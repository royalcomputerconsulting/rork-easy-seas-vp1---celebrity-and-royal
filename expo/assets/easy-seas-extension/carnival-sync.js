(function(global) {
  'use strict';

  if (global.EasySeasCarnivalSync) return;

  var VERSION = '12.4.2';
  var BASE = 'https://www.carnival.com';
  var DEFAULT_PAGE_SIZE = 8;
  var MAX_PAGES_PER_OFFER = 100;

  function compact(value) {
    return String(value == null ? '' : value).replace(/\s+/g, ' ').trim();
  }

  function stripHtml(value) {
    return compact(String(value == null ? '' : value).replace(/<[^>]*>/g, ' '));
  }

  function absolute(href, base) {
    try { return new URL(href, base || global.location.href).toString(); } catch (e) { return ''; }
  }

  function normalizeCode(value) {
    var code = compact(value).toUpperCase();
    return /^[A-Z0-9]{2,10}$/.test(code) ? code : '';
  }

  function parseTgo(value) {
    var out = [];
    var seen = {};
    if (!value) return out;
    String(value).split(';').forEach(function(block) {
      var parts = String(block || '').split(',');
      var code = normalizeCode(parts[0] || '');
      if (!code || seen[code]) return;
      seen[code] = true;
      out.push({ code: code, startDate: compact(parts[1] || ''), endDate: compact(parts[2] || ''), offerName: '', perks: '', bookingLink: '' });
    });
    return out;
  }

  function getOfferItems(data) {
    if (!data) return [];
    if (Array.isArray(data.Items)) return data.Items;
    if (data.raw && Array.isArray(data.raw.Items)) return data.raw.Items;
    if (data.data && Array.isArray(data.data.Items)) return data.data.Items;
    if (Array.isArray(data.offers)) return data.offers;
    if (data.payload && Array.isArray(data.payload.Items)) return data.payload.Items;
    return [];
  }

  function readCookie(name) {
    try {
      var parts = String(document.cookie || '').split(';');
      for (var i = 0; i < parts.length; i++) {
        var part = parts[i].trim();
        if (part.indexOf(name + '=') === 0) return part.substring(name.length + 1);
      }
    } catch (e) {}
    return '';
  }

  function addCatalogEntry(map, code, patch) {
    code = normalizeCode(code);
    if (!code) return;
    var existing = map[code] || {
      code: code,
      startDate: '',
      endDate: '',
      offerName: 'Rate Code ' + code,
      perks: '',
      bookingLink: '',
      actionIndex: -1
    };
    patch = patch || {};
    if (!existing.startDate && patch.startDate) existing.startDate = compact(patch.startDate);
    if (!existing.endDate && patch.endDate) existing.endDate = compact(patch.endDate);
    if ((!existing.offerName || /^Rate Code /i.test(existing.offerName)) && patch.offerName) existing.offerName = compact(patch.offerName).substring(0, 220);
    if (!existing.perks && patch.perks) existing.perks = compact(patch.perks).substring(0, 1800);
    if (!existing.bookingLink && patch.bookingLink) existing.bookingLink = absolute(patch.bookingLink);
    if (existing.actionIndex < 0 && typeof patch.actionIndex === 'number') existing.actionIndex = patch.actionIndex;
    map[code] = existing;
  }

  function inspectUrl(raw, map, state, patch) {
    if (!raw) return;
    try {
      var url = new URL(raw, global.location.href);
      if (url.hostname.indexOf('carnival.com') < 0) return;
      var tgo = url.searchParams.get('tgo') || '';
      var selected = url.searchParams.get('ratecodes') || url.searchParams.get('rateCodes') || '';
      if (tgo) {
        if (!state.tgo) state.tgo = tgo;
        if (!state.personalizedSearchUrl) state.personalizedSearchUrl = url.toString();
        parseTgo(tgo).forEach(function(entry) { addCatalogEntry(map, entry.code, entry); });
      }
      if (selected) {
        selected.split(',').forEach(function(code) {
          addCatalogEntry(map, code, Object.assign({}, patch || {}, { bookingLink: url.toString() }));
        });
        if (!state.personalizedSearchUrl) state.personalizedSearchUrl = url.toString();
      }
      state.vifp = state.vifp || url.searchParams.get('vifp') || '';
      state.tierCode = state.tierCode || url.searchParams.get('tierCode') || '';
      state.resident = state.resident || url.searchParams.get('resident') || '';
      state.locality = state.locality || url.searchParams.get('locality') || '';
      state.currency = state.currency || url.searchParams.get('currency') || '';
    } catch (e) {}
  }

  function discoverCatalog(capturedOffers, authContext) {
    var map = {};
    var state = {
      sourceUrl: global.location.href,
      personalizedSearchUrl: '',
      tgo: '',
      vifp: authContext && authContext.loyaltyId ? String(authContext.loyaltyId) : '',
      tierCode: '',
      resident: '',
      locality: '1',
      currency: 'USD',
      noOffersConfirmed: false,
      actionCards: []
    };

    inspectUrl(global.location.href, map, state);

    var links = document.querySelectorAll('a[href], [data-href], [data-url]');
    for (var i = 0; i < links.length && i < 2000; i++) {
      var raw = links[i].getAttribute('href') || links[i].getAttribute('data-href') || links[i].getAttribute('data-url') || '';
      if (!raw || !/(cruise-search|cruise-deals|tgo=|ratecodes?=)/i.test(raw)) continue;
      var card = links[i].closest('article,section,li,[class*="card" i],[class*="deal" i],[class*="offer" i]');
      var heading = card ? card.querySelector('h1,h2,h3,h4,h5,[class*="title" i]') : null;
      var title = compact(heading ? heading.textContent : links[i].textContent);
      var perks = stripHtml(card ? card.textContent : '');
      inspectUrl(raw, map, state, { offerName: title, perks: perks, bookingLink: raw });
    }

    var items = getOfferItems(capturedOffers);
    for (var ii = 0; ii < items.length; ii++) {
      var item = items[ii] || {};
      var cta = absolute(item.CtaUrl || item.ctaUrl || item.Url || item.url || item.href || '');
      var rateMatch = String(cta || '').match(/[?&]ratecodes?=([A-Z0-9]+)/i);
      var code = normalizeCode(item.RateCode || item.rateCode || item.OfferCode || item.offerCode || (rateMatch ? rateMatch[1] : ''));
      var title = compact(item.Title || item.title || item.Name || item.name || '');
      var description = stripHtml(item.Description || item.description || item.Perks || item.perks || '');
      var subtitle = stripHtml(item.Subtitle || item.subtitle || item.Expiration || item.expiration || '');
      var expiry = '';
      var expiryMatch = subtitle.match(/(?:Book by|Ends|Expires?)\s*:?\s*(.+)/i);
      if (expiryMatch) expiry = compact(expiryMatch[1]);
      if (cta) inspectUrl(cta, map, state, { offerName: title, perks: description, bookingLink: cta, endDate: expiry });
      addCatalogEntry(map, code, { offerName: title, perks: description, bookingLink: cta, endDate: expiry });
    }

    try {
      var tgoCookie = decodeURIComponent(readCookie('tgo') || '');
      if (tgoCookie) {
        var offerMatch = tgoCookie.match(/(?:^|\|)offers=([^|]+)/i);
        var rawTgo = offerMatch ? offerMatch[1] : tgoCookie;
        if (rawTgo.indexOf(',') >= 0) {
          state.tgo = state.tgo || rawTgo;
          parseTgo(rawTgo).forEach(function(entry) { addCatalogEntry(map, entry.code, entry); });
        }
        var pgMatch = tgoCookie.match(/PastGuestNumber=([^|]+)/i);
        if (pgMatch) state.vifp = state.vifp || compact(pgMatch[1]);
      }
    } catch (e) {}

    try {
      var userCookie = readCookie('user');
      if (userCookie) {
        var user = JSON.parse(decodeURIComponent(userCookie));
        state.vifp = state.vifp || compact(user.PastGuestNumber || user.VifpNumber || user.vifpNumber || '');
        state.tierCode = state.tierCode || compact(user.TierCode || user.tierCode || '');
      }
    } catch (e) {}

    var actionEls = document.querySelectorAll('a,button,[role="button"]');
    var actionSeen = {};
    for (var ai = 0; ai < actionEls.length && state.actionCards.length < 80; ai++) {
      var actionText = compact(actionEls[ai].textContent || actionEls[ai].getAttribute('aria-label') || '');
      if (!/^(?:shop now|search cruises|view deal|view offer|view cruises)$/i.test(actionText)) continue;
      var actionCard = actionEls[ai].closest('article,section,li,[class*="card" i],[class*="deal" i],[class*="offer" i]');
      var actionHeading = actionCard ? actionCard.querySelector('h1,h2,h3,h4,h5,[class*="title" i]') : null;
      var actionTitle = compact(actionHeading ? actionHeading.textContent : '');
      var actionHref = absolute(actionEls[ai].getAttribute('href') || actionEls[ai].getAttribute('data-href') || actionEls[ai].getAttribute('data-url') || '');
      var key = (actionTitle + '|' + actionHref + '|' + actionText).toLowerCase();
      if (actionSeen[key]) continue;
      actionSeen[key] = true;
      state.actionCards.push({ index: state.actionCards.length, title: actionTitle, perks: stripHtml(actionCard ? actionCard.textContent : ''), href: actionHref });
      if (actionHref) inspectUrl(actionHref, map, state, { offerName: actionTitle, perks: stripHtml(actionCard ? actionCard.textContent : ''), bookingLink: actionHref, actionIndex: state.actionCards.length - 1 });
    }

    var body = compact(document.body ? document.body.innerText : '');
    state.noOffersConfirmed = /(?:no|zero)\s+(?:special\s+)?(?:offers|deals)\s+(?:available|found)|you do not have any offers/i.test(body);

    var tierMap = { '01': 'Red', '02': 'Gold', '03': 'Platinum', '04': 'Diamond' };
    return {
      sourceUrl: state.sourceUrl,
      personalizedSearchUrl: state.personalizedSearchUrl,
      tgo: state.tgo,
      vifp: state.vifp,
      tierCode: state.tierCode,
      tierName: tierMap[state.tierCode] || '',
      resident: state.resident,
      locality: state.locality || '1',
      currency: state.currency || 'USD',
      rateCodes: Object.keys(map).map(function(code) { return map[code]; }),
      actionCards: state.actionCards,
      noOffersConfirmed: state.noOffersConfirmed
    };
  }

  function buildSearchUrl(catalog, entry, pageNumber) {
    var seed = entry.bookingLink || catalog.personalizedSearchUrl || BASE + '/cruise-search';
    var url;
    try { url = new URL(seed, BASE); } catch (e) { url = new URL(BASE + '/cruise-search'); }
    url.pathname = '/cruise-search';
    url.searchParams.set('pageNumber', String(Math.max(1, pageNumber || 1)));
    url.searchParams.set('numadults', '2');
    url.searchParams.set('ratecodes', entry.code);
    url.searchParams.set('pagesize', String(DEFAULT_PAGE_SIZE));
    url.searchParams.set('sort', 'fromprice');
    url.searchParams.set('showBest', 'true');
    url.searchParams.set('async', 'true');
    url.searchParams.set('currency', catalog.currency || 'USD');
    url.searchParams.set('locality', catalog.locality || '1');
    url.searchParams.set('pastGuest', 'true');
    url.searchParams.set('pastguest', 'true');
    url.searchParams.set('cruisedeals', 'jackpot');
    if (catalog.tgo) url.searchParams.set('tgo', catalog.tgo);
    if (catalog.vifp) url.searchParams.set('vifp', catalog.vifp);
    if (catalog.tierCode) url.searchParams.set('tierCode', catalog.tierCode);
    if (catalog.resident) url.searchParams.set('resident', catalog.resident);
    return url.toString();
  }

  function moneyForTwo(value, context) {
    var n = Number(String(value == null ? '' : value).replace(/[^0-9.\-]/g, ''));
    if (!isFinite(n) || n < 0) return '';
    var text = compact(context).toLowerCase();
    if (/total\s+(?:for|price)|room\s+total|cabin\s+total/.test(text)) return n.toFixed(2);
    return (n * 2).toFixed(2);
  }

  function normalizeDate(value) {
    var raw = compact(value);
    if (!raw) return '';
    var iso = raw.match(/(20\d{2})[-\/]([01]?\d)[-\/]([0-3]?\d)/);
    if (iso) return iso[1] + '-' + String(iso[2]).padStart(2, '0') + '-' + String(iso[3]).padStart(2, '0');
    var d = new Date(raw);
    if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
    return raw;
  }

  function knownShip(text) {
    var match = compact(text).match(/\b(Carnival\s+[A-Z][A-Za-z0-9' -]{2,45}|Mardi Gras)\b/);
    return match ? compact(match[1]) : '';
  }

  function makeSailing(obj, entry, context) {
    if (!obj || typeof obj !== 'object') return null;
    var shipName = compact(obj.shipName || obj.ship || obj.vesselName || obj.vessel || (obj.shipInfo && obj.shipInfo.name) || '');
    if (!shipName) shipName = knownShip(context || JSON.stringify(obj).slice(0, 1400));
    var sailDate = normalizeDate(obj.sailDate || obj.departureDate || obj.startDate || obj.embarkDate || obj.sailingDate || '');
    if (!shipName || !sailDate) return null;
    var itinerary = compact(obj.itineraryName || obj.itinerary || obj.itineraryDescription || obj.destinationName || obj.destination || obj.title || '');
    var port = compact(obj.departurePortName || obj.departurePort || obj.homePort || obj.embarkPort || (obj.port && obj.port.name) || '');
    var nights = Number(String(obj.numberOfNights || obj.nights || obj.duration || obj.durationDays || '').replace(/[^0-9]/g, '')) || 0;
    var priceSource = obj.fromPrice || obj.startingPrice || obj.leadPrice || obj.price || obj.lowestPrice || (obj.pricing && (obj.pricing.fromPrice || obj.pricing.price));
    var contextText = context || JSON.stringify(obj).slice(0, 1800);
    return {
      shipName: shipName,
      shipCode: compact(obj.shipCode || obj.vesselCode || ''),
      sailDate: sailDate,
      sailingDate: sailDate,
      itineraryDescription: itinerary,
      itinerary: itinerary,
      departurePort: port,
      roomType: compact(obj.cabinType || obj.roomType || obj.stateroomType || ''),
      numberOfGuests: 2,
      isGOBO: false,
      numberOfNights: nights,
      totalNights: nights,
      interiorPrice: moneyForTwo(priceSource, contextText),
      taxesAndFees: compact(obj.taxesAndFees || obj.taxes || obj.portFees || ''),
      bookingLink: absolute(obj.bookingLink || obj.url || obj.href || obj.deepLink || ''),
      offerCode: entry.code,
      sourcePage: 'Carnival Players Club Offers'
    };
  }

  function recursiveRows(payload, entry) {
    var rows = [];
    var seen = [];
    var nodes = 0;
    function walk(value, depth) {
      if (!value || depth > 10 || nodes > 40000 || typeof value !== 'object') return;
      nodes++;
      if (seen.indexOf(value) >= 0) return;
      seen.push(value);
      var row = makeSailing(value, entry, JSON.stringify(value).slice(0, 2000));
      if (row) rows.push(row);
      if (Array.isArray(value)) {
        for (var i = 0; i < value.length && i < 3000; i++) walk(value[i], depth + 1);
      } else {
        Object.keys(value).slice(0, 300).forEach(function(key) {
          if (/image|icon|html|analytics|tracking|descriptionHtml/i.test(key)) return;
          walk(value[key], depth + 1);
        });
      }
    }
    walk(payload, 0);
    return rows;
  }

  function extractDates(text) {
    var out = [];
    var seen = {};
    var patterns = [
      /\b(20\d{2}-\d{2}-\d{2})\b/g,
      /\b((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*\s+\d{1,2},?\s+20\d{2})\b/gi,
      /\b(\d{1,2}\/\d{1,2}\/20\d{2})\b/g
    ];
    patterns.forEach(function(re) {
      var m;
      while ((m = re.exec(text || '')) !== null) {
        var value = normalizeDate(m[1]);
        if (value && !seen[value]) { seen[value] = true; out.push(value); }
      }
    });
    return out;
  }

  function domRows(doc, entry) {
    var rows = [];
    var candidates = [];
    var selectors = ['[data-testid*="cruise-result"]','[data-testid*="sailing"]','[class*="CruiseCard"]','[class*="cruise-card"]','[class*="SearchResult"]','[class*="search-result"]','article','li'];
    for (var si = 0; si < selectors.length; si++) {
      var found = doc.querySelectorAll(selectors[si]);
      for (var fi = 0; fi < found.length && candidates.length < 800; fi++) {
        var text = compact(found[fi].textContent);
        if (text.length < 40 || text.length > 6000) continue;
        if (!/(Carnival|\d+[- ](?:Day|Night)|View Itinerary|average per person|from \$)/i.test(text)) continue;
        if (candidates.indexOf(found[fi]) < 0) candidates.push(found[fi]);
      }
      if (candidates.length && si < 5) break;
    }
    candidates.forEach(function(card) {
      var text = compact(card.textContent);
      var shipName = knownShip(text);
      if (!shipName) return;
      var heading = card.querySelector('h1,h2,h3,h4,h5,[class*="title" i]');
      var title = compact(heading ? heading.textContent : '');
      var nightsMatch = (title + ' ' + text).match(/(\d{1,2})[- ](?:Day|Night)/i);
      var nights = nightsMatch ? Number(nightsMatch[1]) : 0;
      var portMatch = (title + ' ' + text).match(/(?:from|Start:)\s*([^•|\n]+?)(?:,\s*[A-Z]{2}|\s*>|\s*to|\s*\$|$)/i);
      var port = portMatch ? compact(portMatch[1]) : '';
      var priceMatch = text.match(/\$\s*([0-9][0-9,]*(?:\.[0-9]{1,2})?)/);
      var price = priceMatch ? moneyForTwo(priceMatch[1], text) : '';
      var dates = extractDates(text);
      var links = card.querySelectorAll('a[href]');
      var bookingLink = '';
      for (var li = 0; li < links.length; li++) {
        var href = absolute(links[li].getAttribute('href') || '', BASE);
        if (href) bookingLink = href;
        dates = dates.concat(extractDates(href));
      }
      var uniqueDates = {};
      dates.forEach(function(date) {
        if (!date || uniqueDates[date]) return;
        uniqueDates[date] = true;
        rows.push({
          shipName: shipName, shipCode: '', sailDate: date, sailingDate: date,
          itineraryDescription: title || text.slice(0, 220), itinerary: title || text.slice(0, 220),
          departurePort: port, roomType: '', numberOfGuests: 2, isGOBO: false,
          numberOfNights: nights, totalNights: nights, interiorPrice: price,
          taxesAndFees: '', bookingLink: bookingLink, offerCode: entry.code,
          sourcePage: 'Carnival Players Club Offers'
        });
      });
    });
    return rows;
  }

  function parseResponseText(text, contentType, entry) {
    var rows = [];
    var total = 0;
    var trimmed = String(text || '').trim();
    if (!trimmed) return { rows: [], totalResults: 0 };
    if (/json/i.test(contentType || '') || /^[\[{]/.test(trimmed)) {
      try {
        var payload = JSON.parse(trimmed);
        rows = recursiveRows(payload, entry);
        total = Number(payload.totalResults || payload.totalCount || payload.count || (payload.data && (payload.data.totalResults || payload.data.totalCount)) || 0) || 0;
        return { rows: rows, totalResults: total };
      } catch (e) {}
    }
    var doc;
    try { doc = new DOMParser().parseFromString(trimmed, 'text/html'); } catch (e) { return { rows: [], totalResults: 0 }; }
    rows = domRows(doc, entry);
    var resultText = compact(doc.body ? doc.body.textContent : '');
    var totalMatch = resultText.match(/([0-9][0-9,]*)\s+Cruise Results?/i);
    total = totalMatch ? Number(totalMatch[1].replace(/,/g, '')) : 0;
    var scripts = doc.querySelectorAll('script[type="application/json"],script#__NEXT_DATA__,script');
    for (var i = 0; i < scripts.length && i < 80; i++) {
      var scriptText = scripts[i].textContent || '';
      if (!scriptText || scriptText.length > 4000000 || !/(sailDate|departureDate|shipName|vesselName|embarkDate)/i.test(scriptText)) continue;
      try { rows = rows.concat(recursiveRows(JSON.parse(scriptText), entry)); } catch (e) {}
    }
    return { rows: rows, totalResults: total };
  }

  function dedupeSailings(rows) {
    var out = [];
    var seen = {};
    rows.forEach(function(row) {
      var key = [row.offerCode || '', row.shipName || '', row.sailDate || row.sailingDate || '', row.itineraryDescription || row.itinerary || '', row.departurePort || ''].join('|').toLowerCase();
      if (!row.shipName || !(row.sailDate || row.sailingDate) || seen[key]) return;
      seen[key] = true;
      out.push(row);
    });
    return out;
  }

  async function fetchOffer(catalog, entry, onProgress) {
    var allRows = [];
    var page = 1;
    var pages = 1;
    var firstUrl = '';
    var lastError = '';
    while (page <= pages && page <= MAX_PAGES_PER_OFFER) {
      var url = buildSearchUrl(catalog, entry, page);
      if (!firstUrl) firstUrl = url;
      if (onProgress) onProgress({ stage: 'offer-page', code: entry.code, title: entry.offerName, page: page, pages: pages, url: url });
      try {
        var response = await fetch(url, { method: 'GET', credentials: 'include', cache: 'no-store', headers: { 'accept': 'application/json,text/html,application/xhtml+xml' } });
        if (!response.ok) throw new Error('HTTP ' + response.status);
        var contentType = response.headers.get('content-type') || '';
        var text = await response.text();
        var parsed = parseResponseText(text, contentType, entry);
        allRows = allRows.concat(parsed.rows || []);
        if (page === 1 && parsed.totalResults > 0) pages = Math.max(1, Math.ceil(parsed.totalResults / DEFAULT_PAGE_SIZE));
        if (page > 1 && (!parsed.rows || parsed.rows.length === 0)) break;
        if (page === 1 && parsed.totalResults === 0 && (!parsed.rows || parsed.rows.length < DEFAULT_PAGE_SIZE)) pages = 1;
      } catch (e) {
        lastError = e && e.message ? e.message : String(e);
        break;
      }
      page++;
    }
    return { code: entry.code, title: entry.offerName || ('Rate Code ' + entry.code), perks: entry.perks || '', expiry: entry.endDate || '', url: firstUrl, error: lastError, rows: dedupeSailings(allRows) };
  }

  async function scrapeAllOffers(catalog, onProgress) {
    var offers = [];
    var allRows = [];
    var failures = [];
    for (var i = 0; i < catalog.rateCodes.length; i++) {
      var entry = catalog.rateCodes[i];
      if (onProgress) onProgress({ stage: 'offer-start', index: i + 1, total: catalog.rateCodes.length, code: entry.code, title: entry.offerName || '' });
      var result = await fetchOffer(catalog, entry, onProgress);
      if (result.error && result.rows.length === 0) failures.push({ code: entry.code, error: result.error });
      allRows = allRows.concat(result.rows);
      offers.push({
        campaignOffer: {
          offerCode: entry.code,
          name: entry.offerName || ('Rate Code ' + entry.code),
          offerName: entry.offerName || ('Rate Code ' + entry.code),
          reserveByDate: entry.endDate || '',
          expirationDate: entry.endDate || '',
          offerType: 'Carnival Players Club',
          perks: entry.perks || '',
          perkCodes: entry.perks ? [{ perkName: entry.perks }] : [],
          bookingLink: entry.bookingLink || result.url || '',
          sailings: result.rows
        }
      });
      if (onProgress) onProgress({ stage: 'offer-complete', index: i + 1, total: catalog.rateCodes.length, code: entry.code, rows: result.rows.length, error: result.error || '' });
    }
    return { offers: offers, rows: dedupeSailings(allRows), failures: failures, catalog: catalog, source: 'carnival' };
  }

  function parseProfileDocument() {
    var body = compact(document.body ? document.body.innerText : '');
    var vifpMatch = body.match(/VIFP\s*(?:Club)?\s*#?\s*:?[\s#]*(\d{6,15})/i);
    var tierMatch = body.match(/(?:TIER\s+|VIFP\s+)(BLUE|RED|GOLD|PLATINUM|DIAMOND)/i);
    var cruiseDayMatch = body.match(/([0-9][0-9,]*)\s+Cruise Day Points/i);
    var vifpPointsMatch = body.match(/([0-9][0-9,]*)\s+VIFP Points(?!\s+until)/i);
    var totalCruisesMatch = body.match(/([0-9][0-9,]*)\s+TOTAL CRUISES/i);
    var playersTierMatch = body.match(/Players Club\s*:?\s*(Blue|Red|Gold|Platinum|Diamond)/i);
    var playersPointsMatch = body.match(/([0-9][0-9,]*)\s+Players (?:Club )?Pts/i);
    var nameMatch = body.match(/WELCOME BACK\s+([A-Z][A-Z' -]+)\s+([A-Z][A-Z' -]+)/i);
    var profile = {
      firstName: nameMatch ? compact(nameMatch[1]) : '',
      lastName: nameMatch ? compact(nameMatch[2]) : '',
      vifpNumber: vifpMatch ? vifpMatch[1] : '',
      vifpTier: tierMatch ? tierMatch[1][0] + tierMatch[1].slice(1).toLowerCase() : '',
      vifpPoints: vifpPointsMatch ? Number(vifpPointsMatch[1].replace(/,/g, '')) : 0,
      cruiseDayPoints: cruiseDayMatch ? Number(cruiseDayMatch[1].replace(/,/g, '')) : 0,
      totalCruises: totalCruisesMatch ? Number(totalCruisesMatch[1].replace(/,/g, '')) : 0,
      playersClubTier: playersTierMatch ? playersTierMatch[1] : '',
      playersClubPoints: playersPointsMatch ? Number(playersPointsMatch[1].replace(/,/g, '')) : 0
    };

    var bookings = [];
    var rows = document.querySelectorAll('table tr, [role="row"]');
    for (var i = 0; i < rows.length; i++) {
      var text = compact(rows[i].textContent);
      var dateMatch = text.match(/\b(\d{1,2}\/\d{1,2}\/20\d{2}|20\d{2}-\d{2}-\d{2})\b/);
      var ship = knownShip(text);
      if (!dateMatch || !ship) continue;
      var cells = rows[i].querySelectorAll('td,[role="cell"]');
      var destination = cells.length > 2 ? compact(cells[2].textContent) : '';
      var bookingId = cells.length > 3 ? compact(cells[3].textContent) : '';
      var pointsMatch = text.match(/\+?\s*([0-9]+(?:\.[0-9]+)?)\s*$/);
      bookings.push({
        shipName: ship,
        sailDate: normalizeDate(dateMatch[1]),
        departureDate: normalizeDate(dateMatch[1]),
        itineraryDescription: destination,
        cruiseTitle: destination,
        bookingId: bookingId,
        reservationNumber: bookingId,
        bookingStatus: 'completed',
        status: 'completed',
        completionState: 'completed',
        isBooked: true,
        cruisePointsEarned: pointsMatch ? Number(pointsMatch[1]) : 0,
        sourcePage: 'Carnival Cruise History',
        cruiseSource: 'carnival'
      });
    }
    return { profile: profile, bookings: bookings };
  }

  function mergeBookings(existingData, domBookings) {
    var existing = [];
    if (existingData) {
      if (Array.isArray(existingData)) existing = existingData;
      else if (Array.isArray(existingData.bookings)) existing = existingData.bookings;
      else if (Array.isArray(existingData.cruises)) existing = existingData.cruises;
      else if (Array.isArray(existingData.reservations)) existing = existingData.reservations;
      else if (existingData.payload && Array.isArray(existingData.payload.bookings)) existing = existingData.payload.bookings;
    }
    var out = [];
    var seen = {};
    existing.concat(domBookings || []).forEach(function(row) {
      if (!row) return;
      var ship = compact(row.shipName || row.ship || row.vesselName || '');
      var date = normalizeDate(row.sailDate || row.departureDate || row.startDate || '');
      var id = compact(row.bookingId || row.reservationNumber || row.confirmationNumber || '');
      var key = (id || (ship + '|' + date)).toLowerCase();
      if (!key || seen[key]) return;
      seen[key] = true;
      var copy = Object.assign({}, row);
      copy.shipName = ship || copy.shipName;
      copy.sailDate = date || copy.sailDate;
      copy.departureDate = date || copy.departureDate;
      copy.cruiseSource = 'carnival';
      copy.sourcePage = copy.sourcePage || 'Carnival My Cruises';
      out.push(copy);
    });
    return out;
  }

  global.EasySeasCarnivalSync = {
    version: VERSION,
    getOfferItems: getOfferItems,
    getOfferCount: function(data) {
      if (!data) return 0;
      if (Array.isArray(data.offers)) return data.offers.length;
      return getOfferItems(data).length;
    },
    parseTgo: parseTgo,
    discoverCatalog: discoverCatalog,
    buildSearchUrl: buildSearchUrl,
    scrapeAllOffers: scrapeAllOffers,
    parseProfileDocument: parseProfileDocument,
    mergeBookings: mergeBookings
  };
})(window);
