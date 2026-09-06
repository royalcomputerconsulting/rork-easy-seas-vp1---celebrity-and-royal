export const STEP1_OFFERS_SCRIPT = String.raw`
(function() {
  const BATCH_SIZE = 25;
  const MAX_BATCH_CHARS = 60000;
  const IS_CELEBRITY = String(location && location.hostname || '').toLowerCase().includes('celebritycruises.com');
  const PROGRAM_NAME = IS_CELEBRITY ? 'Blue Chip Club' : 'Club Royale';
  
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
    const materialSailingCount = Array.isArray(offerRows)
      ? offerRows.filter(row => row && row.shipName && row.sailingDate).length
      : 0;
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
        log('📤 Sent batch ' + batchIndex + ' with ' + chunk.length + ' offer row(s) (total rows: ' + sentCount + '/' + offerRows.length + ')', 'info');
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
      log('📤 Sent batch ' + batchIndex + ' with ' + chunk.length + ' offer row(s) (total rows: ' + sentCount + '/' + offerRows.length + ')', 'info');
    }

    sendOfferBatch([], true, materialSailingCount, offerCount);
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

  function parseMaybeJson(value) {
    if (!value) return null;
    if (typeof value === 'object') return value;
    if (typeof value !== 'string') return null;
    try { return JSON.parse(value); } catch (e) { return null; }
  }

  function firstStringValue() {
    for (let i = 0; i < arguments.length; i += 1) {
      const value = arguments[i];
      if (typeof value === 'string' && value.trim()) return value.trim();
      if (typeof value === 'number' && isFinite(value)) return String(value);
    }
    return '';
  }

  function findAppKey() {
    try {
      const captured = window.capturedRequestHeaders || {};
      if (captured.apiKey) return captured.apiKey;
      const keys = Object.keys(localStorage || {});
      for (const key of keys) {
        if (/appkey|api[-_]?key|apigee/i.test(key)) {
          const value = localStorage.getItem(key);
          if (value && value.length > 10) return value;
        }
      }
      const winAny = window;
      return winAny.RCLL_APPKEY || winAny.RCCL_APPKEY || winAny.APPKEY || '';
    } catch (e) {
      return '';
    }
  }

  function getCookieValue(name) {
    try {
      const target = String(name || '').toLowerCase();
      const entries = String(document.cookie || '').split(';');
      for (const entry of entries) {
        const separator = entry.indexOf('=');
        const key = (separator >= 0 ? entry.slice(0, separator) : entry).trim().toLowerCase();
        if (key !== target) continue;
        const value = separator >= 0 ? entry.slice(separator + 1).trim() : '';
        try { return decodeURIComponent(value); } catch (e) { return value; }
      }
    } catch (e) {}
    return '';
  }

  function decodeJwtSubject(token) {
    try {
      const raw = String(token || '').replace(/^Bearer\s+/i, '');
      const parts = raw.split('.');
      if (parts.length !== 3) return '';
      let payload = parts[1].replace(/-/g, '+').replace(/_/g, '/');
      while (payload.length % 4) payload += '=';
      const parsed = JSON.parse(atob(payload));
      return firstStringValue(parsed.sub, parsed.accountId, parsed.account_id);
    } catch (e) {
      return '';
    }
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
    match = normalized.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
    if (match) {
      const year = match[3].length === 2 ? 2000 + parseInt(match[3], 10) : parseInt(match[3], 10);
      return { year: year, month: parseInt(match[1], 10), day: parseInt(match[2], 10) };
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
    const providerInstanceId = safeStr(
      offer.playerOfferId || offer.offerInstanceId || offer.carnivalOfferId || offer.offerId || offer.id ||
      co.playerOfferId || co.offerInstanceId || co.carnivalOfferId || co.offerId || co.id
    ).trim();
    if (providerInstanceId) return 'provider:' + providerInstanceId.toLowerCase();
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

  async function extractClubRoyaleStatus() {
    try {
      log('Extracting ' + PROGRAM_NAME + ' status...');
      log('⚠️ Note: Loyalty data will be fetched via API in Step 4 for accuracy', 'info');
      return null;
    } catch (error) {
      log('Error extracting ' + PROGRAM_NAME + ' status: ' + error.message, 'warning');
      return null;
    }
  }

  async function getAuthContext() {
    try {
      log('Parsing live session data from browser storage...');
      const host = location && location.hostname ? location.hostname : '';
      const isCarnivalHost = host.includes('carnival.com');
      const storageKeys = ['persist:session'];
      if (isCarnivalHost) {
        storageKeys.push('persist:auth', 'persist:root', 'carnival-session', 'persist:user');
      }
      try {
        Object.keys(localStorage || {}).forEach((key) => {
          if (/persist:|session|auth|token|user/i.test(key) && !storageKeys.includes(key)) {
            storageKeys.push(key);
          }
        });
      } catch (e) {}

      let bestSession = null;
      for (const key of storageKeys) {
        const raw = localStorage.getItem(key);
        if (!raw || raw.length < 10) continue;
        const parsed = parseMaybeJson(raw);
        if (!parsed) continue;
        const token = parseMaybeJson(parsed.token) || parsed.token || parsed.accessToken || parsed.access_token || parsed.idToken || parsed.id_token || parsed.authToken;
        const user = parseMaybeJson(parsed.user) || parsed.user || parsed.profile || parsed.account || {};
        const accountId = firstStringValue(
          user.accountId,
          user.accountID,
          user.account_id,
          parsed.accountId,
          parsed.accountID,
          parsed.account_id,
          user.guestAccountId,
          parsed.guestAccountId
        );
        const loyaltyId = firstStringValue(
          user.cruiseLoyaltyId,
          user.cruiseLoyaltyID,
          user.loyaltyId,
          user.loyaltyID,
          user.casinoLoyaltyId,
          user.casinoLoyaltyID,
          user.clubRoyaleId,
          user.blueChipId,
          user.crownAndAnchorNumber,
          user.crownAnchorNumber,
          user.captainsClubId,
          parsed.cruiseLoyaltyId,
          parsed.loyaltyId
        );
        const tokenString = firstStringValue(token);
        const expirationRaw = parsed.tokenExpiration || parsed.expiresAt || parsed.expires_at || parsed.expiration;
        const expirationNumber = expirationRaw ? Number(expirationRaw) : 0;
        const tokenExpiration = expirationNumber > 0 && expirationNumber < 100000000000 ? expirationNumber * 1000 : expirationNumber;
        const score = (tokenString ? 4 : 0) + (accountId ? 3 : 0) + (loyaltyId ? 2 : 0) + (key === 'persist:session' ? 1 : 0);
        if (score > 0 && (!bestSession || score > bestSession.score)) {
          bestSession = { key, token: tokenString, accountId, loyaltyId, tokenExpiration, user, score };
        }
      }

      const capturedHeaders = window.capturedRequestHeaders || {};
      const capturedAuth = firstStringValue(capturedHeaders.authorization);
      const capturedAccountId = firstStringValue(capturedHeaders.accountId, capturedHeaders.xAccountId);
      const capturedLoyaltyId = firstStringValue(capturedHeaders.loyaltyId, capturedHeaders.xLoyaltyId);
      const cookieToken = firstStringValue(getCookieValue('accessToken'), getCookieValue('access_token'));
      const cookieAccountId = firstStringValue(getCookieValue('VDS_ID'), getCookieValue('vds_id'));
      const cookieLoyaltyId = firstStringValue(getCookieValue('loyalty_ID'), getCookieValue('loyalty_id'));
      const authToken = bestSession?.token || cookieToken || (capturedAuth ? capturedAuth.replace(/^Bearer\s+/i, '') : '');
      const accountId = bestSession?.accountId || cookieAccountId || capturedAccountId || decodeJwtSubject(authToken);
      let loyaltyId = bestSession?.loyaltyId || cookieLoyaltyId || capturedLoyaltyId || '';
      if (!loyaltyId && window.capturedPayloads && window.capturedPayloads.loyalty) {
        const queue = [window.capturedPayloads.loyalty];
        const loyaltyKeys = ['cruiseLoyaltyId', 'loyaltyId', 'loyaltyID', 'casinoLoyaltyId', 'clubRoyaleId', 'crownAndAnchorNumber', 'loyaltyNumber'];
        while (queue.length > 0 && !loyaltyId) {
          const current = queue.shift();
          if (!current || typeof current !== 'object') continue;
          for (const key of loyaltyKeys) {
            const candidate = current[key];
            if ((typeof candidate === 'string' || typeof candidate === 'number') && String(candidate).trim()) {
              loyaltyId = String(candidate).trim();
              break;
            }
          }
          if (!loyaltyId) {
            Object.keys(current).slice(0, 80).forEach((key) => {
              const child = current[key];
              if (child && typeof child === 'object') queue.push(child);
            });
          }
        }
      }

      if (!authToken && !accountId) {
        // Royal commonly authenticates the embedded browser through HttpOnly
        // cookies. A logged-in page can therefore have no token visible to
        // JavaScript. Keep the valid cookie session and use credentials:'include'.
        log('Using the active cookie-authenticated Royal session', 'success');
      }

      if (bestSession?.tokenExpiration && bestSession.tokenExpiration < Date.now()) {
        log('⚠️ Stored token timestamp is stale; continuing with the active browser session/cookies', 'warning');
      }

      log('Session context prepared' + (bestSession?.key ? ' from ' + bestSession.key : ' from captured headers'), 'success');
      const networkAuth = authToken ? (authToken.startsWith('Bearer ') ? authToken : 'Bearer ' + authToken) : capturedAuth;
      const appKey = findAppKey();
      const headers = {
        'accept': 'application/json',
        'accept-language': 'en-US,en;q=0.9',
        'content-type': 'application/json',
        'cache-control': 'no-cache',
        'pragma': 'no-cache',
      };
      if (accountId) {
        headers['account-id'] = accountId;
        headers['x-account-id'] = accountId;
      }
      if (loyaltyId) headers['x-loyalty-id'] = loyaltyId;
      if (networkAuth) headers['authorization'] = networkAuth;
      if (appKey) {
        headers['appkey'] = appKey;
        headers['x-api-key'] = appKey;
      }
      const brandCode = host.includes('celebritycruises.com') ? 'C' : (host.includes('carnival.com') ? 'N' : 'R');
      const baseUrl = brandCode === 'C' ? 'https://www.celebritycruises.com' : (brandCode === 'N' ? 'https://www.carnival.com' : 'https://www.royalcaribbean.com');
      return { headers, accountId, loyaltyId, brandCode, baseUrl, user: bestSession?.user || {} };
    } catch (error) {
      log('Failed to get auth context: ' + error.message, 'error');
      throw error;
    }
  }

  async function fetchPricingAndItinerary(baseUrl, shipCode, minDate, maxDate, count) {
    const endpoint = baseUrl + '/graph';
    const query = 'query cruiseSearch_Cruises($filters:String,$qualifiers:String,$sort:CruiseSearchSort,$pagination:CruiseSearchPagination,$nlSearch:String){cruiseSearch(filters:$filters,qualifiers:$qualifiers,sort:$sort,pagination:$pagination,nlSearch:$nlSearch){results{cruises{id productViewLink masterSailing{itinerary{name code days{number type ports{activity arrivalTime departureTime port{code name region}}}departurePort{code name region}destination{code name}portSequence sailingNights ship{code name}totalNights type}}sailings{bookingLink id itinerary{code}sailDate startDate endDate taxesAndFees{value}taxesAndFeesIncluded stateroomClassPricing{price{value currency{code}}stateroomClass{id content{code}}}}}cruiseRecommendationId total}}}';
    const filtersValue = 'startDate:' + minDate + '~' + maxDate + '|ship:' + shipCode;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 18000);
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        signal: controller.signal,
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
    } finally {
      clearTimeout(timeout);
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
      });
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

  async function readRoyalJsonResponse(response, label) {
    const contentType = String(response.headers && response.headers.get ? response.headers.get('content-type') || '' : '').toLowerCase();
    if (contentType.includes('application/json')) return response.json();
    const raw = await response.text();
    try { return JSON.parse(raw); } catch (e) {}
    try { return JSON.parse(atob(raw)); } catch (e) {
      throw new Error(label + ' response was not readable JSON');
    }
  }

  async function fetchRoyalWithTimeout(url, options, label, timeoutMs) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs || 18000);
    try {
      const response = await fetch(url, { ...options, signal: controller.signal, credentials: 'include' });
      if (!response.ok) {
        let detail = '';
        try { detail = (await response.clone().text()).slice(0, 180); } catch (e) {}
        const error = new Error(label + ' failed: HTTP ' + response.status + (detail ? ' - ' + detail : ''));
        error.status = response.status;
        throw error;
      }
      return response;
    } catch (error) {
      if (error && error.name === 'AbortError') throw new Error(label + ' timed out');
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }

  function mergeDetailedCampaignOffer(originalOffer, detailsData, expectedCode) {
    let detailCampaignOffer = null;
    if (detailsData && Array.isArray(detailsData.offers) && detailsData.offers.length > 0) {
      const match = detailsData.offers.find(item => {
        const campaign = getCampaignOffer(item);
        return safeStr(campaign.offerCode).trim().toUpperCase() === String(expectedCode || '').trim().toUpperCase();
      }) || detailsData.offers[0];
      detailCampaignOffer = getCampaignOffer(match);
    } else if (detailsData && detailsData.campaignOffer) {
      detailCampaignOffer = detailsData.campaignOffer;
    } else if (detailsData && (detailsData.sailings || detailsData.offerCode)) {
      detailCampaignOffer = detailsData;
    }
    if (!detailCampaignOffer) return originalOffer;
    const cloned = JSON.parse(JSON.stringify(originalOffer));
    cloned.campaignOffer = { ...getCampaignOffer(cloned), ...detailCampaignOffer };
    return cloned;
  }

  function findCapturedRoyalOfferList() {
    try {
      const captured = window.capturedPayloads || {};
      const candidates = Array.isArray(captured.offerCandidates) ? captured.offerCandidates : [];
      for (let index = candidates.length - 1; index >= 0; index -= 1) {
        const candidate = candidates[index];
        const url = String(candidate && candidate.url || '').toLowerCase();
        if (!url.includes('/api/casino/v2/offers/list')) continue;
        const normalized = normalizeOffersApiResponse(candidate && candidate.data);
        if (Array.isArray(normalized.offers) && normalized.offers.length > 0) {
          return { data: candidate.data, offers: normalized.offers, url: String(candidate.url || '') };
        }
      }
    } catch (error) {}
    return null;
  }

  async function fetchCurrentRoyalOffers(authContext) {
    const partnerPath = '/api/casino/v1/partners/player';
    const listPath = '/api/casino/v2/offers/list';
    const detailsPath = '/api/casino/v2/offers/details';
    const baseUrl = authContext.baseUrl || location.origin;
    const headers = { ...(authContext.headers || {}) };

    log('🔌 Using the current three-step ' + PROGRAM_NAME + ' API flow...', 'info');

    let partnershipIds = [];
    try {
      const partnerResponse = await fetchRoyalWithTimeout(baseUrl + partnerPath, { method: 'GET', headers }, PROGRAM_NAME + ' partner lookup', 15000);
      const partnerData = await readRoyalJsonResponse(partnerResponse, PROGRAM_NAME + ' partner lookup');
      const partners = Array.isArray(partnerData) ? partnerData : (Array.isArray(partnerData?.data) ? partnerData.data : []);
      partnershipIds = partners.map(partner => safeStr(partner?.partnershipId || partner?.id || partner)).filter(Boolean);
      log('✅ Retrieved ' + partnershipIds.length + ' ' + PROGRAM_NAME + ' partnership ID(s)', 'success');
    } catch (error) {
      if (error && (error.status === 402 || error.status === 403)) throw error;
      log('⚠️ Partnership lookup was unavailable; trying the offers list with the signed-in session', 'warning');
    }

    const featureFlags = authContext.user && authContext.user.featureFlags ? authContext.user.featureFlags : {};
    const approvedAgencyIds = Array.isArray(featureFlags['approved-agency-ids']) ? featureFlags['approved-agency-ids'] : [];
    const digitalRedemption = typeof featureFlags['digital-redemption'] === 'boolean' ? featureFlags['digital-redemption'] : true;
    const listParams = new URLSearchParams();
    if (partnershipIds.length > 0) listParams.append('partnershipIds', partnershipIds.join(','));
    listParams.append('sortBy', 'offer.reserveByDate');
    listParams.append('sortDirection', 'asc');
    listParams.append('limit', '100');
    listParams.append('page', '1');
    listParams.append('digitalRedemption', String(digitalRedemption));
    if (approvedAgencyIds.length > 0) listParams.append('approvedAgencyIds', approvedAgencyIds.join(','));

    const listUrl = baseUrl + listPath + '?' + listParams.toString();
    const capturedList = findCapturedRoyalOfferList();
    let listData = capturedList ? capturedList.data : null;
    if (capturedList) {
      log('✅ Using the signed-in website offer list already captured by Easy Seas (' + capturedList.offers.length + ' offer(s)); skipping a duplicate list request', 'success');
    } else {
      let listError = null;
      for (let attempt = 1; attempt <= 3; attempt += 1) {
        try {
          const listResponse = await fetchRoyalWithTimeout(listUrl, { method: 'GET', headers }, PROGRAM_NAME + ' offers list', 20000);
          listData = await readRoyalJsonResponse(listResponse, PROGRAM_NAME + ' offers list');
          break;
        } catch (error) {
          listError = error;
          const status = Number(error && error.status || 0);
          const retryable = !status || status === 429 || status >= 500;
          if (!retryable || attempt === 3) break;
          const retryDelay = 600 * attempt;
          log('⚠️ ' + PROGRAM_NAME + ' offer list attempt ' + attempt + ' failed' + (status ? ' with HTTP ' + status : '') + '; retrying in ' + retryDelay + 'ms', 'warning');
          await wait(retryDelay);
        }
      }
      if (!listData) throw listError || new Error(PROGRAM_NAME + ' offers list returned no data');
    }
    const initialOffers = normalizeOffersApiResponse(listData).offers;
    if (!Array.isArray(initialOffers) || initialOffers.length === 0) {
      throw new Error('The current ' + PROGRAM_NAME + ' offers list returned zero offer records');
    }
    log('✅ ' + PROGRAM_NAME + ' list returned ' + initialOffers.length + ' offer(s)', 'success');

    const detailedOffers = new Array(initialOffers.length);
    const detailRequestCache = new Map();
    let nextIndex = 0;
    let detailFailureCount = 0;
    // Bounded concurrency shortens Royal's per-offer detail waterfall without
    // collapsing distinct playerOfferId instances or flooding the session.
    // Four requests avoids overwhelming Royal's session while transient
    // throttling and server failures receive two backoff retries.
    const DETAIL_WORKER_LIMIT = 4;
    const workerCount = Math.min(DETAIL_WORKER_LIMIT, initialOffers.length);
    const workers = Array.from({ length: workerCount }, async () => {
      while (true) {
        const index = nextIndex;
        nextIndex += 1;
        if (index >= initialOffers.length) return;
        const offer = initialOffers[index];
        const campaign = getCampaignOffer(offer);
        const offerCode = safeStr(campaign.offerCode || campaign.marketingCouponCode || campaign.code).trim();
        const playerOfferId = safeStr(offer.playerOfferId || campaign.playerOfferId).trim();
        if (!offerCode || !playerOfferId) {
          detailedOffers[index] = offer;
          detailFailureCount += 1;
          log('⚠️ Offer instance ' + (index + 1) + ' is missing the offer code or playerOfferId required for sailing details', 'warning');
          continue;
        }
        const detailsParams = new URLSearchParams();
        detailsParams.append('offerCode', offerCode);
        detailsParams.append('playerOfferId', playerOfferId);
        detailsParams.append('limit', '999');
        detailsParams.append('page', '1');
        detailsParams.append('sortBy', 'offer.reserveByDate');
        detailsParams.append('sortDirection', 'asc');
        try {
          const detailIdentity = offerCode.toUpperCase() + '|' + playerOfferId;
          let detailRequest = detailRequestCache.get(detailIdentity);
          if (!detailRequest) {
            detailRequest = (async () => {
              let lastError = null;
              for (let attempt = 0; attempt < 3; attempt += 1) {
                try {
                  const detailResponse = await fetchRoyalWithTimeout(baseUrl + detailsPath + '?' + detailsParams.toString(), { method: 'GET', headers }, 'Offer ' + offerCode + ' details', 20000);
                  return await readRoyalJsonResponse(detailResponse, 'Offer ' + offerCode + ' details');
                } catch (error) {
                  lastError = error;
                  const status = Number(error && error.status || 0);
                  const retryable = !status || status === 429 || status >= 500;
                  if (!retryable || attempt === 2) break;
                  await wait(600 * (attempt + 1));
                }
              }
              throw lastError || new Error('Offer detail request failed');
            })();
            detailRequestCache.set(detailIdentity, detailRequest);
          }
          const detailData = await detailRequest;
          detailedOffers[index] = mergeDetailedCampaignOffer(offer, detailData, offerCode);
          const sailingCount = Array.isArray(getCampaignOffer(detailedOffers[index]).sailings) ? getCampaignOffer(detailedOffers[index]).sailings.length : 0;
          sendOfferProgress(index + 1, initialOffers.length, offerCode, sailingCount, 'complete');
        } catch (error) {
          detailedOffers[index] = offer;
          detailFailureCount += 1;
          log('⚠️ Could not refresh details for ' + offerCode + ': ' + error.message, 'warning');
        }
      }
    });
    await Promise.all(workers);

    const result = { ...(listData && typeof listData === 'object' && !Array.isArray(listData) ? listData : {}), offers: detailedOffers.filter(Boolean) };
    const withSailings = result.offers.filter(offer => {
      const campaign = getCampaignOffer(offer);
      return Array.isArray(campaign.sailings) && campaign.sailings.length > 0;
    }).length;
    log('✅ Current ' + PROGRAM_NAME + ' API completed: ' + result.offers.length + ' offer(s), ' + withSailings + ' with sailing details', 'success');
    if (detailFailureCount > 0) {
      throw new Error(PROGRAM_NAME + ' detail recovery remained incomplete for ' + detailFailureCount + ' offer instance(s); refusing to publish a partial sailing catalog');
    }
    if (withSailings === 0) {
      throw new Error(PROGRAM_NAME + ' returned ' + result.offers.length + ' offer instance(s) but zero sailing-detail responses');
    }
    return result;
  }

  async function fetchOffersFromAPI(authContext) {
    // First use Royal's current signed-in three-step flow: partner IDs, offer
    // list, then per-offer sailing details. Captured network/server-rendered
    // payloads remain a secondary recovery path, followed by DOM extraction.
    try {
      return await fetchCurrentRoyalOffers(authContext);
    } catch (currentApiError) {
      log('⚠️ Current ' + PROGRAM_NAME + ' API flow unavailable: ' + currentApiError.message, 'warning');
    }

    log('🔎 Inspecting the live Royal page and captured website requests for offer data...', 'info');
    await wait(1200);

    const candidates = [];
    const captured = window.capturedPayloads || {};
    if (captured.offers) candidates.push(captured.offers);
    if (Array.isArray(captured.offerCandidates)) {
      captured.offerCandidates.forEach(entry => {
        if (entry && entry.data) candidates.push(entry.data);
      });
    }

    try {
      if (window.__NEXT_DATA__) candidates.push(window.__NEXT_DATA__);
    } catch (e) {}

    function collectJsonScripts(doc) {
      const found = [];
      try {
        Array.from(doc.querySelectorAll('script')).forEach(script => {
          const raw = String(script.textContent || '').trim();
          if (!raw || raw.length > 5000000) return;
          const type = String(script.getAttribute('type') || '').toLowerCase();
          if (type.includes('json') || raw[0] === '{' || raw[0] === '[') {
            const parsed = parseMaybeJson(raw);
            if (parsed) found.push(parsed);
          }
        });
      } catch (e) {}
      return found;
    }

    collectJsonScripts(document).forEach(candidate => candidates.push(candidate));

    let richest = null;
    let richestCount = 0;
    candidates.forEach(candidate => {
      try {
        const normalized = normalizeOffersApiResponse(candidate);
        const count = Array.isArray(normalized.offers) ? normalized.offers.length : 0;
        if (count > richestCount) {
          richest = normalized;
          richestCount = count;
        }
      } catch (e) {}
    });

    if (richest && richestCount > 0) {
      const recoveredSailingOffers = richest.offers.filter(offer => {
        const campaign = getCampaignOffer(offer);
        return Array.isArray(campaign.sailings) && campaign.sailings.length > 0;
      }).length;
      if (recoveredSailingOffers > 0) {
        log('✅ Recovered ' + richestCount + ' ' + PROGRAM_NAME + ' offer record(s), including ' + recoveredSailingOffers + ' with sailing details, from the website session', 'success');
        return richest;
      }
      log('⚠️ Recovered ' + richestCount + ' offer headers but no sailing details; continuing to the live View Sailings fallback instead of exporting empty placeholders', 'warning');
    }

    throw new Error('The signed-in page did not expose a structured offer payload; using link/DOM extraction.');
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
    const processPricingGroup = async (group) => {
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
            }
          }
          processedCount += group.sailings.length;
          log('  ✓ Enriched ' + group.sailings.length + ' sailing(s) for ship ' + group.shipCode, 'success');
        } else {
          processedCount += group.sailings.length;
          log('  ⚠️ No pricing data found for ship ' + group.shipCode, 'warning');
        }
      } catch (err) {
        processedCount += group.sailings.length;
        log('  ⚠️ Error fetching pricing for ' + group.shipCode + ': ' + err.message, 'warning');
      }
    };
    let nextGroupIndex = 0;
    const pricingWorkerCount = Math.min(3, groups.length);
    const pricingWorkers = Array.from({ length: pricingWorkerCount }, async () => {
      while (true) {
        const groupIndex = nextGroupIndex;
        nextGroupIndex += 1;
        if (groupIndex >= groups.length) return;
        await processPricingGroup(groups[groupIndex]);
      }
    });
    await Promise.all(pricingWorkers);
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
      const playerOfferId = safeStr(offer.playerOfferId || co.playerOfferId).trim();
      const carnivalOfferId = safeStr(offer.carnivalOfferId || co.carnivalOfferId || offer.offerId || co.offerId).trim();
      let offerInstanceId = safeStr(offer.offerInstanceId || co.offerInstanceId || playerOfferId || carnivalOfferId).trim();
      const offerName = co.name || co.title || co.offerName || co.marketingTitle || '';
      const offerCode = co.offerCode || co.marketingCouponCode || co.couponCode || co.code || '';
      const offerExpiry = formatDate(co.reserveByDate);
      if (!offerInstanceId) offerInstanceId = [offerCode, offerName, offerExpiry, i].join('|').toLowerCase();
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
          playerOfferId: playerOfferId,
          carnivalOfferId: carnivalOfferId,
          offerInstanceId: offerInstanceId,
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
          numberOfGuests: '',
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
          playerOfferId: playerOfferId,
          carnivalOfferId: carnivalOfferId,
          offerInstanceId: offerInstanceId,
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

  async function extractOffers() {
    try {
      log('Extracting ' + PROGRAM_NAME + ' data...');
      await extractClubRoyaleStatus();
      log('Loading ' + PROGRAM_NAME + ' Offers page...');
      await wait(2000);
      window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'progress', current: 0, total: 100, stepName: 'Authenticating and fetching all data...' }));
      const authContext = await getAuthContext();
      const offersData = await fetchOffersFromAPI(authContext);
      let { offerRows, offerCount } = processAPIResponse(offersData, SCRAPE_PRICING_AND_ITINERARY);
      if (SCRAPE_PRICING_AND_ITINERARY && offerRows.length > 0) {
        log('🔄 Starting pricing and itinerary enrichment...', 'info');
        offerRows = await enrichWithPricingData(offerRows, authContext.baseUrl);
      }
      const parsedInstanceIds = new Set((offersData.offers || []).map((offer, index) => getOfferIdentityKey(offer, 'parsed:' + index)));
      const exportedInstanceIds = new Set(offerRows.map((row, index) => {
        const providerId = row.playerOfferId || row.carnivalOfferId || row.offerInstanceId;
        return providerId
          ? 'provider:' + String(providerId).toLowerCase()
          : [row.offerCode, row.offerName, row.offerExpirationDate, index].join('|').toLowerCase();
      }));
      const codesToInstances = {};
      (offersData.offers || []).forEach((offer, index) => {
        const campaign = getCampaignOffer(offer);
        const code = safeStr(campaign.offerCode || campaign.marketingCouponCode || campaign.code || '[NO CODE]').toUpperCase();
        if (!codesToInstances[code]) codesToInstances[code] = new Set();
        codesToInstances[code].add(getOfferIdentityKey(offer, 'diagnostic:' + index));
      });
      const sharedCodeDiagnostics = Object.keys(codesToInstances).filter(code => codesToInstances[code].size > 1);
      sharedCodeDiagnostics.forEach(code => log('ℹ️ Preserved ' + codesToInstances[code].size + ' distinct offer instances sharing code ' + code, 'info'));
      const materialSailingRows = offerRows.filter(row => row && row.shipName && row.sailingDate).length;
      log('📊 Offer reconciliation — website: ' + offerCount + ', parsed instances: ' + parsedInstanceIds.size + ', exported instances: ' + exportedInstanceIds.size + ', sailing rows: ' + materialSailingRows, parsedInstanceIds.size === exportedInstanceIds.size ? 'success' : 'warning');
      if (offerCount !== parsedInstanceIds.size || parsedInstanceIds.size !== exportedInstanceIds.size) {
        log('⚠️ Offer totals differ; no rows were discarded silently. Review the per-offer diagnostics above before replacing saved data.', 'warning');
      }
      sendOfferRowsInChunks(offerRows, offerCount);
      log('✓ Extracted ' + materialSailingRows + ' sailing row(s) plus ' + (offerRows.length - materialSailingRows) + ' empty offer header(s) from ' + offerCount + ' offer(s)', 'success');
      if (SCRAPE_PRICING_AND_ITINERARY) {
        const withPricing = offerRows.filter(r => r.interiorPrice || r.oceanviewPrice || r.balconyPrice || r.suitePrice).length;
        const withItinerary = offerRows.filter(r => r.dayByDayItinerary && r.dayByDayItinerary.length > 0).length;
        const withTaxes = offerRows.filter(r => r.taxesAndFees).length;
        log('📊 Enrichment summary: ' + withPricing + ' with pricing, ' + withItinerary + ' with day-by-day itinerary, ' + withTaxes + ' with taxes/fees', 'success');
      }
    } catch (error) {
      log('Structured offer extraction was unavailable: ' + error.message, 'warning');
      const capturedOffers = window.capturedPayloads && window.capturedPayloads.offers;
      if (capturedOffers) {
        try {
          log('🔄 Rechecking the already-captured ' + PROGRAM_NAME + ' payload...', 'info');
          const recoveredData = normalizeOffersApiResponse(capturedOffers);
          let recovered = processAPIResponse(recoveredData, SCRAPE_PRICING_AND_ITINERARY);
          let recoveredRows = recovered.offerRows || [];
          if (SCRAPE_PRICING_AND_ITINERARY && recoveredRows.length > 0) {
            recoveredRows = await enrichWithPricingData(recoveredRows, location.origin);
          }
          const materialRecoveredRows = recoveredRows.filter(row => row && row.shipName && row.sailingDate).length;
          const capturedList = findCapturedRoyalOfferList();
          const materialRecoveredInstances = new Set(recoveredRows.filter(row => row && row.shipName && row.sailingDate).map((row, index) => {
            const providerId = row.playerOfferId || row.carnivalOfferId || row.offerInstanceId;
            return providerId ? 'provider:' + String(providerId).toLowerCase() : [row.offerCode, row.offerName, row.offerExpirationDate, index].join('|').toLowerCase();
          })).size;
          const expectedRecoveredInstances = capturedList ? capturedList.offers.length : 0;
          const captureProvesCompleteCatalog = expectedRecoveredInstances > 0 && materialRecoveredInstances >= expectedRecoveredInstances;
          if (materialRecoveredRows > 0 && captureProvesCompleteCatalog) {
            sendOfferRowsInChunks(recoveredRows, recovered.offerCount || 0);
            log('✅ Recovered ' + materialRecoveredRows + ' sailing row(s) from network capture', 'success');
            return;
          }
          log('⚠️ Captured recovery did not prove sailing details for all ' + expectedRecoveredInstances + ' listed offer instance(s); continuing to the live View Sailings fallback', 'warning');
        } catch (captureError) {
          log('⚠️ Captured offers recovery failed: ' + captureError.message, 'warning');
        }
      }
      log('Attempting fallback to DOM scraping...', 'warning');
      await fallbackDOMExtraction();
    }
  }

  async function fallbackDOMExtraction() {
    log('🔄 Starting non-navigating ' + PROGRAM_NAME + ' link/DOM extraction...', 'warning');
    const pageText = document.body ? (document.body.textContent || '') : '';
    let expectedOfferCount = 0;
    const featuredMatch = pageText.match(/Featured\s+Offers?\s*\((\d+)\)/i);
    const moreMatch = pageText.match(/More\s+Offers?\s*\((\d+)\)/i);
    if (featuredMatch) expectedOfferCount += parseInt(featuredMatch[1], 10);
    if (moreMatch) expectedOfferCount += parseInt(moreMatch[1], 10);
    log('Expected offers from page: ' + expectedOfferCount);

    const viewSailingsButtons = Array.from(document.querySelectorAll('button, a, [role="button"]')).filter(el => {
      const text = String(el.textContent || '').trim().toLowerCase();
      return text.includes('view sailing') || text.includes('see sailing');
    });

    if (viewSailingsButtons.length === 0) {
      log('No View Sailings controls were found on the signed-in page.', 'warning');
      sendOfferBatch([], true, 0, 0);
      return;
    }

    log('Found ' + viewSailingsButtons.length + ' View Sailings controls');
    const extractedRows = [];
    const seenRows = new Set();

    function normalizeSpace(value) {
      return String(value || '').replace(/\s+/g, ' ').trim();
    }

    function findOfferCard(button) {
      return button.closest('article, li, section, [data-testid*="offer"], [class*="offer-card"], [class*="OfferCard"], [class*="offer"]')
        || button.parentElement;
    }

    function parseCardMeta(card, index) {
      const text = normalizeSpace(card && card.textContent);
      const codeMatch = text.match(/\b\d{2}[A-Z0-9]{4,12}\b/i);
      const heading = card && card.querySelector ? card.querySelector('h1,h2,h3,h4,[class*="title"],[data-testid*="title"]') : null;
      const expiryMatch = text.match(/(?:redeem|reserve|book)\s+by\s*:?[ ]*((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{1,2},\s+\d{4}|\d{1,2}\/\d{1,2}\/\d{2,4})/i);
      const cardPlayerOfferId = card && card.getAttribute
        ? (card.getAttribute('data-player-offer-id') || card.getAttribute('data-playerofferid') || card.getAttribute('data-offer-id'))
        : '';
      const offerLink = card && card.querySelector ? card.querySelector('a[href*="offer"],a[href*="playerOffer"]') : null;
      const href = offerLink && offerLink.getAttribute ? String(offerLink.getAttribute('href') || '') : '';
      const hrefIdMatch = href.match(/[?&](?:playerOfferId|offerId)=([^&#]+)/i);
      const playerOfferId = normalizeSpace(cardPlayerOfferId || (hrefIdMatch ? decodeURIComponent(hrefIdMatch[1]) : ''));
      const offerCode = codeMatch ? codeMatch[0].toUpperCase() : '';
      const offerName = normalizeSpace(heading && heading.textContent) || (PROGRAM_NAME + ' Offer ' + (index + 1));
      const offerExpirationDate = expiryMatch ? normalizeSpace(expiryMatch[1]) : '';
      return {
        offerCode: offerCode,
        offerName: offerName,
        offerExpirationDate: offerExpirationDate,
        playerOfferId: playerOfferId,
        offerInstanceId: playerOfferId || [offerCode, offerName, offerExpirationDate, index].join('|').toLowerCase(),
        cardText: text
      };
    }

    function rowKey(row) {
      return [row.playerOfferId || row.offerInstanceId, row.offerCode, row.shipName, row.sailingDate, row.cabinType, row.numberOfGuests, row.perks].join('|').toLowerCase();
    }

    function addRow(row, meta) {
      if (!row || !row.shipName || !row.sailingDate) return false;
      const enriched = {
        ...row,
        sourcePage: row.sourcePage || 'Offers',
        offerCode: row.offerCode || meta.offerCode,
        offerName: row.offerName || meta.offerName,
        offerExpirationDate: row.offerExpirationDate || meta.offerExpirationDate,
        offerType: row.offerType || PROGRAM_NAME,
        playerOfferId: row.playerOfferId || meta.playerOfferId,
        offerInstanceId: row.offerInstanceId || meta.offerInstanceId,
      };
      const key = rowKey(enriched);
      if (seenRows.has(key)) return false;
      seenRows.add(key);
      extractedRows.push(enriched);
      return true;
    }

    function parseSailingText(rawText, meta) {
      const block = normalizeSpace(rawText);
      if (!block || block.length > 5000) return null;
      const dateMatch = block.match(/\b(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+\d{1,2},\s+\d{4}\b/i)
        || block.match(/\b\d{1,2}\/\d{1,2}\/\d{4}\b/);
      const shipMatch = block.match(/\b[A-Z][A-Za-z' -]+ of the Seas\b/i);
      if (!dateMatch || !shipMatch) return null;

      const nightsMatch = block.match(/\b(\d{1,2})\s*Night\b/i);
      const cabinMatch = block.match(/\b(Interior|Ocean\s*View|Oceanview|Balcony|Junior\s*Suite|Suite)(?:\s*-\s*GTY|\s+GTY)?\b/i);
      const guestsMatch = block.match(/\b(?:for\s+)?([12])\s+Guests?\b/i);
      const freePlayMatch = block.match(/\$(\d[\d,]*)\s*Free\s*Play/i);
      const obcMatch = block.match(/\$(\d[\d,]*)\s*(?:OBC|Onboard Credit|Next\s*Cruise\s*OBC)/i);
      const tradeMatch = block.match(/\$(\d[\d,]*)\s*Trade[-\s]*In/i);
      const portMatch = block.match(/(?:Depart(?:ure|ing)?\s*(?:Port|From)?|Sails?\s+From)\s*:?\s*([^|•]+?)(?=\s{2,}|[|•]|$)/i);

      return {
        sourcePage: 'Offers',
        offerName: meta.offerName,
        offerCode: meta.offerCode,
        playerOfferId: meta.playerOfferId,
        offerInstanceId: meta.offerInstanceId,
        offerExpirationDate: meta.offerExpirationDate,
        offerType: PROGRAM_NAME,
        shipName: normalizeSpace(shipMatch[0]),
        shipCode: '',
        sailingDate: normalizeSpace(dateMatch[0]),
        itinerary: nightsMatch ? normalizeSpace(block.substring(Math.max(0, nightsMatch.index || 0), Math.min(block.length, (nightsMatch.index || 0) + 180))) : '',
        departurePort: portMatch ? normalizeSpace(portMatch[1]) : '',
        cabinType: cabinMatch ? normalizeSpace(cabinMatch[0]) : '',
        numberOfGuests: guestsMatch ? guestsMatch[1] : '',
        perks: [
          freePlayMatch ? ('$' + freePlayMatch[1] + ' FreePlay') : '',
          obcMatch ? ('$' + obcMatch[1] + ' OBC') : '',
          tradeMatch ? ('$' + tradeMatch[1] + ' Trade-In') : ''
        ].filter(Boolean).join('; '),
        loyaltyLevel: '', loyaltyPoints: '', interiorPrice: '', oceanviewPrice: '', balconyPrice: '', suitePrice: '', taxesAndFees: '', portList: '', dayByDayItinerary: [], destinationName: '',
        totalNights: nightsMatch ? parseInt(nightsMatch[1], 10) : undefined,
        bookingLink: ''
      };
    }

    function parseDocumentRows(doc, meta) {
      let added = 0;
      const selectors = [
        'tr', 'li', 'article',
        '[data-testid*="sailing"]', '[data-testid*="cruise"]',
        '[class*="sailing"]', '[class*="Sailing"]', '[class*="cruise-card"]', '[class*="CruiseCard"]'
      ].join(',');
      const nodes = Array.from(doc.querySelectorAll(selectors));
      nodes.forEach(node => {
        const text = normalizeSpace(node.textContent || '');
        if (text.length < 15 || text.length > 5000) return;
        const row = parseSailingText(text, meta);
        if (row && addRow(row, meta)) added += 1;
      });

      if (added === 0 && doc.body) {
        const rawLines = String(doc.body.innerText || doc.body.textContent || '').split(/\n+/).map(normalizeSpace).filter(Boolean);
        for (let index = 0; index < rawLines.length; index += 1) {
          const block = rawLines.slice(Math.max(0, index - 2), Math.min(rawLines.length, index + 5)).join(' ');
          const row = parseSailingText(block, meta);
          if (row && addRow(row, meta)) added += 1;
        }
      }
      return added;
    }

    function getDetailHref(button, card) {
      const directAnchor = button.tagName && button.tagName.toLowerCase() === 'a' ? button : button.closest('a[href]');
      const cardAnchor = card && card.querySelector ? Array.from(card.querySelectorAll('a[href]')).find(a => /sailing|offer|casino/i.test(String(a.textContent || '') + ' ' + String(a.getAttribute('href') || ''))) : null;
      const raw = (directAnchor && directAnchor.getAttribute('href'))
        || (cardAnchor && cardAnchor.getAttribute('href'))
        || button.getAttribute('data-href')
        || button.getAttribute('data-url')
        || '';
      if (!raw || raw.startsWith('javascript:') || raw === '#') return '';
      try { return new URL(raw, location.href).href; } catch (e) { return ''; }
    }

    async function fetchDocument(url) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15000);
      try {
        const response = await fetch(url, { credentials: 'include', signal: controller.signal, headers: { accept: 'text/html,application/xhtml+xml,application/json' } });
        if (!response.ok) throw new Error('HTTP ' + response.status);
        const contentType = String(response.headers.get('content-type') || '').toLowerCase();
        if (contentType.includes('json')) {
          const json = await response.json();
          const normalized = normalizeOffersApiResponse(json);
          return { doc: null, structured: normalized };
        }
        const html = await response.text();
        return { doc: new DOMParser().parseFromString(html, 'text/html'), structured: null };
      } finally {
        clearTimeout(timeout);
      }
    }

    function rowsFromStructured(structured, meta) {
      try {
        const processed = processAPIResponse(structured, false);
        let count = 0;
        (processed.offerRows || []).forEach(row => { if (addRow(row, meta)) count += 1; });
        return count;
      } catch (e) {
        return 0;
      }
    }

    for (let buttonIndex = 0; buttonIndex < viewSailingsButtons.length; buttonIndex += 1) {
      const button = viewSailingsButtons[buttonIndex];
      const card = findOfferCard(button);
      const meta = parseCardMeta(card, buttonIndex);
      let offerRows = 0;

      try {
        // First parse any sailing information already rendered in the offer card.
        const cardRow = parseSailingText(card ? card.textContent || '' : '', meta);
        if (cardRow && addRow(cardRow, meta)) offerRows += 1;

        const href = getDetailHref(button, card);
        if (href) {
          log('Fetching offer ' + (buttonIndex + 1) + '/' + viewSailingsButtons.length + ' without leaving the offers page...', 'info');
          const fetched = await fetchDocument(href);
          if (fetched.structured) offerRows += rowsFromStructured(fetched.structured, meta);
          if (fetched.doc) {
            // Structured state can be embedded in JSON script tags.
            Array.from(fetched.doc.querySelectorAll('script')).forEach(script => {
              const raw = String(script.textContent || '').trim();
              if (!raw || raw.length > 5000000) return;
              const parsed = parseMaybeJson(raw);
              if (parsed) offerRows += rowsFromStructured(normalizeOffersApiResponse(parsed), meta);
            });
            offerRows += parseDocumentRows(fetched.doc, meta);
          }
        }

        // Only attempt a same-page modal interaction when there is no link.
        // Never click a navigation anchor: that was the source of the prior
        // page reload and permanent Step 1 hang after offer 1.
        const declaresDialog = String(button.getAttribute('aria-haspopup') || '').toLowerCase() === 'dialog'
          || Boolean(button.getAttribute('aria-controls'))
          || /modal|dialog|drawer/i.test(String(button.getAttribute('data-target') || button.getAttribute('data-testid') || ''));
        if (offerRows === 0 && !href && declaresDialog && String(button.tagName || '').toLowerCase() !== 'a') {
          button.scrollIntoView({ block: 'center' });
          button.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
          await wait(1200);
          const dialog = document.querySelector('[role="dialog"], [aria-modal="true"], [class*="modal"], [class*="drawer"]');
          if (dialog) {
            const tempDoc = document.implementation.createHTMLDocument('dialog');
            tempDoc.body.innerHTML = dialog.innerHTML;
            offerRows += parseDocumentRows(tempDoc, meta);
            const closeButton = Array.from(dialog.querySelectorAll('button,[role="button"]')).find(el => {
              const label = normalizeSpace((el.getAttribute && (el.getAttribute('aria-label') || el.getAttribute('title'))) || el.textContent).toLowerCase();
              return label === 'close' || label.includes('close dialog') || label === '×';
            });
            if (closeButton && typeof closeButton.click === 'function') closeButton.click();
          }
        }
      } catch (error) {
        log('Offer ' + (buttonIndex + 1) + ' extraction error: ' + String(error && error.message ? error.message : error), 'warning');
      }

      sendOfferProgress(buttonIndex + 1, viewSailingsButtons.length, meta.offerName, offerRows, offerRows > 0 ? 'complete' : 'empty');
      log('Offer ' + (buttonIndex + 1) + '/' + viewSailingsButtons.length + ' (' + meta.offerName + '): ' + offerRows + ' sailing row(s)', offerRows > 0 ? 'success' : 'warning');
      await wait(150);
    }

    sendOfferRowsInChunks(extractedRows, viewSailingsButtons.length);
    if (extractedRows.length > 0) {
      log('✅ ' + PROGRAM_NAME + ' extraction completed: ' + extractedRows.length + ' sailing row(s) from ' + viewSailingsButtons.length + ' visible offer(s)', 'success');
    } else {
      log('⛔ ' + PROGRAM_NAME + ' offers are visible but no sailing rows were readable. Existing saved offers will be preserved and the sync will be marked incomplete.', 'error');
    }
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
