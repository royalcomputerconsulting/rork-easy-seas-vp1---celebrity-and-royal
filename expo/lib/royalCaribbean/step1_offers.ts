export const STEP1_OFFERS_SCRIPT = String.raw`
(function() {
  const BATCH_SIZE = 150;
  const MAX_BATCH_CHARS = 120000;
  
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

  function sendOfferRowsInChunks(offerRows, offerCount) {
    if (!Array.isArray(offerRows) || offerRows.length === 0) {
      sendOfferBatch([], true, 0, offerCount);
      return;
    }

    let chunk = [];
    let chunkChars = 0;
    let sentCount = 0;
    let batchIndex = 0;

    for (const row of offerRows) {
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

  const MONTH_INDEX = {
    jan: 1, january: 1,
    feb: 2, february: 2,
    mar: 3, march: 3,
    apr: 4, april: 4,
    may: 5,
    jun: 6, june: 6,
    jul: 7, july: 7,
    aug: 8, august: 8,
    sep: 9, sept: 9, september: 9,
    oct: 10, october: 10,
    nov: 11, november: 11,
    dec: 12, december: 12
  };

  function normalizeYear(value) {
    const year = String(value || '').trim();
    if (!year) return null;
    return year.length === 2 ? 2000 + parseInt(year, 10) : parseInt(year, 10);
  }

  function validateDateParts(year, month, day) {
    if (!year || !month || !day) return null;
    if (year < 2020 || year > 2035 || month < 1 || month > 12 || day < 1 || day > 31) return null;
    const check = new Date(year, month - 1, day);
    if (check.getFullYear() !== year || check.getMonth() + 1 !== month || check.getDate() !== day) return null;
    return { year: year, month: month, day: day };
  }

  function getDateParts(dateStr) {
    if (!dateStr) return null;
    const normalized = String(dateStr)
      .trim()
      .replace(/\u00a0/g, ' ')
      .replace(/\s+/g, ' ')
      .replace(/\.$/, '');
    let match = normalized.match(/^(\d{4})[-\/]?(\d{2})[-\/]?(\d{2})(?:[T\s].*)?$/);
    if (match) {
      return validateDateParts(parseInt(match[1], 10), parseInt(match[2], 10), parseInt(match[3], 10));
    }
    match = normalized.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
    if (match) {
      return validateDateParts(normalizeYear(match[3]), parseInt(match[1], 10), parseInt(match[2], 10));
    }
    match = normalized.match(/^([A-Za-z]{3,9})\.?\s+(\d{1,2})(?:st|nd|rd|th)?[,]?\s+(\d{2,4})$/i);
    if (match) {
      return validateDateParts(normalizeYear(match[3]), MONTH_INDEX[match[1].toLowerCase().replace('.', '')], parseInt(match[2], 10));
    }
    match = normalized.match(/^(\d{1,2})(?:st|nd|rd|th)?\s+([A-Za-z]{3,9})\.?[,]?\s+(\d{2,4})$/i);
    if (match) {
      return validateDateParts(normalizeYear(match[3]), MONTH_INDEX[match[2].toLowerCase().replace('.', '')], parseInt(match[1], 10));
    }
    try {
      const date = new Date(normalized.includes('T') ? normalized : normalized + 'T12:00:00');
      if (!isNaN(date.getTime())) {
        return validateDateParts(date.getFullYear(), date.getMonth() + 1, date.getDate());
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
      const endpoint = baseUrl + (brandCode === 'C' ? '/api/casino/casino-offers/v2' : '/api/casino/casino-offers/v1');
      const apiBrandCode = brandCode === 'N' ? 'CCL' : brandCode;
      const brandLabel = brandCode === 'C' ? 'Celebrity' : (brandCode === 'N' ? 'Carnival' : 'Royal Caribbean');

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
      for (let attempt = 0; attempt < requestBodies.length; attempt += 1) {
        const body = requestBodies[attempt];
        try {
          window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'progress', current: attempt + 1, total: requestBodies.length, stepName: 'Fetching all casino offers...' }));
          log('  Offer API attempt ' + (attempt + 1) + '/' + requestBodies.length + (loyaltyId ? ' using loyalty id' : ' using cookies'), 'info');
          const response = await fetch(endpoint, {
            method: 'POST',
            headers: headers,
            credentials: 'include',
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
                  const refetchResponse = await fetch(endpoint, { method: 'POST', headers: headers, credentials: 'include', body: JSON.stringify({ ...body, offerCode: code }) });
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


  function collectSailingArraysDeep(value, depth) {
    if (!value || depth > 8) return [];
    const arrays = [];
    if (Array.isArray(value)) {
      const looksLikeSailing = value.some(function(item) {
        return item && typeof item === 'object' && (item.shipName || item.shipCode || item.sailDate || item.sailingDate || item.departureDate || item.startDate || item.masterSailing || item.itinerary);
      });
      if (looksLikeSailing) arrays.push(value);
      value.forEach(function(item) { arrays.push.apply(arrays, collectSailingArraysDeep(item, depth + 1)); });
      return arrays;
    }
    if (typeof value !== 'object') return [];
    Object.keys(value).forEach(function(key) {
      const lk = String(key || '').toLowerCase();
      const child = value[key];
      if (Array.isArray(child) && (lk.includes('sail') || lk.includes('cruise') || lk.includes('voyage') || lk.includes('itinerar') || lk.includes('eligible') || lk.includes('available'))) {
        const looksLikeSailing = child.some(function(item) {
          return item && typeof item === 'object' && (item.shipName || item.shipCode || item.sailDate || item.sailingDate || item.departureDate || item.startDate || item.masterSailing || item.itinerary);
        });
        if (looksLikeSailing) arrays.push(child);
      }
      arrays.push.apply(arrays, collectSailingArraysDeep(child, depth + 1));
    });
    return arrays;
  }

  function extractSailingsForOffer(offer, co) {
    const direct = co.sailings || co.availableSailings || co.eligibleSailings || co.sailingInfo || co.offerSailings || co.sailingList || co.cruises || co.voyages || co.availableCruises || co.cruiseOptions || co.sailingOptions || offer.sailings || offer.availableSailings || offer.eligibleSailings || offer.sailingInfo || offer.offerSailings || offer.sailingList || offer.cruises || offer.voyages || offer.availableCruises || offer.cruiseOptions || offer.sailingOptions || [];
    if (Array.isArray(direct) && direct.length > 0) return direct;
    const arrays = collectSailingArraysDeep(offer, 0).concat(collectSailingArraysDeep(co, 0));
    for (let i = 0; i < arrays.length; i += 1) {
      if (Array.isArray(arrays[i]) && arrays[i].length > 0) return arrays[i];
    }
    return [];
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
      const sailings = extractSailingsForOffer(offer, co);
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
        const masterSailing = sailing.masterSailing || {};
        const masterItinerary = masterSailing.itinerary || {};
        const masterShip = masterItinerary.ship || masterSailing.ship || {};
        const shipName = sailing.shipName || sailing.ship?.name || masterShip.name || '';
        const shipCode = sailing.shipCode || sailing.ship?.code || masterShip.code || '';
        const sailDate = formatSailDate(sailing.sailDate || sailing.sailingDate || sailing.departureDate || sailing.startDate);
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


  function processAllCapturedOfferPayloads() {
    let rows = [];
    let offerCount = 0;
    try {
      const payloads = [];
      const captured = window.capturedPayloads || {};
      if (captured.offers) payloads.push({ source: 'capturedPayloads.offers', data: captured.offers });
      if (Array.isArray(captured.offerPayloads)) {
        captured.offerPayloads.forEach(function(item, idx) { payloads.push({ source: item.url || ('capturedPayloads.offerPayloads[' + idx + ']'), data: item.data || item }); });
      }
      if (Array.isArray(window.capturedOfferPayloads)) {
        window.capturedOfferPayloads.forEach(function(item, idx) { payloads.push({ source: item.url || ('capturedOfferPayloads[' + idx + ']'), data: item.data || item }); });
      }
      const seenPayloads = new Set();
      payloads.forEach(function(payload, idx) {
        if (!payload || !payload.data) return;
        let key = '';
        try { key = (payload.source || '') + '|' + JSON.stringify(payload.data).slice(0, 1000); } catch(e) { key = (payload.source || '') + '|' + idx; }
        if (seenPayloads.has(key)) return;
        seenPayloads.add(key);
        const normalized = normalizeOffersApiResponse(payload.data);
        if (!normalized.offers || normalized.offers.length === 0) return;
        const parsed = processAPIResponse(normalized, SCRAPE_PRICING_AND_ITINERARY);
        const parsedRows = (parsed && parsed.offerRows) || [];
        if (parsedRows.length > 0) {
          rows = mergeSailingRows(rows, parsedRows);
          offerCount += parsed.offerCount || normalized.offers.length || 0;
          log('📦 Payload sweep parsed ' + parsedRows.length + ' sailing row(s) from ' + (payload.source || 'captured payload'), 'success');
        }
      });
    } catch (e) {
      log('⚠️ Captured offer payload sweep failed: ' + (e && e.message ? e.message : String(e)), 'warning');
    }
    return { offerRows: rows, offerCount: offerCount, totalSailings: rows.length };
  }

  async function extractOffers() {
    try {
      log('Extracting Club Royale data...');
      log('🛠️ Offer sync engine v8.6.5 active: all-offer payload sweep + strict expanded-sailing extraction + completed-history guard', 'info');
      await extractClubRoyaleStatus();
      log('Loading Club Royale Offers page...');
      await wait(2000);
      await expandAllOffersBeforeExtraction();
      window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'progress', current: 0, total: 100, stepName: 'Reading visible Club Royale offer cards...' }));

      // Royal's page currently renders the offer cards in the DOM but the old casino-offers API returns 404.
      // Do NOT call the broken endpoint first. Parse the visible offer cards immediately.
      const visibleOffers = parseVisibleOfferCards();
      const viewSailingsButtons = getViewSailingsButtons();
      const expected = getAllOffersExpectedCount() || visibleOffers.length || viewSailingsButtons.length;
      log('DOM-first offer scan: expected ' + expected + ' offer(s), parsed ' + visibleOffers.length + ' card(s), found ' + viewSailingsButtons.length + ' View Sailings button(s)', visibleOffers.length ? 'success' : 'warning');

      if (visibleOffers.length > 0) {
        let domRows = await scrapeSailingsForVisibleOffers(visibleOffers);
        let mergedRows = [];
        domRows.forEach(function(row) { mergedRows = mergeSailingRows(mergedRows, [row]); });

        const capturedResult = processAllCapturedOfferPayloads();
        if (capturedResult.offerRows && capturedResult.offerRows.length > 0) {
          mergedRows = mergeSailingRows(mergedRows, capturedResult.offerRows);
        }

        try {
          const authContext = await getAuthContext();
          const offersData = await fetchOffersFromAPI(authContext);
          let apiResult = processAPIResponse(offersData, SCRAPE_PRICING_AND_ITINERARY);
          let apiRows = apiResult.offerRows || [];
          if (SCRAPE_PRICING_AND_ITINERARY && apiRows.length > 0) {
            log('🔄 Starting pricing and itinerary enrichment for API/direct rows...', 'info');
            apiRows = await enrichWithPricingData(apiRows, authContext.baseUrl);
          }
          if (apiRows.length > 0) mergedRows = mergeSailingRows(mergedRows, apiRows);
        } catch (apiFallbackError) {
          log('⚠️ API/direct offer fetch failed after DOM extraction: ' + (apiFallbackError && apiFallbackError.message ? apiFallbackError.message : String(apiFallbackError)), 'warning');
        }

        // Ensure each visible offer tile survives even if Royal hides its sailing rows, but never count closed-card summaries as a complete sailing list.
        visibleOffers.forEach(function(offer) {
          const hasRowsForOffer = mergedRows.some(function(row) { return (offer.offerCode && row.offerCode === offer.offerCode) || (!offer.offerCode && row.offerName === offer.offerName); });
          if (!hasRowsForOffer) mergedRows.push(blankRowForOffer(offer, 'Offer captured from DOM; full View Sailings rows were not exposed'));
        });

        const mergedRowsWithSailings = mergedRows.filter(r => r && r.shipName && r.sailingDate).length;
        sendOfferRowsInChunks(mergedRows, visibleOffers.length);
        log('✅ STEP 1 ALL-OFFER MERGE COMPLETE: captured ' + visibleOffers.length + ' visible offer card(s) with ' + mergedRows.length + ' row(s), ' + mergedRowsWithSailings + ' real ship/date sailing row(s)', 'success');
        return;
      }

      // API fallback only if the visible page truly did not expose any structured offer cards.
      log('No visible offer cards parsed; trying API/network fallback only as secondary path.', 'warning');
      const authContext = await getAuthContext();
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
    const codeMatch = clean.match(/(\d{2}[A-Z]{2,8}\d{2,5}[A-Z]?)/);
    const offerCode = codeMatch ? codeMatch[1] : '';
    let offerName = '';
    if (offerCode) {
      const before = clean.slice(0, Math.max(0, clean.indexOf(offerCode))).trim();
      const bits = before.split(/(?:All Offers\s*\(\d+\)|My partner accounts\s*\(\d+\)|Sort|Filters|Redeem|Offer details|View Sailings|Royal Beach Club|Missing Offers\?|Contact a Club Royale Representative)/i).map(x => x.trim()).filter(Boolean);
      offerName = normalizeOfferName(bits.length ? bits[bits.length - 1] : before);
    }
    if (!offerName) {
      const nameMatch = clean.match(/([A-Z][A-Za-z0-9 '&-]{2,80})\s*\d{2}[A-Z]{2,8}\d{2,5}[A-Z]?/);
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
      perks: desc,
      rawCardText: clean
    };
  }

  function parseOfferCardsFromWholePage() {
    const pageText = cleanOfferText(document.body?.textContent || '');
    const byCode = new Map();
    const codeRegex = /(\d{2}[A-Z]{2,8}\d{2,5}[A-Z]?)/g;
    const codes = [];
    let m;
    while ((m = codeRegex.exec(pageText)) !== null) {
      const code = m[1];
      if (!byCode.has(code)) codes.push({ code, index: m.index, end: m.index + code.length });
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
    const re = /([A-Z][A-Za-z0-9 '&-]{2,80})\s*(\d{2}[A-Z]{2,8}\d{2,5}[A-Z]?)\s*(.{0,260}?)\s+Redeem\s+by\s+([A-Za-z]{3,9}\s+\d{1,2},\s+\d{4})/g;
    while ((m = re.exec(pageText)) !== null) {
      const parsed = {
        offerName: normalizeOfferName(m[1]),
        offerCode: m[2],
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
      const hasOneOffer = (txt.match(/\d{2}[A-Z]{2,8}\d{2,5}[A-Z]?/g) || []).length === 1;
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

    return Array.from(byCode.values()).filter(o => o.offerName && !/club royale|crown|anchor|tier credits/i.test(o.offerName));
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

  function getDateRegex(globalFlag) {
    const month = '(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t|tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\\.?';
    const textualMDY = month + '\\s+\\d{1,2}(?:st|nd|rd|th)?[,]?\\s+20\\d{2}';
    const textualDMY = '\\d{1,2}(?:st|nd|rd|th)?\\s+' + month + '[,]?\\s+20\\d{2}';
    const numeric = '\\b(?:\\d{1,2}[\\/\\-]\\d{1,2}[\\/\\-]20\\d{2}|20\\d{2}[\\/\\-]?\\d{2}[\\/\\-]?\\d{2})\\b';
    return new RegExp(textualMDY + '|' + textualDMY + '|' + numeric, globalFlag ? 'ig' : 'i');
  }

  function isLikelyExpirationDateContext(text, index, rawDate) {
    const rawLength = String(rawDate || '').length;
    const before = text.slice(Math.max(0, index - 140), index).toLowerCase();
    const after = text.slice(index + rawLength, index + rawLength + 80).toLowerCase();
    const local = text.slice(Math.max(0, index - 140), index + rawLength + 80).toLowerCase();
    // Strong expiry guard: Royal cards often place Redeem by / Reserve by near a real ship
    // name, which previously created fake sailings like Feb 14, 2026 for every offer.
    if (/(redeem|reserve|book|expires?|expiration|valid|use)\s*(by|before|until|thru|through)?[^|
]{0,80}$/.test(before)) return true;
    if (/^\s*(expiration|deadline|offer\s*ends|redeem|reserve|book|expires?)/.test(after)) return true;
    if (/(redeem\s*by|reserve\s*by|book\s*by|expires?\s*(on|by)?|expiration\s*date|valid\s*(until|through|thru))[^|
]{0,90}$/.test(local)) return true;
    return false;
  }


  function expandRoyalDateLine(rawText) {
    const text = cleanOfferText(rawText || '');
    if (!text) return [];
    const out = [];
    const seen = new Set();
    function add(raw) {
      const formatted = formatSailDate(raw);
      if (!formatted || formatted === raw) return;
      if (!seen.has(formatted)) { seen.add(formatted); out.push(formatted); }
    }
    // Full dates anywhere in the string.
    const fullRe = getDateRegex(true);
    let m;
    while ((m = fullRe.exec(text)) !== null) {
      if (!isLikelyExpirationDateContext(text, m.index, m[0])) add(m[0]);
    }
    // Royal offer-card shorthand: "Dates 2026 Aug 29, Sep 26, Oct 24, Oct 30".
    const yearMatch = text.match(/\b(20\d{2})\b/);
    const sharedYear = yearMatch ? parseInt(yearMatch[1], 10) : null;
    if (sharedYear) {
      const afterYear = text.slice(yearMatch.index + yearMatch[0].length);
      const monthDayRe = /\b(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t)?(?:ember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\.?\s+(\d{1,2})(?:st|nd|rd|th)?\b/ig;
      let md;
      while ((md = monthDayRe.exec(afterYear)) !== null) {
        const absoluteIndex = yearMatch.index + yearMatch[0].length + md.index;
        if (isLikelyExpirationDateContext(text, absoluteIndex, md[0])) continue;
        add(md[1] + ' ' + md[2] + ', ' + sharedYear);
      }
    }
    return out;
  }

  function parseSailingsFromOfferCardText(offer) {
    const cardText = cleanOfferText(offer.rawCardText || offer.cardText || '');
    if (!cardText) return [];
    const shipSearchText = cardText.replace(/.*?Ship\s*name/i, '').replace(/.*?Shipname/i, '');
    const shipMatch = shipSearchText.match(/([A-Z][A-Za-z' .-]{1,40} of the Seas)/i);
    const datesLabel = cardText.match(/(?:Dates?|Sail(?:ing)?\s*Dates?|Depart(?:ure)?\s*Dates?)\s*[:\-]?\s*(.{0,260})/i);
    if (!datesLabel) return [];
    const dateSource = datesLabel[1];
    const dates = expandRoyalDateLine(dateSource);
    if (!shipMatch || dates.length === 0) return [];
    const rows = [];
    dates.forEach(function(date) {
      const row = blankRowForOffer(offer, 'Sailing expanded from offer card date list');
      row.shipName = shipMatch[1];
      row.sailingDate = date;
      row.itinerary = cardText;
      rows.push(row);
    });
    if (rows.length > 1) {
      log('✅ Expanded offer card for ' + (offer.offerName || offer.offerCode) + ' into ' + rows.length + ' sailing date(s): ' + dates.join(', '), 'success');
    }
    return rows;
  }

  function extractSailingDateFromWindow(windowText) {
    const matches = [];
    const re = getDateRegex(true);
    let m;
    while ((m = re.exec(windowText)) !== null) {
      const raw = m[0];
      const parts = getDateParts(raw);
      if (!parts) continue;
      const context = windowText.slice(Math.max(0, m.index - 60), Math.min(windowText.length, m.index + raw.length + 60));
      if (isLikelyExpirationDateContext(windowText, m.index, raw)) continue;
      let score = 0;
      if (/sail|depart|embark|cruise|night|itinerary|ship|arrival/i.test(context)) score += 3;
      if (/redeem|reserve|expires?|expiration/i.test(context)) score -= 4;
      matches.push({ raw: raw, index: m.index, score: score });
    }
    if (matches.length === 0) return null;
    matches.sort((a, b) => b.score - a.score || a.index - b.index);
    return matches[0].raw;
  }

  function parseSailingsFromCurrentText(offer, beforeText) {
    const text = (document.body?.textContent || '').replace(/\r/g, '\n');
    const changedText = beforeText && beforeText.length ? text.replace(beforeText, '') : text;
    const targetText = changedText.length > 200 ? changedText : text;
    const rows = [];
    const dateRe = getDateRegex(false);
    const shipRe = /([A-Z][A-Za-z' .-]+ of the Seas)/i;
    const lines = targetText.split(/\n+/).map(l => l.replace(/\s+/g, ' ').trim()).filter(Boolean);
    for (let i = 0; i < lines.length; i += 1) {
      const windowText = lines.slice(i, i + 10).join(' | ');
      const shipSearchText = windowText.replace(/.*?Ship\s*name/i, '').replace(/.*?Shipname/i, '');
      if (!shipRe.test(shipSearchText)) continue;
      const sm = shipSearchText.match(shipRe);
      const sailingDates = expandRoyalDateLine(windowText);
      if (!dateRe.test(windowText) && sailingDates.length === 0) continue;
      if (sailingDates.length === 0) {
        const sailingDateRaw = extractSailingDateFromWindow(windowText);
        if (sailingDateRaw) sailingDates.push(formatSailDate(sailingDateRaw));
      }
      if (sailingDates.length === 0) continue;
      const nightMatch = windowText.match(/(\d{1,2})\s*(?:Night|Nt)\b/i);
      sailingDates.forEach(function(sailingDate) {
        const key = (sm ? sm[1] : '') + '|' + sailingDate + '|' + windowText.slice(0, 120);
        if (rows.some(r => r._key === key)) return;
        const row = blankRowForOffer(offer, 'Sailing captured from View Sailings page/modal');
        row.shipName = sm ? sm[1] : '';
        row.sailingDate = sailingDate;
        row.itinerary = windowText;
        row.totalNights = nightMatch ? parseInt(nightMatch[1], 10) : null;
        row._key = key;
        rows.push(row);
      });
    }
    rows.forEach(r => { try { delete r._key; } catch(e) {} });
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
        await wait(4500);
        rows = await collectAllVisibleSailingRows(offer, before);
        await returnToOffersList();
        await wait(1200);
      }
      // Safety gate: a closed-card summary may contain a ship name plus a Redeem-by date.
      // Those rows are not a valid expanded sailing list and must not be counted as cruises.
      rows = rows.filter(function(row) {
        const itinerary = cleanOfferText(row.itinerary || '');
        if (!row.shipName || !row.sailingDate) return false;
        if (/redeem\s*by|reserve\s*by|book\s*by|expires?|expiration\s*date|valid\s*(until|through|thru)/i.test(itinerary) &&
            !/(sailing\s*date|sailing\s*dates|departure\s*date|departure\s*dates|dates?\s*:)/i.test(itinerary)) {
          log('⚠️ Rejected probable offer-expiration row for ' + (offer.offerName || offer.offerCode) + ': ' + row.shipName + ' - ' + row.sailingDate, 'warning');
          return false;
        }
        return true;
      });
      const cardRows = parseSailingsFromOfferCardText(offer);
      if (cardRows.length > 0) rows = mergeSailingRows(rows, cardRows);
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
    const rows = await scrapeSailingsForVisibleOffers(visibleOffers);
    // Critical: never report zero when real offer cards were parsed. This lets the app sync actual offer tiles even if Royal hides sailing rows.
    sendOfferRowsInChunks(rows, visibleOffers.length);
    log('✅ DOM fallback captured ' + visibleOffers.length + ' offer(s) and ' + rows.length + ' row(s).', 'success');
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
