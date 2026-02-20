export const CARNIVAL_OFFERS_SCRIPT = `
(function() {
  var BATCH_SIZE = 150;

  var CARNIVAL_SHIPS = [
    'Carnival Breeze', 'Carnival Celebration', 'Carnival Conquest', 'Carnival Dream',
    'Carnival Elation', 'Carnival Fascination', 'Carnival Firenze', 'Carnival Freedom',
    'Carnival Glory', 'Carnival Horizon', 'Carnival Imagination', 'Carnival Inspiration',
    'Carnival Jubilee', 'Carnival Legend', 'Carnival Liberty', 'Carnival Luminosa',
    'Carnival Magic', 'Mardi Gras', 'Carnival Miracle', 'Carnival Panorama',
    'Carnival Paradise', 'Carnival Pride', 'Carnival Radiance', 'Carnival Sensation',
    'Carnival Spirit', 'Carnival Splendor', 'Carnival Sunrise', 'Carnival Sunshine',
    'Carnival Valor', 'Carnival Venice', 'Carnival Vista'
  ];
  var SHIP_PATTERN = new RegExp('(' + CARNIVAL_SHIPS.map(function(s) { return s.replace(/\\s+/g, '\\\\s+'); }).join('|') + ')', 'i');

  function wait(ms) { return new Promise(function(r) { setTimeout(r, ms); }); }

  function log(message, type) {
    try {
      window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'log', message: message, logType: type || 'info' }));
    } catch(e) {}
  }

  function sendBatch(offers, isFinal, totalCount, offerCount) {
    try {
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: isFinal ? 'step_complete' : 'offers_batch',
        step: 1,
        data: offers,
        isFinal: !!isFinal,
        totalCount: totalCount || 0,
        offerCount: offerCount || 0
      }));
    } catch(e) {}
  }

  function progress(current, total, stepName) {
    try {
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'progress', current: current, total: total, stepName: stepName
      }));
    } catch(e) {}
  }

  function getCookie(name) {
    try {
      var cookies = document.cookie.split(';');
      for (var i = 0; i < cookies.length; i++) {
        var c = cookies[i].trim();
        if (c.indexOf(name + '=') === 0) {
          return c.substring(name.length + 1);
        }
      }
    } catch(e) {}
    return null;
  }

  function parseCarnivalUserCookie() {
    try {
      var raw = getCookie('user');
      if (!raw) return null;
      var decoded = decodeURIComponent(raw);
      return JSON.parse(decoded);
    } catch(e) {
      return null;
    }
  }

  function parseTgoCookie() {
    try {
      var raw = getCookie('tgo');
      if (!raw) return null;
      var decoded = decodeURIComponent(raw);
      var parts = decoded.split('|');
      var offers = [];
      var vifpNumber = '';
      for (var pi = 0; pi < parts.length; pi++) {
        var part = parts[pi];
        if (part.indexOf('offers=') === 0) {
          var offerStr = part.substring(7);
          var offerParts = offerStr.split(';');
          for (var oi = 0; oi < offerParts.length; oi++) {
            var fields = offerParts[oi].split(',');
            if (fields.length >= 3) {
              offers.push({ code: fields[0], startDate: fields[1], endDate: fields[2] });
            }
          }
        } else if (part.indexOf('PastGuestNumber=') === 0) {
          vifpNumber = part.substring(16);
        }
      }
      return { offers: offers, vifpNumber: vifpNumber };
    } catch(e) {
      return null;
    }
  }

  function formatSailDate(dateStr) {
    if (!dateStr) return '';
    try {
      var date = new Date(dateStr);
      if (isNaN(date.getTime())) return dateStr;
      var month = String(date.getMonth() + 1).padStart(2, '0');
      var day = String(date.getDate()).padStart(2, '0');
      var year = date.getFullYear();
      return month + '/' + day + '/' + year;
    } catch(e) { return dateStr; }
  }

  function formatDate(dateStr) {
    if (!dateStr) return '';
    try {
      var date = new Date(dateStr);
      if (isNaN(date.getTime())) return dateStr;
      var months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
      return months[date.getMonth()] + ' ' + date.getDate() + ', ' + date.getFullYear();
    } catch(e) { return dateStr; }
  }

  function safeStr(val) {
    if (val === null || val === undefined) return '';
    if (typeof val === 'string') return val;
    if (typeof val === 'object') return val.name || val.description || val.code || val.text || '';
    return String(val);
  }

  function buildAuthHeaders() {
    var headers = { 'accept': 'application/json', 'content-type': 'application/json' };
    var loyaltyId = '';
    try {
      var keys = Object.keys(localStorage || {});
      for (var i = 0; i < keys.length; i++) {
        var k = keys[i];
        try {
          var v = localStorage.getItem(k);
          if (!v || v.length < 30) continue;
          var parsed = JSON.parse(v);
          if (parsed && parsed.token) {
            var token = typeof parsed.token === 'string' ? JSON.parse(parsed.token) : parsed.token;
            var user = parsed.user ? (typeof parsed.user === 'string' ? JSON.parse(parsed.user) : parsed.user) : null;
            if (token && user && user.accountId) {
              var rawAuth = token.toString ? token.toString() : String(token);
              headers['authorization'] = rawAuth.startsWith('Bearer ') ? rawAuth : 'Bearer ' + rawAuth;
              headers['account-id'] = user.accountId;
              if (user.cruiseLoyaltyId) loyaltyId = user.cruiseLoyaltyId;
              break;
            }
          }
        } catch(e2) {}
      }
    } catch(e) {}
    return { headers: headers, loyaltyId: loyaltyId };
  }

  async function tryCasinoOffersAPI(loyaltyId) {
    try {
      log('Trying casino offers API with cookie auth...', 'info');
      var auth = buildAuthHeaders();
      if (!loyaltyId && auth.loyaltyId) loyaltyId = auth.loyaltyId;

      var controller = new AbortController();
      var timeoutId = setTimeout(function() { controller.abort(); }, 12000);

      var response = await fetch('/api/casino/casino-offers/v1', {
        method: 'POST',
        headers: auth.headers,
        credentials: 'include',
        signal: controller.signal,
        body: JSON.stringify({ cruiseLoyaltyId: loyaltyId || '', offerCode: '', brand: 'CCL' })
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        var data = await response.json();
        if (data && data.offers && data.offers.length > 0) {
          log('Casino offers API returned ' + data.offers.length + ' offers!', 'success');
          return data;
        }
        log('Casino offers API returned empty (status ' + response.status + ')', 'info');
      } else {
        log('Casino offers API returned ' + response.status + ' - not available on carnival.com', 'info');
      }
      return null;
    } catch(e) {
      if (e.name === 'AbortError') {
        log('Casino offers API timed out - not available on carnival.com', 'info');
      } else {
        log('Casino offers API error: ' + (e.message || e), 'info');
      }
      return null;
    }
  }

  function processRCStyleOffers(data) {
    var allRows = [];
    if (!data || !Array.isArray(data.offers)) return { rows: allRows, count: 0 };
    var validOffers = data.offers.filter(function(o) { return o && o.campaignOffer; });

    for (var i = 0; i < validOffers.length; i++) {
      var offer = validOffers[i];
      var co = offer.campaignOffer;
      var offerName = co.name || '';
      var offerCode = co.offerCode || '';
      var offerExpiry = formatDate(co.reserveByDate);
      var tradeInValue = co.tradeInValue ? '$' + Number(co.tradeInValue).toFixed(2) : '';
      var perks = tradeInValue ? 'Trade-in value: ' + tradeInValue : '';
      var sailings = co.sailings || [];

      log('Offer ' + (i+1) + '/' + validOffers.length + ': ' + offerName + ' (' + offerCode + ') - ' + sailings.length + ' sailings', 'info');

      if (sailings.length === 0) {
        allRows.push({
          sourcePage: 'Offers', offerName: offerName, offerCode: offerCode,
          offerExpirationDate: offerExpiry, offerType: 'VIFP Club',
          shipName: '', shipCode: '', sailingDate: '', itinerary: '',
          departurePort: '', cabinType: '', numberOfGuests: '2', perks: perks,
          loyaltyLevel: '', loyaltyPoints: '', interiorPrice: '', oceanviewPrice: '',
          balconyPrice: '', suitePrice: '', taxesAndFees: '', portList: '',
          dayByDayItinerary: [], destinationName: '', totalNights: null, bookingLink: ''
        });
        continue;
      }

      for (var j = 0; j < sailings.length; j++) {
        var s = sailings[j];
        allRows.push({
          sourcePage: 'Offers', offerName: offerName, offerCode: offerCode,
          offerExpirationDate: offerExpiry, offerType: 'VIFP Club',
          shipName: s.shipName || '', shipCode: s.shipCode || '',
          sailingDate: formatSailDate(s.sailDate),
          itinerary: safeStr(s.itineraryDescription || (s.sailingType && s.sailingType.name) || ''),
          departurePort: safeStr((s.departurePort && s.departurePort.name) || s.departurePortName || ''),
          cabinType: safeStr(s.roomType || s.stateroomType || ''),
          numberOfGuests: (s.isGOBO || co.isGOBO) ? '1' : '2',
          perks: perks, loyaltyLevel: '', loyaltyPoints: '',
          interiorPrice: '', oceanviewPrice: '', balconyPrice: '', suitePrice: '',
          taxesAndFees: '', portList: '',
          dayByDayItinerary: [], destinationName: '', totalNights: null, bookingLink: ''
        });
      }
    }
    return { rows: allRows, count: validOffers.length };
  }

  function convertVifpOffers(vifpData) {
    var rows = [];
    if (!vifpData || !Array.isArray(vifpData.Items)) return rows;
    for (var i = 0; i < vifpData.Items.length; i++) {
      var item = vifpData.Items[i];
      var rateCode = '';
      try {
        var m = (item.CtaUrl || '').match(/rateCodes=([A-Z0-9]+)/i);
        if (m) rateCode = m[1];
      } catch(e) {}
      var expiry = '';
      try {
        var m2 = (item.Subtitle || '').match(/Book by (.+)/i);
        if (m2) expiry = m2[1].trim();
      } catch(e) {}
      var desc = (item.Description || '').replace(/<[^>]*>/g, ' ').replace(/\\s+/g, ' ').trim();
      rows.push({
        sourcePage: 'Offers', offerName: item.Title || 'Carnival VIFP Offer',
        offerCode: rateCode, offerExpirationDate: expiry, offerType: 'VIFP Club',
        shipName: '', shipCode: '', sailingDate: '', itinerary: '',
        departurePort: '', cabinType: '', numberOfGuests: '2',
        perks: desc.substring(0, 200), loyaltyLevel: '', loyaltyPoints: '',
        interiorPrice: item.Price ? '$' + Number(item.Price).toFixed(2) : '',
        oceanviewPrice: '', balconyPrice: '', suitePrice: '', taxesAndFees: '',
        portList: '', dayByDayItinerary: [], destinationName: '',
        totalNights: null, bookingLink: item.CtaUrl || '',
        carnivalOfferId: item.OfferId || ''
      });
    }
    return rows;
  }

  function tryExtractFromNextData() {
    try {
      var el = document.getElementById('__NEXT_DATA__');
      if (!el) return [];
      var pageData = JSON.parse(el.textContent || '');
      var props = pageData && pageData.props && pageData.props.pageProps;
      if (!props) return [];
      log('Found __NEXT_DATA__ on page, scanning for deals...', 'info');
      var keys = Object.keys(props);
      for (var ki = 0; ki < keys.length; ki++) {
        var val = props[keys[ki]];
        if (Array.isArray(val) && val.length > 0 && val[0]) {
          var first = val[0];
          if (first.shipName || first.ship || first.sailDate || first.departureDate ||
              first.price || first.startingPrice || first.cruiseTitle || first.itinerary) {
            log('Found ' + val.length + ' deals in __NEXT_DATA__.' + keys[ki], 'success');
            var rows = [];
            for (var vi = 0; vi < val.length; vi++) {
              var item = val[vi];
              var price = item.price || item.startingPrice || item.lowestPrice || 0;
              rows.push({
                sourcePage: 'Offers',
                offerName: item.cruiseTitle || item.title || item.name || 'Carnival Cruise Deal',
                offerCode: item.rateCode || item.offerCode || '',
                offerExpirationDate: '',
                offerType: 'Cruise Deal',
                shipName: item.shipName || item.ship || '',
                shipCode: item.shipCode || '',
                sailingDate: formatSailDate(item.sailDate || item.departureDate || item.startDate || ''),
                itinerary: item.itinerary || item.destination || item.destinationName || '',
                departurePort: item.departurePort || item.homePort || '',
                cabinType: '',
                numberOfGuests: '2',
                perks: '',
                loyaltyLevel: '', loyaltyPoints: '',
                interiorPrice: price ? '$' + Number(price).toFixed(2) : '',
                oceanviewPrice: '', balconyPrice: '', suitePrice: '', taxesAndFees: '',
                portList: Array.isArray(item.ports) ? item.ports.map(function(p) { return typeof p === 'string' ? p : (p.name || ''); }).join(', ') : '',
                dayByDayItinerary: [],
                destinationName: item.destination || item.destinationName || '',
                totalNights: item.duration || item.nights || item.numberOfNights || null,
                bookingLink: item.bookingUrl || item.url || item.productViewLink || ''
              });
            }
            return rows;
          }
        }
      }
    } catch(e) {
      log('__NEXT_DATA__ parse error: ' + (e.message || e), 'warning');
    }
    return [];
  }

  function scrapeDealCardsFromDOM() {
    var deals = [];
    log('Attempting DOM scrape of cruise deals page...', 'info');

    var selectorList = [
      '[data-testid*="deal"], [data-testid*="cruise"], [data-testid*="offer"]',
      '[class*="DealCard"], [class*="deal-card"], [class*="dealCard"]',
      '[class*="CruiseCard"], [class*="cruise-card"], [class*="cruiseCard"]',
      '[class*="OfferCard"], [class*="offer-card"], [class*="offerCard"]',
      '[class*="SearchResult"], [class*="search-result"]',
      'article[class*="deal"], article[class*="cruise"]',
      '[class*="tile"][class*="cruise"], [class*="tile"][class*="deal"]'
    ];

    var cards = [];
    for (var si = 0; si < selectorList.length; si++) {
      try {
        var found = document.querySelectorAll(selectorList[si]);
        if (found.length > 1) {
          cards = found;
          log('Found ' + found.length + ' deal elements: ' + selectorList[si], 'info');
          break;
        }
      } catch(e) {}
    }

    if (cards.length === 0) {
      try {
        var cruiseLinks = document.querySelectorAll('a[href*="/cruise-search"], a[href*="/booking"], a[href*="itineraryCode"], a[href*="/cruise-deals/"]');
        if (cruiseLinks.length > 1) {
          log('Found ' + cruiseLinks.length + ' cruise links - checking parent cards', 'info');
          var parents = [];
          for (var li = 0; li < cruiseLinks.length; li++) {
            var parent = cruiseLinks[li].closest('article, section, [class*="card"], [class*="Card"], [class*="tile"], [class*="Tile"], [class*="deal"], [class*="Deal"]');
            if (parent && parents.indexOf(parent) === -1) parents.push(parent);
          }
          if (parents.length > 0) cards = parents;
        }
      } catch(e) {}
    }

    if (cards.length === 0) {
      try {
        var allEls = document.querySelectorAll('section, article, [role="listitem"], [class*="card"], [class*="Card"]');
        var shipEls = [];
        for (var ei = 0; ei < allEls.length; ei++) {
          var txt = (allEls[ei].textContent || '').substring(0, 500);
          if (SHIP_PATTERN.test(txt) && txt.match(/\\$\\s*[\\d,]+/)) {
            shipEls.push(allEls[ei]);
          }
        }
        if (shipEls.length > 0) {
          cards = shipEls;
          log('Found ' + shipEls.length + ' elements with ship names + prices', 'info');
        }
      } catch(e) {}
    }

    for (var i = 0; i < cards.length; i++) {
      try {
        var card = cards[i];
        var text = (card.textContent || '').replace(/\\s+/g, ' ').trim();
        if (text.length < 15) continue;

        var shipMatch = text.match(SHIP_PATTERN);
        var shipName = shipMatch ? shipMatch[1] : '';

        var dateMatch = text.match(/((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\\.?\\s+\\d{1,2},?\\s+\\d{4})/i);
        if (!dateMatch) dateMatch = text.match(/(\\d{1,2}\\/\\d{1,2}\\/\\d{2,4})/);
        if (!dateMatch) dateMatch = text.match(/(\\d{4}-\\d{2}-\\d{2})/);
        var sailDate = dateMatch ? dateMatch[1] : '';

        var nightsMatch = text.match(/(\\d+)\\s*[-\\s]?\\s*(?:Night|night|Nite|Day)/i);
        var nights = nightsMatch ? nightsMatch[1] : '';

        var priceMatch = text.match(/\\$\\s*([\\d,]+)/);
        var price = priceMatch ? '$' + priceMatch[1].replace(/,/g, '') : '';

        var destMatch = text.match(/((?:Western|Eastern|Southern)?\\s*Caribbean|Bahamas|Mexico|Alaska|Hawaii|Bermuda|Europe|Mediterranean|Panama Canal|Transatlantic|Canada|New England|Cuba|Riviera)/i);
        var destination = destMatch ? destMatch[1].trim() : '';

        var portMatch = text.match(/(?:from|departing|departs?|sailing from)\\s+([A-Z][a-z]+(?:\\s+[A-Z][a-z]+)*(?:,\\s*[A-Z]{2})?)/i);
        var port = portMatch ? portMatch[1] : '';

        var rateCode = '';
        try {
          var links = card.querySelectorAll('a[href]');
          for (var li2 = 0; li2 < links.length; li2++) {
            var href = links[li2].getAttribute('href') || '';
            var rcMatch = href.match(/rateCodes?=([A-Z0-9]+)/i);
            if (rcMatch) { rateCode = rcMatch[1]; break; }
          }
        } catch(e3) {}

        if (shipName || (sailDate && nights) || (price && nights) || (shipName && price)) {
          deals.push({
            sourcePage: 'Offers',
            offerName: (destination || 'Carnival') + (nights ? ' ' + nights + '-Night' : '') + ' Cruise Deal',
            offerCode: rateCode,
            offerExpirationDate: '',
            offerType: 'Cruise Deal',
            shipName: shipName,
            shipCode: '',
            sailingDate: sailDate,
            itinerary: destination,
            departurePort: port,
            cabinType: '',
            numberOfGuests: '2',
            perks: '',
            loyaltyLevel: '', loyaltyPoints: '',
            interiorPrice: price,
            oceanviewPrice: '', balconyPrice: '', suitePrice: '', taxesAndFees: '',
            portList: '',
            dayByDayItinerary: [],
            destinationName: destination,
            totalNights: nights ? parseInt(nights) : null,
            bookingLink: ''
          });
        }
      } catch(e) {}
    }

    return deals;
  }

  async function extractCarnivalOffers() {
    try {
      log('Starting Carnival offer extraction...', 'info');

      var userCookie = parseCarnivalUserCookie();
      var tgoCookie = parseTgoCookie();

      if (userCookie) {
        log('Found Carnival user: ' + (userCookie.FirstName || '') + ' ' + (userCookie.LastName || ''), 'success');
        log('   VIFP#: ' + (userCookie.PastGuestNumber || 'N/A') + ', Tier: ' + (userCookie.TierCode || 'N/A'), 'info');
        try {
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'carnival_user_data', data: userCookie
          }));
        } catch(e) {}
      } else {
        log('No Carnival user cookie found - using cookie-based auth', 'info');
      }

      if (tgoCookie && tgoCookie.offers.length > 0) {
        log('Found ' + tgoCookie.offers.length + ' rate codes from TGO cookie', 'success');
      }

      var loyaltyId = '';
      if (userCookie && userCookie.PastGuestNumber) loyaltyId = userCookie.PastGuestNumber;
      else if (tgoCookie && tgoCookie.vifpNumber) loyaltyId = tgoCookie.vifpNumber;

      progress(0, 100, 'Starting Carnival offer extraction...');

      // Strategy 1: Check already-captured VIFP offers from network interception
      var vifpSource = window.__carnivalVifpOffers || (window.capturedPayloads && window.capturedPayloads.carnivalVifpOffers);
      if (vifpSource) {
        var immediateRows = convertVifpOffers(vifpSource);
        if (immediateRows.length > 0) {
          log('Found pre-captured VIFP offers: ' + immediateRows.length, 'success');
          sendBatch(immediateRows, false);
          sendBatch([], true, immediateRows.length, immediateRows.length);
          return;
        }
      }

      // Strategy 2: Try casino offers API (works if carnival.com has this endpoint)
      progress(5, 100, 'Trying Carnival offers API...');
      var casinoData = await tryCasinoOffersAPI(loyaltyId);
      if (casinoData && casinoData.offers && casinoData.offers.length > 0) {
        log('Processing casino offers API data...', 'info');
        var result = processRCStyleOffers(casinoData);
        for (var k = 0; k < result.rows.length; k += BATCH_SIZE) {
          sendBatch(result.rows.slice(k, k + BATCH_SIZE), false);
        }
        sendBatch([], true, result.rows.length, result.count);
        log('Offers complete: ' + result.rows.length + ' sailings from ' + result.count + ' offers', 'success');
        return;
      }

      // Strategy 3: Wait for VIFP offers from page API calls (network interception)
      log('Waiting for Carnival page to load offers data...', 'info');
      for (var wi = 0; wi < 12; wi++) {
        await wait(2500);
        progress(15 + (wi * 5), 100, 'Waiting for Carnival offers (' + ((wi + 1) * 2.5).toFixed(0) + 's)...');

        var captured = window.__carnivalVifpOffers || (window.capturedPayloads && window.capturedPayloads.carnivalVifpOffers);
        if (captured) {
          var rows = convertVifpOffers(captured);
          if (rows.length > 0) {
            sendBatch(rows, false);
            sendBatch([], true, rows.length, rows.length);
            log('VIFP offers captured: ' + rows.length + ' offers', 'success');
            return;
          }
        }
      }

      // Strategy 4: Try __NEXT_DATA__
      progress(80, 100, 'Checking page data...');
      var nextDataRows = tryExtractFromNextData();
      if (nextDataRows.length > 0) {
        sendBatch(nextDataRows, false);
        sendBatch([], true, nextDataRows.length, nextDataRows.length);
        log('Extracted ' + nextDataRows.length + ' deals from page data', 'success');
        return;
      }

      // Strategy 5: DOM scraping
      progress(85, 100, 'Scraping page for deals...');
      var domDeals = scrapeDealCardsFromDOM();
      if (domDeals.length > 0) {
        sendBatch(domDeals, false);
        sendBatch([], true, domDeals.length, domDeals.length);
        log('Scraped ' + domDeals.length + ' deals from page', 'success');
        return;
      }

      // Strategy 6: TGO cookie fallback
      if (tgoCookie && tgoCookie.offers.length > 0) {
        log('Creating offers from TGO cookie rate codes...', 'info');
        var cookieRows = [];
        for (var ci = 0; ci < tgoCookie.offers.length; ci++) {
          var co = tgoCookie.offers[ci];
          cookieRows.push({
            sourcePage: 'Offers', offerName: 'Carnival Rate Code ' + co.code,
            offerCode: co.code, offerExpirationDate: co.endDate || '',
            offerType: 'VIFP Club', shipName: '', shipCode: '', sailingDate: '',
            itinerary: '', departurePort: '', cabinType: '', numberOfGuests: '2',
            perks: '', loyaltyLevel: '', loyaltyPoints: '', interiorPrice: '',
            oceanviewPrice: '', balconyPrice: '', suitePrice: '', taxesAndFees: '',
            portList: '', dayByDayItinerary: [], destinationName: '',
            totalNights: null, bookingLink: '/cruise-search?rateCodes=' + co.code
          });
        }
        sendBatch(cookieRows, false);
        sendBatch([], true, cookieRows.length, cookieRows.length);
        log('Created ' + cookieRows.length + ' offers from TGO cookie', 'success');
        return;
      }

      log('No Carnival offers found from any source', 'warning');
      sendBatch([], true, 0, 0);
    } catch(error) {
      log('Carnival extraction error: ' + (error.message || error), 'error');
      sendBatch([], true, 0, 0);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', extractCarnivalOffers);
  } else {
    extractCarnivalOffers();
  }
})();
`;

export function injectCarnivalOffersExtraction(): string {
  return CARNIVAL_OFFERS_SCRIPT;
}

export const CARNIVAL_BOOKINGS_SCRAPE_SCRIPT = `
(function() {
  var CARNIVAL_SHIPS = [
    'Carnival Breeze', 'Carnival Celebration', 'Carnival Conquest', 'Carnival Dream',
    'Carnival Elation', 'Carnival Fascination', 'Carnival Firenze', 'Carnival Freedom',
    'Carnival Glory', 'Carnival Horizon', 'Carnival Imagination', 'Carnival Inspiration',
    'Carnival Jubilee', 'Carnival Legend', 'Carnival Liberty', 'Carnival Luminosa',
    'Carnival Magic', 'Mardi Gras', 'Carnival Miracle', 'Carnival Panorama',
    'Carnival Paradise', 'Carnival Pride', 'Carnival Radiance', 'Carnival Sensation',
    'Carnival Spirit', 'Carnival Splendor', 'Carnival Sunrise', 'Carnival Sunshine',
    'Carnival Valor', 'Carnival Venice', 'Carnival Vista'
  ];
  var SHIP_PATTERN = new RegExp('(' + CARNIVAL_SHIPS.map(function(s) { return s.replace(/\\s+/g, '\\\\s+'); }).join('|') + ')', 'i');

  function log(message, type) {
    try {
      window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'log', message: message, logType: type || 'info' }));
    } catch(e) {}
  }

  function getCookie(name) {
    try {
      var cookies = document.cookie.split(';');
      for (var i = 0; i < cookies.length; i++) {
        var c = cookies[i].trim();
        if (c.indexOf(name + '=') === 0) return c.substring(name.length + 1);
      }
    } catch(e) {}
    return null;
  }

  function parseCarnivalUserCookie() {
    try {
      var raw = getCookie('user');
      if (!raw) return null;
      return JSON.parse(decodeURIComponent(raw));
    } catch(e) { return null; }
  }

  function parseDate(str) {
    if (!str) return '';
    var m1 = str.match(/((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\\.?\\s+\\d{1,2},?\\s+\\d{4})/i);
    if (m1) return m1[1];
    var m2 = str.match(/(\\d{1,2}\\/\\d{1,2}\\/\\d{2,4})/);
    if (m2) return m2[1];
    var m3 = str.match(/(\\d{4}-\\d{2}-\\d{2})/);
    if (m3) return m3[1];
    return '';
  }

  function formatBookingFromAPI(booking, index) {
    var shipName = booking.shipName || booking.ship || '';
    if (!shipName && booking.shipCode) shipName = 'Carnival ' + booking.shipCode;
    return {
      rawBooking: booking,
      sourcePage: 'Upcoming',
      shipName: shipName,
      shipCode: booking.shipCode || '',
      cruiseTitle: booking.cruiseTitle || booking.title || (booking.numberOfNights ? booking.numberOfNights + ' Night Cruise' : 'Cruise'),
      sailingStartDate: booking.sailDate || booking.departureDate || booking.startDate || '',
      sailingEndDate: booking.endDate || booking.returnDate || '',
      sailingDates: '',
      itinerary: booking.itinerary || booking.destination || '',
      departurePort: booking.departurePort || booking.homePort || '',
      arrivalPort: booking.arrivalPort || '',
      cabinType: booking.stateroomType || booking.cabinType || booking.categoryType || '',
      cabinCategory: booking.stateroomCategoryCode || booking.categoryCode || '',
      cabinNumberOrGTY: booking.stateroomNumber || booking.cabinNumber || 'GTY',
      deckNumber: booking.deckNumber || '',
      bookingId: (booking.bookingId || booking.confirmationNumber || booking.reservationId || ('CCL-' + Date.now() + '-' + index)).toString(),
      numberOfGuests: (booking.guestCount || booking.numberOfGuests || 2).toString(),
      numberOfNights: (booking.numberOfNights || booking.duration || '').toString(),
      daysToGo: '',
      status: booking.status || 'Upcoming',
      holdExpiration: '',
      loyaltyLevel: '',
      loyaltyPoints: '',
      paidInFull: booking.paidInFull ? 'Yes' : '',
      balanceDue: (booking.balanceDue || booking.amountDue || '').toString(),
      musterStation: '',
      bookingStatus: booking.bookingStatus || 'BK',
      packageCode: '',
      passengerStatus: '',
      stateroomNumber: booking.stateroomNumber || booking.cabinNumber || '',
      stateroomCategoryCode: booking.stateroomCategoryCode || booking.categoryCode || '',
      stateroomType: booking.stateroomType || booking.cabinType || ''
    };
  }

  async function tryFetchBookingsAPI() {
    var endpoints = [
      '/api/profile/bookings',
      '/api/account/bookings',
      '/profilemanagement/api/bookings',
      '/api/booking/upcoming',
      '/api/profile/cruises'
    ];

    for (var ei = 0; ei < endpoints.length; ei++) {
      try {
        var controller = new AbortController();
        var tid = setTimeout(function() { controller.abort(); }, 8000);
        var response = await fetch(endpoints[ei], {
          method: 'GET',
          headers: { 'accept': 'application/json' },
          credentials: 'include',
          signal: controller.signal
        });
        clearTimeout(tid);

        if (response.ok) {
          var ct = response.headers.get('content-type') || '';
          if (ct.includes('json')) {
            var data = await response.json();
            var bookings = null;
            if (Array.isArray(data)) bookings = data;
            else if (data.bookings && Array.isArray(data.bookings)) bookings = data.bookings;
            else if (data.cruises && Array.isArray(data.cruises)) bookings = data.cruises;
            else if (data.reservations && Array.isArray(data.reservations)) bookings = data.reservations;
            else if (data.data && Array.isArray(data.data)) bookings = data.data;
            else if (data.payload && Array.isArray(data.payload)) bookings = data.payload;
            else if (data.upcoming && Array.isArray(data.upcoming)) bookings = data.upcoming;

            if (bookings && bookings.length > 0) {
              log('Found ' + bookings.length + ' bookings from ' + endpoints[ei], 'success');
              return bookings;
            }
          }
        }
      } catch(e) {}
    }
    return null;
  }

  function tryExtractFromNextData() {
    try {
      var el = document.getElementById('__NEXT_DATA__');
      if (!el) return [];
      var pageData = JSON.parse(el.textContent || '');
      var props = pageData && pageData.props && pageData.props.pageProps;
      if (!props) return [];
      var keys = Object.keys(props);
      for (var ki = 0; ki < keys.length; ki++) {
        var val = props[keys[ki]];
        if (Array.isArray(val) && val.length > 0 && val[0]) {
          var first = val[0];
          if (first.bookingId || first.confirmationNumber || first.shipName || first.bookingNumber) {
            log('Found bookings in __NEXT_DATA__.' + keys[ki], 'success');
            return val;
          }
        }
      }
      if (props.bookings) return Array.isArray(props.bookings) ? props.bookings : [];
      if (props.cruises) return Array.isArray(props.cruises) ? props.cruises : [];
      if (props.trips) return Array.isArray(props.trips) ? props.trips : [];
    } catch(e) {}
    return [];
  }

  function scrapeBookingsFromDOM() {
    var bookings = [];

    var selectorList = [
      '[data-testid*="booking"], [data-testid*="cruise"], [data-testid*="trip"]',
      '[class*="BookingCard"], [class*="booking-card"], [class*="bookingCard"]',
      '[class*="CruiseCard"], [class*="cruise-card"], [class*="cruiseCard"]',
      '[class*="TripCard"], [class*="trip-card"], [class*="tripCard"]',
      '[class*="reservation"], [class*="Reservation"]',
      '[class*="upcoming-cruise"], [class*="UpcomingCruise"]',
      '[class*="profile-cruise"], [class*="ProfileCruise"]'
    ];

    var cards = [];
    for (var si = 0; si < selectorList.length; si++) {
      try {
        var found = document.querySelectorAll(selectorList[si]);
        if (found.length > 0) {
          cards = found;
          log('Found ' + found.length + ' booking elements: ' + selectorList[si], 'info');
          break;
        }
      } catch(e) {}
    }

    if (cards.length === 0) {
      var allElements = document.querySelectorAll('section, article, [role="listitem"], [class*="card"], [class*="Card"]');
      var matchingEls = [];
      for (var ei = 0; ei < allElements.length; ei++) {
        var elText = (allElements[ei].textContent || '').substring(0, 600);
        if (SHIP_PATTERN.test(elText)) {
          var hasDate = /(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)|\\d{1,2}\\/\\d{1,2}\\/\\d{2,4}|\\d{4}-\\d{2}-\\d{2}/i.test(elText);
          if (hasDate) matchingEls.push(allElements[ei]);
        }
      }
      if (matchingEls.length > 0) {
        cards = matchingEls;
        log('Found ' + matchingEls.length + ' elements with ship names + dates', 'info');
      }
    }

    for (var i = 0; i < cards.length; i++) {
      try {
        var card = cards[i];
        var text = (card.textContent || '').replace(/\\s+/g, ' ');

        var shipMatch = text.match(SHIP_PATTERN);
        if (!shipMatch) continue;

        var dateStr = parseDate(text);
        var nightsMatch = text.match(/(\\d+)\\s*[-\\s]?\\s*(?:Night|night|Nite)/i);
        var nights = nightsMatch ? nightsMatch[1] : '';

        var bookingIdMatch = text.match(/(?:Booking|Confirmation|Booking\\s*Number|Conf(?:irmation)?|Reference)\\s*(?:#|:|Number:?)?\\s*([A-Z0-9]{4,12})/i);
        var bookingId = bookingIdMatch ? bookingIdMatch[1] : '';
        if (!bookingId) bookingId = card.getAttribute('data-booking-id') || card.getAttribute('data-confirmation') || '';

        var cabinMatch = text.match(/(?:Cabin|Stateroom|Room)\\s*(?:#|:|Number:?)?\\s*([A-Z]?\\d{3,5}[A-Z]?)/i);
        var cabin = cabinMatch ? cabinMatch[1] : '';

        var categoryMatch = text.match(/(Interior|Ocean\\s*View|Oceanview|Balcony|Suite|Havana|Cloud\\s*9|Spa|Extended\\s*Balcony|Cove\\s*Balcony)/i);
        var category = categoryMatch ? categoryMatch[1] : '';

        var portMatch = text.match(/(?:from|departing|departs?|sailing from)\\s+([A-Z][a-z]+(?:\\s+[A-Z][a-z]+)*(?:,\\s*[A-Z]{2})?)/i);
        var port = portMatch ? portMatch[1] : '';

        var destMatch = text.match(/((?:Western|Eastern|Southern)?\\s*Caribbean|Bahamas|Mexico|Alaska|Hawaii|Bermuda|Europe|Mediterranean|Panama Canal|Transatlantic)/i);
        var destination = destMatch ? destMatch[1].trim() : '';

        bookings.push({
          rawBooking: null, sourcePage: 'Upcoming',
          shipName: shipMatch[1], shipCode: '',
          cruiseTitle: nights ? nights + ' Night ' + (destination || 'Cruise') : (destination || 'Cruise'),
          sailingStartDate: dateStr, sailingEndDate: '', sailingDates: '',
          itinerary: destination, departurePort: port, arrivalPort: '',
          cabinType: category, cabinCategory: '',
          cabinNumberOrGTY: cabin || 'GTY', deckNumber: '',
          bookingId: bookingId || ('CCL-DOM-' + Date.now() + '-' + i),
          numberOfGuests: '2', numberOfNights: nights,
          daysToGo: '', status: 'Upcoming', holdExpiration: '',
          loyaltyLevel: '', loyaltyPoints: '', paidInFull: '',
          balanceDue: '', musterStation: '', bookingStatus: 'BK',
          packageCode: '', passengerStatus: '',
          stateroomNumber: cabin, stateroomCategoryCode: '', stateroomType: category
        });
        log('Found booking: ' + shipMatch[1] + (dateStr ? ' - ' + dateStr : '') + (nights ? ' (' + nights + ' nights)' : ''), 'success');
      } catch(e) {}
    }

    return bookings;
  }

  async function scrapeBookings() {
    log('Starting Carnival bookings extraction...', 'info');
    await new Promise(function(r) { setTimeout(r, 4000); });

    var bookings = [];

    // Strategy 1: Try booking APIs with cookie auth
    log('Trying Carnival booking APIs...', 'info');
    var apiBookings = await tryFetchBookingsAPI();
    if (apiBookings && apiBookings.length > 0) {
      for (var ai = 0; ai < apiBookings.length; ai++) {
        bookings.push(formatBookingFromAPI(apiBookings[ai], ai));
      }
      log('Captured ' + bookings.length + ' booking(s) from Carnival API', 'success');
    }

    // Strategy 2: Check network captures
    if (bookings.length === 0 && window.capturedPayloads) {
      var captured = window.capturedPayloads.upcomingCruises;
      if (captured) {
        var capBookings = null;
        if (Array.isArray(captured)) capBookings = captured;
        else if (captured.bookings) capBookings = captured.bookings;
        else if (captured.cruises) capBookings = captured.cruises;
        else if (captured.data && Array.isArray(captured.data)) capBookings = captured.data;
        else if (captured.payload && Array.isArray(captured.payload)) capBookings = captured.payload;

        if (capBookings && capBookings.length > 0) {
          for (var ci = 0; ci < capBookings.length; ci++) {
            bookings.push(formatBookingFromAPI(capBookings[ci], ci));
          }
          log('Captured ' + bookings.length + ' booking(s) from network capture', 'success');
        }
      }
    }

    // Strategy 3: __NEXT_DATA__
    if (bookings.length === 0) {
      var nextBookings = tryExtractFromNextData();
      if (nextBookings.length > 0) {
        for (var ni = 0; ni < nextBookings.length; ni++) {
          bookings.push(formatBookingFromAPI(nextBookings[ni], ni));
        }
        log('Extracted ' + bookings.length + ' booking(s) from page data', 'success');
      }
    }

    // Strategy 4: DOM scraping
    if (bookings.length === 0) {
      log('No API/network bookings - scraping DOM...', 'info');
      bookings = scrapeBookingsFromDOM();
    }

    if (bookings.length > 0) {
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'cruise_batch', data: bookings
      }));
      log('Total: ' + bookings.length + ' Carnival booking(s) captured', 'success');
    } else {
      log('No bookings found - you may have no upcoming cruises booked', 'info');
    }

    // Loyalty from user cookie
    var userCookie = parseCarnivalUserCookie();
    if (userCookie) {
      var tierMap = { '01': 'Red', '02': 'Gold', '03': 'Platinum', '04': 'Diamond' };
      var tierName = tierMap[userCookie.TierCode] || userCookie.TierCode || 'Unknown';
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'carnival_user_data', data: userCookie
      }));
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'loyalty_data',
        data: {
          crownAndAnchorLevel: tierName,
          crownAndAnchorPoints: userCookie.PastGuestNumber || '',
          clubRoyaleTier: tierName,
          clubRoyalePoints: ''
        }
      }));
      log('VIFP loyalty: ' + tierName + ' (VIFP# ' + (userCookie.PastGuestNumber || 'N/A') + ')', 'success');
    }

    // Signal step 2 completion so the sync flow doesn't hang
    try {
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'step_complete', step: 2, totalCount: bookings.length, data: []
      }));
      log('Carnival bookings extraction step complete', 'info');
    } catch(e) {}
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', scrapeBookings);
  } else {
    scrapeBookings();
  }
})();
`;

export function injectCarnivalBookingsScrape(): string {
  return CARNIVAL_BOOKINGS_SCRAPE_SCRIPT;
}
