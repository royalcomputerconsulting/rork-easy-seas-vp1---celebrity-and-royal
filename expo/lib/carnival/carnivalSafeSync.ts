import type { BookedCruiseRow, OfferRow } from '@/lib/royalCaribbean/types';
import {
  CARNIVAL_SHIP_CODE_MAP,
  CARNIVAL_VIFP_TIER_BY_CODE,
  decodeCarnivalVifpTier,
} from './carnivalDataRuntime';

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
  bookingLinkVerified?: boolean;
  bookingLinkSource?: 'explicit' | 'clicked' | 'catalog' | 'generated' | 'observed';
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
  debugInfo?: string;
}

export interface CarnivalSearchPageResult {
  requestId: string;
  runId: string;
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
  expectedUrl?: string;
  capturedUrl?: string;
  payloadMatched?: boolean;
  authoritativeEmpty?: boolean;
  readiness?: string;
  requestProof?: boolean;
  pageProof?: boolean;
  pageContextMatched?: boolean;
  renderedTerminalProof?: boolean;
  resultStable?: boolean;
  visibleRowCount?: number;
  displayedTotal?: number;
  nextControlState?: 'enabled' | 'disabled' | 'absent' | 'unknown';
  terminalProofSource?: 'api' | 'rendered_page' | 'authoritative_empty' | 'none';
  pageSignature?: string;
  paginationMode?: 'page' | 'offset' | 'cursor' | 'link' | 'unknown';
  nextPageNumber?: number;
  nextOffset?: number | null;
  nextCursor?: string;
  nextUrl?: string;
  truncationReason?: string;
  inventoryPayloadCount?: number;
  payloadKinds?: string[];
  rows: OfferRow[];
}

export interface CarnivalProfileSnapshot {
  firstName: string;
  lastName: string;
  vifpNumber: string;
  vifpTier: string;
  vifpTierSource?: 'authoritative' | 'inferred' | 'unknown';
  vifpPoints: number;
  cruiseDayPoints: number;
  totalCruises: number;
  playersClubTier: string;
  playersClubPoints: number;
  hasVifpData?: boolean;
  hasPlayersClubData?: boolean;
  authoritativeFields?: string[];
}

export interface CarnivalProfileScrapeResult {
  requestId: string;
  profile: CarnivalProfileSnapshot;
  bookings: BookedCruiseRow[];
  upcomingEmptyConfirmed?: boolean;
  historyEmptyConfirmed?: boolean;
  upcomingCount?: number;
  completedCount?: number;
  pageUrl?: string;
  pageKind?: 'cruises' | 'profile' | 'unknown';
  authenticatedPage?: boolean;
  discoveredProfileUrls?: string[];
  profilePayloadCount?: number;
  historyBounded?: boolean;
  debugInfo?: string;
  error?: string;
}

/**
 * Verifies the Carnival WebView session against the same protected profile API
 * used by the live site. Carnival's identity cookies are commonly HttpOnly, and
 * the profile SPA can finish its API request before member text appears in the
 * DOM, so cookie/visible-text checks alone produce false "login expired" states.
 */
export function injectCarnivalAuthenticationProbe(requestId: string, runId: string): string {
  const input = JSON.stringify({ requestId, runId });
  return `
(function() {
  var INPUT = ${input};
  var PROFILE_API = '/profilemanagement/api/v1.0/Profiles';
  var finished = false;
  function compact(value) { return String(value == null ? '' : value).replace(/\\s+/g, ' ').trim(); }
  function post(authenticated, source, details) {
    if (finished) return;
    finished = true;
    window.__easySeasCarnivalAuthProbeInFlight = false;
    var payload = details || {};
    try {
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'carnival_auth_probe',
        requestId: INPUT.requestId,
        runId: INPUT.runId,
        authenticated: !!authenticated,
        source: source || 'unknown',
        reason: compact(payload.reason || ''),
        httpStatus: Number(payload.httpStatus || 0),
        url: compact(payload.url || window.location.href || '')
      }));
    } catch (e) {}
  }
  function payloadShowsAuthenticationFailure(value) {
    if (!value || typeof value !== 'object') return false;
    var message = compact(value.message || value.error || value.errorMessage || value.description || value.title || '').toLowerCase();
    var status = Number(value.status || value.statusCode || value.httpStatus || 0);
    return status === 401 || status === 403 || /unauthori[sz]ed|forbidden|not authenticated|authentication required|session (?:has )?expired|please sign in|log in to continue/.test(message);
  }
  function payloadLooksProtected(value) {
    if (!value || typeof value !== 'object' || payloadShowsAuthenticationFailure(value)) return false;
    if (Array.isArray(value)) return true;
    var root = value.payload && typeof value.payload === 'object' ? value.payload : value;
    if (Array.isArray(root)) return true;
    return Object.keys(root || {}).length > 0;
  }
  function recentApiEvidence() {
    var observedAt = Number(window.__easySeasCarnivalApiAuthenticatedAt || 0);
    return observedAt > 0 && Date.now() - observedAt < 120000;
  }
  function domSnapshot() {
    var url = compact(window.location.href || '');
    var body = compact(document.body ? document.body.innerText : '');
    var hasPassword = !!document.querySelector('input[type="password"], form[action*="login"], form[action*="sign-in"]');
    var loginRoute = /(?:login|sign[-_]?in|identity|security|challenge|authenticate|session-expired)/i.test(url);
    var loginBody = /session (?:has )?expired|please sign in|log in to continue|authentication required/i.test(body);
    var profileRoute = /profilemanagement\\/profiles/i.test(url);
    var identityCookie = /(?:^|;\\s*)(?:user|tgo)=/i.test(String(document.cookie || ''));
    var accountEvidence = /VIFP(?:\\s+Club)?\\s*#?[:\\s]+[0-9]{6,15}|WELCOME BACK|My Profile|Cruise History|Sign Out/i.test(body);
    return {
      url: url,
      explicitAuthLost: hasPassword || loginRoute || loginBody,
      authenticated: !hasPassword && !loginRoute && !loginBody && ((profileRoute && (identityCookie || accountEvidence)) || recentApiEvidence())
    };
  }
  async function verify() {
    var dom = domSnapshot();
    if (dom.explicitAuthLost) {
      window.__easySeasCarnivalApiAuthenticatedAt = 0;
      post(false, 'explicit_login_page', { reason: 'Carnival is displaying a login or expired-session page', url: dom.url });
      return;
    }
    if (typeof window.fetch !== 'function') {
      post(dom.authenticated, dom.authenticated ? 'profile_dom' : 'fetch_unavailable', { reason: dom.authenticated ? '' : 'Protected profile API probe is unavailable', url: dom.url });
      return;
    }
    var controller = typeof AbortController === 'function' ? new AbortController() : null;
    var timer = setTimeout(function() { try { if (controller) controller.abort(); } catch (e) {} }, 6500);
    try {
      window.__easySeasCarnivalAuthProbeInFlight = true;
      var response = await window.fetch(PROFILE_API, {
        method: 'GET',
        credentials: 'include',
        cache: 'no-store',
        headers: { 'Accept': 'application/json, text/plain, */*' },
        signal: controller ? controller.signal : undefined
      });
      clearTimeout(timer);
      var responseUrl = compact(response.url || PROFILE_API);
      var responseContentType = compact(response.headers && response.headers.get ? response.headers.get('content-type') : '');
      var responseText = await response.text();
      var redirectedToLogin = /(?:login|sign[-_]?in|identity|security|challenge|authenticate|session-expired)/i.test(responseUrl);
      var authFailureText = /session (?:has )?expired|please sign in|log in to continue|unauthori[sz]ed|forbidden|authentication required/i.test(responseText);
      if (response.status === 401 || response.status === 403 || redirectedToLogin || authFailureText) {
        window.__easySeasCarnivalApiAuthenticatedAt = 0;
        post(false, 'protected_profile_api_rejected', { reason: 'Protected Carnival profile API rejected the session', httpStatus: response.status, url: responseUrl });
        return;
      }
      var parsed = null;
      try { parsed = responseText ? JSON.parse(responseText) : null; } catch (e) {}
      var isJson = /json|javascript/i.test(responseContentType) || /^\\s*[\\[{]/.test(responseText);
      if (response.ok && isJson && payloadLooksProtected(parsed)) {
        window.__easySeasCarnivalApiAuthenticatedAt = Date.now();
        window.__easySeasCarnivalApiAuthenticatedUrl = responseUrl;
        post(true, 'protected_profile_api', { httpStatus: response.status, url: responseUrl });
        return;
      }
      if (dom.authenticated) {
        post(true, 'profile_dom_fallback', { reason: 'Protected API response was indeterminate; signed-in profile evidence remained present', httpStatus: response.status, url: responseUrl });
        return;
      }
      post(false, 'protected_profile_api_indeterminate', { reason: 'Protected Carnival profile API did not return authenticated JSON', httpStatus: response.status, url: responseUrl });
    } catch (error) {
      clearTimeout(timer);
      var fallback = dom.authenticated || recentApiEvidence();
      post(fallback, fallback ? 'recent_protected_api_fallback' : 'protected_profile_api_error', {
        reason: fallback ? 'A recent protected profile response verified the session' : compact(error && error.message ? error.message : error),
        url: dom.url
      });
    }
  }
  verify();
})();
true;
`;
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
    const entryMap = new Map(entries.map((entry) => [entry.code, entry]));
    selectedCodes.forEach((code) => {
      const prior = entryMap.get(code) ?? { code, startDate: '', endDate: '' };
      entryMap.set(code, {
        ...prior,
        bookingLink: url.href,
        bookingLinkVerified: true,
        bookingLinkSource: 'explicit',
      });
    });
    const resolvedEntries = Array.from(entryMap.values());
    const tierCode = url.searchParams.get('tierCode') || '';
    const tierName = decodeCarnivalVifpTier(tierCode).tier;
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
      rateCodes: resolvedEntries,
      actionCards: [],
      noOffersConfirmed: false,
    };
  } catch {
    return fallback;
  }
}

export function isCarnivalBookingLinkForCode(value: string | null | undefined, rateCode: string): boolean {
  if (!value) return false;
  try {
    const url = new URL(value, CARNIVAL_OFFERS_LANDING_URL);
    const expected = normalizeCode(rateCode);
    const selected = (url.searchParams.get('ratecodes') || url.searchParams.get('rateCodes') || url.searchParams.get('rateCode') || '')
      .split(',')
      .map(normalizeCode)
      .filter(Boolean);
    return selected.includes(expected);
  } catch {
    return false;
  }
}

export function ensureCarnivalCodeSpecificCatalog(catalog: CarnivalCatalogDiscovery): CarnivalCatalogDiscovery {
  return {
    ...catalog,
    noOffersConfirmed: catalog.rateCodes.length === 0 && Boolean(catalog.noOffersConfirmed),
    rateCodes: catalog.rateCodes.map((entry) => {
      if (isCarnivalBookingLinkForCode(entry.bookingLink, entry.code)) {
        return { ...entry, bookingLinkVerified: true, bookingLinkSource: entry.bookingLinkSource || 'explicit' };
      }
      const generated = buildCarnivalOfferSearchUrl(catalog, entry.code, 1, 50);
      return {
        ...entry,
        bookingLink: generated,
        bookingLinkVerified: isCarnivalBookingLinkForCode(generated, entry.code),
        bookingLinkSource: 'generated',
      };
    }),
  };
}

export function buildCarnivalOfferSearchUrl(
  catalog: CarnivalCatalogDiscovery,
  rateCode: string,
  pageNumber: number = 1,
  pageSize: number = 50,
  pagination?: { offset?: number | null; cursor?: string; nextUrl?: string },
): string {
  let url: URL;
  try {
    url = new URL(pagination?.nextUrl || catalog.personalizedSearchUrl || `${CARNIVAL_OFFERS_LANDING_URL}`);
  } catch {
    url = new URL(CARNIVAL_OFFERS_LANDING_URL);
  }

  url.pathname = '/cruise-search';
  url.searchParams.set('pageNumber', String(Math.max(1, pageNumber)));
  if (pagination?.offset !== null && pagination?.offset !== undefined) url.searchParams.set('offset', String(Math.max(0, pagination.offset)));
  if (pagination?.cursor) url.searchParams.set('cursor', pagination.cursor);
  url.searchParams.set('numadults', '2');
  url.searchParams.set('ratecodes', normalizeCode(rateCode));
  // Ask Carnival for a large page so a virtualized card list cannot make the app
  // mistake two rendered cards for the authoritative server page size.
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

export function injectCarnivalCatalogDiscovery(runId = ''): string {
  const payload = serializeForInjection({ runId });
  return `
(function() {
  var INPUT = ${payload};
  function post(type, payload) {
    try { window.ReactNativeWebView.postMessage(JSON.stringify(Object.assign({ type: type, runId: INPUT.runId }, payload || {}))); } catch (e) {}
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
  function linkSelectsCode(link, code) {
    if (!link) return false;
    try {
      var parsed = new URL(link, window.location.href);
      var selected = parsed.searchParams.get('ratecodes') || parsed.searchParams.get('rateCodes') || parsed.searchParams.get('rateCode') || '';
      return selected.split(',').map(function(value) { return compact(value).toUpperCase(); }).indexOf(code) >= 0;
    } catch (e) { return false; }
  }
  function addEntry(map, code, startDate, endDate, offerName, perks, bookingLink, bookingLinkSource) {
    code = compact(code).toUpperCase();
    if (!/^[A-Z0-9]{2,10}$/.test(code)) return;
    var existing = map[code] || { code: code, startDate: '', endDate: '', offerName: '', perks: '', bookingLink: '', bookingLinkVerified: false, bookingLinkSource: '' };
    if (!existing.startDate && startDate) existing.startDate = compact(startDate);
    if (!existing.endDate && endDate) existing.endDate = compact(endDate);
    if ((!existing.offerName || /^Rate Code /i.test(existing.offerName)) && offerName) existing.offerName = compact(offerName).substring(0, 180);
    if (!existing.perks && perks) existing.perks = compact(perks).substring(0, 1000);
    if (bookingLink) {
      var resolvedLink = absolute(bookingLink);
      var verified = linkSelectsCode(resolvedLink, code);
      if (verified || !existing.bookingLink || !existing.bookingLinkVerified) {
        existing.bookingLink = resolvedLink;
        existing.bookingLinkVerified = verified;
        existing.bookingLinkSource = bookingLinkSource || (verified ? 'explicit' : 'observed');
      }
    }
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
          addEntry(map, selectedCodes[si], '', '', title, perks, linkUrl, 'catalog');
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
        addEntry(map, rateCode, '', expiryMatch ? expiryMatch[1] : '', compact(item.Title || item.title || ''), description, cta, 'catalog');
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
    var tierMap = ${JSON.stringify(CARNIVAL_VIFP_TIER_BY_CODE)};
    var entries = Object.keys(map).map(function(code) {
      var item = map[code];
      if (!item.offerName) item.offerName = 'Rate Code ' + code;
      return item;
    });
    // Zero offers is authoritative only on the authenticated My Offers page,
    // with zero valid rate codes and a visible offer-specific empty-state node.
    // Never trust broad body text because hidden templates and hydration shells
    // can contain the same wording while personalized cards are still loading.
    var authenticatedMyOffersPage = /\\/profilemanagement\\/profiles\\/offers(?:\\/|$)/i.test(String(window.location.pathname || ''))
      && !!(state.vifp || (user && (user.PastGuestNumber || user.VifpNumber)));
    var visibleNoOffersState = false;
    try {
      var emptyNodes = document.querySelectorAll('[data-testid*="empty" i],[class*="empty" i],[class*="no-offer" i],[class*="noOffer" i],[role="status"],[role="alert"],main h1,main h2,main h3,main p');
      for (var eni = 0; eni < emptyNodes.length; eni++) {
        var emptyRect = emptyNodes[eni].getBoundingClientRect ? emptyNodes[eni].getBoundingClientRect() : null;
        if (emptyRect && (emptyRect.width <= 0 || emptyRect.height <= 0)) continue;
        var emptyStyle = window.getComputedStyle ? window.getComputedStyle(emptyNodes[eni]) : null;
        if (emptyStyle && (emptyStyle.display === 'none' || emptyStyle.visibility === 'hidden' || emptyStyle.opacity === '0')) continue;
        var emptyText = compact(emptyNodes[eni].textContent || '');
        if (/^(?:you (?:currently )?do not have any offers|no (?:special )?(?:offers|deals) (?:available|found)|0 (?:offers|deals))\\.?$/i.test(emptyText)) {
          visibleNoOffersState = true;
          break;
        }
      }
    } catch (e) {}
    var noOffersConfirmed = authenticatedMyOffersPage && entries.length === 0 && visibleNoOffersState;
    var catalogDebugInfo = '';
    if (entries.length === 0) {
      try {
        var vifpPayloadForDebug = window.__carnivalVifpOffers || (window.capturedPayloads && window.capturedPayloads.carnivalVifpOffers);
        var vifpItemCount = vifpPayloadForDebug && Array.isArray(vifpPayloadForDebug.Items) ? vifpPayloadForDebug.Items.length : 0;
        catalogDebugInfo = 'onOffersPage=' + authenticatedMyOffersPage + ' links=' + links.length + ' actionCards=' + actionCards.length + ' vifpPayload=' + !!vifpPayloadForDebug + ' vifpItems=' + vifpItemCount + ' noOffersState=' + visibleNoOffersState + ' vifp=' + (state.vifp || 'none');
      } catch (debugError) { catalogDebugInfo = 'debug-error: ' + String(debugError && debugError.message ? debugError.message : debugError); }
    }
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
        noOffersConfirmed: noOffersConfirmed,
        debugInfo: catalogDebugInfo
      }
    });
  } catch (error) {
    post('carnival_catalog_discovered', { data: { sourceUrl: window.location.href || '', personalizedSearchUrl: '', tgo: '', vifp: '', tierCode: '', tierName: '', resident: '', locality: '1', currency: 'USD', rateCodes: [], actionCards: [], noOffersConfirmed: false, debugInfo: 'top-level-exception: ' + String(error && error.message ? error.message : error) }, error: String(error && error.message ? error.message : error) });
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
  runId: string;
  contextFingerprint: string;
  expectedUrl: string;
  offerCode: string;
  offerName: string;
  offerExpiry: string;
  perks: string;
  pageNumber: number;
  pageSize: number;
  priorUniqueCount?: number;
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
    var source = compact(text);
    if (!source) return '';
    var labelled = source.match(/(?:ship|vessel)\s*(?:name)?\s*[:\-]\s*((?:Carnival\s+)?[A-Z][A-Za-z'’-]+(?:\s+[A-Z][A-Za-z'’-]+){0,3}|Mardi Gras)/i);
    var generic = source.match(/\b(Carnival\s+[A-Z][A-Za-z'’-]+(?:\s+[A-Z][A-Za-z'’-]+){0,3}|Mardi Gras)\b/i);
    var raw = compact((labelled && labelled[1]) || (generic && generic[1]) || '');
    if (!raw || /^(?:Carnival\s+)?(?:Cruise|Cruise Line|Players Club|VIFP Club|Search|Deals|Home|Account|Booking)$/i.test(raw)) return '';
    if (/^Mardi Gras$/i.test(raw)) return 'Mardi Gras';
    if (!/^Carnival\s+/i.test(raw)) raw = 'Carnival ' + raw;
    return raw.replace(/\b\w/g, function(c) { return c.toUpperCase(); });
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
  function normalizeSearchUrl(raw) {
    try {
      var url = new URL(String(raw || ''), window.location.href);
      url.hash = '';
      return url.toString();
    } catch (e) { return String(raw || ''); }
  }
  function capturedEnvelope() {
    var payloads = window.capturedPayloads || {};
    var key = String(INPUT.runId || '') + '|' + String(INPUT.offerCode || '').toUpperCase() + '|' + Number(INPUT.pageNumber || 1) + '|' + String(INPUT.requestId || '');
    var envelope = payloads.carnivalSearchByContext && payloads.carnivalSearchByContext[key];
    if (!envelope || typeof envelope !== 'object') return null;
    if (String(envelope.runId || '') !== String(INPUT.runId || '')) return null;
    if (String(envelope.offerCode || '').toUpperCase() !== String(INPUT.offerCode || '').toUpperCase()) return null;
    if (String(envelope.requestId || '') !== String(INPUT.requestId || '')) return null;
    if (!INPUT.contextFingerprint || String(envelope.contextFingerprint || '') !== String(INPUT.contextFingerprint || '')) return null;
    if (Number(envelope.pageNumber || 1) !== Number(INPUT.pageNumber || 1)) return null;
    if (!envelope.inventoryValidated || !envelope.requestProof || !envelope.pageProof) return null;
    var validPayloads = Array.isArray(envelope.payloads) ? envelope.payloads.filter(function(item) {
      var analysis = item && item.analysis;
      var metadata = item && item.metadata;
      if (!analysis || !metadata) return false;
      if (analysis.kind !== 'inventory' && analysis.kind !== 'inventory_empty') return false;
      if (!analysis.offerCodeMatched || !analysis.pageMatched) return false;
      if (String(metadata.runId || '') !== String(INPUT.runId || '')) return false;
      if (String(metadata.requestId || '') !== String(INPUT.requestId || '')) return false;
      if (String(metadata.contextFingerprint || '') !== String(INPUT.contextFingerprint || '')) return false;
      if (String(metadata.offerCode || '').toUpperCase() !== String(INPUT.offerCode || '').toUpperCase()) return false;
      if (Number(metadata.pageNumber || 1) !== Number(INPUT.pageNumber || 1)) return false;
      return true;
    }) : [];
    if (!validPayloads.length) return null;
    envelope.payloads = validPayloads;
    envelope.data = validPayloads.map(function(item) { return item.data; });
    var capturedUrl = normalizeSearchUrl(envelope.url || '');
    var expectedUrl = normalizeSearchUrl(INPUT.expectedUrl || '');
    try {
      var captured = new URL(capturedUrl, window.location.href);
      var expected = new URL(expectedUrl, window.location.href);
      var capturedCode = String(captured.searchParams.get('ratecodes') || captured.searchParams.get('rateCodes') || captured.searchParams.get('rateCode') || '').toUpperCase();
      if (capturedCode && capturedCode.split(',').indexOf(String(INPUT.offerCode || '').toUpperCase()) < 0) return null;
      if (captured.pathname !== expected.pathname && captured.pathname.indexOf('search') < 0 && expected.pathname.indexOf('search') >= 0) return null;
    } catch (e) {}
    return envelope;
  }
  function adapterMeta(envelope) {
    var result = { totalResults: null, pageSize: null, pageNumber: null, offset: null, cursor: '', nextCursor: '', nextUrl: '', hasNextPage: null, authoritativeEmpty: false, kinds: [] };
    var payloads = envelope && Array.isArray(envelope.payloads) ? envelope.payloads : [];
    for (var i = 0; i < payloads.length; i++) {
      var analysis = payloads[i] && payloads[i].analysis;
      if (!analysis) continue;
      if (result.kinds.indexOf(String(analysis.kind || 'unknown')) < 0) result.kinds.push(String(analysis.kind || 'unknown'));
      if (analysis.totalResults !== null && analysis.totalResults !== undefined) result.totalResults = Number(analysis.totalResults);
      if (analysis.pageSize) result.pageSize = Number(analysis.pageSize);
      if (analysis.pageNumber !== null && analysis.pageNumber !== undefined) result.pageNumber = Number(analysis.pageNumber);
      if (analysis.offset !== null && analysis.offset !== undefined) result.offset = Number(analysis.offset);
      if (analysis.cursor) result.cursor = String(analysis.cursor);
      if (analysis.nextCursor) result.nextCursor = String(analysis.nextCursor);
      if (analysis.nextUrl) result.nextUrl = String(analysis.nextUrl);
      if (analysis.hasNextPage !== null && analysis.hasNextPage !== undefined) result.hasNextPage = Boolean(analysis.hasNextPage);
      if (analysis.authoritativeEmpty) result.authoritativeEmpty = true;
    }
    return result;
  }
  function pageContextMatchesExpected() {
    try {
      var current = new URL(window.location.href || '', window.location.href);
      var expected = new URL(INPUT.expectedUrl || '', window.location.href);
      var code = String(INPUT.offerCode || '').toUpperCase();
      var currentCodes = String(current.searchParams.get('ratecodes') || current.searchParams.get('rateCodes') || current.searchParams.get('rateCode') || '').toUpperCase().split(',');
      var expectedCodes = String(expected.searchParams.get('ratecodes') || expected.searchParams.get('rateCodes') || expected.searchParams.get('rateCode') || '').toUpperCase().split(',');
      return currentCodes.indexOf(code) >= 0 && expectedCodes.indexOf(code) >= 0 && (current.pathname === expected.pathname || (current.pathname.indexOf('search') >= 0 && expected.pathname.indexOf('search') >= 0));
    } catch (e) { return false; }
  }
  function pageSignature(rows, meta) {
    var keys = rows.map(function(row) { return [row.offerCode, row.shipName, row.sailingDate, row.itinerary, row.departurePort].join('|').toLowerCase(); }).sort();
    var raw = JSON.stringify({ keys: keys, total: meta.totalResults, page: meta.pageNumber, size: meta.pageSize, offset: meta.offset, cursor: meta.cursor, nextCursor: meta.nextCursor, nextUrl: meta.nextUrl });
    var hash = 2166136261;
    for (var i = 0; i < raw.length; i++) { hash ^= raw.charCodeAt(i); hash = Math.imul(hash, 16777619); }
    return 'fnv1a-' + (hash >>> 0).toString(16).padStart(8, '0');
  }
  function payloadPagination(value) {
    var result = { totalResults: null, pageSize: null, pageNumber: null, hasNextPage: null };
    var seen = [];
    var nodes = 0;
    function numberValue(input) {
      if (typeof input === 'number' && isFinite(input)) return input;
      var match = String(input || '').match(/[0-9][0-9,]*/);
      return match ? Number(match[0].replace(/,/g, '')) : null;
    }
    function walk(node, depth) {
      if (!node || typeof node !== 'object' || depth > 7 || nodes > 12000 || seen.indexOf(node) >= 0) return;
      seen.push(node); nodes++;
      var keys = Object.keys(node);
      for (var i = 0; i < keys.length; i++) {
        var key = keys[i];
        var lower = key.toLowerCase();
        var item = node[key];
        if (/^(total|totalcount|totalresults|resultcount|recordcount|numberofresults)$/.test(lower)) {
          var totalValue = numberValue(item);
          if (totalValue !== null) result.totalResults = result.totalResults === null ? totalValue : Math.max(result.totalResults, totalValue);
        }
        if (/^(pagesize|page_size|limit|perpage|itemsperpage)$/.test(lower)) {
          var pageSizeValue = numberValue(item);
          if (pageSizeValue !== null && pageSizeValue > 0 && pageSizeValue <= 500) result.pageSize = result.pageSize === null ? pageSizeValue : Math.max(result.pageSize, pageSizeValue);
        }
        if (/^(pagenumber|page|currentpage|pageindex)$/.test(lower)) {
          var pageValue = numberValue(item);
          if (pageValue !== null) result.pageNumber = result.pageNumber === null ? pageValue : Math.max(result.pageNumber, pageValue);
        }
        if (/^(hasnext|hasnextpage|more|hasmore)$/.test(lower) && typeof item === 'boolean') {
          result.hasNextPage = result.hasNextPage === true ? true : item;
        }
        if (/^(nextpage|next|nextpagetoken)$/.test(lower) && item) result.hasNextPage = true;
      }
      for (var j = 0; j < keys.length; j++) walk(node[keys[j]], depth + 1);
    }
    walk(value, 0);
    return result;
  }
  function collectEmbeddedRows(meta, envelope) {
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
    // Run-scoped API data is primary.
    // Run-scoped, schema-validated inventory payloads are primary. Pricing,
    // facets, analytics, configuration, and offer-catalog payloads never enter this walk.
    var inventoryPayloads = envelope && Array.isArray(envelope.payloads) ? envelope.payloads : [];
    for (var epi = 0; epi < inventoryPayloads.length; epi++) {
      var payloadAnalysis = inventoryPayloads[epi] && inventoryPayloads[epi].analysis;
      if (!payloadAnalysis || (payloadAnalysis.kind !== 'inventory' && payloadAnalysis.kind !== 'inventory_empty')) continue;
      walk(inventoryPayloads[epi].data, 0);
    }
    // Never walk broad hydration/__NEXT_DATA__ blobs. They may contain
    // sailings for several rate codes and cannot be tied to this request ID.
    // Visible cards remain a non-authoritative fallback; only run-scoped,
    // schema-validated network inventory can complete an offer.
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
      var key = [row.offerCode, row.shipName, row.sailingDate, row.itinerary, row.departurePort].join('|').toLowerCase();
      if (seen[key]) continue;
      seen[key] = true;
      out.push(row);
    }
    return out;
  }
  function visibleOfferSpecificEmptyState() {
    try {
      var candidates = document.querySelectorAll('[data-testid*="empty" i],[data-testid*="no-result" i],[class*="empty" i],[class*="no-result" i],[class*="noResults" i],[role="status"],[role="alert"],main h1,main h2,main h3,main p');
      for (var i = 0; i < candidates.length; i++) {
        var rect = candidates[i].getBoundingClientRect ? candidates[i].getBoundingClientRect() : null;
        if (rect && (rect.width <= 0 || rect.height <= 0)) continue;
        var style = window.getComputedStyle ? window.getComputedStyle(candidates[i]) : null;
        if (style && (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0')) continue;
        var text = compact(candidates[i].textContent || '');
        if (/^(?:0\\s+(?:cruise\\s+)?results?|no cruises found|we couldn\\.?t find(?: any)? cruises(?: matching your search)?|no sailings available)\\.?$/i.test(text)) return true;
      }
    } catch (e) {}
    return false;
  }
  async function waitForSearchReady() {
    var started = Date.now();
    var lastSignal = '';
    while (Date.now() - started < 8000) {
      var text = compact(document.body ? document.body.innerText : '');
      var cardCount = candidateCards().length;
      var hasTotal = /[0-9][0-9,]*\\s+(?:Cruise\\s+Results|Deals|Results)/i.test(text);
      var hasEmpty = visibleOfferSpecificEmptyState();
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
      var envelope = capturedEnvelope();
      var adapter = adapterMeta(envelope);
      var fallbackPagination = payloadPagination(envelope && envelope.data);
      var pageContextMatched = pageContextMatchesExpected();
      var apiRows = collectEmbeddedRows(meta, envelope);
      var domRows = pageContextMatched ? collectDomRows(meta) : [];
      var firstBodyText = compact(document.body ? document.body.innerText : '');
      var firstTotalMatch = firstBodyText.match(/([0-9][0-9,]*)\s+(?:Cruise\s+Results|Deals|Results)/i);
      var firstDomTotal = firstTotalMatch ? Number(firstTotalMatch[1].replace(/,/g, '')) : null;
      var firstNextControl = document.querySelector('a[rel="next"],button[aria-label*="next" i],a[aria-label*="next" i]');
      var firstNextDisabled = !!(firstNextControl && (firstNextControl.disabled || firstNextControl.getAttribute('aria-disabled') === 'true' || /disabled/i.test(firstNextControl.className || '')));
      var firstNextState = firstNextControl ? (firstNextDisabled ? 'disabled' : 'enabled') : 'absent';
      var firstDomSignature = pageSignature(dedupe(domRows), { totalResults: firstDomTotal, pageNumber: Number(INPUT.pageNumber || 1), pageSize: Number(INPUT.pageSize || 50), offset: null, cursor: '', nextCursor: '', nextUrl: firstNextState });
      var readinessIsStable = !/timeout|loading=true/i.test(String(readiness || ''));
      if (pageContextMatched && readinessIsStable) await new Promise(function(resolve) { setTimeout(resolve, 700); });
      var secondContextMatched = pageContextMatchesExpected();
      var secondDomRows = secondContextMatched ? collectDomRows(meta) : [];
      var bodyText = compact(document.body ? document.body.innerText : '');
      var totalMatch = bodyText.match(/([0-9][0-9,]*)\s+(?:Cruise\s+Results|Deals|Results)/i);
      var domTotal = totalMatch ? Number(totalMatch[1].replace(/,/g, '')) : null;
      var nextControl = document.querySelector('a[rel="next"],button[aria-label*="next" i],a[aria-label*="next" i]');
      var nextDisabled = !!(nextControl && (nextControl.disabled || nextControl.getAttribute('aria-disabled') === 'true' || /disabled/i.test(nextControl.className || '')));
      var nextControlState = nextControl ? (nextDisabled ? 'disabled' : 'enabled') : 'absent';
      var secondDomSignature = pageSignature(dedupe(secondDomRows), { totalResults: domTotal, pageNumber: Number(INPUT.pageNumber || 1), pageSize: Number(INPUT.pageSize || 50), offset: null, cursor: '', nextCursor: '', nextUrl: nextControlState });
      var resultStable = Boolean(pageContextMatched && secondContextMatched && readinessIsStable && firstDomSignature === secondDomSignature && firstNextState === nextControlState && Number(firstDomTotal == null ? -1 : firstDomTotal) === Number(domTotal == null ? -1 : domTotal));
      var rows = dedupe(apiRows.concat(domRows, secondDomRows));
      var authoritativeTotal = adapter.totalResults !== null ? adapter.totalResults : fallbackPagination.totalResults;
      var reportedTotal = authoritativeTotal !== null ? authoritativeTotal : (domTotal !== null ? domTotal : rows.length);
      var totalResults = Math.max(Number(reportedTotal || 0), rows.length);
      var effectivePageSize = adapter.pageSize || fallbackPagination.pageSize || Number(INPUT.pageSize) || 50;
      var authoritativeHasNext = adapter.hasNextPage !== null ? adapter.hasNextPage : fallbackPagination.hasNextPage;
      var hasNextPage = authoritativeHasNext !== null
        ? Boolean(authoritativeHasNext)
        : ((nextControlState === 'enabled') || (totalResults > (Number(INPUT.pageNumber || 1) * effectivePageSize)));
      var explicitEmptyText = visibleOfferSpecificEmptyState();
      var apiAuthoritativeEmpty = Boolean(envelope && adapter.authoritativeEmpty && adapter.totalResults === 0);
      var verifiedDomEmpty = Boolean(!envelope && resultStable && explicitEmptyText && visibleOfferSpecificEmptyState());
      var authoritativeEmpty = rows.length === 0 && (apiAuthoritativeEmpty || verifiedDomEmpty);
      var displayedTotalReached = domTotal === null ? true : (Number(INPUT.priorUniqueCount || 0) + rows.length) >= domTotal;
      var renderedTerminalProof = Boolean(pageContextMatched && resultStable && (rows.length > 0 || authoritativeEmpty) && displayedTotalReached && nextControlState !== 'enabled');
      var terminalProofSource = authoritativeEmpty ? 'authoritative_empty' : (envelope ? 'api' : (renderedTerminalProof ? 'rendered_page' : 'none'));
      var resolvedPageNumber = adapter.pageNumber || fallbackPagination.pageNumber || Number(INPUT.pageNumber || 1);
      var nextPageNumber = Number(resolvedPageNumber || INPUT.pageNumber || 1) + 1;
      var nextOffset = adapter.offset !== null && adapter.offset !== undefined ? Number(adapter.offset) + effectivePageSize : null;
      var paginationMode = adapter.nextUrl ? 'link' : (adapter.nextCursor ? 'cursor' : (adapter.offset !== null && adapter.offset !== undefined ? 'offset' : (resolvedPageNumber ? 'page' : 'unknown')));
      var signature = pageSignature(rows, {
        totalResults: totalResults, pageNumber: resolvedPageNumber, pageSize: effectivePageSize,
        offset: adapter.offset, cursor: adapter.cursor, nextCursor: adapter.nextCursor, nextUrl: adapter.nextUrl
      });
      var truncationReason = '';
      if (envelope && !hasNextPage && totalResults > rows.length && !authoritativeEmpty) {
        truncationReason = 'Authoritative payload ended pagination with only ' + rows.length + '/' + totalResults + ' rows on this page';
      }
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
        requestId: INPUT.requestId, runId: INPUT.runId, offerCode: INPUT.offerCode, offerName: meta.title,
        offerExpiry: meta.expiry, perks: meta.perks, pageNumber: INPUT.pageNumber,
        pageSize: INPUT.pageSize, effectivePageSize: effectivePageSize, totalResults: totalResults, hasNextPage: hasNextPage,
        rowCount: rows.length, readiness: readiness, url: window.location.href || '', expectedUrl: INPUT.expectedUrl || '',
        capturedUrl: envelope ? String(envelope.url || '') : '', payloadMatched: Boolean(envelope), authoritativeEmpty: authoritativeEmpty,
        requestProof: Boolean(envelope && envelope.requestProof), pageProof: Boolean(envelope && envelope.pageProof),
        pageContextMatched: pageContextMatched, renderedTerminalProof: renderedTerminalProof, resultStable: resultStable,
        visibleRowCount: dedupe(secondDomRows).length, displayedTotal: domTotal === null ? undefined : domTotal,
        nextControlState: nextControlState, terminalProofSource: terminalProofSource,
        pageSignature: signature, paginationMode: paginationMode,
        nextPageNumber: nextPageNumber, nextOffset: nextOffset, nextCursor: adapter.nextCursor || '', nextUrl: adapter.nextUrl || '',
        truncationReason: truncationReason, inventoryPayloadCount: envelope && Array.isArray(envelope.payloads) ? envelope.payloads.length : 0,
        payloadKinds: adapter.kinds || []
      });
    } catch (error) {
      post('carnival_search_page_complete', { requestId: INPUT.requestId, runId: INPUT.runId, offerCode: INPUT.offerCode, offerName: INPUT.offerName, offerExpiry: INPUT.offerExpiry, perks: INPUT.perks, pageNumber: INPUT.pageNumber, pageSize: INPUT.pageSize, effectivePageSize: 0, totalResults: 0, hasNextPage: false, rowCount: 0, error: String(error && error.message ? error.message : error), url: window.location.href || '', payloadMatched: false, authoritativeEmpty: false, requestProof: false, pageProof: false, pageContextMatched: false, renderedTerminalProof: false, resultStable: false, visibleRowCount: 0, nextControlState: 'unknown', terminalProofSource: 'none', paginationMode: 'unknown', pageSignature: '' });
    }
  }
  setTimeout(run, 250);
})();
true;
`;
}

export function injectCarnivalProfileScrape(requestId: string, runId = ''): string {
  const payload = serializeForInjection({ requestId, runId });
  return `
(async function() {
  var INPUT = ${payload};
  function post(type, payload) { try { window.ReactNativeWebView.postMessage(JSON.stringify(Object.assign({ type: type }, payload || {}))); } catch (e) {} }
  function compact(value) { return String(value || '').replace(/\\s+/g, ' ').trim(); }
  function wait(ms) { return new Promise(function(resolve) { setTimeout(resolve, ms); }); }
  async function expandHistoryRows() {
    var clickedLabels = {};
    for (var round = 0; round < 14; round++) {
      var controls = document.querySelectorAll('button,[role=\"button\"],a');
      var clicked = false;
      for (var ci = 0; ci < controls.length; ci++) {
        var label = compact(controls[ci].textContent || controls[ci].getAttribute('aria-label') || '');
        if (!/^(?:load more|show more|view more|more cruises|more history|cruise history|past cruises|booking history|view all|see all|expand|view details|show all cruises|see cruise history)$/i.test(label)) continue;
        if (/^(?:cruise history|past cruises|booking history|view all|see all|see cruise history)$/i.test(label) && clickedLabels[label.toLowerCase()]) continue;
        var disabled = controls[ci].disabled || controls[ci].getAttribute('aria-disabled') === 'true';
        if (disabled) continue;
        try { controls[ci].scrollIntoView({ block: 'center' }); controls[ci].click(); clickedLabels[label.toLowerCase()] = true; clicked = true; break; } catch (e) {}
      }
      if (!clicked) break;
      await wait(900);
    }
    try {
      var lastHeight = -1;
      for (var scrollRound = 0; scrollRound < 8; scrollRound++) {
        window.scrollTo(0, document.body.scrollHeight);
        await wait(500);
        var height = document.body.scrollHeight;
        if (height === lastHeight) break;
        lastHeight = height;
      }
      window.scrollTo(0, 0);
    } catch (e) {}
  }
  function normalizeShip(value) {
    var text = compact(value);
    if (!text) return '';
    if (/^Carnival\\s+/i.test(text) || /^Mardi Gras$/i.test(text)) return text;
    return 'Carnival ' + text.replace(/\\b\\w/g, function(c) { return c.toUpperCase(); });
  }
  function normalizeDate(value) {
    var raw = compact(value).replace(/\\u00a0/g, ' ');
    if (!raw) return '';
    var iso = raw.match(/\\b(20\\d{2})[-\\/](\\d{1,2})[-\\/](\\d{1,2})\\b/);
    var us = raw.match(/\\b(\\d{1,2})[-\\/](\\d{1,2})[-\\/](20\\d{2})\\b/);
    var monthNames = { jan: 1, january: 1, feb: 2, february: 2, mar: 3, march: 3, apr: 4, april: 4, may: 5, jun: 6, june: 6, jul: 7, july: 7, aug: 8, august: 8, sep: 9, sept: 9, september: 9, oct: 10, october: 10, nov: 11, november: 11, dec: 12, december: 12 };
    var textMonthFirst = raw.match(/\\b([A-Za-z]{3,9})\\.?\\s+(\\d{1,2})(?:st|nd|rd|th)?[,]?\\s+(20\\d{2})\\b/i);
    var textDayFirst = raw.match(/\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+([A-Za-z]{3,9})\\.?[,]?\\s+(20\\d{2})\\b/i);
    var year = 0, month = 0, day = 0;
    if (iso) { year = Number(iso[1]); month = Number(iso[2]); day = Number(iso[3]); }
    else if (us) { year = Number(us[3]); month = Number(us[1]); day = Number(us[2]); }
    else if (textMonthFirst) { year = Number(textMonthFirst[3]); month = monthNames[String(textMonthFirst[1]).toLowerCase()] || 0; day = Number(textMonthFirst[2]); }
    else if (textDayFirst) { year = Number(textDayFirst[3]); month = monthNames[String(textDayFirst[2]).toLowerCase()] || 0; day = Number(textDayFirst[1]); }
    if (!year || !month || !day) return raw;
    var parsed = new Date(year, month - 1, day, 12, 0, 0, 0);
    if (parsed.getFullYear() !== year || parsed.getMonth() !== month - 1 || parsed.getDate() !== day) return raw;
    return String(month).padStart(2, '0') + '/' + String(day).padStart(2, '0') + '/' + String(year);
  }
  function dateParts(value) {
    var normalized = normalizeDate(value);
    var match = normalized.match(/^(\\d{2})\\/(\\d{2})\\/(20\\d{2})$/);
    if (!match) return null;
    return { month: Number(match[1]), day: Number(match[2]), year: Number(match[3]) };
  }
  function deriveNights(startValue, endValue, textValue) {
    var explicit = compact(textValue).match(/\\b(\\d{1,3})[- ](?:day|night)s?\\b/i);
    if (explicit && Number(explicit[1]) > 0) return Number(explicit[1]);
    var start = dateParts(startValue), end = dateParts(endValue);
    if (!start || !end) return 0;
    var nights = Math.round((Date.UTC(end.year, end.month - 1, end.day) - Date.UTC(start.year, start.month - 1, start.day)) / 86400000);
    return nights > 0 && nights < 400 ? nights : 0;
  }
  function capturedProfilePayloads() {
    var payloads = [];
    var captured = window.capturedPayloads || {};
    if (captured.upcomingCruises) payloads.push(captured.upcomingCruises);
    var ledger = Array.isArray(captured.carnivalProfilePayloads) ? captured.carnivalProfilePayloads : [];
    for (var i = 0; i < ledger.length; i++) if (ledger[i] && ledger[i].data) payloads.push(ledger[i].data);
    if (captured.loyalty) payloads.push(captured.loyalty);
    return payloads;
  }
  function capturedValue(keyPattern) {
    var payloads = capturedProfilePayloads(), seen = [], answer = '', nodes = 0;
    function walk(value, depth) {
      if (answer !== '' || value == null || depth > 8 || nodes++ > 20000 || typeof value !== 'object') return;
      if (seen.indexOf(value) >= 0) return;
      seen.push(value);
      if (Array.isArray(value)) { for (var ai = 0; ai < value.length; ai++) walk(value[ai], depth + 1); return; }
      var keys = Object.keys(value);
      for (var ki = 0; ki < keys.length; ki++) {
        var key = keys[ki], item = value[key];
        if (keyPattern.test(key) && (typeof item === 'string' || typeof item === 'number')) {
          var candidate = compact(item); if (candidate) { answer = candidate; return; }
        }
      }
      for (var kj = 0; kj < keys.length; kj++) walk(value[keys[kj]], depth + 1);
    }
    for (var pi = payloads.length - 1; pi >= 0 && answer === ''; pi--) walk(payloads[pi], 0);
    return answer;
  }
  function enrichBookingRow(row) {
    var text = compact((row.cruiseTitle || '') + ' ' + (row.itinerary || ''));
    var explicitNights = Number(row.numberOfNights || 0);
    var derived = explicitNights > 0 ? explicitNights : deriveNights(row.sailingStartDate, row.sailingEndDate, text);
    var isCompleted = /completed|past|history/i.test(compact((row.status || '') + ' ' + (row.bookingStatus || '') + ' ' + (row.sourcePage || ''))) || isPastSailing(row.sailingEndDate || row.sailingStartDate);
    return Object.assign({}, row, { numberOfNights: derived > 0 ? derived : undefined, sourcePage: isCompleted ? 'Completed' : 'Upcoming', status: isCompleted ? 'Completed' : (row.status || 'Upcoming'), bookingStatus: isCompleted ? 'COMPLETED' : (row.bookingStatus || 'BOOKED'), daysToGo: isCompleted ? '0' : row.daysToGo });
  }

  function stableHash(value) {
    var input = compact(value).toLowerCase();
    var hash = 2166136261;
    for (var i = 0; i < input.length; i++) { hash ^= input.charCodeAt(i); hash = Math.imul(hash, 16777619); }
    return (hash >>> 0).toString(16).padStart(8, '0');
  }
  function syntheticBookingId(row) {
    var passenger = row && row.passengers && row.passengers[0] ? compact((row.passengers[0].firstName || '') + ' ' + (row.passengers[0].lastName || '')) : '';
    var basis = [compact(row && row.shipName), normalizeDate(row && (row.sailingStartDate || row.sailingDates)), normalizeDate(row && row.sailingEndDate), compact(row && (row.itinerary || row.cruiseTitle)), passenger, compact(row && (row.cabinNumberOrGTY || row.stateroomNumber))].join('|');
    return 'carnival-synthetic-' + stableHash(basis);
  }
  function isSyntheticBookingId(value) {
    var id = compact(value).toLowerCase();
    return !id || /^carnival-synthetic-/.test(id) || /^carnival-(?:history|upcoming)-/.test(id) || /^carnival-\\d{10,}-\\d+$/.test(id) || /^booking_\\d+$/.test(id);
  }
  function isPastSailing(value) {
    var normalized = normalizeDate(value);
    var match = normalized.match(/^(\\d{2})\\/(\\d{2})\\/(20\\d{2})$/);
    if (!match) return false;
    var sailing = new Date(Number(match[3]), Number(match[1]) - 1, Number(match[2]), 12, 0, 0, 0);
    var now = new Date();
    var today = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12, 0, 0, 0);
    return sailing.getTime() < today.getTime();
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
    var capturedVifpNumber = capturedValue(/^(?:pastguestnumber|vifpnumber|vifp_number|membernumber)$/i);
    var capturedTierCode = capturedValue(/^(?:tiercode|vifptiercode|loyaltytiercode)$/i);
    var capturedTierName = capturedValue(/^(?:tiername|vifptier|loyaltytier)$/i);
    var capturedVifpPoints = capturedValue(/^(?:vifppoints|totalpoints)$/i);
    var capturedCruiseDayPoints = capturedValue(/^(?:cruisedaypoints|cruise_day_points)$/i);
    var capturedTotalCruises = capturedValue(/^(?:totalcruises|cruisecount|total_cruises)$/i);
    var capturedPlayersTier = capturedValue(/^(?:playersclubtier|playerstier|casinotier)$/i);
    var capturedPlayersPoints = capturedValue(/^(?:playersclubpoints|playerspoints|playerpoints|casinopoints)$/i);
    var tierCode = compact(capturedTierCode || user.TierCode || user.tierCode);
    var tierMap = ${JSON.stringify(CARNIVAL_VIFP_TIER_BY_CODE)};
    var breakdownMatch = bodyText.match(/VIFP\\s+POINTS\\s+BREAKDOWN([\\s\\S]{0,600}?)(?:Check your Special Offers|Cruise History|$)/i);
    var breakdownText = breakdownMatch ? breakdownMatch[1] : '';
    var actualVifpMatch = bodyText.match(/([0-9][0-9,]*)\\s+VIFP\\s+Points(?!\\s+until)/i);
    var vifpPoints = Number(String(capturedVifpPoints || '').replace(/,/g, '')) || nearestNumberForLabel(/VIFP\\s+Points/, breakdownText) || (actualVifpMatch ? Number(actualVifpMatch[1].replace(/,/g, '')) : 0) || Number(user.Points || user.TotalPoints || user.VifpPoints || 0) || 0;
    var cruiseDayPoints = Number(String(capturedCruiseDayPoints || '').replace(/,/g, '')) || nearestNumberForLabel(/Cruise\\s+Day\\s+Points/, breakdownText) || nearestNumberForLabel(/Cruise\\s+Day\\s+Points/, bodyText);
    var totalCruises = Number(String(capturedTotalCruises || '').replace(/,/g, '')) || nearestNumberForLabel(/Total\\s+Cruises/, breakdownText) || nearestNumberForLabel(/Total\\s+Cruises/, bodyText);
    var playersTierMatch = bodyText.match(/Players(?:'|’)s?\\s+Club[^A-Za-z]{0,20}(Blue|Gold|Platinum|Black Card)/i);
    var playersPoints = Number(String(capturedPlayersPoints || '').replace(/,/g, '')) || nearestNumberForLabel(/Players(?:'|’)s?\\s+(?:Club\\s+)?(?:Points|Pts)/, bodyText) || Number(user.PlayersClubPoints || user.PlayersPoints || user.PlayersPts || 0) || 0;
    var hasVifpData = !!(capturedVifpNumber || capturedTierCode || capturedTierName || user.PastGuestNumber || user.VifpNumber || vifpMatch || tierCode || tierMatch || /VIFP\\s+Points|Cruise\\s+Day\\s+Points/i.test(bodyText));
    var hasPlayersClubData = !!(capturedPlayersTier || capturedPlayersPoints || playersTierMatch || /Players(?:'|’)s?\\s+(?:Club\\s+)?(?:Points|Pts)/i.test(bodyText) || user.PlayersClubPoints !== undefined || user.PlayersPoints !== undefined || user.PlayersPts !== undefined);
    var authoritativeFields = [];
    var hasOwn = function(object, key) { return !!object && Object.prototype.hasOwnProperty.call(object, key); };
    if (capturedVifpNumber || user.PastGuestNumber || user.VifpNumber || vifpMatch) authoritativeFields.push('vifpNumber');
    if (tierMap[tierCode] || capturedTierName || tierMatch) authoritativeFields.push('vifpTier');
    if (capturedVifpPoints !== '' || actualVifpMatch || /VIFP\\s+Points/i.test(breakdownText) || hasOwn(user, 'Points') || hasOwn(user, 'TotalPoints') || hasOwn(user, 'VifpPoints')) authoritativeFields.push('vifpPoints');
    if (capturedCruiseDayPoints !== '' || /Cruise\\s+Day\\s+Points/i.test(breakdownText + ' ' + bodyText) || hasOwn(user, 'CruiseDayPoints')) authoritativeFields.push('cruiseDayPoints');
    if (capturedTotalCruises !== '' || /Total\\s+Cruises/i.test(breakdownText + ' ' + bodyText) || hasOwn(user, 'TotalCruises')) authoritativeFields.push('totalCruises');
    if (capturedPlayersTier || playersTierMatch || hasOwn(user, 'PlayersClubTier')) authoritativeFields.push('playersClubTier');
    if (capturedPlayersPoints !== '' || /Players(?:'|’)s?\\s+(?:Club\\s+)?(?:Points|Pts)/i.test(bodyText) || hasOwn(user, 'PlayersClubPoints') || hasOwn(user, 'PlayersPoints') || hasOwn(user, 'PlayersPts')) authoritativeFields.push('playersClubPoints');
    return {
      firstName: compact(user.FirstName || nameParts[0] || ''),
      lastName: compact(user.LastName || nameParts.slice(1).join(' ')),
      vifpNumber: compact(capturedVifpNumber || user.PastGuestNumber || user.VifpNumber || (vifpMatch ? vifpMatch[1] : '')),
      vifpTier: compact(tierMap[tierCode] || capturedTierName || (tierMatch ? tierMatch[1] : '')),
      vifpTierSource: tierMap[tierCode] || capturedTierName || tierMatch ? 'authoritative' : 'unknown',
      vifpPoints: vifpPoints,
      cruiseDayPoints: cruiseDayPoints,
      totalCruises: totalCruises,
      playersClubTier: compact(capturedPlayersTier || (playersTierMatch ? playersTierMatch[1] : '')),
      playersClubPoints: playersPoints,
      hasVifpData: hasVifpData,
      hasPlayersClubData: hasPlayersClubData,
      authoritativeFields: authoritativeFields
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
          bookingId: booking || syntheticBookingId({ shipName: normalizeShip(ship), sailingStartDate: normalizeDate(sailDate), itinerary: destination }),
          numberOfGuests: '', numberOfNights: undefined, daysToGo: '', status: 'Completed',
          loyaltyLevel: '', loyaltyPoints: points ? String(points) : '', paidInFull: '', balanceDue: '', musterStation: '',
          bookingStatus: 'COMPLETED', packageCode: '', passengerStatus: '', stateroomNumber: '', stateroomCategoryCode: '', stateroomType: ''
        });
      }
    }
    return rows;
  }
  var SHIP_CODE_MAP = ${JSON.stringify(CARNIVAL_SHIP_CODE_MAP)};
  function isValidCalendarDate(value) {
    var parts = dateParts(value);
    return !!parts;
  }
  function rowsFromCapturedPayload() {
    var rows = [];
    var payloads = capturedProfilePayloads();
    function fieldFrom(object, names) {
      if (!object || typeof object !== 'object') return '';
      var keys = Object.keys(object);
      for (var ni = 0; ni < names.length; ni++) {
        var target = names[ni].toLowerCase();
        for (var ki = 0; ki < keys.length; ki++) {
          if (keys[ki].toLowerCase().replace(/[_-]/g, '') !== target) continue;
          var raw = object[keys[ki]];
          if (raw !== null && raw !== undefined && raw !== '') return raw;
        }
      }
      return '';
    }
    var WRAPPER_KEYS = ['ship', 'vessel', 'cruise', 'sailing', 'voyage', 'reservation', 'booking', 'itinerarydetails'];
    function field(object, names) {
      var direct = fieldFrom(object, names);
      if (direct !== '') return direct;
      if (!object || typeof object !== 'object') return '';
      var keys = Object.keys(object);
      for (var wi = 0; wi < WRAPPER_KEYS.length; wi++) {
        for (var ki = 0; ki < keys.length; ki++) {
          if (keys[ki].toLowerCase() !== WRAPPER_KEYS[wi]) continue;
          var nested = fieldFrom(object[keys[ki]], names);
          if (nested !== '') return nested;
        }
      }
      return '';
    }
    function walk(value, depth) {
      if (!value || depth > 7 || rows.length > 1000) return;
      if (Array.isArray(value)) { for (var ai = 0; ai < value.length; ai++) walk(value[ai], depth + 1); return; }
      if (typeof value !== 'object') return;
      var ship = compact(field(value, ['shipName', 'ship', 'vesselName', 'vessel', 'name']));
      var shipCodeValue = compact(field(value, ['shipCode', 'vesselCode', 'shipAbbreviation', 'code'])).toUpperCase();
      var sailDate = compact(field(value, ['sailDate', 'departureDate', 'startDate', 'sailingDate', 'sailingStartDate', 'embarkDate', 'embarkationDate', 'cruiseStartDate']));
      var itineraryValue = compact(field(value, ['itinerary', 'destination', 'itineraryName']));
      var cruiseTitleValue = compact(field(value, ['cruiseTitle', 'title']));
      var bookingIdValue = compact(field(value, ['bookingId', 'confirmationNumber', 'reservationId', 'bookingNumber']));
      var resolvedShip = ship || (shipCodeValue && SHIP_CODE_MAP[shipCodeValue]) || '';
      var hasSecondaryIdentifier = !!(resolvedShip || shipCodeValue || itineraryValue || cruiseTitleValue || bookingIdValue);
      if (sailDate && hasSecondaryIdentifier && isValidCalendarDate(sailDate)) {
        var endDate = compact(field(value, ['endDate', 'returnDate', 'sailingEndDate', 'debarkDate', 'debarkationDate', 'cruiseEndDate']));
        var statusText = compact(field(value, ['status', 'bookingStatus', 'reservationStatus', 'cruiseStatus']));
        var isCompleted = /completed|past|history/i.test(statusText) || isPastSailing(endDate || sailDate);
        if (!statusText) statusText = isCompleted ? 'Completed' : 'Upcoming';
        var passengers = field(value, ['passengers', 'guests', 'guestList']);
        var stateroomNumberValue = compact(field(value, ['stateroomNumber', 'cabinNumber', 'roomNumber']));
        var finalShipName = resolvedShip || (shipCodeValue ? shipCodeValue : 'Carnival Cruise Line');
        rows.push({
          rawBooking: undefined, sourcePage: isCompleted ? 'Completed' : 'Upcoming', shipName: normalizeShip(finalShipName), shipCode: shipCodeValue,
          cruiseTitle: cruiseTitleValue || compact(field(value, ['itinerary'])) || 'Carnival Cruise', sailingStartDate: normalizeDate(sailDate),
          sailingEndDate: normalizeDate(endDate), sailingDates: normalizeDate(sailDate), itinerary: itineraryValue,
          departurePort: compact(field(value, ['departurePort', 'homePort'])), arrivalPort: compact(field(value, ['arrivalPort'])),
          cabinType: compact(field(value, ['stateroomType', 'cabinType'])), cabinCategory: compact(field(value, ['stateroomCategoryCode', 'categoryCode'])),
          cabinNumberOrGTY: stateroomNumberValue || 'GTY', deckNumber: compact(field(value, ['deckNumber'])),
          bookingId: bookingIdValue || syntheticBookingId({ shipName: normalizeShip(finalShipName), sailingStartDate: normalizeDate(sailDate), sailingEndDate: normalizeDate(endDate), itinerary: itineraryValue, cabinNumberOrGTY: stateroomNumberValue || 'GTY', passengers: passengers || [] }),
          numberOfGuests: String(field(value, ['guestCount', 'numberOfGuests']) || ''), numberOfNights: Number(field(value, ['numberOfNights', 'duration', 'nights']) || 0) || undefined,
          daysToGo: '', status: isCompleted ? 'Completed' : 'Upcoming', loyaltyLevel: '', loyaltyPoints: '', paidInFull: field(value, ['paidInFull']) ? 'Yes' : '',
          balanceDue: compact(field(value, ['balanceDue', 'amountDue'])), musterStation: '', bookingStatus: compact(field(value, ['bookingStatus']) || statusText),
          packageCode: compact(field(value, ['packageCode', 'rateCode'])), passengerStatus: '', stateroomNumber: stateroomNumberValue,
          stateroomCategoryCode: compact(field(value, ['stateroomCategoryCode', 'categoryCode'])), stateroomType: compact(field(value, ['stateroomType', 'cabinType']))
        });
        return;
      }
      var keys = Object.keys(value);
      for (var ki = 0; ki < keys.length; ki++) walk(value[keys[ki]], depth + 1);
    }
    for (var pi = 0; pi < payloads.length; pi++) walk(payloads[pi], 0);
    return rows;
  }
  function genericCardScan() {
    var rows = [];
    try {
      var containers = document.querySelectorAll('div,li,article,section');
      var dateRe = /(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\\.?\\s+\\d{1,2},?\\s+20\\d{2}|\\d{1,2}[\\/\\-]\\d{1,2}[\\/\\-]20\\d{2}|20\\d{2}[\\/\\-]\\d{1,2}[\\/\\-]\\d{1,2}/gi;
      var shipRe = /\\b(Carnival\\s+[A-Za-z][A-Za-z0-9 '&.\\-]{2,35}|Mardi Gras)\\b/i;
      for (var i = 0; i < containers.length && i < 3000 && rows.length < 150; i++) {
        var el = containers[i];
        var text = compact(el.textContent);
        if (text.length < 15 || text.length > 900) continue;
        if (!shipRe.test(text)) continue;
        var dates = text.match(dateRe) || [];
        if (!dates.length || !isValidCalendarDate(dates[0])) continue;
        var childMatches = false;
        var childEls = el.children || [];
        for (var c = 0; c < childEls.length; c++) {
          var childText = compact(childEls[c].textContent);
          if (shipRe.test(childText) && dateRe.test(childText)) { childMatches = true; break; }
        }
        if (childMatches) continue;
        var shipMatch = text.match(shipRe);
        var bookingMatch = text.match(/(?:Booking|Confirmation|Reservation)\\s*#?[:\\s]+([A-Z0-9-]{4,20})/i);
        var domCompleted = /completed|past|history/i.test(text) || isPastSailing(dates[1] || dates[0]);
        rows.push({
          sourcePage: domCompleted ? 'Completed' : 'Upcoming', shipName: normalizeShip(shipMatch[1]), shipCode: '', cruiseTitle: text.substring(0, 160),
          sailingStartDate: normalizeDate(dates[0]), sailingEndDate: normalizeDate(dates[1] || ''), sailingDates: normalizeDate(dates[0]),
          itinerary: '', departurePort: '', arrivalPort: '', cabinType: '', cabinCategory: '', cabinNumberOrGTY: 'GTY', deckNumber: '',
          bookingId: bookingMatch ? bookingMatch[1] : syntheticBookingId({ shipName: normalizeShip(shipMatch[1]), sailingStartDate: normalizeDate(dates[0]), sailingEndDate: normalizeDate(dates[1] || ''), cruiseTitle: text.substring(0, 160), cabinNumberOrGTY: 'GTY' }),
          numberOfGuests: '', numberOfNights: undefined, daysToGo: domCompleted ? '0' : '', status: domCompleted ? 'Completed' : 'Upcoming', loyaltyLevel: '', loyaltyPoints: '',
          paidInFull: '', balanceDue: '', musterStation: '', bookingStatus: domCompleted ? 'COMPLETED' : 'BOOKED', packageCode: '', passengerStatus: '',
          stateroomNumber: '', stateroomCategoryCode: '', stateroomType: ''
        });
      }
    } catch (e) {}
    return rows;
  }
  function upcomingFromDom() {
    var rows = [];
    var elements = document.querySelectorAll('[data-testid*="booking"],[data-testid*="cruise"],[data-testid*="history" i],[data-testid*="voyage" i],[class*="BookingCard"],[class*="booking-card"],[class*="CruiseCard"],[class*="cruise-card"],[class*="history-card" i],[class*="HistoryCard"],[class*="history-row" i],[class*="past-cruise" i],[class*="PastCruise"]');
    for (var i = 0; i < elements.length && i < 200; i++) {
      var text = compact(elements[i].textContent);
      if (!/(booking|manage|sail|departure|carnival|cruise|history|vifp|points)/i.test(text)) continue;
      var structuredShip = compact(elements[i].getAttribute('data-ship-name') || elements[i].getAttribute('data-vessel-name') || '');
      var shipNode = elements[i].querySelector('[data-ship-name],[data-vessel-name],[itemprop="name"],[class*="ship-name" i],[class*="vessel" i],[data-testid*="ship" i]');
      if (!structuredShip && shipNode) structuredShip = compact(shipNode.getAttribute('data-ship-name') || shipNode.getAttribute('data-vessel-name') || shipNode.textContent || '');
      var labeledShip = text.match(/(?:Ship|Vessel)\\s*:?\\s*((?:Carnival\\s+)?[A-Za-z][A-Za-z0-9 '&.\\-]{2,45}?)(?=\\s+(?:Sail|Departure|Itinerary|Booking|Confirmation|\\d{1,2}[\\/\\-]|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)|$)/i);
      var carnivalShip = text.match(/\\b(Carnival\\s+[A-Za-z][A-Za-z0-9 '&.\\-]{2,35}|Mardi Gras)\\b/i);
      var heading = elements[i].querySelector('h1,h2,h3,h4,strong');
      var shipValue = structuredShip || compact(labeledShip ? labeledShip[1] : '') || compact(carnivalShip ? carnivalShip[1] : '') || compact(heading ? heading.textContent : '');
      var dates = text.match(/(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\\.?\\s+\\d{1,2},?\\s+20\\d{2}|\\d{1,2}[\\/\\-]\\d{1,2}[\\/\\-]20\\d{2}|20\\d{2}[\\/\\-]\\d{1,2}[\\/\\-]\\d{1,2}/gi) || [];
      if (!shipValue || !dates.length) continue;
      var bookingMatch = text.match(/(?:Booking|Confirmation)\\s*#?[:\\s]+([A-Z0-9-]{4,20})/i);
      var domCompleted = /completed|past|history/i.test(text) || isPastSailing(dates[1] || dates[0]);
      rows.push({
        sourcePage: domCompleted ? 'Completed' : 'Upcoming', shipName: normalizeShip(shipValue), shipCode: '', cruiseTitle: text.substring(0, 160),
        sailingStartDate: normalizeDate(dates[0]), sailingEndDate: normalizeDate(dates[1] || ''), sailingDates: normalizeDate(dates[0]),
        itinerary: '', departurePort: '', arrivalPort: '', cabinType: '', cabinCategory: '', cabinNumberOrGTY: 'GTY', deckNumber: '',
        bookingId: bookingMatch ? bookingMatch[1] : syntheticBookingId({ shipName: normalizeShip(shipValue), sailingStartDate: normalizeDate(dates[0]), sailingEndDate: normalizeDate(dates[1] || ''), cruiseTitle: text.substring(0, 160), cabinNumberOrGTY: 'GTY' }),
        numberOfGuests: '', numberOfNights: undefined, daysToGo: domCompleted ? '0' : '', status: domCompleted ? 'Completed' : 'Upcoming', loyaltyLevel: '', loyaltyPoints: '',
        paidInFull: '', balanceDue: '', musterStation: '', bookingStatus: domCompleted ? 'COMPLETED' : 'BOOKED', packageCode: '', passengerStatus: '',
        stateroomNumber: '', stateroomCategoryCode: '', stateroomType: ''
      });
    }
    return rows;
  }
  function dedupe(rows) {
    var indexByKey = {};
    var out = [];
    function completed(row) {
      return /completed|past|history/i.test(compact((row.status || '') + ' ' + (row.bookingStatus || '') + ' ' + (row.sourcePage || ''))) || isPastSailing(row.sailingEndDate || row.sailingStartDate);
    }
    for (var i = 0; i < rows.length; i++) {
      var row = rows[i];
      var key = compact(row.bookingId).toLowerCase();
      if (isSyntheticBookingId(key)) key = [compact(row.shipName), normalizeDate(row.sailingStartDate), normalizeDate(row.sailingEndDate), compact(row.itinerary || row.cruiseTitle), compact(row.cabinNumberOrGTY || row.stateroomNumber)].join('|').toLowerCase();
      if (indexByKey[key] === undefined) {
        indexByKey[key] = out.length;
        out.push(row);
        continue;
      }
      var priorIndex = indexByKey[key];
      var prior = out[priorIndex];
      if (completed(row) && !completed(prior)) out[priorIndex] = Object.assign({}, prior, row, { sourcePage: 'Completed', status: 'Completed', bookingStatus: 'COMPLETED', daysToGo: '0' });
    }
    return out.map(function(row) {
      return completed(row) ? Object.assign({}, row, { sourcePage: 'Completed', status: 'Completed', bookingStatus: 'COMPLETED', daysToGo: '0' }) : row;
    });
  }
  try {
    await expandHistoryRows();
    var profile = profileSnapshot();
    var payloadRows = rowsFromCapturedPayload();
    var domRows = upcomingFromDom();
    var tableRows = completedFromTables();
    var genericRows = (payloadRows.length + domRows.length + tableRows.length) === 0 ? genericCardScan() : [];
    var rows = dedupe(payloadRows.concat(domRows, tableRows, genericRows)).map(enrichBookingRow);
    var chunkSize = 12;
    if (!rows.length) post('carnival_profile_bookings_chunk', { requestId: INPUT.requestId, runId: INPUT.runId, rows: [], chunkIndex: 1, totalChunks: 1 });
    else {
      var chunks = Math.ceil(rows.length / chunkSize);
      for (var i = 0; i < chunks; i++) post('carnival_profile_bookings_chunk', { requestId: INPUT.requestId, runId: INPUT.runId, rows: rows.slice(i * chunkSize, (i + 1) * chunkSize), chunkIndex: i + 1, totalChunks: chunks });
    }
    var completedCount = rows.filter(function(row) { return /completed|past|history/i.test(compact(row.status + ' ' + row.bookingStatus + ' ' + row.sourcePage)); }).length;
    var upcomingCount = rows.length - completedCount;
    var bodyText = compact(document.body ? document.body.innerText : '');
    var pageUrl = String(window.location.href || '');
    var pageKind = /profilemanagement\\/profiles\\/cruises/i.test(pageUrl) ? 'cruises' : /profilemanagement\\/profiles(?:[/?#]|$)/i.test(pageUrl) ? 'profile' : 'unknown';
    var authenticatedPage = pageKind !== 'unknown' && !/(login|signin|identity|security|challenge|authenticate)/i.test(pageUrl) && !!(profile.vifpNumber || profile.hasVifpData || userCookie());
    function sectionText(pattern) {
      var candidates = document.querySelectorAll('section,article,[role="region"],div');
      for (var si = 0; si < candidates.length && si < 800; si++) {
        var heading = candidates[si].querySelector('h1,h2,h3,h4,[role="heading"]');
        var headingText = compact(heading ? heading.textContent : '');
        if (pattern.test(headingText)) return compact(candidates[si].textContent || '');
      }
      return '';
    }
    var upcomingSectionText = sectionText(/upcoming|booked|reservations|my cruises/i);
    var historySectionText = sectionText(/cruise history|past cruises|history/i);
    var upcomingEmptyConfirmed = authenticatedPage && pageKind === 'cruises' && !!upcomingSectionText && /no\\s+(?:upcoming|booked)\\s+(?:cruises|trips)|you have no upcoming|no reservations found/i.test(upcomingSectionText);
    var historyEmptyConfirmed = authenticatedPage && pageKind === 'cruises' && !!historySectionText && /no\\s+(?:cruise\\s+)?history|no past cruises|you have no cruise history/i.test(historySectionText);
    var discoveredProfileUrls = [];
    var seenProfileUrls = {};
    var links = document.querySelectorAll('a[href]');
    for (var li = 0; li < links.length && li < 1200; li++) {
      try {
        var candidate = new URL(links[li].getAttribute('href') || '', pageUrl);
        var candidateText = compact((links[li].textContent || '') + ' ' + candidate.pathname + ' ' + candidate.search);
        var sameCarnivalHost = /(^|\\.)carnival\\.com$/i.test(candidate.hostname);
        var profileRoute = /\\/profilemanagement\\/profiles(?:\\/|$)/i.test(candidate.pathname);
        var usefulRoute = /cruise|booking|reservation|history|past|trip|loyalty|vifp/i.test(candidateText);
        var offerRoute = /offer|deal|shop|search-results/i.test(candidateText);
        candidate.hash = '';
        var normalizedCandidate = candidate.toString();
        if (sameCarnivalHost && profileRoute && usefulRoute && !offerRoute && !seenProfileUrls[normalizedCandidate] && normalizedCandidate !== pageUrl) {
          seenProfileUrls[normalizedCandidate] = true;
          discoveredProfileUrls.push(normalizedCandidate);
        }
      } catch (_) {}
    }
    var profilePayloadCount = capturedProfilePayloads().length;
    var historyBounded = !!historyEmptyConfirmed || (Number(profile.totalCruises || 0) > 0 && completedCount >= Number(profile.totalCruises || 0));
    var debugInfo = '';
    if (rows.length === 0 && (profilePayloadCount > 0 || Number(profile.totalCruises || 0) > 0)) {
      try {
        var payloadsForDebug = capturedProfilePayloads();
        var payloadKeySamples = payloadsForDebug.slice(0, 3).map(function(p) {
          if (p === null || p === undefined) return 'null';
          if (Array.isArray(p)) return 'array[' + p.length + ']';
          if (typeof p !== 'object') return typeof p;
          return Object.keys(p).slice(0, 14).join(',');
        });
        debugInfo = 'payloads=' + payloadsForDebug.length + ' keys=[' + payloadKeySamples.join(' | ') + '] tables=' + document.querySelectorAll('table').length + ' totalCruisesOnProfile=' + (profile.totalCruises || 0);
      } catch (debugError) { debugInfo = 'debug-error: ' + String(debugError && debugError.message ? debugError.message : debugError); }
    }
    post('carnival_profile_scrape_complete', { requestId: INPUT.requestId, runId: INPUT.runId, profile: profile, rowCount: rows.length, upcomingCount: upcomingCount, completedCount: completedCount, upcomingEmptyConfirmed: upcomingEmptyConfirmed, historyEmptyConfirmed: historyEmptyConfirmed, discoveredProfileUrls: discoveredProfileUrls, profilePayloadCount: profilePayloadCount, historyBounded: historyBounded, pageUrl: pageUrl, pageKind: pageKind, authenticatedPage: authenticatedPage, debugInfo: debugInfo, url: pageUrl });
  } catch (error) {
    post('carnival_profile_scrape_complete', { requestId: INPUT.requestId, runId: INPUT.runId, profile: { firstName: '', lastName: '', vifpNumber: '', vifpTier: '', vifpTierSource: 'unknown', vifpPoints: 0, cruiseDayPoints: 0, totalCruises: 0, playersClubTier: '', playersClubPoints: 0, hasVifpData: false, hasPlayersClubData: false, authoritativeFields: [] }, rowCount: 0, upcomingCount: 0, completedCount: 0, upcomingEmptyConfirmed: false, historyEmptyConfirmed: false, debugInfo: 'top-level-exception: ' + String(error && error.message ? error.message : error), error: String(error && error.message ? error.message : error), url: window.location.href || '' });
  }
})();
true;
`;
}
