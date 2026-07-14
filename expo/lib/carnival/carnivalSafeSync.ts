import type { BookedCruiseRow, OfferRow } from '@/lib/royalCaribbean/types';

export const CARNIVAL_OFFERS_LANDING_URL = 'https://www.carnival.com/cruise-deals';
export const CARNIVAL_PROFILE_URL = 'https://www.carnival.com/profilemanagement/profiles';
export const CARNIVAL_CRUISES_URL = 'https://www.carnival.com/profilemanagement/profiles/cruises';
export const CARNIVAL_PROFILE_OFFERS_URL = 'https://www.carnival.com/profilemanagement/profiles/offers';

export interface CarnivalRateCodeEntry {
  code: string;
  startDate: string;
  endDate: string;
  offerName?: string;
  perks?: string;
  bookingLink?: string;
}

export interface CarnivalOfferAction {
  index: number;
  title: string;
  perks: string;
  href: string;
}

export interface CarnivalCatalogDiscovery {
  sourceUrl: string;
  personalizedSearchUrl: string;
  tgo: string;
  vifp: string;
  tierCode: string;
  tierName: string;
  resident: string;
  locality: string;
  currency: string;
  rateCodes: CarnivalRateCodeEntry[];
  actionCards?: CarnivalOfferAction[];
  noOffersConfirmed: boolean;
}

export interface CarnivalSearchPageResult {
  requestId: string;
  offerCode: string;
  offerName: string;
  offerExpiry: string;
  perks: string;
  pageNumber: number;
  pageSize: number;
  totalResults: number;
  hasNextPage: boolean;
  effectivePageSize?: number;
  rowCount?: number;
  error?: string;
  url?: string;
  rows: OfferRow[];
}

export interface CarnivalProfileSnapshot {
  firstName: string;
  lastName: string;
  vifpNumber: string;
  vifpTier: string;
  vifpPoints: number;
  cruiseDayPoints: number;
  totalCruises: number;
  playersClubTier: string;
  playersClubPoints: number;
  hasVifpData?: boolean;
  hasPlayersClubData?: boolean;
}

export interface CarnivalProfileScrapeResult {
  requestId: string;
  profile: CarnivalProfileSnapshot;
  bookings: BookedCruiseRow[];
  upcomingEmptyConfirmed?: boolean;
  historyEmptyConfirmed?: boolean;
  upcomingCount?: number;
  completedCount?: number;
}

const normalizeCode = (value: string): string => value.trim().toUpperCase();

export function parseCarnivalTgo(value: string): CarnivalRateCodeEntry[] {
  if (!value) return [];
  const seen = new Set<string>();
  const rows: CarnivalRateCodeEntry[] = [];
  for (const block of value.split(';')) {
    const [rawCode, rawStart = '', rawEnd = ''] = block.split(',');
    const code = normalizeCode(rawCode || '');
    if (!/^[A-Z0-9]{2,10}$/.test(code) || seen.has(code)) continue;
    seen.add(code);
    rows.push({ code, startDate: rawStart.trim(), endDate: rawEnd.trim() });
  }
  return rows;
}

export function parseCarnivalPersonalizedUrl(input: string): CarnivalCatalogDiscovery {
  const fallback: CarnivalCatalogDiscovery = {
    sourceUrl: input,
    personalizedSearchUrl: '',
    tgo: '',
    vifp: '',
    tierCode: '',
    tierName: '',
    resident: '',
    locality: '1',
    currency: 'USD',
    rateCodes: [],
    actionCards: [],
    noOffersConfirmed: false,
  };

  try {
    const url = new URL(input);
    const tgo = url.searchParams.get('tgo') || '';
    const selectedCodes = (url.searchParams.get('ratecodes') || url.searchParams.get('rateCodes') || '')
      .split(',')
      .map(normalizeCode)
      .filter((code) => /^[A-Z0-9]{2,10}$/.test(code));
    const entries = parseCarnivalTgo(tgo);
    const seen = new Set(entries.map((entry) => entry.code));
    selectedCodes.forEach((code) => {
      if (!seen.has(code)) {
        seen.add(code);
        entries.push({ code, startDate: '', endDate: '' });
      }
    });
    const tierCode = url.searchParams.get('tierCode') || '';
    const tierName = ({ '01': 'Red', '02': 'Gold', '03': 'Platinum', '04': 'Diamond' } as Record<string, string>)[tierCode] || '';
    return {
      sourceUrl: input,
      personalizedSearchUrl: url.href,
      tgo,
      vifp: url.searchParams.get('vifp') || '',
      tierCode,
      tierName,
      resident: url.searchParams.get('resident') || '',
      locality: url.searchParams.get('locality') || '1',
      currency: url.searchParams.get('currency') || 'USD',
      rateCodes: entries,
      actionCards: [],
      noOffersConfirmed: false,
    };
  } catch {
    return fallback;
  }
}

export function buildCarnivalOfferSearchUrl(
  catalog: CarnivalCatalogDiscovery,
  rateCode: string,
  pageNumber: number = 1,
  pageSize: number = 8,
): string {
  let url: URL;
  try {
    url = new URL(catalog.personalizedSearchUrl || `${CARNIVAL_OFFERS_LANDING_URL}`);
  } catch {
    url = new URL(CARNIVAL_OFFERS_LANDING_URL);
  }

  url.pathname = '/cruise-search';
  url.searchParams.set('pageNumber', String(Math.max(1, pageNumber)));
  url.searchParams.set('numadults', '2');
  url.searchParams.set('ratecodes', normalizeCode(rateCode));
  // Carnival currently renders eight result cards per page. Keep this explicit so
  // pagination math matches the live site instead of assuming Royal's larger pages.
  url.searchParams.set('pagesize', String(Math.max(1, pageSize)));
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

export function injectCarnivalCatalogDiscovery(): string {
  return `
(function() {
  function post(type, payload) {
    try { window.ReactNativeWebView.postMessage(JSON.stringify(Object.assign({ type: type }, payload || {}))); } catch (e) {}
  }
  function compact(value) { return String(value || '').replace(/\\s+/g, ' ').trim(); }
  function absolute(href) {
    try { return new URL(href, window.location.href).toString(); } catch (e) { return ''; }
  }
  function readCookie(name) {
    try {
      var parts = String(document.cookie || '').split(';');
      for (var i = 0; i < parts.length; i++) {
        var item = parts[i].trim();
        if (item.indexOf(name + '=') === 0) return item.substring(name.length + 1);
      }
    } catch (e) {}
    return '';
  }
  function parseUserCookie() {
    try {
      var raw = readCookie('user');
      return raw ? JSON.parse(decodeURIComponent(raw)) : null;
    } catch (e) { return null; }
  }
  function addEntry(map, code, startDate, endDate, offerName, perks, bookingLink) {
    code = compact(code).toUpperCase();
    if (!/^[A-Z0-9]{2,10}$/.test(code)) return;
    var existing = map[code] || { code: code, startDate: '', endDate: '', offerName: '', perks: '', bookingLink: '' };
    if (!existing.startDate && startDate) existing.startDate = compact(startDate);
    if (!existing.endDate && endDate) existing.endDate = compact(endDate);
    if ((!existing.offerName || /^Rate Code /i.test(existing.offerName)) && offerName) existing.offerName = compact(offerName).substring(0, 180);
    if (!existing.perks && perks) existing.perks = compact(perks).substring(0, 1000);
    if (!existing.bookingLink && bookingLink) existing.bookingLink = absolute(bookingLink);
    map[code] = existing;
  }
  function parseTgo(value, map) {
    if (!value) return;
    var blocks = String(value).split(';');
    for (var i = 0; i < blocks.length; i++) {
      var fields = blocks[i].split(',');
      addEntry(map, fields[0] || '', fields[1] || '', fields[2] || '', '', '', '');
    }
  }
  function inspectUrl(raw, map, state) {
    if (!raw) return;
    try {
      var url = new URL(raw, window.location.href);
      if (url.hostname.indexOf('carnival.com') < 0) return;
      var tgo = url.searchParams.get('tgo') || '';
      var selected = url.searchParams.get('ratecodes') || url.searchParams.get('rateCodes') || '';
      if (tgo) {
        state.tgo = state.tgo || tgo;
        state.personalizedSearchUrl = state.personalizedSearchUrl || url.toString();
        parseTgo(tgo, map);
      }
      if (selected) {
        var codes = selected.split(',');
        for (var ci = 0; ci < codes.length; ci++) addEntry(map, codes[ci], '', '', '', '', url.toString());
        state.personalizedSearchUrl = state.personalizedSearchUrl || url.toString();
      }
      state.vifp = state.vifp || url.searchParams.get('vifp') || '';
      state.tierCode = state.tierCode || url.searchParams.get('tierCode') || '';
      state.resident = state.resident || url.searchParams.get('resident') || '';
      state.locality = state.locality || url.searchParams.get('locality') || '';
      state.currency = state.currency || url.searchParams.get('currency') || '';
    } catch (e) {}
  }
  try {
    var map = {};
    var state = { personalizedSearchUrl: '', tgo: '', vifp: '', tierCode: '', resident: '', locality: '', currency: '' };
    inspectUrl(window.location.href || '', map, state);

    var links = document.querySelectorAll('a[href], [data-href], [data-url]');
    for (var li = 0; li < links.length && li < 1200; li++) {
      var href = links[li].getAttribute('href') || links[li].getAttribute('data-href') || links[li].getAttribute('data-url') || '';
      if (!href || (href.indexOf('cruise-search') < 0 && href.indexOf('cruise-deals') < 0 && href.indexOf('tgo=') < 0)) continue;
      inspectUrl(href, map, state);
      var linkUrl = absolute(href);
      var card = links[li].closest('article, section, li, [class*="card"], [class*="Card"], [class*="deal"], [class*="Deal"], [class*="offer"], [class*="Offer"]');
      var cardText = compact(card ? card.textContent : links[li].textContent);
      var heading = card ? card.querySelector('h1,h2,h3,h4,h5,[class*="title"],[class*="Title"]') : null;
      var title = compact(heading ? heading.textContent : '');
      var perks = '';
      if (card) {
        var bullets = card.querySelectorAll('li');
        var bulletParts = [];
        for (var bi = 0; bi < bullets.length && bi < 20; bi++) {
          var bullet = compact(bullets[bi].textContent);
          if (bullet) bulletParts.push(bullet);
        }
        perks = bulletParts.join(' • ') || cardText;
      }
      try {
        var parsedLink = new URL(linkUrl);
        var selectedCodes = (parsedLink.searchParams.get('ratecodes') || parsedLink.searchParams.get('rateCodes') || '').split(',');
        for (var si = 0; si < selectedCodes.length; si++) {
          addEntry(map, selectedCodes[si], '', '', title, perks, linkUrl);
        }
      } catch (e) {}
    }

    var cookieTgo = '';
    try { cookieTgo = decodeURIComponent(readCookie('tgo') || ''); } catch (e) {}
    if (cookieTgo) {
      var directTgo = cookieTgo;
      var offersMatch = directTgo.match(/(?:^|\\|)offers=([^|]+)/i);
      if (offersMatch) directTgo = offersMatch[1];
      if (directTgo.indexOf(',') >= 0) {
        state.tgo = state.tgo || directTgo;
        parseTgo(directTgo, map);
      }
      var pgMatch = cookieTgo.match(/PastGuestNumber=([^|]+)/i);
      if (pgMatch) state.vifp = state.vifp || compact(pgMatch[1]);
    }

    var user = parseUserCookie();
    if (user) {
      state.vifp = state.vifp || compact(user.PastGuestNumber || user.VifpNumber || user.vifpNumber);
      state.tierCode = state.tierCode || compact(user.TierCode || user.tierCode);
      post('carnival_user_data', { data: user });
    }

    // Carnival's personalized offer API often exposes the authoritative rate code only
    // inside each item's CtaUrl. Read the locally captured payload without transferring
    // the full response over the React Native bridge.
    try {
      var vifpPayload = window.__carnivalVifpOffers || (window.capturedPayloads && window.capturedPayloads.carnivalVifpOffers);
      var items = vifpPayload && Array.isArray(vifpPayload.Items) ? vifpPayload.Items : [];
      for (var vi = 0; vi < items.length; vi++) {
        var item = items[vi] || {};
        var cta = absolute(item.CtaUrl || item.ctaUrl || item.Url || item.url || '');
        if (cta) inspectUrl(cta, map, state);
        var rateMatch = String(cta || '').match(/[?&]ratecodes?=([A-Z0-9]+)/i);
        var rateCode = compact(item.RateCode || item.rateCode || (rateMatch ? rateMatch[1] : ''));
        var description = compact(String(item.Description || item.description || '').replace(/<[^>]*>/g, ' '));
        var subtitle = compact(item.Subtitle || item.subtitle || '');
        var expiryMatch = subtitle.match(/(?:Book by|Ends|Expires?)\s+(.+)/i);
        addEntry(map, rateCode, '', expiryMatch ? expiryMatch[1] : '', compact(item.Title || item.title || ''), description, cta);
      }
    } catch (e) {}

    // Some Carnival offer cards use JavaScript-only SHOP NOW buttons rather than links.
    // Report those actions so the native orchestrator can click each card and capture the
    // personalized rate-code URL that appears only after the click.
    var actionCards = [];
    try {
      var actionEls = document.querySelectorAll('a,button,[role="button"]');
      var actionSeen = {};
      for (var aci = 0; aci < actionEls.length && actionCards.length < 60; aci++) {
        var actionText = compact(actionEls[aci].textContent || actionEls[aci].getAttribute('aria-label') || '');
        if (!/^(?:shop now|search cruises|view deal|view offer|view cruises)$/i.test(actionText)) continue;
        var rect = actionEls[aci].getBoundingClientRect ? actionEls[aci].getBoundingClientRect() : null;
        if (rect && (rect.width <= 0 || rect.height <= 0)) continue;
        var actionHref = absolute(actionEls[aci].getAttribute('href') || actionEls[aci].getAttribute('data-href') || actionEls[aci].getAttribute('data-url') || '');
        var actionCard = actionEls[aci].closest('article, section, li, [class*="card"], [class*="Card"], [class*="deal"], [class*="Deal"], [class*="offer"], [class*="Offer"]');
        var actionHeading = actionCard ? actionCard.querySelector('h1,h2,h3,h4,h5,[class*="title"],[class*="Title"]') : null;
        var actionTitle = compact(actionHeading ? actionHeading.textContent : '');
        var actionPerks = compact(actionCard ? actionCard.textContent : '');
        var actionKey = (actionTitle + '|' + actionHref + '|' + actionText).toLowerCase();
        if (actionSeen[actionKey]) continue;
        actionSeen[actionKey] = true;
        actionCards.push({ index: actionCards.length, title: actionTitle, perks: actionPerks.substring(0, 1000), href: actionHref });
        if (actionHref) inspectUrl(actionHref, map, state);
      }
    } catch (e) {}

    var bodyText = compact(document.body ? document.body.innerText : '');
    if (!state.vifp) {
      var vifpMatch = bodyText.match(/VIFP(?:\\s+Club)?\\s*#?[:\\s]+([0-9]{6,15})/i);
      if (vifpMatch) state.vifp = vifpMatch[1];
    }
    var tierMap = { '01': 'Red', '02': 'Gold', '03': 'Platinum', '04': 'Diamond' };
    var noOffersConfirmed = /(?:no|zero)\\s+(?:special\\s+)?(?:offers|deals)\\s+(?:available|found)|you do not have any offers/i.test(bodyText);
    var entries = Object.keys(map).map(function(code) {
      var item = map[code];
      if (!item.offerName) item.offerName = 'Rate Code ' + code;
      return item;
    });
    post('carnival_catalog_discovered', {
      data: {
        sourceUrl: window.location.href || '',
        personalizedSearchUrl: state.personalizedSearchUrl || '',
        tgo: state.tgo || '',
        vifp: state.vifp || '',
        tierCode: state.tierCode || '',
        tierName: tierMap[state.tierCode] || '',
        resident: state.resident || '',
        locality: state.locality || '1',
        currency: state.currency || 'USD',
        rateCodes: entries,
        actionCards: actionCards,
        noOffersConfirmed: noOffersConfirmed
      }
    });
  } catch (error) {
    post('carnival_catalog_discovered', { data: { sourceUrl: window.location.href || '', personalizedSearchUrl: '', tgo: '', vifp: '', tierCode: '', tierName: '', resident: '', locality: '1', currency: 'USD', rateCodes: [], actionCards: [], noOffersConfirmed: false }, error: String(error && error.message ? error.message : error) });
  }
})();
true;
`;
}


export function injectCarnivalOfferActionClick(actionIndex: number): string {
  const index = Math.max(0, Math.floor(actionIndex));
  return `
(function() {
  function post(type, payload) { try { window.ReactNativeWebView.postMessage(JSON.stringify(Object.assign({ type: type }, payload || {}))); } catch (e) {} }
  function compact(value) { return String(value || '').replace(/\\s+/g, ' ').trim(); }
  try {
    var actions = [];
    var actionSeen = {};
    var elements = document.querySelectorAll('a,button,[role="button"]');
    for (var i = 0; i < elements.length && actions.length < 60; i++) {
      var text = compact(elements[i].textContent || elements[i].getAttribute('aria-label') || '');
      if (!/^(?:shop now|search cruises|view deal|view offer|view cruises)$/i.test(text)) continue;
      var rect = elements[i].getBoundingClientRect ? elements[i].getBoundingClientRect() : null;
      if (rect && (rect.width <= 0 || rect.height <= 0)) continue;
      var card = elements[i].closest('article, section, li, [class*="card"], [class*="Card"], [class*="deal"], [class*="Deal"], [class*="offer"], [class*="Offer"]');
      var heading = card ? card.querySelector('h1,h2,h3,h4,h5,[class*="title"],[class*="Title"]') : null;
      var href = compact(elements[i].getAttribute('href') || elements[i].getAttribute('data-href') || elements[i].getAttribute('data-url') || '');
      var key = (compact(heading ? heading.textContent : '') + '|' + href + '|' + text).toLowerCase();
      if (actionSeen[key]) continue;
      actionSeen[key] = true;
      actions.push(elements[i]);
    }
    var target = actions[${index}];
    if (!target) {
      post('log', { message: 'Carnival offer action ${index + 1} was not found on the current page', logType: 'warning' });
      return;
    }
    post('log', { message: 'Opening Carnival offer action ${index + 1}/' + actions.length + ': ' + compact(target.textContent || target.getAttribute('aria-label') || 'offer'), logType: 'info' });
    target.scrollIntoView({ block: 'center', inline: 'center' });
    setTimeout(function() { try { target.click(); } catch (e) {} }, 250);
  } catch (error) {
    post('log', { message: 'Carnival offer action click failed: ' + String(error && error.message ? error.message : error), logType: 'warning' });
  }
})();
true;
`;
}

function serializeForInjection(value: unknown): string {
  return JSON.stringify(value).replace(/</g, '\\u003c').replace(/>/g, '\\u003e');
}

export function injectCarnivalSearchPageScrape(input: {
  requestId: string;
  offerCode: string;
  offerName: string;
  offerExpiry: string;
  perks: string;
  pageNumber: number;
  pageSize: number;
}): string {
  const payload = serializeForInjection(input);
  return `
(function() {
  var INPUT = ${payload};
  function post(type, payload) {
    try { window.ReactNativeWebView.postMessage(JSON.stringify(Object.assign({ type: type }, payload || {}))); } catch (e) {}
  }
  function compact(value) { return String(value || '').replace(/\\s+/g, ' ').trim(); }
  function absolute(href) { try { return new URL(href, window.location.href).toString(); } catch (e) { return ''; } }
  function numericMoney(value) {
    if (value === null || value === undefined || value === '') return null;
    if (typeof value === 'number' && isFinite(value)) return value;
    var match = String(value).match(/\\$?\\s*([0-9][0-9,]*(?:\\.[0-9]{1,2})?)/);
    return match ? Number(match[1].replace(/,/g, '')) : null;
  }
  function moneyForTwo(value, contextText, assumePerPerson) {
    var amount = numericMoney(value);
    if (amount === null || !isFinite(amount)) return '';
    var context = String(contextText || '');
    var isPerPerson = assumePerPerson || /average per person|per person|\\bpp\\b/i.test(context);
    var total = isPerPerson ? amount * 2 : amount;
    return '$' + (Math.round(total * 100) / 100).toFixed(total % 1 ? 2 : 0);
  }
  function knownShip(text) {
    var source = String(text || '');
    var match = source.match(/(?:Carnival\s+)?(Adventure|Breeze|Celebration|Conquest|Dream|Elation|Encounter|Festivale|Firenze|Freedom|Glory|Horizon|Jubilee|Legend|Liberty|Luminosa|Magic|Mardi Gras|Miracle|Panorama|Paradise|Pride|Radiance|Spirit|Splendor|Sunrise|Sunshine|Valor|Venezia|Venice|Vista)/i);
    if (match) return /^Mardi Gras$/i.test(match[1]) ? 'Mardi Gras' : 'Carnival ' + match[1].replace(/\b\w/g, function(c) { return c.toUpperCase(); });
    var generic = source.match(/\bCarnival\s+([A-Z][A-Za-z]+(?:\s+[A-Z][A-Za-z]+){0,2})\b/);
    if (!generic || /^(?:Cruise|Cruise Line|Players Club|VIFP Club|Search|Deals)$/i.test(generic[1])) return '';
    return 'Carnival ' + generic[1];
  }
  function normalizeDate(value) {
    var raw = compact(value);
    if (!raw) return '';
    var iso = raw.match(/^(20\\d{2})[-\\/](\\d{1,2})[-\\/](\\d{1,2})/);
    if (iso) return String(iso[2]).padStart(2, '0') + '/' + String(iso[3]).padStart(2, '0') + '/' + iso[1];
    var us = raw.match(/^(\\d{1,2})[-\\/](\\d{1,2})[-\\/](20\\d{2})/);
    if (us) return String(us[1]).padStart(2, '0') + '/' + String(us[2]).padStart(2, '0') + '/' + us[3];
    return raw;
  }
  function extractDateStrings(text) {
    var found = [];
    var seen = {};
    var patterns = [
      /(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\\.?\\s+\\d{1,2},?\\s+20\\d{2}/gi,
      /\\b\\d{1,2}\\/\\d{1,2}\\/20\\d{2}\\b/g,
      /\\b20\\d{2}-\\d{1,2}-\\d{1,2}\\b/g
    ];
    for (var pi = 0; pi < patterns.length; pi++) {
      var matches = String(text || '').match(patterns[pi]) || [];
      for (var mi = 0; mi < matches.length; mi++) {
        var key = compact(matches[mi]).toLowerCase();
        if (!seen[key]) { seen[key] = true; found.push(normalizeDate(matches[mi])); }
      }
    }
    return found;
  }
  function getOfferMeta() {
    var bodyText = compact(document.body ? document.body.innerText : '');
    var title = INPUT.offerName || '';
    var headings = document.querySelectorAll('h1,h2,h3,h4,[class*="title"],[class*="Title"]');
    for (var hi = 0; hi < headings.length && hi < 120; hi++) {
      var h = compact(headings[hi].textContent);
      if (h && h.length < 180 && /(deal|offer|free|jackpot|casino|sailing exclusively)/i.test(h)) { title = h; break; }
    }
    var perkParts = [];
    var listItems = document.querySelectorAll('li');
    for (var li = 0; li < listItems.length && li < 50; li++) {
      var itemText = compact(listItems[li].textContent);
      if (itemText && itemText.length < 300 && /(free|credit|casino|companion|book|rate code|offer|tax|fee|deposit|drink|sailing)/i.test(itemText)) perkParts.push(itemText);
    }
    var perks = perkParts.length ? perkParts.slice(0, 20).join(' • ') : (INPUT.perks || '');
    var expiry = INPUT.offerExpiry || '';
    var expiryMatch = bodyText.match(/(?:Book by|Ends|Expires?)[:\\s]+([A-Za-z]+\\s+\\d{1,2}(?:,\\s*20\\d{2})?|\\d{1,2}\\/\\d{1,2}\\/20\\d{2})/i);
    if (expiryMatch) expiry = compact(expiryMatch[1]);
    return { title: title || ('Rate Code ' + INPUT.offerCode), perks: perks, expiry: expiry };
  }
  function rowFromObject(obj, meta) {
    if (!obj || typeof obj !== 'object') return null;
    var ship = compact(obj.shipName || obj.ship || obj.vesselName || (obj.shipInfo && obj.shipInfo.name) || '');
    if (!ship) ship = knownShip(JSON.stringify(obj).substring(0, 1200));
    var date = compact(obj.sailDate || obj.departureDate || obj.startDate || obj.embarkDate || obj.sailingDate || '');
    if (!ship || !date) return null;
    var itinerary = compact(obj.itineraryName || obj.itinerary || obj.itineraryDescription || obj.destinationName || obj.destination || obj.title || '');
    var port = compact(obj.departurePortName || obj.departurePort || obj.homePort || obj.embarkPort || (obj.port && obj.port.name) || '');
    var nightsRaw = obj.numberOfNights || obj.nights || obj.duration || obj.durationDays || '';
    var nights = Number(String(nightsRaw).replace(/[^0-9]/g, '')) || 0;
    var priceValue = obj.fromPrice || obj.startingPrice || obj.leadPrice || obj.price || obj.lowestPrice || (obj.pricing && (obj.pricing.fromPrice || obj.pricing.price));
    // Carnival search prices are advertised per person for a two-person room.
    // Store the two-guest total so app value comparisons remain consistent.
    var price = moneyForTwo(priceValue, JSON.stringify(obj).substring(0, 1000), true);
    var link = absolute(obj.bookingLink || obj.url || obj.href || obj.deepLink || '');
    return {
      sourcePage: 'Offers', offerName: meta.title, offerCode: INPUT.offerCode,
      offerExpirationDate: meta.expiry, offerType: 'Carnival Players Club',
      shipName: ship, shipCode: compact(obj.shipCode || ''), sailingDate: normalizeDate(date),
      itinerary: itinerary, departurePort: port, cabinType: compact(obj.cabinType || obj.roomType || obj.stateroomType || ''),
      numberOfGuests: '2', perks: compact((meta.perks || '') + ' • Carnival displayed price converted to total for 2 guests'), loyaltyLevel: '', loyaltyPoints: '',
      interiorPrice: price, oceanviewPrice: '', balconyPrice: '', suitePrice: '', taxesAndFees: '',
      portList: '', dayByDayItinerary: [], destinationName: compact(obj.destinationName || obj.destination || ''),
      totalNights: nights || null, bookingLink: link || window.location.href
    };
  }
  function collectEmbeddedRows(meta) {
    var rows = [];
    var seenObjects = [];
    var nodeCount = 0;
    function walk(value, depth) {
      if (!value || depth > 9 || nodeCount > 25000) return;
      nodeCount++;
      if (typeof value !== 'object') return;
      if (seenObjects.indexOf(value) >= 0) return;
      seenObjects.push(value);
      var row = rowFromObject(value, meta);
      if (row) rows.push(row);
      if (Array.isArray(value)) {
        for (var ai = 0; ai < value.length && ai < 2000; ai++) walk(value[ai], depth + 1);
      } else {
        var keys = Object.keys(value);
        for (var ki = 0; ki < keys.length && ki < 200; ki++) {
          var key = keys[ki];
          if (/image|icon|content|descriptionHtml|analytics/i.test(key)) continue;
          walk(value[key], depth + 1);
        }
      }
    }
    var scripts = document.querySelectorAll('script[type="application/json"], script#__NEXT_DATA__');
    for (var si = 0; si < scripts.length && si < 30; si++) {
      var text = scripts[si].textContent || '';
      if (!text || text.length > 2500000 || !/(sailDate|departureDate|shipName|vesselName|embarkDate)/i.test(text)) continue;
      try { walk(JSON.parse(text), 0); } catch (e) {}
    }
    var captured = window.capturedPayloads && (window.capturedPayloads.carnivalSearch || window.capturedPayloads.cruiseSearch);
    if (captured) walk(captured, 0);
    return rows;
  }
  function candidateCards() {
    var candidates = [];
    var selectors = [
      '[data-testid*="cruise-result"]', '[data-testid*="sailing"]',
      '[class*="CruiseCard"]', '[class*="cruise-card"]', '[class*="SearchResult"]', '[class*="search-result"]',
      'article', 'li'
    ];
    for (var si = 0; si < selectors.length; si++) {
      var found = document.querySelectorAll(selectors[si]);
      for (var fi = 0; fi < found.length && candidates.length < 500; fi++) {
        var text = compact(found[fi].textContent);
        if (text.length < 40 || text.length > 5000) continue;
        if (!/(Carnival|\\d+[- ](?:Day|Night)|View Itinerary|from \\$|average per person)/i.test(text)) continue;
        if (candidates.indexOf(found[fi]) < 0) candidates.push(found[fi]);
      }
      if (candidates.length > 0 && si < 5) break;
    }
    return candidates;
  }
  async function expandDates() {
    var controls = document.querySelectorAll('button,a,[role="button"]');
    var clicked = 0;
    for (var i = 0; i < controls.length && clicked < 40; i++) {
      var text = compact((controls[i].textContent || '') + ' ' + (controls[i].getAttribute('aria-label') || ''));
      if (!/(show|view|check)\\s+dates?/i.test(text)) continue;
      try { controls[i].click(); clicked++; } catch (e) {}
    }
    if (clicked) await new Promise(function(resolve) { setTimeout(resolve, 1200); });
  }
  function collectDomRows(meta) {
    var rows = [];
    var cards = candidateCards();
    for (var ci = 0; ci < cards.length; ci++) {
      var card = cards[ci];
      var text = compact(card.textContent);
      var heading = card.querySelector('h1,h2,h3,h4,h5,[class*="title"],[class*="Title"]');
      var title = compact(heading ? heading.textContent : '');
      var ship = knownShip(text);
      if (!ship) continue;
      var nightsMatch = (title + ' ' + text).match(/(\\d{1,2})[- ](?:Day|Night)/i);
      var nights = nightsMatch ? Number(nightsMatch[1]) : 0;
      var port = '';
      var portMatch = (title + ' ' + text).match(/(?:from|Start:)\\s*([^•|\\n]+?)(?:,\\s*[A-Z]{2}|\\s*>|\\s*to|\\s*\\$|$)/i);
      if (portMatch) port = compact(portMatch[1]);
      var priceMatch = text.match(/\\$\\s*([0-9][0-9,]*(?:\\.[0-9]{1,2})?)/);
      var price = priceMatch ? moneyForTwo(priceMatch[1], text, true) : '';
      var dates = extractDateStrings(text);
      var links = card.querySelectorAll('a[href]');
      var bookingLink = '';
      for (var li = 0; li < links.length; li++) {
        var rawHref = links[li].getAttribute('href') || '';
        var href = absolute(rawHref);
        if (href) { bookingLink = href; }
        dates = dates.concat(extractDateStrings(rawHref));
        try {
          var hrefUrl = new URL(href || rawHref, window.location.href);
          ['sailDate','departureDate','startDate','date'].forEach(function(key) {
            var value = hrefUrl.searchParams.get(key);
            if (value) dates = dates.concat(extractDateStrings(value));
          });
        } catch (e) {}
        if (href && /book|cruise|itinerary/i.test(href)) break;
      }
      var dateAttributes = ['data-sail-date','data-departure-date','data-start-date','datetime'];
      for (var ai = 0; ai < dateAttributes.length; ai++) {
        var value = card.getAttribute(dateAttributes[ai]);
        if (value) dates = dates.concat(extractDateStrings(value));
        var datedNodes = card.querySelectorAll('[' + dateAttributes[ai] + ']');
        for (var dni = 0; dni < datedNodes.length && dni < 50; dni++) {
          dates = dates.concat(extractDateStrings(datedNodes[dni].getAttribute(dateAttributes[ai]) || ''));
        }
      }
      var dateSeen = {};
      dates = dates.filter(function(date) {
        var key = compact(date).toLowerCase();
        if (!key || dateSeen[key]) return false;
        dateSeen[key] = true;
        return true;
      });
      // A ship/itinerary card without an actual sail date is not an available sailing.
      // Keep the offer itself elsewhere, but never fabricate a cruise row with a blank date.
      if (!dates.length) continue;
      for (var di = 0; di < dates.length; di++) {
        rows.push({
          sourcePage: 'Offers', offerName: meta.title, offerCode: INPUT.offerCode,
          offerExpirationDate: meta.expiry, offerType: 'Carnival Players Club',
          shipName: ship, shipCode: '', sailingDate: dates[di], itinerary: title || text.substring(0, 180),
          departurePort: port, cabinType: '', numberOfGuests: '2', perks: compact((meta.perks || '') + ' • Carnival displayed price converted to total for 2 guests'),
          loyaltyLevel: '', loyaltyPoints: '', interiorPrice: price, oceanviewPrice: '', balconyPrice: '', suitePrice: '', taxesAndFees: '',
          portList: '', dayByDayItinerary: [], destinationName: title, totalNights: nights || null,
          bookingLink: bookingLink || window.location.href
        });
      }
    }
    return rows;
  }
  function dedupe(rows) {
    var out = [];
    var seen = {};
    for (var i = 0; i < rows.length; i++) {
      var row = rows[i];
      var key = [row.offerCode, row.shipName, row.sailingDate, row.itinerary, row.departurePort, row.interiorPrice].join('|').toLowerCase();
      if (seen[key]) continue;
      seen[key] = true;
      out.push(row);
    }
    return out;
  }
  async function waitForSearchReady() {
    var started = Date.now();
    var lastSignal = '';
    while (Date.now() - started < 15000) {
      var text = compact(document.body ? document.body.innerText : '');
      var cardCount = candidateCards().length;
      var hasTotal = /[0-9][0-9,]*\\s+(?:Cruise\\s+Results|Deals|Results)/i.test(text);
      var hasEmpty = /(?:0|no)\\s+(?:cruise\\s+)?results|no cruises found|we couldn\\.?t find/i.test(text);
      var loading = /loading|searching cruises|please wait/i.test(text) && cardCount === 0;
      lastSignal = 'cards=' + cardCount + ', total=' + hasTotal + ', empty=' + hasEmpty + ', loading=' + loading;
      if ((cardCount > 0 || hasTotal || hasEmpty) && !loading) return lastSignal;
      await new Promise(function(resolve) { setTimeout(resolve, 500); });
    }
    return lastSignal || 'timeout';
  }
  async function run() {
    try {
      var readiness = await waitForSearchReady();
      await expandDates();
      var meta = getOfferMeta();
      var rows = dedupe(collectEmbeddedRows(meta).concat(collectDomRows(meta)));
      var bodyText = compact(document.body ? document.body.innerText : '');
      var totalMatch = bodyText.match(/([0-9][0-9,]*)\\s+(?:Cruise\\s+Results|Deals|Results)/i);
      var totalResults = totalMatch ? Number(totalMatch[1].replace(/,/g, '')) : rows.length;
      var nextControl = document.querySelector('a[rel="next"],button[aria-label*="next" i],a[aria-label*="next" i]');
      var nextDisabled = !!(nextControl && (nextControl.disabled || nextControl.getAttribute('aria-disabled') === 'true' || /disabled/i.test(nextControl.className || '')));
      var resultCards = candidateCards().length;
      var effectivePageSize = resultCards || rows.length || Number(INPUT.pageSize) || 8;
      var hasNextPage = (!!nextControl && !nextDisabled) || (totalResults > (INPUT.pageNumber * effectivePageSize));
      var chunkSize = 10;
      if (!rows.length) {
        post('carnival_search_page_chunk', { requestId: INPUT.requestId, rows: [], chunkIndex: 1, totalChunks: 1 });
      } else {
        var totalChunks = Math.ceil(rows.length / chunkSize);
        for (var i = 0; i < totalChunks; i++) {
          post('carnival_search_page_chunk', { requestId: INPUT.requestId, rows: rows.slice(i * chunkSize, (i + 1) * chunkSize), chunkIndex: i + 1, totalChunks: totalChunks });
        }
      }
      post('carnival_search_page_complete', {
        requestId: INPUT.requestId, offerCode: INPUT.offerCode, offerName: meta.title,
        offerExpiry: meta.expiry, perks: meta.perks, pageNumber: INPUT.pageNumber,
        pageSize: INPUT.pageSize, effectivePageSize: effectivePageSize, totalResults: totalResults, hasNextPage: hasNextPage,
        rowCount: rows.length, readiness: readiness, url: window.location.href || ''
      });
    } catch (error) {
      post('carnival_search_page_complete', { requestId: INPUT.requestId, offerCode: INPUT.offerCode, offerName: INPUT.offerName, offerExpiry: INPUT.offerExpiry, perks: INPUT.perks, pageNumber: INPUT.pageNumber, pageSize: INPUT.pageSize, effectivePageSize: 0, totalResults: 0, hasNextPage: false, rowCount: 0, error: String(error && error.message ? error.message : error), url: window.location.href || '' });
    }
  }
  setTimeout(run, 250);
})();
true;
`;
}

export function injectCarnivalProfileScrape(requestId: string): string {
  const payload = serializeForInjection({ requestId });
  return `
(async function() {
  var INPUT = ${payload};
  function post(type, payload) { try { window.ReactNativeWebView.postMessage(JSON.stringify(Object.assign({ type: type }, payload || {}))); } catch (e) {} }
  function compact(value) { return String(value || '').replace(/\\s+/g, ' ').trim(); }
  function wait(ms) { return new Promise(function(resolve) { setTimeout(resolve, ms); }); }
  async function expandHistoryRows() {
    for (var round = 0; round < 10; round++) {
      var controls = document.querySelectorAll('button,[role=\"button\"]');
      var clicked = false;
      for (var ci = 0; ci < controls.length; ci++) {
        var label = compact(controls[ci].textContent || controls[ci].getAttribute('aria-label') || '');
        if (!/^(?:load more|show more|view more|more cruises|more history)$/i.test(label)) continue;
        var disabled = controls[ci].disabled || controls[ci].getAttribute('aria-disabled') === 'true';
        if (disabled) continue;
        try { controls[ci].scrollIntoView({ block: 'center' }); controls[ci].click(); clicked = true; break; } catch (e) {}
      }
      if (!clicked) break;
      await wait(900);
    }
  }
  function normalizeShip(value) {
    var text = compact(value);
    if (!text) return '';
    if (/^Carnival\\s+/i.test(text) || /^Mardi Gras$/i.test(text)) return text;
    return 'Carnival ' + text.replace(/\\b\\w/g, function(c) { return c.toUpperCase(); });
  }
  function normalizeDate(value) {
    var raw = compact(value);
    var iso = raw.match(/^(20\\d{2})[-\\/](\\d{1,2})[-\\/](\\d{1,2})/);
    if (iso) return String(iso[2]).padStart(2, '0') + '/' + String(iso[3]).padStart(2, '0') + '/' + iso[1];
    return raw;
  }
  function readCookie(name) {
    try {
      var parts = String(document.cookie || '').split(';');
      for (var i = 0; i < parts.length; i++) { var item = parts[i].trim(); if (item.indexOf(name + '=') === 0) return item.substring(name.length + 1); }
    } catch (e) {}
    return '';
  }
  function userCookie() { try { var raw = readCookie('user'); return raw ? JSON.parse(decodeURIComponent(raw)) : null; } catch (e) { return null; } }
  function nearestNumberForLabel(labelRegex, bodyText) {
    var match = bodyText.match(new RegExp('([0-9][0-9,]*)\\s*' + labelRegex.source, 'i')) || bodyText.match(new RegExp(labelRegex.source + '[^0-9]{0,30}([0-9][0-9,]*)', 'i'));
    return match ? Number(String(match[1]).replace(/,/g, '')) : 0;
  }
  function profileSnapshot() {
    var bodyText = compact(document.body ? document.body.innerText : '');
    var user = userCookie() || {};
    var nameMatch = bodyText.match(/WELCOME BACK\\s+([A-Z][A-Z '\\-]+?)(?:VIFP|My Profile|$)/i);
    var fullName = compact((user.FirstName || '') + ' ' + (user.LastName || '')) || compact(nameMatch ? nameMatch[1] : '');
    var nameParts = fullName.split(' ');
    var vifpMatch = bodyText.match(/VIFP(?:\\s+Club)?\\s*#?[:\\s]+([0-9]{6,15})/i);
    var tierMatch = bodyText.match(/Tier\\s+(Blue|Red|Gold|Platinum|Diamond)/i) || bodyText.match(/VIFP\\s+(Blue|Red|Gold|Platinum|Diamond)/i);
    var tierCode = compact(user.TierCode || user.tierCode);
    var tierMap = { '00': 'Blue', '01': 'Red', '02': 'Gold', '03': 'Platinum', '04': 'Diamond' };
    var breakdownMatch = bodyText.match(/VIFP\\s+POINTS\\s+BREAKDOWN([\\s\\S]{0,600}?)(?:Check your Special Offers|Cruise History|$)/i);
    var breakdownText = breakdownMatch ? breakdownMatch[1] : '';
    var actualVifpMatch = bodyText.match(/([0-9][0-9,]*)\\s+VIFP\\s+Points(?!\\s+until)/i);
    var vifpPoints = nearestNumberForLabel(/VIFP\\s+Points/, breakdownText) || (actualVifpMatch ? Number(actualVifpMatch[1].replace(/,/g, '')) : 0) || Number(user.Points || user.TotalPoints || user.VifpPoints || 0) || 0;
    var cruiseDayPoints = nearestNumberForLabel(/Cruise\\s+Day\\s+Points/, breakdownText) || nearestNumberForLabel(/Cruise\\s+Day\\s+Points/, bodyText);
    var totalCruises = nearestNumberForLabel(/Total\\s+Cruises/, breakdownText) || nearestNumberForLabel(/Total\\s+Cruises/, bodyText);
    var playersTierMatch = bodyText.match(/Players(?:'|’)s?\\s+Club[^A-Za-z]{0,20}(Blue|Gold|Platinum|Black Card)/i);
    var playersPoints = nearestNumberForLabel(/Players(?:'|’)s?\\s+(?:Club\\s+)?Points/, bodyText);
    var hasVifpData = !!(user.PastGuestNumber || user.VifpNumber || vifpMatch || tierCode || tierMatch || /VIFP\\s+Points|Cruise\\s+Day\\s+Points/i.test(bodyText));
    var hasPlayersClubData = !!(playersTierMatch || /Players(?:'|’)s?\\s+(?:Club\\s+)?Points/i.test(bodyText));
    return {
      firstName: compact(user.FirstName || nameParts[0] || ''),
      lastName: compact(user.LastName || nameParts.slice(1).join(' ')),
      vifpNumber: compact(user.PastGuestNumber || user.VifpNumber || (vifpMatch ? vifpMatch[1] : '')),
      vifpTier: compact(tierMap[tierCode] || (tierMatch ? tierMatch[1] : '')),
      vifpPoints: vifpPoints,
      cruiseDayPoints: cruiseDayPoints,
      totalCruises: totalCruises,
      playersClubTier: compact(playersTierMatch ? playersTierMatch[1] : ''),
      playersClubPoints: playersPoints,
      hasVifpData: hasVifpData,
      hasPlayersClubData: hasPlayersClubData
    };
  }
  function completedFromTables() {
    var rows = [];
    var tables = document.querySelectorAll('table');
    for (var ti = 0; ti < tables.length; ti++) {
      var tableText = compact(tables[ti].textContent);
      if (!/(Cruise History|Sail Date|VIFP Points|Booking)/i.test(tableText)) continue;
      var headers = [];
      var headerCells = tables[ti].querySelectorAll('thead th');
      if (!headerCells.length) headerCells = tables[ti].querySelectorAll('tr:first-child th, tr:first-child td');
      for (var hi = 0; hi < headerCells.length; hi++) headers.push(compact(headerCells[hi].textContent).toLowerCase());
      var bodyRows = tables[ti].querySelectorAll('tbody tr');
      if (!bodyRows.length) bodyRows = tables[ti].querySelectorAll('tr');
      for (var ri = 0; ri < bodyRows.length; ri++) {
        var cells = bodyRows[ri].querySelectorAll('td');
        if (cells.length < 2) continue;
        var values = [];
        for (var ci = 0; ci < cells.length; ci++) values.push(compact(cells[ci].textContent));
        var get = function(pattern, fallbackIndex) {
          for (var ii = 0; ii < headers.length; ii++) if (pattern.test(headers[ii])) return values[ii] || '';
          return values[fallbackIndex] || '';
        };
        var sailDate = get(/sail date|date/, 0);
        var ship = get(/ship/, 1);
        var destination = get(/destination|itinerary/, 2);
        var booking = get(/booking/, 3);
        var pointsText = get(/vifp|points/, values.length - 1);
        if (!sailDate || !ship || /sail date/i.test(sailDate)) continue;
        var pointsMatch = pointsText.match(/[-+]?\\s*([0-9][0-9,.]*)/);
        var points = pointsMatch ? Number(pointsMatch[1].replace(/,/g, '')) : 0;
        rows.push({
          sourcePage: 'Completed', shipName: normalizeShip(ship), shipCode: '', cruiseTitle: destination || 'Carnival Cruise',
          sailingStartDate: normalizeDate(sailDate), sailingEndDate: '', sailingDates: normalizeDate(sailDate), itinerary: destination,
          departurePort: '', arrivalPort: '', cabinType: '', cabinCategory: '', cabinNumberOrGTY: '', deckNumber: '',
          bookingId: booking || ('carnival-history-' + normalizeShip(ship).toLowerCase().replace(/[^a-z0-9]+/g, '-') + '-' + normalizeDate(sailDate).replace(/[^0-9]/g, '')),
          numberOfGuests: '', numberOfNights: points > 0 && points <= 30 ? points : undefined, daysToGo: '', status: 'Completed',
          loyaltyLevel: '', loyaltyPoints: points ? String(points) : '', paidInFull: '', balanceDue: '', musterStation: '',
          bookingStatus: 'COMPLETED', packageCode: '', passengerStatus: '', stateroomNumber: '', stateroomCategoryCode: '', stateroomType: ''
        });
      }
    }
    return rows;
  }
  function rowsFromCapturedPayload() {
    var rows = [];
    var payload = window.capturedPayloads && window.capturedPayloads.upcomingCruises;
    function walk(value, depth) {
      if (!value || depth > 7 || rows.length > 1000) return;
      if (Array.isArray(value)) { for (var ai = 0; ai < value.length; ai++) walk(value[ai], depth + 1); return; }
      if (typeof value !== 'object') return;
      var ship = compact(value.shipName || value.ship || value.vesselName || '');
      var sailDate = compact(value.sailDate || value.departureDate || value.startDate || '');
      if (ship && sailDate) {
        var endDate = compact(value.endDate || value.returnDate || '');
        var statusText = compact(value.status || value.bookingStatus || 'Upcoming');
        var isCompleted = /completed|past|history/i.test(statusText);
        rows.push({
          rawBooking: undefined, sourcePage: isCompleted ? 'Completed' : 'Upcoming', shipName: normalizeShip(ship), shipCode: compact(value.shipCode || ''),
          cruiseTitle: compact(value.cruiseTitle || value.title || value.itinerary || 'Carnival Cruise'), sailingStartDate: normalizeDate(sailDate),
          sailingEndDate: normalizeDate(endDate), sailingDates: normalizeDate(sailDate), itinerary: compact(value.itinerary || value.destination || ''),
          departurePort: compact(value.departurePort || value.homePort || ''), arrivalPort: compact(value.arrivalPort || ''),
          cabinType: compact(value.stateroomType || value.cabinType || ''), cabinCategory: compact(value.stateroomCategoryCode || value.categoryCode || ''),
          cabinNumberOrGTY: compact(value.stateroomNumber || value.cabinNumber || 'GTY'), deckNumber: compact(value.deckNumber || ''),
          bookingId: compact(value.bookingId || value.confirmationNumber || value.reservationId || ('carnival-' + Date.now() + '-' + rows.length)),
          numberOfGuests: String(value.guestCount || value.numberOfGuests || ''), numberOfNights: Number(value.numberOfNights || value.duration || 0) || undefined,
          daysToGo: '', status: isCompleted ? 'Completed' : 'Upcoming', loyaltyLevel: '', loyaltyPoints: '', paidInFull: value.paidInFull ? 'Yes' : '',
          balanceDue: compact(value.balanceDue || value.amountDue || ''), musterStation: '', bookingStatus: compact(value.bookingStatus || statusText),
          packageCode: compact(value.packageCode || value.rateCode || ''), passengerStatus: '', stateroomNumber: compact(value.stateroomNumber || value.cabinNumber || ''),
          stateroomCategoryCode: compact(value.stateroomCategoryCode || value.categoryCode || ''), stateroomType: compact(value.stateroomType || value.cabinType || '')
        });
        return;
      }
      var keys = Object.keys(value);
      for (var ki = 0; ki < keys.length; ki++) walk(value[keys[ki]], depth + 1);
    }
    walk(payload, 0);
    return rows;
  }
  function upcomingFromDom() {
    var rows = [];
    var elements = document.querySelectorAll('[data-testid*="booking"],[data-testid*="cruise"],[class*="BookingCard"],[class*="booking-card"],[class*="CruiseCard"],[class*="cruise-card"]');
    for (var i = 0; i < elements.length && i < 200; i++) {
      var text = compact(elements[i].textContent);
      if (!/(booking|manage|sail|departure|carnival)/i.test(text)) continue;
      var shipMatch = text.match(/(?:Carnival\\s+)?(Adventure|Breeze|Celebration|Conquest|Dream|Elation|Encounter|Festivale|Firenze|Freedom|Glory|Horizon|Jubilee|Legend|Liberty|Luminosa|Magic|Mardi Gras|Miracle|Panorama|Paradise|Pride|Radiance|Spirit|Splendor|Sunrise|Sunshine|Valor|Venezia|Venice|Vista)/i);
      var dates = text.match(/(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\\.?\\s+\\d{1,2},?\\s+20\\d{2}|\\d{1,2}\\/\\d{1,2}\\/20\\d{2}/gi) || [];
      if (!shipMatch || !dates.length) continue;
      var bookingMatch = text.match(/(?:Booking|Confirmation)\\s*#?[:\\s]+([A-Z0-9-]{4,20})/i);
      rows.push({
        sourcePage: 'Upcoming', shipName: normalizeShip(shipMatch[1]), shipCode: '', cruiseTitle: text.substring(0, 160),
        sailingStartDate: normalizeDate(dates[0]), sailingEndDate: normalizeDate(dates[1] || ''), sailingDates: normalizeDate(dates[0]),
        itinerary: '', departurePort: '', arrivalPort: '', cabinType: '', cabinCategory: '', cabinNumberOrGTY: 'GTY', deckNumber: '',
        bookingId: bookingMatch ? bookingMatch[1] : ('carnival-upcoming-' + normalizeDate(dates[0]).replace(/[^0-9]/g, '') + '-' + i),
        numberOfGuests: '', numberOfNights: undefined, daysToGo: '', status: 'Upcoming', loyaltyLevel: '', loyaltyPoints: '',
        paidInFull: '', balanceDue: '', musterStation: '', bookingStatus: 'BOOKED', packageCode: '', passengerStatus: '',
        stateroomNumber: '', stateroomCategoryCode: '', stateroomType: ''
      });
    }
    return rows;
  }
  function dedupe(rows) {
    var map = {};
    var out = [];
    for (var i = 0; i < rows.length; i++) {
      var row = rows[i];
      var key = compact(row.bookingId).toLowerCase();
      if (!key || /^carnival-(?:history|upcoming)-/.test(key)) key = [compact(row.shipName), compact(row.sailingStartDate), compact(row.status)].join('|').toLowerCase();
      if (map[key]) continue;
      map[key] = true;
      out.push(row);
    }
    return out;
  }
  try {
    await expandHistoryRows();
    var profile = profileSnapshot();
    var rows = dedupe(rowsFromCapturedPayload().concat(upcomingFromDom(), completedFromTables()));
    var chunkSize = 12;
    if (!rows.length) post('carnival_profile_bookings_chunk', { requestId: INPUT.requestId, rows: [], chunkIndex: 1, totalChunks: 1 });
    else {
      var chunks = Math.ceil(rows.length / chunkSize);
      for (var i = 0; i < chunks; i++) post('carnival_profile_bookings_chunk', { requestId: INPUT.requestId, rows: rows.slice(i * chunkSize, (i + 1) * chunkSize), chunkIndex: i + 1, totalChunks: chunks });
    }
    var completedCount = rows.filter(function(row) { return /completed|past|history/i.test(compact(row.status + ' ' + row.bookingStatus + ' ' + row.sourcePage)); }).length;
    var upcomingCount = rows.length - completedCount;
    var bodyText = compact(document.body ? document.body.innerText : '');
    var upcomingEmptyConfirmed = /no\\s+(?:upcoming|booked)\\s+(?:cruises|trips)|you have no upcoming|no reservations found/i.test(bodyText);
    var historyEmptyConfirmed = /no\\s+(?:cruise\\s+)?history|no past cruises|you have no cruise history/i.test(bodyText);
    post('carnival_profile_scrape_complete', { requestId: INPUT.requestId, profile: profile, rowCount: rows.length, upcomingCount: upcomingCount, completedCount: completedCount, upcomingEmptyConfirmed: upcomingEmptyConfirmed, historyEmptyConfirmed: historyEmptyConfirmed, url: window.location.href || '' });
  } catch (error) {
    post('carnival_profile_scrape_complete', { requestId: INPUT.requestId, profile: { firstName: '', lastName: '', vifpNumber: '', vifpTier: '', vifpPoints: 0, cruiseDayPoints: 0, totalCruises: 0, playersClubTier: '', playersClubPoints: 0, hasVifpData: false, hasPlayersClubData: false }, rowCount: 0, upcomingCount: 0, completedCount: 0, upcomingEmptyConfirmed: false, historyEmptyConfirmed: false, error: String(error && error.message ? error.message : error), url: window.location.href || '' });
  }
})();
true;
`;
}
