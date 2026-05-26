export const STEP1_OFFERS_SCRIPT = String.raw`
(function() {
  const BATCH_SIZE = 50;
  const MAX_BATCH_CHARS = 45000;
  
  function wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  function postOfferMessage(payload) {
    window.ReactNativeWebView.postMessage(JSON.stringify(payload));
  }

  function sendOfferBatch(offers, isFinal = false, totalCount = 0, offerCount = 0) {
    postOfferMessage({
      type: isFinal ? 'step_complete' : 'offers_batch',
      step: 1,
      data: offers,
      isFinal: isFinal,
      totalCount: totalCount,
      offerCount: offerCount
    });
  }

  function compactOfferRowForBridge(rawRow) {
    const row = Object.assign({}, rawRow || {});
    ['rawCardText', 'cardText', '_raw', '_sourceText', '_debugText', '_key'].forEach(function(k) { try { delete row[k]; } catch (e) {} });
    ['itinerary', 'perks', 'offerStatus', 'portList'].forEach(function(k) {
      if (typeof row[k] === 'string' && row[k].length > 1200) row[k] = row[k].slice(0, 1200);
    });
    if (Array.isArray(row.dayByDayItinerary) && row.dayByDayItinerary.length > 30) row.dayByDayItinerary = row.dayByDayItinerary.slice(0, 30);
    return row;
  }

  function sendOfferRowsInChunks(offerRows, offerCount) {
    if (!Array.isArray(offerRows) || offerRows.length === 0) {
      sendOfferBatch([], true, 0, offerCount);
      return;
    }

    let chunk = [];
    let chunkChars = 0;
    let sentCount = 0;
    let batchIndex = 0;

    for (const rawRow of offerRows) {
      const row = compactOfferRowForBridge(rawRow);
      let rowChars = 0;
      try {
        rowChars = JSON.stringify(row).length;
      } catch (e) {
        rowChars = 2500;
      }

      if (chunk.length > 0 && (chunk.length >= BATCH_SIZE || chunkChars + rowChars > MAX_BATCH_CHARS)) {
        batchIndex += 1;
        sendOfferBatch(chunk, false);
        sentCount += chunk.length;
        log('📤 Sent batch ' + batchIndex + ' with ' + chunk.length + ' sailings (total: ' + sentCount + '/' + offerRows.length + ')', 'info');
        chunk = [];
        chunkChars = 0;
      }

      chunk.push(row);
      chunkChars += rowChars;
    }

    if (chunk.length > 0) {
      batchIndex += 1;
      sendOfferBatch(chunk, false);
      sentCount += chunk.length;
      log('📤 Sent batch ' + batchIndex + ' with ' + chunk.length + ' sailings (total: ' + sentCount + '/' + offerRows.length + ')', 'info');
    }

    sendOfferBatch([], true, offerRows.length, offerCount);
  }
  
  function sendOfferProgress(offerIndex, totalOffers, offerName, sailingsCount, status) {
    window.ReactNativeWebView.postMessage(JSON.stringify({
      type: 'offer_progress',
      offerIndex: offerIndex,
      totalOffers: totalOffers,
      offerName: offerName,
      sailingsCount: sailingsCount,
      status: status
    }));
  }

  function log(message, type = 'info') {
    window.ReactNativeWebView.postMessage(JSON.stringify({
      type: 'log',
      message: message,
      logType: type
    }));
  }

  function safeStr(val) {
    if (val === null || val === undefined) return '';
    if (typeof val === 'string') return val;
    if (typeof val === 'object') {
      return val.name || val.description || val.code || val.text || val.title || val.value || '';
    }
    return String(val);
  }

  function pad2(value) {
    return String(value).padStart(2, '0');
  }

  function getDateParts(dateStr) {
    if (!dateStr) return null;
    const normalized = String(dateStr).trim();
    let match = normalized.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T\s].*)?$/);
    if (match) {
      return { year: parseInt(match[1], 10), month: parseInt(match[2], 10), day: parseInt(match[3], 10) };
    }
    match = normalized.match(/^(\d{4})(\d{2})(\d{2})$/);
    if (match) {
      return { year: parseInt(match[1], 10), month: parseInt(match[2], 10), day: parseInt(match[3], 10) };
    }
    match = normalized.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
    if (match) {
      const year = match[3].length === 2 ? 2000 + parseInt(match[3], 10) : parseInt(match[3], 10);
      return { year: year, month: parseInt(match[1], 10), day: parseInt(match[2], 10) };
    }
    match = normalized.match(/^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*\s+(\d{1,2})(?:st|nd|rd|th)?(?:,)?\s+(20\d{2})$/i);
    if (match) {
      const monthMap = { jan:1, feb:2, mar:3, apr:4, may:5, jun:6, jul:7, aug:8, sep:9, sept:9, oct:10, nov:11, dec:12 };
      const key = match[1].toLowerCase().slice(0, match[1].toLowerCase().startsWith('sept') ? 4 : 3);
      return { year: parseInt(match[3], 10), month: monthMap[key] || monthMap[key.slice(0,3)] || 0, day: parseInt(match[2], 10) };
    }
    try {
      const date = new Date(normalized);
      if (!isNaN(date.getTime())) {
        return { year: date.getFullYear(), month: date.getMonth() + 1, day: date.getDate() };
      }
    } catch (e) {}
    return null;
  }

  function formatDate(dateStr) {
    if (!dateStr) return '';
    const parts = getDateParts(dateStr);
    if (!parts) return dateStr;
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return months[parts.month - 1] + ' ' + parts.day + ', ' + parts.year;
  }

  function formatSailDate(dateStr) {
    if (!dateStr) return '';
    const parts = getDateParts(dateStr);
    if (!parts) return dateStr;
    return pad2(parts.month) + '/' + pad2(parts.day) + '/' + parts.year;
  }

  function toISODate(dateStr) {
    if (!dateStr) return '';
    const parts = getDateParts(dateStr);
    if (!parts) return dateStr;
    return parts.year + '-' + pad2(parts.month) + '-' + pad2(parts.day);
  }

  function isOfferLikeRecord(record) {
    if (!record || typeof record !== 'object') return false;
    return !!(
      record.campaignOffer ||
      record.offer ||
      record.offerDetails ||
      record.offerCode ||
      record.marketingCouponCode ||
      record.couponCode ||
      record.reserveByDate ||
      record.expirationDate ||
      record.marketingEndDate
    );
  }

  function getCampaignOffer(offer) {
    return offer?.campaignOffer || offer?.offer || offer?.offerDetails || offer || {};
  }

  function collectOfferArrays(value, depth) {
    if (depth > 4 || !value) return [];
    if (Array.isArray(value)) {
      if (value.some(isOfferLikeRecord)) return value;
      return value.flatMap(item => collectOfferArrays(item, depth + 1));
    }
    if (typeof value !== 'object') return [];
    const collected = [];
    Object.keys(value).forEach(key => {
      const normalizedKey = key.toLowerCase();
      if (normalizedKey.includes('offer') || normalizedKey === 'payload' || normalizedKey === 'data') {
        collected.push(...collectOfferArrays(value[key], depth + 1));
      }
    });
    return collected;
  }

  function getOfferIdentityKey(offer, fallback) {
    const co = getCampaignOffer(offer);
    const parts = [
      safeStr(co.offerCode || co.marketingCouponCode || co.couponCode || co.code),
      safeStr(co.name || co.title || co.offerName || co.marketingTitle || co.description),
      safeStr(co.reserveByDate || co.expirationDate || co.marketingEndDate),
      getOfferStatus(co, offer),
    ].filter(Boolean);
    if (parts.length > 0) return parts.join('|').toLowerCase();
    try { return fallback + '|' + JSON.stringify(offer).slice(0, 500); } catch (e) { return fallback; }
  }

  function extractCandidateOffers(candidate) {
    if (Array.isArray(candidate)) return candidate.filter(item => item && typeof item === 'object');
    if (!candidate || typeof candidate !== 'object') return [];
    if (isOfferLikeRecord(candidate)) return [candidate];
    return collectOfferArrays(candidate, 0);
  }

  function extractOffersArray(data) {
    const candidates = [
      data,
      data?.offers,
      data?.offer,
      data?.casinoOffers,
      data?.casinoOffer,
      data?.featuredOffers,
      data?.featuredOffer,
      data?.featuredCasinoOffers,
      data?.featuredCasinoOffer,
      data?.casinoFeaturedOffers,
      data?.casinoFeaturedOffer,
      data?.highlightedOffers,
      data?.highlightedOffer,
      data?.primaryOffers,
      data?.primaryOffer,
      data?.moreOffers,
      data?.moreOffer,
      data?.availableOffers,
      data?.availableOffer,
      data?.payload?.casinoOffers,
      data?.payload?.casinoOffer,
      data?.payload?.offers,
      data?.payload?.offer,
      data?.payload?.featuredOffers,
      data?.payload?.featuredOffer,
      data?.payload?.featuredCasinoOffers,
      data?.payload?.featuredCasinoOffer,
      data?.payload?.casinoFeaturedOffers,
      data?.payload?.casinoFeaturedOffer,
      data?.payload?.highlightedOffers,
      data?.payload?.highlightedOffer,
      data?.payload?.primaryOffers,
      data?.payload?.primaryOffer,
      data?.payload?.moreOffers,
      data?.payload?.moreOffer,
      data?.payload?.availableOffers,
      data?.payload?.availableOffer,
      data?.data?.casinoOffers,
      data?.data?.casinoOffer,
      data?.data?.offers,
      data?.data?.offer,
      data?.data?.featuredOffers,
      data?.data?.featuredOffer,
      data?.data?.moreOffers,
      data?.data?.moreOffer,
      data?.data?.availableOffers,
      data?.data?.availableOffer,
    ];
    const map = new Map();
    const addOffer = (offer, index, source) => {
      if (!offer || typeof offer !== 'object') return;
      const key = getOfferIdentityKey(offer, source + ':' + index);
      if (!map.has(key)) map.set(key, offer);
    };
    candidates.forEach((candidate, candidateIndex) => {
      extractCandidateOffers(candidate).forEach((offer, offerIndex) => addOffer(offer, offerIndex, 'candidate:' + candidateIndex));
    });
    collectOfferArrays(data, 0).forEach((offer, index) => addOffer(offer, index, 'deep'));
    return Array.from(map.values());
  }

  function normalizeOffersApiResponse(data) {
    const base = data && typeof data === 'object' && !Array.isArray(data) ? data : {};
    return { ...base, offers: extractOffersArray(data) };
  }

  function getOfferStatus(co, offer) {
    return safeStr(
      co?.status ||
      co?.offerStatus ||
      co?.redemptionStatus ||
      co?.progressStatus ||
      co?.state ||
      offer?.status ||
      offer?.offerStatus ||
      offer?.redemptionStatus ||
      offer?.progressStatus ||
      offer?.state ||
      ''
    );
  }

  function isOfferInProgress(co, offer) {
    if (co?.isInProgress || co?.inProgress || co?.isPending || offer?.isInProgress || offer?.inProgress || offer?.isPending) {
      return true;
    }
    const status = getOfferStatus(co, offer).toLowerCase().replace(/[\s_-]+/g, ' ').trim();
    if (status.includes('in progress') || status.includes('pending') || status.includes('processing') || status.includes('earning')) {
      return true;
    }
    return false;
  }


  function getAllOffersExpectedCount() {
    try {
      const pageText = document.body?.textContent || '';
      const allMatch = pageText.match(/All\s+Offers?\s*\((\d+)\)/i);
      if (allMatch) return parseInt(allMatch[1], 10) || 0;
      const featuredMatch = pageText.match(/Featured\s+Offers?\s*\((\d+)\)/i);
      const moreMatch = pageText.match(/More\s+Offers?\s*\((\d+)\)/i);
      return (featuredMatch ? parseInt(featuredMatch[1], 10) || 0 : 0) + (moreMatch ? parseInt(moreMatch[1], 10) || 0 : 0);
    } catch (e) { return 0; }
  }

  function getViewSailingsButtons() {
    try {
      return Array.from(document.querySelectorAll('button, a, [role="button"], [role="tab"]')).filter(el => {
        const text = (el.textContent || el.innerText || el.getAttribute('aria-label') || '').trim().toLowerCase();
        return text.includes('view sailing') || text.includes('view sailings') || text.includes('see sailing') || text.includes('see sailings');
      });
    } catch (e) { return []; }
  }

  function clickElementLikeUser(el) {
    if (!el) return false;
    try {
      const target = el.closest('button, a, [role="button"], [role="tab"]') || el;
      target.scrollIntoView({ behavior: 'instant', block: 'center', inline: 'center' });
      const rect = target.getBoundingClientRect();
      const x = rect.left + Math.max(4, rect.width / 2);
      const y = rect.top + Math.max(4, rect.height / 2);
      ['pointerdown','mousedown','touchstart','pointerup','mouseup','touchend','click'].forEach(type => {
        try {
          const evt = type.indexOf('touch') === 0
            ? new Event(type, { bubbles: true, cancelable: true })
            : new MouseEvent(type, { bubbles: true, cancelable: true, clientX: x, clientY: y });
          target.dispatchEvent(evt);
        } catch (e) {}
      });
      if (typeof target.click === 'function') target.click();
      return true;
    } catch (e) { return false; }
  }

  async function waitForOffersPageToRender(timeoutMs) {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      const text = document.body?.textContent || '';
      if (/All\s+Offers?/i.test(text) || /View\s+Sailings?/i.test(text) || /My\s+Offers/i.test(text)) return true;
      await wait(750);
    }
    return false;
  }

  async function expandAllOffersBeforeExtraction() {
    try {
      await waitForOffersPageToRender(8000);
      let expectedBefore = getAllOffersExpectedCount();
      log('🔎 Club Royale page reports All Offers count: ' + (expectedBefore || 'unknown'), 'info');

      const tryFindClickable = () => Array.from(document.querySelectorAll('button, a, [role="button"], [role="tab"], div, span, li')).find(el => {
        const direct = Array.from(el.childNodes || []).filter(n => n.nodeType === 3).map(n => n.textContent || '').join(' ');
        const aria = el.getAttribute && (el.getAttribute('aria-label') || el.getAttribute('title') || '');
        const ownText = (direct || aria || '').replace(/\s+/g, ' ').trim();
        const fullText = (el.textContent || el.innerText || '').replace(/\s+/g, ' ').trim();
        const text = ownText || (fullText.length <= 40 ? fullText : '');
        if (!text || text.length > 40) return false;
        return /^All\s+Offers?(\s*\(\d+\))?$/i.test(text);
      });

      let clicked = false;
      const clickable = tryFindClickable();
      if (clickable) {
        const text = (clickable.textContent || clickable.innerText || clickable.getAttribute('aria-label') || 'All Offers').replace(/\s+/g, ' ').trim();
        log('👆 Clicking Club Royale "' + text + '" before scraping offers', 'info');
        clicked = clickElementLikeUser(clickable);
        await wait(1500);
      }

      if (!clicked) {
        log('ℹ️ All Offers control not found by exact text; skipping unsafe container click and using visible cards/lazy-load scroll', 'info');
        // Deliberately do not click random screen coordinates; earlier builds clicked the entire page container.
      }

      for (let pass = 0; pass < 1; pass += 1) {
        for (let i = 0; i < 5; i += 1) {
          window.scrollBy(0, 550);
          await wait(350);
        }
        window.scrollTo(0, 0);
        await wait(900);
        if (getViewSailingsButtons().length >= Math.max(1, expectedBefore || 1)) break;
      }
      const expectedAfter = getAllOffersExpectedCount();
      const viewButtons = getViewSailingsButtons().length;
      log('📊 Offer page expanded: expected ' + (expectedAfter || expectedBefore || 'unknown') + ' offer(s), found ' + viewButtons + ' View Sailings button(s)', viewButtons > 0 ? 'success' : 'warning');
    } catch (e) {
      log('⚠️ Could not expand All Offers before extraction: ' + e.message, 'warning');
    }
  }

  function findFirstDeepValue(obj, keyPatterns, depth) {
    if (!obj || depth > 8) return '';
    if (typeof obj !== 'object') return '';
    for (const key of Object.keys(obj)) {
      const lower = key.toLowerCase();
      if (keyPatterns.some(p => p.test(lower))) {
        const value = obj[key];
        if (value !== null && value !== undefined && String(value).trim()) return String(value).trim();
      }
    }
    for (const key of Object.keys(obj)) {
      const value = obj[key];
      if (value && typeof value === 'object') {
        const found = findFirstDeepValue(value, keyPatterns, depth + 1);
        if (found) return found;
      }
    }
    return '';
  }

  async function getCookieBasedRoyalAuthContext() {
    const host = location && location.hostname ? location.hostname : '';
    const brandCode = host.includes('celebritycruises.com') ? 'C' : 'R';
    const baseUrl = brandCode === 'C' ? 'https://www.celebritycruises.com' : 'https://www.royalcaribbean.com';
    try {
      log('🔐 No localStorage session found; trying cookie-based Royal/Celebrity session API fallback...', 'warning');
      let loyaltyId = '';
      let accountId = '';
      const loyaltyUrl = baseUrl + (brandCode === 'C' ? '/api/casino/v1/loyalty-data' : '/api/casino/v1/loyalty-data');
      try {
        const loyaltyResponse = await fetch(loyaltyUrl, { method: 'GET', credentials: 'include', headers: { accept: 'application/json' } });
        log('Cookie loyalty-data response status: ' + loyaltyResponse.status, loyaltyResponse.ok ? 'info' : 'warning');
        if (loyaltyResponse.ok) {
          const loyaltyData = await loyaltyResponse.json();
          loyaltyId = findFirstDeepValue(loyaltyData, [/cruise.*loyalty.*id/, /loyalty.*number/, /loyalty.*id/, /casino.*id/, /player.*id/], 0);
          accountId = findFirstDeepValue(loyaltyData, [/account.*id/, /guest.*id/, /profile.*id/], 0);
          log('Cookie fallback loyalty id detected: ' + (loyaltyId ? '[found]' : '[not found]'), loyaltyId ? 'success' : 'warning');
        }
      } catch (loyaltyErr) {
        log('Cookie loyalty-data fallback failed: ' + loyaltyErr.message, 'warning');
      }
      const headers = {
        accept: 'application/json',
        'accept-language': 'en-US,en;q=0.9',
        'content-type': 'application/json',
      };
      return { headers, accountId, loyaltyId, brandCode, baseUrl, user: null, cookieBased: true };
    } catch (e) {
      log('Cookie-based auth context failed: ' + e.message, 'warning');
      throw e;
    }
  }



  function deepFindFirst(obj, predicate, depth) {
    if (!obj || depth > 8) return '';
    if (typeof obj !== 'object') return '';
    if (Array.isArray(obj)) {
      for (const item of obj) {
        const found = deepFindFirst(item, predicate, depth + 1);
        if (found) return found;
      }
      return '';
    }
    for (const key of Object.keys(obj)) {
      const value = obj[key];
      try {
        if (predicate(key, value)) return String(value || '').trim();
      } catch (e) {}
    }
    for (const key of Object.keys(obj)) {
      const found = deepFindFirst(obj[key], predicate, depth + 1);
      if (found) return found;
    }
    return '';
  }

  function extractLoyaltyIdFromCapturedPayloads() {
    try {
      const payloads = window.capturedPayloads || {};
      const candidates = [payloads.loyalty, payloads.offers];
      for (const data of candidates) {
        const found = deepFindFirst(data, (key, value) => {
          const k = String(key || '').toLowerCase();
          return value && (k.includes('cruiseloyaltyid') || k.includes('loyaltynumber') || k.includes('loyaltyid') || k.includes('crownandanchorid')) && String(value).replace(/\D/g, '').length >= 6;
        }, 0);
        if (found) return found;
      }
    } catch (e) {}
    return '';
  }

  function getCapturedAuthHeaders() {
    try {
      const captured = window.capturedRequestHeaders || {};
      const headers = {
        'accept': 'application/json',
        'accept-language': 'en-US,en;q=0.9',
        'content-type': 'application/json'
      };
      if (captured.authorization) headers.authorization = captured.authorization;
      if (captured.accountId) headers['account-id'] = captured.accountId;
      if (captured.apiKey) {
        headers['x-api-key'] = captured.apiKey;
        headers.appkey = captured.apiKey;
      }
      return headers;
    } catch (e) {
      return { 'accept': 'application/json', 'accept-language': 'en-US,en;q=0.9', 'content-type': 'application/json' };
    }
  }

  async function extractClubRoyaleStatus() {
    try {
      log('Extracting Club Royale status...');
      log('⚠️ Note: Loyalty data will be fetched via API in Step 4 for accuracy', 'info');
      return null;
    } catch (error) {
      log('Error extracting Club Royale status: ' + error.message, 'warning');
      return null;
    }
  }

  async function getAuthContext() {
    try {
      log('Parsing session/captured auth context...');
      const host = location && location.hostname ? location.hostname : '';
      const brandCode = host.includes('celebritycruises.com') ? 'C' : (host.includes('carnival.com') ? 'N' : 'R');
      const baseUrl = brandCode === 'C' ? 'https://www.celebritycruises.com' : (brandCode === 'N' ? 'https://www.carnival.com' : 'https://www.royalcaribbean.com');
      let accountId = '';
      let loyaltyId = extractLoyaltyIdFromCapturedPayloads();
      let user = null;
      let headers = getCapturedAuthHeaders();

      try {
        const sessionData = localStorage.getItem('persist:session');
        if (sessionData) {
          const parsedData = JSON.parse(sessionData);
          const authToken = parsedData.token ? JSON.parse(parsedData.token) : null;
          const tokenExpiration = parsedData.tokenExpiration ? JSON.parse(parsedData.tokenExpiration) : null;
          user = parsedData.user ? JSON.parse(parsedData.user) : null;
          accountId = user && user.accountId ? user.accountId : (headers['account-id'] || '');
          loyaltyId = (user && user.cruiseLoyaltyId ? user.cruiseLoyaltyId : '') || loyaltyId;
          const currentTime = Date.now();
          if (tokenExpiration && tokenExpiration < currentTime) {
            log('Session token appears expired, but trying cookie/network-auth offer fetch before failing', 'warning');
          }
          if (authToken) {
            const rawAuth = authToken && authToken.toString ? authToken.toString() : '';
            headers.authorization = rawAuth.startsWith('Bearer ') ? rawAuth : 'Bearer ' + rawAuth;
          }
          if (accountId) headers['account-id'] = accountId;
          log('Session/captured auth context available', 'success');
        } else {
          accountId = headers['account-id'] || '';
          log('No local session data found; using Royal cookies/captured request headers for offer fetch', 'warning');
        }
      } catch (sessionErr) {
        accountId = headers['account-id'] || '';
        log('Could not parse local session; using cookies/captured headers: ' + sessionErr.message, 'warning');
      }

      return { headers, accountId, loyaltyId, brandCode, baseUrl, user };
    } catch (error) {
      log('Failed to get auth context: ' + error.message, 'error');
      throw error;
    }
  }

  async function fetchPricingAndItinerary(baseUrl, shipCode, minDate, maxDate, count) {
    const endpoint = baseUrl + '/graph';
    const query = 'query cruiseSearch_Cruises($filters:String,$qualifiers:String,$sort:CruiseSearchSort,$pagination:CruiseSearchPagination,$nlSearch:String){cruiseSearch(filters:$filters,qualifiers:$qualifiers,sort:$sort,pagination:$pagination,nlSearch:$nlSearch){results{cruises{id productViewLink masterSailing{itinerary{name code days{number type ports{activity arrivalTime departureTime port{code name region}}}departurePort{code name region}destination{code name}portSequence sailingNights ship{code name}totalNights type}}sailings{bookingLink id itinerary{code}sailDate startDate endDate taxesAndFees{value}taxesAndFeesIncluded stateroomClassPricing{price{value currency{code}}stateroomClass{id content{code}}}}}cruiseRecommendationId total}}}';
    const filtersValue = 'startDate:' + minDate + '~' + maxDate + '|ship:' + shipCode;
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'accept': 'application/json',
          'apollographql-client-name': 'rci-NextGen-Cruise-Search',
          'apollographql-query-name': 'cruiseSearch_Cruises',
          'skip_authentication': 'true'
        },
        body: JSON.stringify({ query: query, variables: { filters: filtersValue, pagination: { count: count, skip: 0 } } })
      });
      if (!response.ok) {
        return null;
      }
      const data = await response.json();
      return data?.data?.cruiseSearch?.results?.cruises || [];
    } catch (error) {
      return null;
    }
  }

  function extractPricingFromCruise(cruise, sailDate) {
    const result = {
      interiorPrice: '',
      oceanviewPrice: '',
      balconyPrice: '',
      suitePrice: '',
      taxesAndFees: '',
      dayByDayItinerary: [],
      destinationName: '',
      totalNights: null,
      bookingLink: '',
      portList: ''
    };
    try {
      const itin = cruise?.masterSailing?.itinerary || {};
      result.destinationName = itin?.destination?.name || '';
      result.totalNights = itin?.totalNights || itin?.sailingNights || null;
      if (Array.isArray(itin?.days)) {
        result.dayByDayItinerary = itin.days.map(day => ({
          day: day.number || 0,
          type: day.type || '',
          portName: day.ports?.[0]?.port?.name || '',
          portCode: day.ports?.[0]?.port?.code || '',
          arrivalTime: day.ports?.[0]?.arrivalTime || '',
          departureTime: day.ports?.[0]?.departureTime || ''
        }));
        const portNames = itin.days
          .filter(d => d.ports && d.ports.length > 0)
          .map(d => d.ports[0]?.port?.name)
          .filter(n => n);
        result.portList = [...new Set(portNames)].join(', ');
      }
      const sailings = cruise?.sailings || [];
      const targetDate = toISODate(sailDate);
      const matchingSailing = sailings.find(s => {
        const sSailDate = (s.sailDate || '').toString().trim().slice(0, 10);
        return sSailDate === targetDate;
      }) || sailings[0];
      if (matchingSailing) {
        result.bookingLink = matchingSailing.bookingLink || '';
        const taxVal = matchingSailing.taxesAndFees?.value;
        if (taxVal !== undefined && taxVal !== null) {
          const taxNum = Number(taxVal);
          if (!isNaN(taxNum)) {
            result.taxesAndFees = '$' + (taxNum * 2).toFixed(2);
          }
        }
        const categoryMap = {
          'I': 'interior', 'IN': 'interior', 'INT': 'interior', 'INSIDE': 'interior', 'INTERIOR': 'interior',
          'O': 'oceanview', 'OV': 'oceanview', 'OB': 'oceanview', 'E': 'oceanview', 'OCEAN': 'oceanview',
          'OCEANVIEW': 'oceanview', 'OUTSIDE': 'oceanview',
          'B': 'balcony', 'BAL': 'balcony', 'BK': 'balcony', 'BALCONY': 'balcony',
          'D': 'suite', 'DLX': 'suite', 'DELUXE': 'suite', 'JS': 'suite', 'SU': 'suite', 'SUITE': 'suite'
        };
        const categoryPrices = { interior: null, oceanview: null, balcony: null, suite: null };
        if (Array.isArray(matchingSailing.stateroomClassPricing)) {
          for (const pricing of matchingSailing.stateroomClassPricing) {
            const code = (pricing?.stateroomClass?.content?.code || pricing?.stateroomClass?.id || '').toString().trim().toUpperCase();
            const priceVal = pricing?.price?.value;
            if (code && priceVal !== undefined && priceVal !== null) {
              const category = categoryMap[code];
              if (category) {
                const priceNum = Number(priceVal) * 2;
                if (!isNaN(priceNum) && (categoryPrices[category] === null || priceNum < categoryPrices[category])) {
                  categoryPrices[category] = priceNum;
                }
              }
            }
          }
        }
        if (categoryPrices.interior !== null) result.interiorPrice = '$' + categoryPrices.interior.toFixed(2);
        if (categoryPrices.oceanview !== null) result.oceanviewPrice = '$' + categoryPrices.oceanview.toFixed(2);
        if (categoryPrices.balcony !== null) result.balconyPrice = '$' + categoryPrices.balcony.toFixed(2);
        if (categoryPrices.suite !== null) result.suitePrice = '$' + categoryPrices.suite.toFixed(2);
      }
    } catch (e) {}
    return result;
  }

  async function fetchOffersFromAPI(authContext) {
    try {
      log('🔌 Using hardened API/network offer extraction...');
      const { headers, loyaltyId, brandCode, baseUrl } = authContext;
      const relativeEndpoint = brandCode === 'C' ? '/api/casino/casino-offers/v2' : '/api/casino/casino-offers/v1';
      const endpoint = baseUrl + relativeEndpoint;
      const apiBrandCode = brandCode === 'N' ? 'CCL' : brandCode;
      const brandLabel = brandCode === 'C' ? 'Celebrity' : (brandCode === 'N' ? 'Carnival' : 'Royal Caribbean');
      const endpointCandidates = [];
      // The old working dual-domain extension used a same-origin RELATIVE endpoint and credentials:'omit'
      // with explicit authorization/account-id headers. Try that first when we are already on Royal/Celebrity.
      if ((location.hostname || '').includes('royalcaribbean.com') || (location.hostname || '').includes('celebritycruises.com')) endpointCandidates.push(relativeEndpoint);
      endpointCandidates.push(endpoint);

      const existing = window.capturedPayloads && window.capturedPayloads.offers ? window.capturedPayloads.offers : null;
      if (existing) {
        const normalizedExisting = normalizeOffersApiResponse(existing);
        if (normalizedExisting.offers && normalizedExisting.offers.length > 0) {
          log('✅ Using already captured Casino Offers API payload with ' + normalizedExisting.offers.length + ' offer(s)', 'success');
          return normalizedExisting;
        }
      }

      log('📡 Calling ' + brandLabel + ' Casino Offers API with cookies/captured auth...');
      log('Endpoint: ' + endpoint);
      const requestBodies = [];
      requestBodies.push({ cruiseLoyaltyId: loyaltyId || '', offerCode: '', brand: apiBrandCode });
      requestBodies.push({ loyaltyId: loyaltyId || '', offerCode: '', brand: apiBrandCode });
      requestBodies.push({ offerCode: '', brand: apiBrandCode });
      if (loyaltyId) requestBodies.push({ cruiseLoyaltyId: loyaltyId, brand: apiBrandCode });

      let lastError = null;
      for (let endpointIndex = 0; endpointIndex < endpointCandidates.length; endpointIndex += 1) {
        const activeEndpoint = endpointCandidates[endpointIndex];
        const activeCredentials = activeEndpoint.charAt(0) === '/' ? 'omit' : 'include';
        for (let attempt = 0; attempt < requestBodies.length; attempt += 1) {
          const body = requestBodies[attempt];
          try {
            window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'progress', current: attempt + 1, total: requestBodies.length, stepName: 'Fetching all casino offers...' }));
            log('  Offer API attempt ' + (attempt + 1) + '/' + requestBodies.length + ' via ' + activeEndpoint + ' (' + activeCredentials + ')' + (loyaltyId ? ' using loyalty id' : ' using session headers'), 'info');
            const response = await fetch(activeEndpoint, {
              method: 'POST',
              headers: headers,
              credentials: activeCredentials,
              body: JSON.stringify(body)
            });
          log('  API response status: ' + response.status, response.ok ? 'info' : 'warning');
          const text = await response.text();
          if (!response.ok) {
            lastError = new Error('API error: ' + response.status + ' - ' + text.slice(0, 300));
            continue;
          }
          let rawData = null;
          try { rawData = JSON.parse(text); } catch (jsonErr) { throw new Error('Offer API returned non-JSON response'); }
          window.capturedPayloads = window.capturedPayloads || {};
          window.capturedPayloads.offers = rawData;
          const data = normalizeOffersApiResponse(rawData);
          if (Array.isArray(data.offers) && data.offers.length > 0) {
            log('✅ Casino Offers API returned ' + data.offers.length + ' offer(s)', 'success');

            const offersWithEmptySailings = data.offers.filter(o => {
              const co = getCampaignOffer(o);
              return (co?.offerCode || co?.marketingCouponCode || co?.couponCode) &&
                Array.isArray(co.sailings) &&
                (co.sailings.length === 0 || (co.sailings[0] && co.sailings[0].itineraryCode === null)) &&
                !isOfferInProgress(co, o);
            });
            if (offersWithEmptySailings.length > 0) {
              log('🔄 Refetching ' + offersWithEmptySailings.length + ' offer(s) with empty/incomplete sailings...');
              for (let offerIndex = 0; offerIndex < offersWithEmptySailings.length; offerIndex += 1) {
                const offer = offersWithEmptySailings[offerIndex];
                const offerCampaign = getCampaignOffer(offer);
                const code = safeStr(offerCampaign.offerCode || offerCampaign.marketingCouponCode || offerCampaign.couponCode).trim();
                if (!code) continue;
                try {
                  const refetchResponse = await fetch(activeEndpoint, { method: 'POST', headers: headers, credentials: activeCredentials, body: JSON.stringify({ ...body, offerCode: code }) });
                  if (refetchResponse.ok) {
                    const refetchRawData = await refetchResponse.json();
                    const refetchData = normalizeOffersApiResponse(refetchRawData);
                    const refreshedOffer = refetchData.offers?.find(o => safeStr(getCampaignOffer(o)?.offerCode || getCampaignOffer(o)?.marketingCouponCode || getCampaignOffer(o)?.couponCode) === code) || refetchData.offers?.[0];
                    const refreshedCampaign = getCampaignOffer(refreshedOffer);
                    if (refreshedCampaign?.sailings?.length > 0) {
                      const originalIdx = data.offers.indexOf(offer);
                      if (originalIdx !== -1) {
                        const originalCampaign = getCampaignOffer(data.offers[originalIdx]);
                        originalCampaign.sailings = refreshedCampaign.sailings;
                        log('  ✓ Updated ' + code + ': now has ' + originalCampaign.sailings.length + ' sailings', 'success');
                      }
                    }
                  }
                } catch (refetchErr) {
                  log('  ⚠️ Failed to refetch ' + code + ': ' + refetchErr.message, 'warning');
                }
                await wait(250);
              }
            }
            return data;
          }
          lastError = new Error('Offer API returned zero parsed offers for attempt ' + (attempt + 1));
        } catch (attemptErr) {
          lastError = attemptErr;
          log('  ⚠️ Offer API attempt failed: ' + attemptErr.message, 'warning');
        }
      }
      }
      throw lastError || new Error('Casino Offers API fetch returned no offers');
    } catch (error) {
      log('Casino Offers API fetch failed: ' + error.message, 'error');
      throw error;
    }
  }

  async function enrichWithPricingData(allOfferRows, baseUrl) {
    if (!SCRAPE_PRICING_AND_ITINERARY || allOfferRows.length === 0) {
      return allOfferRows;
    }
    log('💰 Fetching stateroom pricing, taxes & day-by-day itinerary...', 'info');
    const shipDateMap = new Map();
    allOfferRows.forEach((row, idx) => {
      if (row.shipCode && row.sailingDate) {
        const sailDateISO = toISODate(row.sailingDate);
        if (sailDateISO) {
          const key = row.shipCode + '|' + sailDateISO;
          if (!shipDateMap.has(key)) {
            shipDateMap.set(key, { shipCode: row.shipCode, sailDate: sailDateISO, indices: [] });
          }
          shipDateMap.get(key).indices.push(idx);
        }
      }
    });
    const uniqueSailings = Array.from(shipDateMap.values());
    log('📊 Found ' + uniqueSailings.length + ' unique ship/date combinations to enrich', 'info');
    if (uniqueSailings.length === 0) {
      return allOfferRows;
    }
    const shipGroups = {};
    uniqueSailings.forEach(s => {
      if (!shipGroups[s.shipCode]) {
        shipGroups[s.shipCode] = { shipCode: s.shipCode, sailings: [], minDate: null, maxDate: null };
      }
      const group = shipGroups[s.shipCode];
      group.sailings.push(s);
      if (!group.minDate || s.sailDate < group.minDate) group.minDate = s.sailDate;
      if (!group.maxDate || s.sailDate > group.maxDate) group.maxDate = s.sailDate;
    });
    const groups = Object.values(shipGroups);
    let processedCount = 0;
    const totalCount = uniqueSailings.length;
    for (const group of groups) {
      try {
        window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'progress', current: processedCount, total: totalCount, stepName: 'Fetching pricing for ' + group.shipCode + '...' }));
        const cruises = await fetchPricingAndItinerary(baseUrl, group.shipCode, group.minDate, group.maxDate, group.sailings.length * 3);
        if (cruises && cruises.length > 0) {
          const cruiseByDate = {};
          cruises.forEach(cruise => {
            const sailings = cruise?.sailings || [];
            sailings.forEach(s => {
              const sDate = (s.sailDate || '').toString().trim().slice(0, 10);
              if (sDate) {
                cruiseByDate[sDate] = cruise;
              }
            });
          });
          for (const sailing of group.sailings) {
            const cruise = cruiseByDate[sailing.sailDate];
            if (cruise) {
              const pricingData = extractPricingFromCruise(cruise, sailing.sailDate);
              for (const idx of sailing.indices) {
                const row = allOfferRows[idx];
                if (!row.interiorPrice && pricingData.interiorPrice) row.interiorPrice = pricingData.interiorPrice;
                if (!row.oceanviewPrice && pricingData.oceanviewPrice) row.oceanviewPrice = pricingData.oceanviewPrice;
                if (!row.balconyPrice && pricingData.balconyPrice) row.balconyPrice = pricingData.balconyPrice;
                if (!row.suitePrice && pricingData.suitePrice) row.suitePrice = pricingData.suitePrice;
                if (!row.taxesAndFees && pricingData.taxesAndFees) row.taxesAndFees = pricingData.taxesAndFees;
                if (!row.portList && pricingData.portList) row.portList = pricingData.portList;
                if (!row.destinationName && pricingData.destinationName) row.destinationName = pricingData.destinationName;
                if (!row.totalNights && pricingData.totalNights) row.totalNights = pricingData.totalNights;
                if (!row.bookingLink && pricingData.bookingLink) row.bookingLink = pricingData.bookingLink;
                if (pricingData.dayByDayItinerary && pricingData.dayByDayItinerary.length > 0) {
                  row.dayByDayItinerary = pricingData.dayByDayItinerary;
                }
              }
              processedCount += sailing.indices.length;
            } else {
              processedCount += sailing.indices.length;
            }
          }
          log('  ✓ Enriched ' + group.sailings.length + ' sailing(s) for ship ' + group.shipCode, 'success');
        } else {
          processedCount += group.sailings.reduce((sum, s) => sum + s.indices.length, 0);
          log('  ⚠️ No pricing data found for ship ' + group.shipCode, 'warning');
        }
        await wait(200);
      } catch (err) {
        processedCount += group.sailings.reduce((sum, s) => sum + s.indices.length, 0);
        log('  ⚠️ Error fetching pricing for ' + group.shipCode + ': ' + err.message, 'warning');
      }
    }
    const enrichedCount = allOfferRows.filter(r => r.interiorPrice || r.oceanviewPrice || r.balconyPrice || r.suitePrice).length;
    log('✅ Pricing enrichment complete: ' + enrichedCount + '/' + allOfferRows.length + ' sailings have pricing data', 'success');
    return allOfferRows;
  }

  function processAPIResponse(data, scrapePricing) {
    const allOfferRows = [];
    let totalSailings = 0;
    if (!data || !Array.isArray(data.offers)) {
      return { offerRows: allOfferRows, offerCount: 0, totalSailings: 0 };
    }
    const validOffers = data.offers.filter(o => o && isOfferLikeRecord(o));
    const host = location && location.hostname ? location.hostname : '';
    const defaultOfferType = host.includes('celebritycruises.com') ? 'Blue Chip Club' : 'Club Royale';
    log('📊 Processing ' + validOffers.length + ' offers from API response...');
    for (let i = 0; i < validOffers.length; i++) {
      const offer = validOffers[i];
      const co = getCampaignOffer(offer);
      const offerName = co.name || co.title || co.offerName || co.marketingTitle || '';
      const offerCode = co.offerCode || co.marketingCouponCode || co.couponCode || co.code || '';
      const offerExpiry = formatDate(co.reserveByDate);
      const tradeInValue = co.tradeInValue ? '$' + Number(co.tradeInValue).toFixed(2) : '';
      const perks = tradeInValue ? 'Trade-in value: ' + tradeInValue : '';
      const offerStatus = getOfferStatus(co, offer);
      const offerIsInProgress = isOfferInProgress(co, offer);
      log('━━━━━ Offer ' + (i + 1) + '/' + validOffers.length + ' ━━━━━');
      log('  Offer Name: ' + offerName);
      log('  Offer Code: ' + (offerCode || '[NOT FOUND]'), offerCode ? 'info' : 'warning');
      log('  Expiry Date: ' + (offerExpiry || '[NOT FOUND]'), offerExpiry ? 'info' : 'warning');
      if (tradeInValue) {
        log('  Trade-in Value: ' + tradeInValue);
      }
      if (offerStatus) {
        log('  Status: ' + offerStatus, offerIsInProgress ? 'warning' : 'info');
      }
      const sailings = co.sailings || co.availableSailings || co.eligibleSailings || co.sailingInfo || co.offerSailings || offer.sailings || offer.availableSailings || offer.eligibleSailings || offer.sailingInfo || offer.offerSailings || [];
      if (sailings.length === 0) {
        log('  ⚠️ No sailings available for this offer', 'warning');
        allOfferRows.push({
          sourcePage: defaultOfferType === 'Blue Chip Club' ? 'Blue Chip Club Offers' : 'Offers',
          offerName: offerName,
          offerCode: offerCode,
          offerExpirationDate: offerExpiry,
          offerType: defaultOfferType,
          shipName: '',
          shipCode: '',
          sailingDate: '',
          itinerary: '',
          departurePort: '',
          cabinType: '',
          numberOfGuests: '2',
          perks: perks,
          loyaltyLevel: '',
          loyaltyPoints: '',
          interiorPrice: '',
          oceanviewPrice: '',
          balconyPrice: '',
          suitePrice: '',
          taxesAndFees: '',
          portList: '',
          dayByDayItinerary: [],
          destinationName: '',
          totalNights: null,
          bookingLink: '',
          offerStatus: offerStatus || 'No sailings available',
          isInProgress: offerIsInProgress
        });
        totalSailings++;
        sendOfferProgress(i + 1, validOffers.length, offerName, 0, 'complete');
        continue;
      }
      log('  📜 Processing ' + sailings.length + ' sailings...');
      sendOfferProgress(i + 1, validOffers.length, offerName, 0, 'processing');
      let offerSailingCount = 0;
      for (let sailingIndex = 0; sailingIndex < sailings.length; sailingIndex += 1) {
        const sailing = sailings[sailingIndex];
        const shipName = sailing.shipName || '';
        const shipCode = sailing.shipCode || '';
        const sailDate = formatSailDate(sailing.sailDate);
        const departurePort = safeStr(sailing.departurePort?.name || sailing.departurePortName || sailing.departurePort || '');
        const itinerary = safeStr(sailing.itineraryDescription || sailing.sailingType?.name || sailing.sailingType || '');
        const cabinType = safeStr(sailing.roomType || sailing.stateroomType || '');
        const isGOBO = sailing.isGOBO || co.isGOBO || false;
        const numberOfGuests = isGOBO ? '1' : '2';
        let interiorPrice = '';
        let oceanviewPrice = '';
        let balconyPrice = '';
        let suitePrice = '';
        if (sailing.pricing && Array.isArray(sailing.pricing)) {
          for (const priceInfo of sailing.pricing) {
            const type = (priceInfo.roomType || priceInfo.cabinType || '').toLowerCase();
            const price = priceInfo.price || priceInfo.amount || priceInfo.rate;
            const priceStr = price ? '$' + Number(price).toFixed(2) : '';
            if (type.includes('interior') || type.includes('inside')) {
              interiorPrice = priceStr;
            } else if (type.includes('oceanview') || type.includes('ocean view')) {
              oceanviewPrice = priceStr;
            } else if (type.includes('balcony')) {
              balconyPrice = priceStr;
            } else if (type.includes('suite')) {
              suitePrice = priceStr;
            }
          }
        }
        const ports = sailing.ports || sailing.itinerary?.ports || [];
        const portList = Array.isArray(ports) ? ports.map(p => p.name || p.portName || '').filter(n => n).join(', ') : '';
        allOfferRows.push({
          sourcePage: defaultOfferType === 'Blue Chip Club' ? 'Blue Chip Club Offers' : 'Offers',
          offerName: offerName,
          offerCode: offerCode,
          offerExpirationDate: offerExpiry,
          offerType: defaultOfferType,
          shipName: shipName,
          shipCode: shipCode,
          sailingDate: sailDate,
          itinerary: itinerary,
          departurePort: departurePort,
          cabinType: cabinType,
          numberOfGuests: numberOfGuests,
          perks: perks,
          loyaltyLevel: '',
          loyaltyPoints: '',
          interiorPrice: interiorPrice,
          oceanviewPrice: oceanviewPrice,
          balconyPrice: balconyPrice,
          suitePrice: suitePrice,
          taxesAndFees: '',
          portList: portList,
          dayByDayItinerary: [],
          destinationName: '',
          totalNights: null,
          bookingLink: '',
          offerStatus: offerStatus,
          isInProgress: offerIsInProgress
        });
        totalSailings++;
        offerSailingCount++;
        if (totalSailings % BATCH_SIZE === 0 || offerSailingCount === 1 || offerSailingCount === sailings.length || offerSailingCount % 100 === 0) {
          window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'progress', current: totalSailings, total: Math.max(totalSailings, validOffers.length), stepName: 'Processing offers...' }));
          sendOfferProgress(i + 1, validOffers.length, offerName, offerSailingCount, offerSailingCount === sailings.length ? 'parsed' : 'processing');
        }
        if (offerSailingCount % 100 === 0) {
          log('    ✓ Processed ' + offerSailingCount + '/' + sailings.length + ' sailings (' + totalSailings + ' total)');
        }
      }
      sendOfferProgress(i + 1, validOffers.length, offerName, offerSailingCount, 'complete');
      log('Offer ' + (i + 1) + '/' + validOffers.length + ' (' + offerName + '): ' + offerSailingCount + ' sailings - complete', 'success');
      log('  ✓ Offer complete: ' + offerSailingCount + ' sailings added', 'success');
    }
    return { offerRows: allOfferRows, offerCount: validOffers.length, totalSailings };
  }

  function hasRealSailing(row) {
    return !!(row && cleanOfferText(row.shipName || '') && cleanOfferText(row.sailingDate || ''));
  }

  function logOfferRowCounts(rows, offers, label) {
    const byCode = new Map();
    (rows || []).forEach(r => {
      if (!hasRealSailing(r)) return;
      const code = normalizeRoyalCasinoOfferCode(r.offerCode || '');
      const key = code || cleanOfferText(r.offerName || 'Unknown Offer');
      if (!byCode.has(key)) byCode.set(key, { name: r.offerName || key, code: code, count: 0 });
      byCode.get(key).count += 1;
    });
    (offers || []).forEach(o => {
      const code = normalizeRoyalCasinoOfferCode(o.offerCode || '');
      const key = code || cleanOfferText(o.offerName || 'Unknown Offer');
      if (!byCode.has(key)) byCode.set(key, { name: o.offerName || key, code: code, count: 0 });
    });
    Array.from(byCode.values()).forEach(v => {
      log('📊 Offer sync count ' + (label ? '[' + label + '] ' : '') + (v.name || v.code) + (v.code ? ' (' + v.code + ')' : '') + ': ' + v.count + ' cruise(s)', v.count > 0 ? 'success' : 'warning');
    });
  }


  function extractPlayerOfferId(text) {
    try {
      const value = cleanOfferText(text || '');
      let match = value.match(/[?&]playerOfferId=([0-9a-f-]{20,})/i);
      if (match) return decodeURIComponent(match[1]);
      match = value.match(/playerOfferId["'\s:=]+([0-9a-f-]{20,})/i);
      if (match) return match[1];
    } catch (e) {}
    return '';
  }

  function canonicalOfferCodeForRoute(code) {
    return encodeURIComponent(normalizeRoyalCasinoOfferCode(code || ''));
  }

  function decodeRoyalTextBlob(text) {
    let t = String(text || '');
    try { t = t.replace(/\\u0026/g, '&').replace(/\\u003d/g, '=').replace(/\\u002f/gi, '/').replace(/\\u002F/g, '/'); } catch (e) {}
    try { t = t.replace(/\\"/g, '"').replace(/\\n/g, ' ').replace(/\\r/g, ' ').replace(/\\t/g, ' '); } catch (e) {}
    try { t = t.replace(/\s+/g, ' '); } catch (e) {}
    return t;
  }

  function knownRoyalShipNames() {
    return [
      'Adventure of the Seas','Allure of the Seas','Anthem of the Seas','Brilliance of the Seas','Enchantment of the Seas','Explorer of the Seas','Freedom of the Seas','Grandeur of the Seas','Harmony of the Seas','Icon of the Seas','Independence of the Seas','Jewel of the Seas','Legend of the Seas','Liberty of the Seas','Mariner of the Seas','Navigator of the Seas','Oasis of the Seas','Odyssey of the Seas','Ovation of the Seas','Quantum of the Seas','Radiance of the Seas','Rhapsody of the Seas','Serenade of the Seas','Spectrum of the Seas','Star of the Seas','Symphony of the Seas','Utopia of the Seas','Vision of the Seas','Voyager of the Seas','Wonder of the Seas',
      'Celebrity Apex','Celebrity Ascent','Celebrity Beyond','Celebrity Constellation','Celebrity Eclipse','Celebrity Edge','Celebrity Equinox','Celebrity Flora','Celebrity Infinity','Celebrity Millennium','Celebrity Reflection','Celebrity Silhouette','Celebrity Solstice','Celebrity Summit','Celebrity Xcel'
    ];
  }

  function nearestShipNameAround(text, index) {
    const ships = knownRoyalShipNames();
    const start = Math.max(0, index - 900);
    const end = Math.min(text.length, index + 900);
    const chunk = text.slice(start, end);
    let best = '';
    let bestDist = Infinity;
    ships.forEach(ship => {
      const re = new RegExp(ship.replace(/[.*+?^\${}()|[\]\\]/g, '\\$&'), 'ig');
      let m;
      while ((m = re.exec(chunk)) !== null) {
        const abs = start + m.index;
        const dist = Math.abs(abs - index);
        if (dist < bestDist) { bestDist = dist; best = ship; }
      }
    });
    if (best) return best;
    const generic = chunk.match(/([A-Z][A-Za-z' -]{2,40}\s+of\s+the\s+Seas)/);
    return generic ? cleanOfferText(generic[1]) : '';
  }

  function extractSailingRowsFromTextBlob(rawText, offer, sourceLabel) {
    const text = decodeRoyalTextBlob(rawText);
    const rows = [];
    const seen = new Set();
    const datePatterns = [
      /(?:sail(?:ing)?Date|sail_date|departureDate|startDate|date)["'\s:=]+(20\d{2}-\d{2}-\d{2})/ig,
      /(?:sail(?:ing)?Date|sail_date|departureDate|startDate|date)["'\s:=]+(20\d{6})/ig,
      /\b(20\d{2}-\d{2}-\d{2})\b/g,
      /\b(20\d{6})\b/g,
      /\b(\d{1,2}[\/\-]\d{1,2}[\/\-]20\d{2})\b/g,
      /\b((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*\s+\d{1,2}(?:st|nd|rd|th)?(?:,)?\s+20\d{2})\b/ig
    ];

    datePatterns.forEach(re => {
      let m;
      while ((m = re.exec(text)) !== null) {
        const dateRaw = m[1];
        const sailingDate = formatSailDate(dateRaw);
        if (!/^\d{2}\/\d{2}\/20\d{2}$/.test(sailingDate)) continue;
        const shipName = nearestShipNameAround(text, m.index);
        if (!shipName) continue;
        const contextStart = Math.max(0, m.index - 450);
        const contextEnd = Math.min(text.length, m.index + 700);
        const context = cleanOfferText(text.slice(contextStart, contextEnd));
        const nightsMatch = context.match(/(\d{1,2})\s*(?:Night|Nights|nt)\b/i);
        const portMatch = context.match(/(?:Depart(?:ure)?\s*(?:from)?|Leaving\s+from|Sailing\s+from|From)\s*[:\-]?\s*([A-Z][A-Za-z .'-]{2,60})(?=\s+(?:Itinerary|Ship|Date|\d|Interior|Ocean|Balcony|Suite|\||,|$))/i);
        const key = normalizeRoyalCasinoOfferCode(offer.offerCode || '') + '|' + shipName.toLowerCase() + '|' + sailingDate;
        if (seen.has(key)) continue;
        seen.add(key);
        rows.push({
          sourcePage: 'Offers',
          source: sourceLabel || 'live-rsc',
          offerName: offer.offerName || 'Casino Offer',
          offerCode: normalizeRoyalCasinoOfferCode(offer.offerCode || ''),
          offerExpirationDate: offer.offerExpirationDate || '',
          offerType: offer.numberOfGuests || 'Club Royale',
          cabinType: offer.cabinType || '',
          numberOfGuests: offer.numberOfGuests || '2 person',
          shipName: shipName,
          shipCode: '',
          sailingDate: sailingDate,
          itinerary: context.slice(0, 500),
          nights: nightsMatch ? nightsMatch[1] : '',
          departurePort: portMatch ? cleanOfferText(portMatch[1]) : '',
          perks: offer.perks || ''
        });
      }
    });
    return rows;
  }

  function deepFindString(obj, patterns, depth) {
    if (!obj || depth > 8) return '';
    if (typeof obj !== 'object') return '';
    for (const key of Object.keys(obj)) {
      const lower = key.toLowerCase();
      if (patterns.some(p => p.test(lower))) {
        const v = obj[key];
        if (v !== undefined && v !== null && String(v).trim()) return String(v).trim();
      }
    }
    for (const key of Object.keys(obj)) {
      const found = deepFindString(obj[key], patterns, depth + 1);
      if (found) return found;
    }
    return '';
  }

  function collectSailingRowsFromStructuredJson(value, offer, rows, seen, depth) {
    if (!value || depth > 10) return;
    if (Array.isArray(value)) {
      value.forEach(v => collectSailingRowsFromStructuredJson(v, offer, rows, seen, depth + 1));
      return;
    }
    if (typeof value !== 'object') return;

    const dateRaw = deepFindString(value, [/sail.*date/, /sailingdate/, /departure.*date/, /start.*date/, /^date$/], 0);
    const shipName = deepFindString(value, [/ship.*name/, /^shipname$/, /vessel.*name/], 0);
    if (dateRaw && shipName) {
      const sailingDate = formatSailDate(dateRaw);
      if (/^\d{2}\/\d{2}\/20\d{2}$/.test(sailingDate)) {
        const key = normalizeRoyalCasinoOfferCode(offer.offerCode || '') + '|' + shipName.toLowerCase() + '|' + sailingDate;
        if (!seen.has(key)) {
          seen.add(key);
          rows.push({
            sourcePage: 'Offers',
            source: 'live-json',
            offerName: offer.offerName || deepFindString(value, [/offer.*name/, /title/, /name/], 0) || 'Casino Offer',
            offerCode: normalizeRoyalCasinoOfferCode(offer.offerCode || deepFindString(value, [/offer.*code/, /coupon.*code/, /marketing.*coupon/], 0) || ''),
            offerExpirationDate: offer.offerExpirationDate || deepFindString(value, [/expir/, /redeem/, /reserve/], 0),
            offerType: offer.numberOfGuests || 'Club Royale',
            cabinType: offer.cabinType || deepFindString(value, [/cabin/, /stateroom/], 0),
            numberOfGuests: offer.numberOfGuests || '2 person',
            shipName,
            shipCode: deepFindString(value, [/ship.*code/, /^shipcode$/], 0),
            sailingDate,
            itinerary: deepFindString(value, [/itinerary/, /destination/], 0),
            nights: deepFindString(value, [/nights/, /duration/], 0),
            departurePort: deepFindString(value, [/departure.*port/, /depart.*from/, /portname/], 0),
            perks: offer.perks || ''
          });
        }
      }
    }

    Object.keys(value).forEach(k => collectSailingRowsFromStructuredJson(value[k], offer, rows, seen, depth + 1));
  }

  function collectRowsFromJsonPayload(payload, offer, sourceLabel) {
    const rows = [];
    const seen = new Set();
    try { collectSailingRowsFromStructuredJson(payload, offer, rows, seen, 0); } catch (e) {}
    if (rows.length === 0) {
      try { rows.push(...extractSailingRowsFromTextBlob(JSON.stringify(payload), offer, sourceLabel || 'live-json-text')); } catch (e) {}
    }
    return rows;
  }

  async function fetchCasinoV2MergedRows(visibleOffers) {
    const rows = [];
    try {
      const baseUrl = location.origin || 'https://www.royalcaribbean.com';
      const urls = [baseUrl + '/api/casino/v2/offers/merged', baseUrl + '/api/casino/v2/offers/facets'];
      for (const url of urls) {
        try {
          log('📡 Live casino v2 GET: ' + url, 'info');
          const res = await fetch(url, { method: 'GET', credentials: 'include', headers: { accept: 'application/json,text/plain,*/*' } });
          log('  casino v2 status: ' + res.status, res.ok ? 'info' : 'warning');
          const text = await res.text();
          if (!res.ok || !text) continue;
          let payload = null;
          try { payload = JSON.parse(text); } catch (e) {}
          for (const offer of visibleOffers) {
            const offerRows = payload ? collectRowsFromJsonPayload(payload, offer, 'live-casino-v2') : extractSailingRowsFromTextBlob(text, offer, 'live-casino-v2-text');
            offerRows.forEach(r => {
              if (!r.offerCode) r.offerCode = normalizeRoyalCasinoOfferCode(offer.offerCode || '');
              if (!r.offerName) r.offerName = offer.offerName || 'Casino Offer';
              rows.push(r);
            });
          }
        } catch (err) {
          log('  ⚠️ casino v2 fetch failed: ' + err.message, 'warning');
        }
      }
    } catch (e) {}
    return rows.filter(hasRealSailing);
  }

  async function fetchOfferRscRows(visibleOffers) {
    const allRows = [];
    const baseUrl = location.origin || 'https://www.royalcaribbean.com';
    for (let i = 0; i < visibleOffers.length; i += 1) {
      const offer = visibleOffers[i];
      const code = canonicalOfferCodeForRoute(offer.offerCode || '');
      if (!code || code.indexOf('UNKNOWN') === 0) continue;
      const urls = [];
      const playerOfferId = offer.playerOfferId || extractPlayerOfferId(offer.detailUrl || '');
      if (offer.detailUrl) urls.push(offer.detailUrl);
      if (playerOfferId) urls.push(baseUrl + '/club-royale/offers/' + code + '?redirect=%2Foffers%2F&country=USA&playerOfferId=' + encodeURIComponent(playerOfferId));
      urls.push(baseUrl + '/club-royale/offers/' + code + '?redirect=%2Foffers%2F&country=USA');
      urls.push(baseUrl + '/club-royale/offers/' + code);

      const uniqueUrls = Array.from(new Set(urls.filter(Boolean)));
      for (const rawUrl of uniqueUrls) {
        const sep = rawUrl.indexOf('?') === -1 ? '?' : '&';
        const rscUrl = rawUrl.indexOf('_rsc=') === -1 ? rawUrl + sep + '_rsc=' + Math.random().toString(36).slice(2, 10) : rawUrl;
        try {
          log('📡 Live RSC offer fetch ' + (i + 1) + '/' + visibleOffers.length + ': ' + (offer.offerName || code) + ' (' + decodeURIComponent(code) + ')', 'info');
          const res = await fetch(rscUrl, {
            method: 'GET',
            credentials: 'include',
            headers: { accept: 'text/x-component,text/html,application/json,text/plain,*/*', rsc: '1' }
          });
          log('  RSC status: ' + res.status + ' for ' + decodeURIComponent(code), res.ok ? 'info' : 'warning');
          const text = await res.text();
          if (!res.ok || !text) continue;
          let rows = [];
          try {
            const maybeJson = JSON.parse(text);
            rows = collectRowsFromJsonPayload(maybeJson, offer, 'live-rsc-json');
          } catch (e) {
            rows = extractSailingRowsFromTextBlob(text, offer, 'live-rsc-text');
          }
          rows = rows.filter(hasRealSailing);
          if (rows.length > 0) {
            log('  ✅ RSC captured ' + rows.length + ' live sailing row(s) for ' + (offer.offerName || code), 'success');
            rows.forEach(r => allRows.push(r));
            break;
          }
        } catch (err) {
          log('  ⚠️ RSC offer fetch failed for ' + decodeURIComponent(code) + ': ' + err.message, 'warning');
        }
        await wait(200);
      }
    }
    return allRows.filter(hasRealSailing);
  }

  function dedupeLiveSailingRows(rows) {
    const seen = new Set();
    const out = [];
    (rows || []).forEach(row => {
      if (!hasRealSailing(row)) return;
      row.offerCode = normalizeRoyalCasinoOfferCode(row.offerCode || '');
      const key = [row.offerCode, cleanOfferText(row.shipName).toLowerCase(), formatSailDate(row.sailingDate), cleanOfferText(row.cabinType || '').toLowerCase(), cleanOfferText(row.numberOfGuests || '').toLowerCase()].join('|');
      if (seen.has(key)) return;
      seen.add(key);
      row.sailingDate = formatSailDate(row.sailingDate);
      out.push(row);
    });
    return out;
  }


  function mergeRowsPreferringBaselineWhenWebViewIsIncomplete(domRows, offers) {
    // v9.1.8 LIVE ONLY: local fallback is prohibited.
    // Return only rows that have real ship/date sailing information from the live Royal page/API.
    return (domRows || []).filter(hasRealSailing);
  }

  async function extractOffers() {
    try {
      log('Extracting Club Royale data...');
      log('🛠️ Offer sync engine v9.2.2 active: LIVE-ONLY extension-grade API-first scraper + DOM modal fallback; no CSV/baseline fallback; completed-history path unchanged', 'info');
      await extractClubRoyaleStatus();
      log('Loading Club Royale Offers page...');
      await wait(2000);
      await expandAllOffersBeforeExtraction();
      window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'progress', current: 0, total: 100, stepName: 'Reading visible Club Royale offer cards...' }));

      // v9.2.2: API-FIRST, based on the old dual-domain extension that actually returned live sailing arrays.
      // The extension did NOT rely on clicking every modal first. It POSTed to /api/casino/casino-offers/v1
      // with persist:session token + account-id + cruiseLoyaltyId, then refetched empty offers by offerCode.
      // This is still live Royal data. No CSV/baseline fallback is allowed.
      const authContext = await getAuthContext();
      try {
        const apiData = await fetchOffersFromAPI(authContext);
        let apiProcessed = processAPIResponse(apiData, SCRAPE_PRICING_AND_ITINERARY);
        let apiRows = (apiProcessed.offerRows || []).filter(hasRealSailing);
        if (SCRAPE_PRICING_AND_ITINERARY && apiRows.length > 0) {
          log('🔄 Starting live pricing and itinerary enrichment for API rows...', 'info');
          apiRows = await enrichWithPricingData(apiRows, authContext.baseUrl);
        }
        if (apiRows.length > 0) {
          logOfferRowCounts(apiRows, [], 'API-first live final');
          sendOfferRowsInChunks(apiRows, apiProcessed.offerCount || 0);
          log('✅ STEP 1 API-FIRST LIVE COMPLETE: captured ' + (apiProcessed.offerCount || 0) + ' offer(s) with ' + apiRows.length + ' real sailing row(s) from Royal casino-offers API', 'success');
          return;
        }
        log('⚠️ API-first live scraper returned 0 real ship/date rows; falling back to visible-card/modal scraper only. No local baseline will be used.', 'warning');
      } catch (apiErr) {
        log('⚠️ API-first live scraper failed: ' + (apiErr && apiErr.message ? apiErr.message : String(apiErr)) + '. Falling back to DOM/modal live scraper only.', 'warning');
      }

      const visibleOffers = parseVisibleOfferCards();
      const viewSailingsButtons = getViewSailingsButtons();
      const expected = getAllOffersExpectedCount() || visibleOffers.length || viewSailingsButtons.length;
      log('DOM fallback offer scan: expected ' + expected + ' offer(s), parsed ' + visibleOffers.length + ' card(s), found ' + viewSailingsButtons.length + ' View Sailings button(s)', visibleOffers.length ? 'success' : 'warning');

      if (visibleOffers.length > 0) {
        const rawDomRows = await scrapeSailingsForVisibleOffers(visibleOffers);
        const domRealCount = rawDomRows.filter(hasRealSailing).length;
        let liveRows = mergeRowsPreferringBaselineWhenWebViewIsIncomplete(rawDomRows, visibleOffers);

        if (liveRows.filter(hasRealSailing).length === 0) {
          log('ℹ️ DOM modal scraper returned only placeholders. Trying live Royal v2 merged/facets payloads...', 'warning');
          const v2Rows = await fetchCasinoV2MergedRows(visibleOffers);
          if (v2Rows.length > 0) log('✅ Live casino v2 payload captured ' + v2Rows.length + ' real sailing row(s).', 'success');
          liveRows = liveRows.concat(v2Rows);
        }

        if (liveRows.filter(hasRealSailing).length === 0) {
          log('ℹ️ Casino v2 payload did not expose rows. Trying Next.js RSC offer detail endpoints shown by Royal...', 'warning');
          const rscRows = await fetchOfferRscRows(visibleOffers);
          if (rscRows.length > 0) log('✅ Live RSC endpoints captured ' + rscRows.length + ' real sailing row(s).', 'success');
          liveRows = liveRows.concat(rscRows);
        }

        const domRows = dedupeLiveSailingRows(liveRows);
        const realAfterMerge = domRows.filter(hasRealSailing).length;
        if (realAfterMerge === 0 && visibleOffers.length > 0) {
          log('❌ STEP 1 LIVE SCRAPE INCOMPLETE: Royal showed ' + visibleOffers.length + ' offer(s), but DOM, v2 endpoints, and RSC detail endpoints captured 0 real ship/date sailing rows. No local fallback and no placeholder rows will be used.', 'error');
        }
        logOfferRowCounts(domRows, visibleOffers, 'Step 1 final');
        sendOfferRowsInChunks(domRows, visibleOffers.length);
        const realCount = domRows.filter(hasRealSailing).length;
        log((realCount > 0 ? '✅' : '❌') + ' STEP 1 LIVE SCRAPE COMPLETE: captured ' + visibleOffers.length + ' visible offer(s) with ' + realCount + ' real sailing row(s) (' + domRealCount + ' live DOM row(s); no local fallback)', realCount > 0 ? 'success' : 'error');
        return;
      }

      // API fallback only if the visible page truly did not expose any structured offer cards.
      log('No visible offer cards parsed; trying API/network fallback only as secondary path.', 'warning');
      const offersData = await fetchOffersFromAPI(authContext);
      let { offerRows, offerCount } = processAPIResponse(offersData, SCRAPE_PRICING_AND_ITINERARY);
      if (SCRAPE_PRICING_AND_ITINERARY && offerRows.length > 0) {
        log('🔄 Starting pricing and itinerary enrichment...', 'info');
        offerRows = await enrichWithPricingData(offerRows, authContext.baseUrl);
      }
      sendOfferRowsInChunks(offerRows, offerCount);
      log('✓ Extracted ' + offerRows.length + ' offer rows from ' + offerCount + ' offer(s)', 'success');
    } catch (error) {
      log('❌ Offer extraction primary path failed: ' + (error && error.message ? error.message : String(error)), 'error');
      log('Attempting final DOM fallback...', 'warning');
      await fallbackDOMExtraction();
    }
  }

  function cleanOfferText(text) {
    return (text || '').replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();
  }

  function normalizeRoyalCasinoOfferCode(code) {
    let value = cleanOfferText(code || '').toUpperCase();
    // Royal offer codes appear in at least two families:
    //   26BCP105 / 26JUL104 / 26WCR403B
    //   2605C03A (monthly certificate format)
    // Royal also concatenates the next cabin word in DOM text:
    //   26BCP105Exterior / 26JUL104Oceanview
    if (/^26[A-Z]{2,8}\d{2,5}[EO]$/.test(value)) value = value.slice(0, -1);
    return value;
  }


  function normalizeOfferName(name) {
    let value = cleanOfferText(name);
    value = value.replace(/^(Hi,?\s*\w+\s*)/i, '');
    value = value.replace(/^(Sign out|CURRENT CLUB TIER|Choice|Prime|Signature|Masters|My Offers|Benefits|More|Sort|Filters)\s*/ig, '').trim();
    value = value.replace(/.*(?:All Offers\s*\(\d+\)|My partner accounts\s*\(\d+\)|Sort|Filters)/i, '').trim();
    return value.slice(0, 80).trim();
  }

  function inferCabinFromDescription(desc) {
    const lower = cleanOfferText(desc).toLowerCase();
    const cabins = [];
    if (lower.includes('suite')) cabins.push('Suite');
    if (lower.includes('balcony')) cabins.push('Balcony');
    if (lower.includes('oceanview') || lower.includes('ocean view')) cabins.push('Oceanview');
    if (lower.includes('interior')) cabins.push('Interior');
    return cabins.join(' or ');
  }

  function inferGuestsFromDescription(desc) {
    const lower = cleanOfferText(desc).toLowerCase();
    if (/fare\s+for\s+one|for\s+one\s+plus|one\s+plus\s+a\s+discount/i.test(lower)) return '1 person and a discount for second guest';
    if (/room\s+for\s+two|for\s+two|2\s*person|two\s+guests/i.test(lower)) return '2 person';
    return '2 person';
  }

  function parseOfferFromText(text, fallbackIndex) {
    const clean = cleanOfferText(text);
    const codeMatch = clean.match(/(\d{4}[A-Z]\d{2}[A-Z]?|\d{2}[A-Z]{2,8}\d{2,5}[A-Z]?)/);
    const offerCode = codeMatch ? normalizeRoyalCasinoOfferCode(codeMatch[1]) : '';
    let offerName = '';
    if (offerCode) {
      const before = clean.slice(0, Math.max(0, clean.indexOf(offerCode))).trim();
      const bits = before.split(/(?:All Offers\s*\(\d+\)|My partner accounts\s*\(\d+\)|Sort|Filters|Redeem|Offer details|View Sailings|Royal Beach Club|Missing Offers\?|Contact a Club Royale Representative)/i).map(x => x.trim()).filter(Boolean);
      offerName = normalizeOfferName(bits.length ? bits[bits.length - 1] : before);
    }
    if (!offerName) {
      const nameMatch = clean.match(/([A-Z][A-Za-z0-9 '&-]{2,80})\s*(?:\d{4}[A-Z]\d{2}[A-Z]?|\d{2}[A-Z]{2,8}\d{2,5}[A-Z]?)/);
      offerName = normalizeOfferName(nameMatch ? nameMatch[1] : ('Casino Offer ' + fallbackIndex));
    }
    const expiryMatch = clean.match(/Redeem\s+by\s+([A-Za-z]{3,9}\s+\d{1,2},\s+\d{4})/i);
    let desc = '';
    if (offerCode) {
      const afterCode = clean.slice(clean.indexOf(offerCode) + offerCode.length);
      const descMatch = afterCode.match(/^\s*(.*?)\s*Redeem\s+by/i);
      desc = cleanOfferText(descMatch ? descMatch[1] : '');
    }
    return {
      offerName: offerName,
      offerCode: offerCode,
      offerExpirationDate: expiryMatch ? expiryMatch[1] : '',
      cabinType: inferCabinFromDescription(desc),
      numberOfGuests: inferGuestsFromDescription(desc),
      perks: desc
    };
  }

  function parseOfferCardsFromWholePage() {
    const pageText = cleanOfferText(document.body?.textContent || '');
    const byCode = new Map();
    const codeRegex = /(\d{4}[A-Z]\d{2}[A-Z]?|\d{2}[A-Z]{2,8}\d{2,5}[A-Z]?)/g;
    const codes = [];
    let m;
    while ((m = codeRegex.exec(pageText)) !== null) {
      const code = normalizeRoyalCasinoOfferCode(m[1]);
      if (!byCode.has(code)) codes.push({ code, index: m.index, end: m.index + m[1].length });
    }
    for (let i = 0; i < codes.length; i += 1) {
      const item = codes[i];
      const prevBoundary = Math.max(0, item.index - 160);
      const nextBoundary = i + 1 < codes.length ? codes[i + 1].index : Math.min(pageText.length, item.end + 500);
      const segment = pageText.slice(prevBoundary, nextBoundary);
      const parsed = parseOfferFromText(segment, i + 1);
      if (parsed.offerCode) byCode.set(parsed.offerCode, parsed);
    }
    // A second, very specific pass for the current Royal page shape: Name Code Description Redeem by Date.
    const re = /([A-Z][A-Za-z0-9 '&-]{2,80})\s*((?:\d{4}[A-Z]\d{2}[A-Z]?|\d{2}[A-Z]{2,8}\d{2,5}[A-Z]?))\s*(.{0,260}?)\s+Redeem\s+by\s+([A-Za-z]{3,9}\s+\d{1,2},\s+\d{4})/g;
    while ((m = re.exec(pageText)) !== null) {
      const parsed = {
        offerName: normalizeOfferName(m[1]),
        offerCode: normalizeRoyalCasinoOfferCode(m[2]),
        perks: cleanOfferText(m[3]),
        offerExpirationDate: m[4],
        cabinType: inferCabinFromDescription(m[3]),
        numberOfGuests: inferGuestsFromDescription(m[3])
      };
      if (parsed.offerCode && !byCode.has(parsed.offerCode)) byCode.set(parsed.offerCode, parsed);
    }
    const buttons = getViewSailingsButtons();
    const offers = Array.from(byCode.values()).filter(o => o.offerCode && o.offerName && !/club royale|crown|anchor|tier credits/i.test(o.offerName));
    offers.forEach((offer, idx) => { offer.button = buttons[idx] || null; });
    return offers;
  }

  function findOfferCardForButton(button) {
    let node = button;
    let best = null;
    for (let i = 0; node && i < 7; i += 1) {
      const txt = cleanOfferText(node.textContent || '');
      const hasOneOffer = (txt.match(/(?:\d{4}[A-Z]\d{2}[A-Z]?|\d{2}[A-Z]{2,8}\d{2,5}[A-Z]?)/g) || []).length === 1;
      if (txt && txt.length < 1200 && hasOneOffer && /Redeem\s+by/i.test(txt)) best = node;
      node = node.parentElement;
    }
    return best || button;
  }

  function parseVisibleOfferCards() {
    const buttons = getViewSailingsButtons();
    const byCode = new Map();
    const pageOffers = parseOfferCardsFromWholePage();

    // Primary: every View Sailings button is authoritative. Do not drop a button
    // just because the card parser missed one; this is what lost Variety Selection.
    buttons.forEach((button, idx) => {
      const card = findOfferCardForButton(button);
      let parsed = parseOfferFromText(card.textContent || button.textContent || '', idx + 1);
      if (!parsed.offerCode && pageOffers[idx]) parsed = pageOffers[idx];
      if (!parsed.offerCode) {
        parsed = {
          offerName: 'Casino Offer ' + (idx + 1),
          offerCode: 'UNKNOWN_' + (idx + 1),
          offerExpirationDate: '',
          cabinType: '',
          numberOfGuests: '2 person',
          perks: ''
        };
      }
      parsed.button = button;
      try {
        const linkEl = (button.closest && button.closest('a[href]')) || (card && card.querySelector && card.querySelector('a[href*="/club-royale/offers/"]')) || null;
        const href = (button.getAttribute && button.getAttribute('href')) || (linkEl && linkEl.href) || '';
        parsed.detailUrl = href || parsed.detailUrl || '';
        parsed.playerOfferId = extractPlayerOfferId(parsed.detailUrl || cleanOfferText(card.textContent || '')) || parsed.playerOfferId || '';
      } catch (e) {}
      const key = parsed.offerCode || ('BUTTON_' + idx);
      byCode.set(key, parsed);
    });

    // Secondary: add any parsed page offers that somehow had no button association.
    pageOffers.forEach((offer, idx) => {
      const key = offer.offerCode || ('PAGE_' + idx);
      if (!byCode.has(key)) {
        offer.button = buttons[idx] || offer.button || null;
        byCode.set(key, offer);
      }
    });

    return Array.from(byCode.values()).filter(o => {
      const name = cleanOfferText(o.offerName || '');
      const code = cleanOfferText(o.offerCode || '');
      if (!name) return false;
      if (/club royale|crown|anchor|tier credits/i.test(name)) return false;
      if (/ready to play|casino credit|apply for credit|marker account/i.test(name) && !/^26[A-Z0-9]/i.test(code)) return false;
      // Keep real coded Royal casino offers even when surrounding page chrome contains banner text.
      if (/^26[A-Z0-9]/i.test(code)) return true;
      return !/^UNKNOWN_/.test(code);
    });
  }

  function blankRowForOffer(offer, status) {
    return {
      sourcePage: 'Offers',
      offerName: offer.offerName || 'Casino Offer',
      offerCode: offer.offerCode || '',
      offerExpirationDate: offer.offerExpirationDate || '',
      offerType: offer.numberOfGuests || 'Club Royale',
      shipName: '',
      shipCode: '',
      sailingDate: '',
      itinerary: '',
      departurePort: '',
      cabinType: offer.cabinType || '',
      numberOfGuests: offer.numberOfGuests || '2 person',
      perks: offer.perks || '',
      loyaltyLevel: '',
      loyaltyPoints: '',
      interiorPrice: '',
      oceanviewPrice: '',
      balconyPrice: '',
      suitePrice: '',
      taxesAndFees: '',
      portList: '',
      dayByDayItinerary: [],
      destinationName: '',
      totalNights: null,
      bookingLink: '',
      offerStatus: status || 'Offer captured from Royal page',
      isInProgress: false
    };
  }

  function makeSailingRow(offer, shipName, dateText, contextText) {
    const row = blankRowForOffer(offer, 'Sailing captured from View Sailings page/modal');
    row.shipName = cleanOfferText(shipName || '');
    row.sailingDate = formatSailDate(cleanOfferText(dateText || ''));
    row.itinerary = cleanOfferText(contextText || '').slice(0, 900);
    const nightMatch = row.itinerary.match(/(\d{1,2})\s*(?:Night|Nt)\b/i);
    row.totalNights = nightMatch ? parseInt(nightMatch[1], 10) : null;
    row._key = [row.offerCode || row.offerName, row.shipName, row.sailingDate].join('|');
    return row;
  }

  function getDeepVisibleText() {
    const parts = [];
    const seen = new Set();
    function visit(node, depth) {
      if (!node || depth > 8 || seen.has(node)) return;
      seen.add(node);
      try {
        if (node.nodeType === Node.TEXT_NODE) {
          const t = cleanOfferText(node.nodeValue || '');
          if (t) parts.push(t);
          return;
        }
        if (node.nodeType !== Node.ELEMENT_NODE && node !== document && node.nodeType !== Node.DOCUMENT_FRAGMENT_NODE) return;
        const el = node;
        if (el.getAttribute) {
          ['aria-label','title','alt','data-testid','data-test','data-cy'].forEach(a => {
            const v = cleanOfferText(el.getAttribute(a) || '');
            if (v) parts.push(v);
          });
        }
        if (el.shadowRoot) visit(el.shadowRoot, depth + 1);
        const kids = el.childNodes ? Array.from(el.childNodes) : [];
        kids.forEach(k => visit(k, depth + 1));
      } catch(e) {}
    }
    visit(document.body || document.documentElement || document, 0);
    return parts.join('\n');
  }

  function parseSailingsFromCurrentText(offer, beforeText) {
    const fullTextRaw = (((document.body?.innerText || document.body?.textContent || '') + '\n' + getDeepVisibleText()).replace(/\r/g, '\n'));
    const fullFlat = cleanOfferText(fullTextRaw);
    const changedText = beforeText && beforeText.length ? fullTextRaw.replace(beforeText, '') : fullTextRaw;
    const targetRaw = changedText && changedText.length > 200 ? changedText : fullTextRaw;
    const targetFlat = cleanOfferText(targetRaw);
    const rows = [];
    const seen = new Set();
    function add(row) {
      if (!row || !row.shipName || !row.sailingDate) return;
      const key = row._key || [row.offerCode || row.offerName, row.shipName, row.sailingDate].join('|');
      if (seen.has(key)) return;
      seen.add(key);
      try { delete row._key; } catch(e) {}
      rows.push(row);
    }

    // Current Royal modal/table text often arrives as one long concatenated string:
    // "View detailsShip nameJewel of the Seas - 06/12/2026". This is the real ship/date row;
    // previous builds only captured the offer card placeholder because they required newlines.
    const shipDatePatterns = [
      /(?:Ship\s*name|Ship)\s*[:\-]?\s*([A-Z][A-Za-z' .-]+ of the Seas)\s*[-–—]\s*((?:\d{1,2}[\/\-]\d{1,2}[\/\-]20\d{2})|(?:20\d{6})|(?:(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*\s+\d{1,2}(?:st|nd|rd|th)?,?\s+20\d{2}))/gi,
      /([A-Z][A-Za-z' .-]+ of the Seas)\s*[-–—]\s*((?:\d{1,2}[\/\-]\d{1,2}[\/\-]20\d{2})|(?:20\d{6})|(?:(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*\s+\d{1,2}(?:st|nd|rd|th)?,?\s+20\d{2}))/gi
    ];
    shipDatePatterns.forEach(function(re) {
      let m;
      while ((m = re.exec(targetFlat)) !== null) {
        const context = targetFlat.slice(Math.max(0, m.index - 120), Math.min(targetFlat.length, re.lastIndex + 260));
        add(makeSailingRow(offer, m[1], m[2], context));
      }
    });

    const month = '(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*';
    const dateRe = new RegExp(month + '\\s+\\d{1,2}(?:st|nd|rd|th)?(?:,)?\\s+20\\d{2}|\\d{1,2}[\\/\\-]\\d{1,2}[\\/\\-]20\\d{2}|20\\d{6}', 'i');
    const shipRe = /([A-Z][A-Za-z' .-]+ of the Seas)/i;
    const lines = targetRaw.split(/\n+/).map(l => cleanOfferText(l)).filter(Boolean);
    for (let i = 0; i < lines.length; i += 1) {
      const windowText = lines.slice(i, i + 14).join(' | ');
      if (!dateRe.test(windowText) || !shipRe.test(windowText)) continue;
      const sm = windowText.match(shipRe);
      const dm = windowText.match(dateRe);
      add(makeSailingRow(offer, sm ? sm[1] : '', dm ? dm[0] : '', windowText));
    }
    return rows;
  }

  async function returnToOffersList() {
    const closeEl = Array.from(document.querySelectorAll('button, a, [role="button"]')).find(el => {
      const t = cleanOfferText(el.textContent || el.getAttribute('aria-label') || '').toLowerCase();
      return t === 'close' || t === 'back' || t.includes('back to offers') || t.includes('all offers') || t.includes('my offers');
    });
    if (closeEl) { clickElementLikeUser(closeEl); await wait(1200); return; }
    try { window.history.back(); } catch(e) {}
    await wait(1600);
    await expandAllOffersBeforeExtraction();
  }

  function mergeSailingRows(existing, incoming) {
    const seen = new Set(existing.map(r => [r.offerCode || r.offerName, r.shipName, r.sailingDate, r.itinerary].join('|')));
    incoming.forEach(row => {
      const key = [row.offerCode || row.offerName, row.shipName, row.sailingDate, row.itinerary].join('|');
      if (!seen.has(key) && (row.shipName || row.sailingDate)) {
        seen.add(key);
        existing.push(row);
      }
    });
    return existing;
  }

  function findScrollableSailingContainers() {
    const all = Array.from(document.querySelectorAll('div, section, main, [role="dialog"], [role="table"], [role="grid"], [class*="modal" i], [class*="dialog" i], [class*="drawer" i], [class*="sailing" i]'));
    return all.filter(el => {
      try {
        const style = window.getComputedStyle(el);
        const canScroll = el.scrollHeight > el.clientHeight + 50;
        const visible = el.getBoundingClientRect().height > 80;
        const text = cleanOfferText(el.textContent || '');
        return visible && canScroll && (/(of the seas|night|sail|itinerary|depart)/i.test(text) || /auto|scroll/i.test(style.overflowY || ''));
      } catch(e) { return false; }
    });
  }

  function clickMoreSailingsControls() {
    const controls = Array.from(document.querySelectorAll('button, a, [role="button"]')).filter(el => {
      const text = cleanOfferText(el.textContent || el.getAttribute('aria-label') || '').toLowerCase();
      return /^(load more|show more|view more|more sailings|next|\>)$/i.test(text) || text.includes('load more') || text.includes('show more') || text.includes('view more');
    });
    let clicked = 0;
    controls.forEach(el => {
      const disabled = el.getAttribute && (el.getAttribute('disabled') !== null || el.getAttribute('aria-disabled') === 'true');
      if (!disabled && clickElementLikeUser(el)) clicked += 1;
    });
    return clicked;
  }

  async function collectAllVisibleSailingRows(offer, beforeText) {
    let rows = [];
    let stablePasses = 0;
    let lastCount = 0;
    for (let pass = 0; pass < 36; pass += 1) {
      rows = mergeSailingRows(rows, parseSailingsFromCurrentText(offer, beforeText));
      const containers = findScrollableSailingContainers();
      if (containers.length > 0) {
        containers.forEach(container => {
          try { container.scrollTop = container.scrollHeight; } catch(e) {}
        });
      }
      try { window.scrollBy(0, Math.max(600, window.innerHeight || 700)); } catch(e) {}
      const clickedMore = clickMoreSailingsControls();
      await wait(clickedMore ? 1400 : 850);
      rows = mergeSailingRows(rows, parseSailingsFromCurrentText(offer, beforeText));
      if (rows.length === lastCount) stablePasses += 1;
      else stablePasses = 0;
      lastCount = rows.length;
      if (stablePasses >= 5) break;
    }
    return rows;
  }

  async function scrapeSailingsForVisibleOffers(offers) {
    const allRows = [];
    const expected = getAllOffersExpectedCount() || offers.length;
    if (offers.length < expected) {
      log('⚠️ Parsed ' + offers.length + ' offer card(s) but expected ' + expected + '. Continuing with button-driven extraction so no View Sailings button is skipped.', 'warning');
    }
    for (let i = 0; i < offers.length; i += 1) {
      let offer = offers[i];
      sendOfferProgress(i + 1, offers.length, offer.offerName || offer.offerCode, 0, 'processing');
      let rows = [];
      const freshOffers = parseVisibleOfferCards();
      const fresh = freshOffers.find(o => (offer.offerCode && o.offerCode === offer.offerCode) || o.offerName === offer.offerName) || freshOffers[i] || offer;
      offer = Object.assign({}, offer, { button: fresh.button || offer.button, offerName: offer.offerName || fresh.offerName, offerCode: offer.offerCode || fresh.offerCode });
      if (offer.button) {
        const before = document.body?.textContent || '';
        log('👆 Opening View Sailings for ' + (offer.offerName || offer.offerCode) + ' (' + (i + 1) + '/' + offers.length + ')', 'info');
        clickElementLikeUser(offer.button);
        await wait(6500);
        rows = await collectAllVisibleSailingRows(offer, before);
        await returnToOffersList();
        await wait(1200);
      }
      if (rows.length === 0) rows = [blankRowForOffer(offer, 'Offer captured; sailings were not exposed in readable DOM during sync')];
      rows.forEach(r => allRows.push(r));
      sendOfferProgress(i + 1, offers.length, offer.offerName || offer.offerCode, rows.length, 'complete');
      log('  ✓ DOM captured ' + rows.length + ' row(s) for ' + (offer.offerName || offer.offerCode), rows.length > 1 ? 'success' : 'warning');
      await wait(700);
    }
    return allRows;
  }

  async function fallbackDOMExtraction() {
    log('🔄 Starting DOM-based fallback extraction...', 'warning');
    await expandAllOffersBeforeExtraction();
    const visibleOffers = parseVisibleOfferCards();
    const viewSailingsButtons = getViewSailingsButtons();
    const expected = getAllOffersExpectedCount() || visibleOffers.length || viewSailingsButtons.length;
    log('Expected offers from page: ' + expected);
    log('Found ' + viewSailingsButtons.length + ' View Sailings button(s) and parsed ' + visibleOffers.length + ' visible offer card(s)', visibleOffers.length ? 'success' : 'warning');
    if (visibleOffers.length === 0) {
      log('❌ Offer page showed ' + viewSailingsButtons.length + ' View Sailings button(s), but no offer codes could be parsed. Refusing to overwrite existing offers.', 'error');
      sendOfferBatch([], true, 0, 0);
      return;
    }
    const rawRows = await scrapeSailingsForVisibleOffers(visibleOffers);
    const rows = mergeRowsPreferringBaselineWhenWebViewIsIncomplete(rawRows, visibleOffers);
    logOfferRowCounts(rows, visibleOffers, 'DOM fallback final');
    sendOfferRowsInChunks(rows, visibleOffers.length);
    log('✅ DOM fallback captured ' + visibleOffers.length + ' offer(s) and ' + rows.filter(hasRealSailing).length + ' real sailing row(s).', 'success');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', extractOffers);
  } else {
    extractOffers();
  }
})();
`;

export function injectOffersExtraction(scrapePricingAndItinerary: boolean = false) {
  return `
const SCRAPE_PRICING_AND_ITINERARY = ${scrapePricingAndItinerary};

${STEP1_OFFERS_SCRIPT}
`;
}
