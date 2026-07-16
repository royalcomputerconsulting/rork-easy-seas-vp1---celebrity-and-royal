import { CARNIVAL_CAPTURE_RUNTIME_SCRIPT } from '../carnival/carnivalInventoryRuntime';

export const AUTH_DETECTION_SCRIPT = `
(function() {
  let lastAuthState = null;
  let checkCount = 0;
  
  if (!window.capturedPayloads) {
    window.capturedPayloads = {
      offers: null,
      upcomingCruises: null,
      courtesyHolds: null,
      loyalty: null,
      voyageEnrichment: null,
      carnivalVifpOffers: null,
      carnivalSearch: null,
      carnivalSearchByContext: {},
      carnivalProfilePayloads: []
    };
  }

  ${CARNIVAL_CAPTURE_RUNTIME_SCRIPT}

  function getCarnivalSearchContext() {
    try {
      if (window.__easySeasCarnivalSearchContext) return window.__easySeasCarnivalSearchContext;
      var raw = localStorage.getItem('__easySeasCarnivalSearchContext');
      if (!raw) return null;
      var parsed = JSON.parse(raw);
      window.__easySeasCarnivalSearchContext = parsed;
      return parsed;
    } catch (e) { return null; }
  }

  function captureCarnivalSearchPayload(data, requestMeta, contextOverride) {
    try {
      var context = contextOverride || getCarnivalSearchContext();
      if (!context || !context.runId || !context.offerCode || !context.requestId) return;
      var meta = Object.assign({}, requestMeta || {}, {
        expectedOfferCode: String(context.offerCode || '').toUpperCase(),
        expectedPageNumber: Number(context.pageNumber || 1),
        runId: String(context.runId || ''),
        requestId: String(context.requestId || ''),
        contextFingerprint: String(context.contextFingerprint || ''),
        accountFingerprint: String(context.accountFingerprint || context.contextFingerprint || ''),
        expectedUrl: String(context.expectedUrl || ''),
        contextStartedAt: Number(context.startedAt || 0),
        requestStartedAt: Number((requestMeta && requestMeta.requestStartedAt) || context.requestStartedAt || 0),
        navigationSequenceId: Number(context.navigationSequenceId || 0),
        expectedNavigationSequenceId: Number(context.navigationSequenceId || 0)
      });
      var analysis = __esAnalyzeCarnivalPayload(data, meta);
      var isInventory = analysis.kind === 'inventory' || analysis.kind === 'inventory_empty';
      if (!isInventory || !analysis.offerCodeMatched || !analysis.pageMatched) {
        if (isInventory || /cruise|sailing|voyage|search/i.test(String(meta.requestUrl || ''))) {
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'log', runId: meta.runId,
            message: 'Ignored Carnival ' + analysis.kind + ' payload for ' + meta.expectedOfferCode + ' page ' + meta.expectedPageNumber + ': ' + analysis.reason + ' (endpoint=' + analysis.approvedEndpoint + ', startedAfterContext=' + analysis.requestStartedAfterContext + ', navMatch=' + analysis.navigationSequenceMatched + ', codeProof=' + analysis.offerProofSource + ', pageProof=' + analysis.pageProofSource + ')',
            logType: 'info'
          }));
        }
        return;
      }
      var maxPayloadBytes = 2500000;
      var maxEnvelopeBytes = 6000000;
      if (analysis.payloadBytes > maxPayloadBytes) {
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'log', runId: meta.runId,
          message: 'Rejected oversized Carnival inventory payload (' + analysis.payloadBytes + ' bytes) for ' + meta.expectedOfferCode + ' page ' + meta.expectedPageNumber,
          logType: 'warning'
        }));
        return;
      }
      var envelope = {
        data: [],
        url: String(meta.responseUrl || meta.requestUrl || ''),
        runId: meta.runId,
        offerCode: meta.expectedOfferCode,
        pageNumber: meta.expectedPageNumber,
        requestId: meta.requestId,
        contextFingerprint: String(meta.contextFingerprint || ''),
        expectedUrl: String(context.expectedUrl || ''),
        capturedAt: Date.now(),
        inventoryValidated: true,
        requestProof: analysis.offerProofSource !== 'none',
        pageProof: analysis.pageProofSource !== 'none',
        offerProofSource: analysis.offerProofSource,
        pageProofSource: analysis.pageProofSource,
        contextCorrelated: Boolean(analysis.contextCorrelated),
        payloads: []
      };
      if (!window.capturedPayloads.carnivalSearchByContext) window.capturedPayloads.carnivalSearchByContext = {};
      var key = envelope.runId + '|' + envelope.offerCode + '|' + envelope.pageNumber + '|' + envelope.requestId;
      var priorEnvelope = window.capturedPayloads.carnivalSearchByContext[key];
      var payloads = priorEnvelope && Array.isArray(priorEnvelope.payloads) ? priorEnvelope.payloads.slice() : [];
      payloads.push({
        data: data,
        metadata: {
          requestMethod: String(meta.method || 'GET').toUpperCase(),
          requestUrl: String(meta.requestUrl || ''),
          requestBody: typeof meta.body === 'string' ? meta.body.substring(0, 12000) : meta.body,
          responseUrl: String(meta.responseUrl || meta.requestUrl || ''),
          status: Number(meta.status || 0),
          contentType: String(meta.contentType || ''),
          offerCode: envelope.offerCode,
          pageNumber: envelope.pageNumber,
          requestId: envelope.requestId,
          contextFingerprint: envelope.contextFingerprint,
          accountFingerprint: String(meta.accountFingerprint || ''),
          runId: envelope.runId,
          contextStartedAt: Number(meta.contextStartedAt || 0),
          requestStartedAt: Number(meta.requestStartedAt || 0),
          navigationSequenceId: Number(meta.navigationSequenceId || 0),
          offerProofSource: String(analysis.offerProofSource || 'none'),
          pageProofSource: String(analysis.pageProofSource || 'none'),
          capturedAt: Date.now()
        },
        analysis: analysis,
        capturedAt: Date.now()
      });
      if (payloads.length > 8) payloads = payloads.slice(payloads.length - 8);
      var totalBytes = 0;
      for (var pi = payloads.length - 1; pi >= 0; pi--) {
        totalBytes += Number(payloads[pi].analysis && payloads[pi].analysis.payloadBytes || 0);
        if (totalBytes > maxEnvelopeBytes) payloads.splice(0, pi + 1);
      }
      envelope.payloads = payloads;
      envelope.data = payloads.map(function(item) { return item.data; });
      envelope.url = String((payloads[payloads.length - 1] && payloads[payloads.length - 1].metadata.responseUrl) || envelope.url);
      window.capturedPayloads.carnivalSearchByContext[key] = envelope;
      window.capturedPayloads.carnivalSearch = envelope;
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'log', runId: envelope.runId,
        message: '📦 Captured verified Carnival ' + analysis.kind + ' payload for ' + envelope.offerCode + ' page ' + envelope.pageNumber + ' via ' + (analysis.inventoryPath || 'inventory adapter') + ' (code=' + analysis.offerProofSource + ', page=' + analysis.pageProofSource + ')',
        logType: 'info'
      }));
    } catch (e) {}
  }

  function recordCarnivalProfilePayload(data, url, source) {
    try {
      if (!data || typeof data !== 'object') return;
      var absoluteUrl = '';
      try { absoluteUrl = new URL(String(url || ''), window.location.href).toString(); } catch (e) { absoluteUrl = String(url || ''); }
      var host = ''; try { host = new URL(absoluteUrl, window.location.href).hostname; } catch (e2) {}
      if (!/(^|\.)carnival\.com$/i.test(host || String(window.location && window.location.hostname || ''))) return;
      var urlSignal = /profile|booking|reservation|cruise.?history|past.?cruise|my.?cruise|loyalty|vifp|pastguest|tier/i.test(absoluteUrl);
      var keySignal = false;
      try {
        var topKeys = Object.keys(data).join('|');
        var nestedKeys = data.data && typeof data.data === 'object' ? Object.keys(data.data).join('|') : '';
        keySignal = /booking|reservation|cruise|voyage|pastguest|vifp|tier|loyalty|profile/i.test(topKeys + '|' + nestedKeys);
      } catch (e3) {}
      if (!urlSignal && !keySignal) return;
      var encoded = ''; try { encoded = JSON.stringify(data); } catch (e4) {}
      if (!encoded || encoded.length > 2500000) return;
      window.capturedPayloads = window.capturedPayloads || {};
      var ledger = Array.isArray(window.capturedPayloads.carnivalProfilePayloads) ? window.capturedPayloads.carnivalProfilePayloads : [];
      var signature = absoluteUrl + '|' + encoded.length + '|' + encoded.substring(0, 180);
      for (var li = ledger.length - 1; li >= 0; li--) if (ledger[li] && ledger[li].signature === signature) return;
      ledger.push({ url: absoluteUrl, source: String(source || 'network'), capturedAt: Date.now(), signature: signature, data: data });
      if (ledger.length > 30) ledger = ledger.slice(ledger.length - 30);
      window.capturedPayloads.carnivalProfilePayloads = ledger;
    } catch (e) {}
  }

  function postCarnivalNetworkPayload(endpoint, data, url) {
    try {
      var encoded = JSON.stringify(data);
      if (encoded.length > 120000) {
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'log',
          message: 'Captured large Carnival ' + endpoint + ' payload locally (' + encoded.length + ' bytes); bridge transfer skipped to protect the app',
          logType: 'info'
        }));
        return;
      }
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'network_payload', endpoint: endpoint, data: data, url: url
      }));
    } catch (e) {}
  }

  function isCarnivalProtectedProfileApiUrl(url) {
    return /\\/profilemanagement\\/api\\/v1\\.0\\/profiles(?:[/?#]|$)/i.test(String(url || ''));
  }

  function carnivalPayloadShowsAuthFailure(data) {
    if (!data || typeof data !== 'object') return false;
    var message = String(data.message || data.error || data.errorMessage || data.description || data.title || '').toLowerCase();
    var status = Number(data.status || data.statusCode || data.httpStatus || 0);
    return status === 401 || status === 403 || /unauthori[sz]ed|forbidden|not authenticated|authentication required|session (?:has )?expired|please sign in|log in to continue/i.test(message);
  }

  function markCarnivalProtectedApiAuthenticated(url) {
    window.__easySeasCarnivalApiAuthenticatedAt = Date.now();
    window.__easySeasCarnivalApiAuthenticatedUrl = String(url || '');
    try {
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'auth_status',
        loggedIn: true,
        source: 'carnival_protected_profile_api',
        url: String(url || '')
      }));
    } catch (e) {}
  }

  function clearCarnivalProtectedApiAuthentication(url, reason) {
    window.__easySeasCarnivalApiAuthenticatedAt = 0;
    window.__easySeasCarnivalApiAuthenticatedUrl = '';
    try {
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'auth_status',
        loggedIn: false,
        source: 'carnival_protected_profile_api',
        reason: String(reason || ''),
        url: String(url || '')
      }));
    } catch (e) {}
  }

  function normalizeRequestHeaders(headersLike) {
    var normalized = {};
    try {
      if (!headersLike) return normalized;
      if (typeof Headers !== 'undefined' && headersLike instanceof Headers) {
        headersLike.forEach(function(value, key) { normalized[String(key).toLowerCase()] = String(value); });
        return normalized;
      }
      if (Array.isArray(headersLike)) {
        headersLike.forEach(function(pair) {
          if (Array.isArray(pair) && pair.length >= 2) normalized[String(pair[0]).toLowerCase()] = String(pair[1]);
        });
        return normalized;
      }
      if (typeof headersLike.forEach === 'function') {
        headersLike.forEach(function(value, key) { normalized[String(key).toLowerCase()] = String(value); });
        return normalized;
      }
      if (typeof headersLike === 'object') {
        Object.keys(headersLike).forEach(function(key) {
          var value = headersLike[key];
          if (value !== undefined && value !== null) normalized[String(key).toLowerCase()] = String(value);
        });
      }
    } catch (e) {}
    return normalized;
  }

  function captureRoyalAuthenticatedHeaders(url, headersLike) {
    try {
      var absolute = '';
      try { absolute = new URL(String(url || ''), window.location.href).toString(); } catch (e) { absolute = String(url || ''); }
      if (!/aws-prd\\.api\\.rccl\\.com|royalcaribbean\\.com\\/(?:api|myaccount|account)/i.test(absolute)) return;
      var incoming = normalizeRequestHeaders(headersLike);
      var allowed = [
        'authorization', 'account-id', 'appkey', 'x-api-key', 'x-rcl-appkey', 'x-rcl-client-id',
        'client-id', 'consumer-id', 'brand', 'locale', 'accept-language', 'content-type', 'accept'
      ];
      window.__easySeasRoyalRequestHeaders = window.__easySeasRoyalRequestHeaders || {};
      allowed.forEach(function(key) {
        if (incoming[key] !== undefined && incoming[key] !== null && String(incoming[key]).trim() !== '') {
          window.__easySeasRoyalRequestHeaders[key] = String(incoming[key]);
        }
      });
      window.__easySeasRoyalRequestHeadersCapturedAt = Date.now();
      window.__easySeasRoyalRequestHeadersSourceUrl = absolute;
    } catch (e) {}
  }

  function mergeFetchRequestHeaders(input, init) {
    var merged = {};
    try {
      if (input && typeof input === 'object' && input.headers) Object.assign(merged, normalizeRequestHeaders(input.headers));
      if (init && init.headers) Object.assign(merged, normalizeRequestHeaders(init.headers));
    } catch (e) {}
    return merged;
  }

  function interceptNetworkCalls() {
    if (window.__easySeasNetworkIntercepted) return;
    window.__easySeasNetworkIntercepted = true;
    window.__easySeasRoyalRequestHeaders = window.__easySeasRoyalRequestHeaders || {};

    const originalFetch = window.fetch;
    window.fetch = function(...args) {
      var requestContext = getCarnivalSearchContext();
      requestContext = requestContext ? Object.assign({}, requestContext, { requestStartedAt: Date.now() }) : null;
      var carnivalAuthProbeRequest = !!window.__easySeasCarnivalAuthProbeInFlight;
      const requestUrlBeforeFetch = (typeof args[0] === 'string') ? args[0] : (args[0] && args[0].url ? args[0].url : '');
      const requestInitBeforeFetch = args[1] || {};
      captureRoyalAuthenticatedHeaders(requestUrlBeforeFetch, mergeFetchRequestHeaders(args[0], requestInitBeforeFetch));
      return originalFetch.apply(this, args).then(response => {
        const clonedResponse = response.clone();
        const url = requestUrlBeforeFetch;
        const requestInit = requestInitBeforeFetch;
        const requestMethod = requestInit.method || (args[0] && args[0].method) || 'GET';
        const requestBody = requestInit.body || '';
        const carnivalProtectedProfileApi = isCarnivalProtectedProfileApiUrl(url);

        if (carnivalProtectedProfileApi && (response.status === 401 || response.status === 403)) {
          clearCarnivalProtectedApiAuthentication(response.url || url, 'Protected Carnival profile API rejected the session');
        }
        
        if (typeof url === 'string' && url) {
          if (url.includes('/api/casino/casino-offers') || url.includes('/casino-offers')) {
            if (response.ok && response.status === 200) {
              clonedResponse.json().then(data => {
                window.capturedPayloads.offers = data;
                window.ReactNativeWebView.postMessage(JSON.stringify({
                  type: 'network_payload',
                  endpoint: 'offers',
                  data: data,
                  url: url
                }));
                window.ReactNativeWebView.postMessage(JSON.stringify({
                  type: 'log',
                  message: '📦 Captured Casino Offers API payload with ' + (data?.offers?.length || data?.payload?.casinoOffers?.length || data?.casinoOffers?.length || 0) + ' offers',
                  logType: 'success'
                }));
              }).catch(() => {});
            }
          }
          
          if (url.includes('/profileBookings/enriched') || url.includes('/api/account/upcoming-cruises') || url.includes('/api/profile/bookings')) {
            if (response.ok && response.status === 200) {
              clonedResponse.json().then(data => {
                window.capturedPayloads.upcomingCruises = data;
                window.ReactNativeWebView.postMessage(JSON.stringify({
                  type: 'network_payload',
                  endpoint: 'upcomingCruises',
                  data: data,
                  url: url
                }));
                const count = (data?.profileBookings?.length || data?.payload?.sailingInfo?.length || data?.sailingInfo?.length || 0);
                window.ReactNativeWebView.postMessage(JSON.stringify({
                  type: 'log',
                  message: '📦 Captured Bookings API payload with ' + count + ' bookings from ' + url,
                  logType: 'success'
                }));
              }).catch(() => {});
            }
          }
          
          if (url.includes('/api/account/courtesy-holds')) {
            if (response.ok && response.status === 200) {
              clonedResponse.json().then(data => {
                window.capturedPayloads.courtesyHolds = data;
                window.ReactNativeWebView.postMessage(JSON.stringify({
                  type: 'network_payload',
                  endpoint: 'courtesyHolds',
                  data: data,
                  url: url
                }));
                const count = (data?.payload?.sailingInfo?.length || data?.sailingInfo?.length || 0);
                window.ReactNativeWebView.postMessage(JSON.stringify({
                  type: 'log',
                  message: '📦 Captured Courtesy Holds API payload with ' + count + ' holds',
                  logType: 'success'
                }));
              }).catch(() => {});
            }
          }
          
          if (url.includes('/ships/voyages') && url.includes('/enriched')) {
            if (response.ok && response.status === 200) {
              clonedResponse.json().then(data => {
                if (!window.capturedPayloads.voyageEnrichment) {
                  window.capturedPayloads.voyageEnrichment = {};
                }
                window.capturedPayloads.voyageEnrichment = data;
                window.ReactNativeWebView.postMessage(JSON.stringify({
                  type: 'network_payload',
                  endpoint: 'voyageEnrichment',
                  data: data,
                  url: url
                }));
                const count = Object.keys(data || {}).length;
                window.ReactNativeWebView.postMessage(JSON.stringify({
                  type: 'log',
                  message: '📦 Captured Voyage Enrichment data with ' + count + ' voyages from ' + url,
                  logType: 'success'
                }));
              }).catch(() => {});
            }
          }
          
          if (url.includes('/guestAccounts/loyalty/info') || url.includes('/en/celebrity/web/v3/guestAccounts/')) {
            clonedResponse.text().then(text => {
              let data = null;
              try { data = JSON.parse(text); } catch (e) { data = { raw: text }; }
              window.capturedPayloads.loyalty = data;
              window.ReactNativeWebView.postMessage(JSON.stringify({
                type: 'network_payload',
                endpoint: 'loyalty',
                data: data,
                url: url
              }));
              window.ReactNativeWebView.postMessage(JSON.stringify({
                type: 'log',
                message: '📦 Captured Loyalty API payload (' + response.status + ') from ' + url,
                logType: response.ok ? 'success' : 'warning'
              }));
            }).catch(() => {});
          } else if (response.ok && response.status === 200 && (url.includes('/loyalty') || url.includes('/guestAccounts/loyalty') || url.includes('/loyaltyInformation') || url.includes('/loyalty-programs') || url.includes('/profile/loyalty') || url.includes('/account/info'))) {
            clonedResponse.json().then(data => {
              window.capturedPayloads.loyalty = data;
              window.ReactNativeWebView.postMessage(JSON.stringify({
                type: 'network_payload',
                endpoint: 'loyalty',
                data: data,
                url: url
              }));
              window.ReactNativeWebView.postMessage(JSON.stringify({
                type: 'log',
                message: '📦 Captured Loyalty API payload from ' + url,
                logType: 'success'
              }));
            }).catch(() => {});
          }
          var isCarnivalDomain = (window.location && window.location.hostname || '').includes('carnival.com');
          if (isCarnivalDomain && response.ok && response.status === 200) {
            var lowerUrl = url.toLowerCase();
            var contentType = '';
            try { contentType = response.headers.get('content-type') || ''; } catch(e) {}
            var isJsonResponse = contentType.includes('json') || contentType.includes('javascript');
            if (lowerUrl.includes('/api/profile') || lowerUrl.includes('/profilemanagement') || lowerUrl.includes('/api/booking') || lowerUrl.includes('/api/account') || lowerUrl.includes('/api/cruise') || lowerUrl.includes('/api/reservation') || lowerUrl.includes('/api/trip')) {
              clonedResponse.clone().json().then(function(data) {
                if (!data) return;
                if (carnivalProtectedProfileApi && !carnivalPayloadShowsAuthFailure(data)) {
                  markCarnivalProtectedApiAuthenticated(response.url || url);
                }
                if (carnivalProtectedProfileApi && carnivalAuthProbeRequest) return;
                var bookingArr = data.bookings || data.cruises || data.reservations || data.upcoming || data.trips || data.payload || data.data || null;
                if (Array.isArray(data) && data.length > 0 && (data[0].bookingId || data[0].confirmationNumber || data[0].shipName)) bookingArr = data;
                if (Array.isArray(bookingArr) && bookingArr.length > 0 && (bookingArr[0].bookingId || bookingArr[0].confirmationNumber || bookingArr[0].shipName || bookingArr[0].sailDate || bookingArr[0].departureDate)) {
                  window.capturedPayloads.upcomingCruises = data;
                  postCarnivalNetworkPayload('upcomingCruises', data, url);
                  window.ReactNativeWebView.postMessage(JSON.stringify({
                    type: 'log', message: '📦 Captured Carnival bookings (' + bookingArr.length + ') from ' + url, logType: 'success'
                  }));
                }
                if (data.TierCode || data.PastGuestNumber || data.loyaltyTier || data.vifpNumber || data.loyaltyLevel) {
                  if (!window.capturedPayloads.loyalty) {
                    window.capturedPayloads.loyalty = data;
                    postCarnivalNetworkPayload('loyalty', data, url);
                    window.ReactNativeWebView.postMessage(JSON.stringify({
                      type: 'log', message: '📦 Captured Carnival loyalty from profile API', logType: 'success'
                    }));
                  }
                  window.ReactNativeWebView.postMessage(JSON.stringify({
                    type: 'carnival_user_data', data: data
                  }));
                }
              }).catch(function() {});
            }
            if (lowerUrl.includes('personaliz') || lowerUrl.includes('vifp') || lowerUrl.includes('cruise-deals') || lowerUrl.includes('tgo') || lowerUrl.includes('member') || lowerUrl.includes('offers') || lowerUrl.includes('casino')) {
              clonedResponse.clone().json().then(function(data) {
                if (data && data.Items && Array.isArray(data.Items) && data.Items.length > 0 && data.Items[0].OfferId) {
                  window.capturedPayloads.carnivalVifpOffers = data;
                  window.__carnivalVifpOffers = data;
                  postCarnivalNetworkPayload('carnival_vifp_offers', data, url);
                  window.ReactNativeWebView.postMessage(JSON.stringify({
                    type: 'log', message: '📦 Captured Carnival VIFP offers (' + data.Items.length + ') from ' + url, logType: 'success'
                  }));
                }
                if (data && data.offers && Array.isArray(data.offers) && data.offers.length > 0) {
                  postCarnivalNetworkPayload('offers', data, url);
                  window.ReactNativeWebView.postMessage(JSON.stringify({
                    type: 'log', message: '📦 Captured Carnival casino offers (' + data.offers.length + ') from ' + url, logType: 'success'
                  }));
                }
              }).catch(function() {});
            }
            if (lowerUrl.includes('/api/profile/loyalty') || lowerUrl.includes('loyaltyinformation') || lowerUrl.includes('/vifp') || lowerUrl.includes('/loyalty') || lowerUrl.includes('/pastguest') || lowerUrl.includes('/tier')) {
              clonedResponse.clone().json().then(function(data) {
                if (data && !window.capturedPayloads.loyalty) {
                  window.capturedPayloads.loyalty = data;
                  postCarnivalNetworkPayload('loyalty', data, url);
                  window.ReactNativeWebView.postMessage(JSON.stringify({
                    type: 'log', message: '📦 Captured Carnival loyalty API from ' + url, logType: 'success'
                  }));
                }
              }).catch(function() {});
            }
            if (isJsonResponse) {
              clonedResponse.clone().text().then(function(text) {
                try {
                  var jsonData = JSON.parse(text);
                  if (!jsonData || typeof jsonData !== 'object') return;
                  recordCarnivalProfilePayload(jsonData, response.url || url, 'fetch');
                  if (jsonData.Items && Array.isArray(jsonData.Items) && jsonData.Items.length > 0 && jsonData.Items[0].OfferId && !window.__carnivalVifpOffers) {
                    window.__carnivalVifpOffers = jsonData;
                    window.capturedPayloads.carnivalVifpOffers = jsonData;
                    postCarnivalNetworkPayload('carnival_vifp_offers', jsonData, url);
                    window.ReactNativeWebView.postMessage(JSON.stringify({
                      type: 'log', message: '📦 Auto-captured Carnival VIFP offers (' + jsonData.Items.length + ')', logType: 'success'
                    }));
                  }
                  captureCarnivalSearchPayload(jsonData, {
                    method: requestMethod,
                    requestUrl: url,
                    body: requestBody,
                    responseUrl: response.url || url,
                    status: response.status,
                    contentType: contentType,
                    requestStartedAt: requestContext ? Number(requestContext.requestStartedAt || 0) : 0
                  }, requestContext);
                  if (!window.capturedPayloads.upcomingCruises) {
                    var autoBookings = jsonData.bookings || jsonData.cruises || jsonData.reservations || jsonData.upcoming || null;
                    if (!autoBookings && Array.isArray(jsonData) && jsonData.length > 0 && (jsonData[0].bookingId || jsonData[0].confirmationNumber || jsonData[0].shipName)) autoBookings = jsonData;
                    if (Array.isArray(autoBookings) && autoBookings.length > 0 && (autoBookings[0].bookingId || autoBookings[0].confirmationNumber || autoBookings[0].shipName)) {
                      window.capturedPayloads.upcomingCruises = jsonData;
                      postCarnivalNetworkPayload('upcomingCruises', jsonData, url);
                      window.ReactNativeWebView.postMessage(JSON.stringify({
                        type: 'log', message: '📦 Auto-captured Carnival bookings (' + autoBookings.length + ') from ' + url, logType: 'success'
                      }));
                    }
                  }
                } catch(e) {}
              }).catch(function() {});
            }
          }
        }
        
        return response;
      });
    };

    const originalXHROpen = XMLHttpRequest.prototype.open;
    const originalXHRSend = XMLHttpRequest.prototype.send;
    const originalXHRSetRequestHeader = XMLHttpRequest.prototype.setRequestHeader;
    
    XMLHttpRequest.prototype.open = function(method, url, ...rest) {
      this._url = url;
      this._easySeasMethod = method || 'GET';
      this._easySeasRequestHeaders = {};
      var requestContext = getCarnivalSearchContext();
      this._easySeasCarnivalSearchContext = requestContext ? Object.assign({}, requestContext) : null;
      return originalXHROpen.apply(this, [method, url, ...rest]);
    };

    XMLHttpRequest.prototype.setRequestHeader = function(name, value) {
      try {
        this._easySeasRequestHeaders = this._easySeasRequestHeaders || {};
        this._easySeasRequestHeaders[String(name || '').toLowerCase()] = String(value ?? '');
      } catch (e) {}
      return originalXHRSetRequestHeader.apply(this, arguments);
    };
    
    XMLHttpRequest.prototype.send = function(...args) {
      captureRoyalAuthenticatedHeaders(this._url || '', this._easySeasRequestHeaders || {});
      this._easySeasRequestBody = args && args.length ? args[0] : '';
      this._easySeasRequestStartedAt = Date.now();
      var currentRequestContext = getCarnivalSearchContext();
      this._easySeasCarnivalSearchContext = currentRequestContext ? Object.assign({}, currentRequestContext, { requestStartedAt: this._easySeasRequestStartedAt }) : null;
      this.addEventListener('load', function() {
        if (this._url) {
          var carnivalProtectedProfileApi = isCarnivalProtectedProfileApiUrl(this._url);
          if (carnivalProtectedProfileApi && (this.status === 401 || this.status === 403)) {
            clearCarnivalProtectedApiAuthentication(this.responseURL || this._url, 'Protected Carnival profile API rejected the session');
          }
          try {
            const data = JSON.parse(this.responseText);
            if (carnivalProtectedProfileApi && this.status >= 200 && this.status < 300 && !carnivalPayloadShowsAuthFailure(data)) {
              markCarnivalProtectedApiAuthenticated(this.responseURL || this._url);
            }
            
            if (this._url.includes('/api/casino/casino-offers') || this._url.includes('/casino-offers') || this._url.includes('/api/casino/v2/offers/merged') || this._url.includes('/api/casino/v2/offers/facets')) {
              window.capturedPayloads.offers = data;
              window.ReactNativeWebView.postMessage(JSON.stringify({
                type: 'network_payload',
                endpoint: 'offers',
                data: data,
                url: this._url
              }));
              window.ReactNativeWebView.postMessage(JSON.stringify({
                type: 'log',
                message: '📦 [XHR] Captured Casino Offers API payload with ' + (data?.offers?.length || data?.payload?.casinoOffers?.length || data?.casinoOffers?.length || 0) + ' offers',
                logType: 'success'
              }));
            }
            
            if (this._url.includes('/profileBookings/enriched') || this._url.includes('/api/account/upcoming-cruises') || this._url.includes('/api/profile/bookings')) {
              window.capturedPayloads.upcomingCruises = data;
              window.ReactNativeWebView.postMessage(JSON.stringify({
                type: 'network_payload',
                endpoint: 'upcomingCruises',
                data: data,
                url: this._url
              }));
              const count = (data?.profileBookings?.length || data?.payload?.sailingInfo?.length || data?.sailingInfo?.length || 0);
              window.ReactNativeWebView.postMessage(JSON.stringify({
                type: 'log',
                message: '📦 [XHR] Captured Bookings API payload with ' + count + ' bookings from ' + this._url,
                logType: 'success'
              }));
            }
            
            if (this._url.includes('/api/account/courtesy-holds')) {
              window.capturedPayloads.courtesyHolds = data;
              window.ReactNativeWebView.postMessage(JSON.stringify({
                type: 'network_payload',
                endpoint: 'courtesyHolds',
                data: data,
                url: this._url
              }));
              const count = (data?.payload?.sailingInfo?.length || data?.sailingInfo?.length || 0);
              window.ReactNativeWebView.postMessage(JSON.stringify({
                type: 'log',
                message: '📦 [XHR] Captured Courtesy Holds API payload with ' + count + ' holds',
                logType: 'success'
              }));
            }
            
            if (this._url.includes('/ships/voyages') && this._url.includes('/enriched')) {
              if (!window.capturedPayloads.voyageEnrichment) {
                window.capturedPayloads.voyageEnrichment = {};
              }
              window.capturedPayloads.voyageEnrichment = data;
              window.ReactNativeWebView.postMessage(JSON.stringify({
                type: 'network_payload',
                endpoint: 'voyageEnrichment',
                data: data,
                url: this._url
              }));
              window.ReactNativeWebView.postMessage(JSON.stringify({
                type: 'log',
                message: '📦 [XHR] Captured Voyage Enrichment data from ' + this._url,
                logType: 'success'
              }));
            }
            
            if (this._url.includes('/guestAccounts/loyalty/info') || this._url.includes('/en/celebrity/web/v3/guestAccounts/')) {
              window.capturedPayloads.loyalty = data;
              window.ReactNativeWebView.postMessage(JSON.stringify({
                type: 'network_payload',
                endpoint: 'loyalty',
                data: data,
                url: this._url
              }));
              window.ReactNativeWebView.postMessage(JSON.stringify({
                type: 'log',
                message: '📦 [XHR] Captured Loyalty API payload (' + this.status + ') from ' + this._url,
                logType: this.status === 200 ? 'success' : 'warning'
              }));
            } else if (this.status === 200 && (this._url.includes('/loyalty') || this._url.includes('/guestAccounts/loyalty') || this._url.includes('/loyaltyInformation') || this._url.includes('/loyalty-programs') || this._url.includes('/profile/loyalty') || this._url.includes('/account/info'))) {
              window.capturedPayloads.loyalty = data;
              window.ReactNativeWebView.postMessage(JSON.stringify({
                type: 'network_payload',
                endpoint: 'loyalty',
                data: data,
                url: this._url
              }));
              window.ReactNativeWebView.postMessage(JSON.stringify({
                type: 'log',
                message: '📦 [XHR] Captured Loyalty API payload from ' + this._url,
                logType: 'success'
              }));
            }
            
            var xhrIsCarnival = (window.location && window.location.hostname || '').includes('carnival.com');
            if (xhrIsCarnival && this.status === 200 && data && typeof data === 'object') {
              recordCarnivalProfilePayload(data, this.responseURL || this._url, 'xhr');
              if (data.Items && Array.isArray(data.Items) && data.Items.length > 0 && data.Items[0].OfferId && !window.__carnivalVifpOffers) {
                window.__carnivalVifpOffers = data;
                window.capturedPayloads.carnivalVifpOffers = data;
                postCarnivalNetworkPayload('carnival_vifp_offers', data, this._url);
                window.ReactNativeWebView.postMessage(JSON.stringify({
                  type: 'log', message: '📦 [XHR] Captured Carnival VIFP offers (' + data.Items.length + ')', logType: 'success'
                }));
              }
              if (data.offers && Array.isArray(data.offers) && data.offers.length > 0) {
                postCarnivalNetworkPayload('offers', data, this._url);
                window.ReactNativeWebView.postMessage(JSON.stringify({
                  type: 'log', message: '📦 [XHR] Captured Carnival casino offers (' + data.offers.length + ')', logType: 'success'
                }));
              }
              var xhrLowerUrl = String(this._url || '').toLowerCase();
              var xhrContentType = '';
              try { xhrContentType = this.getResponseHeader('content-type') || ''; } catch (e) {}
              captureCarnivalSearchPayload(data, {
                method: this._easySeasMethod || 'GET',
                requestUrl: this._url || '',
                body: this._easySeasRequestBody || '',
                responseUrl: this.responseURL || this._url || '',
                status: this.status,
                contentType: xhrContentType,
                requestStartedAt: Number(this._easySeasRequestStartedAt || 0)
              }, this._easySeasCarnivalSearchContext);
              if (!window.capturedPayloads.upcomingCruises) {
                var xhrBookings = data.bookings || data.cruises || data.reservations || data.upcoming || null;
                if (!xhrBookings && Array.isArray(data) && data.length > 0 && (data[0].bookingId || data[0].confirmationNumber || data[0].shipName)) xhrBookings = data;
                if (Array.isArray(xhrBookings) && xhrBookings.length > 0 && (xhrBookings[0].bookingId || xhrBookings[0].confirmationNumber || xhrBookings[0].shipName)) {
                  window.capturedPayloads.upcomingCruises = data;
                  postCarnivalNetworkPayload('upcomingCruises', data, this._url);
                  window.ReactNativeWebView.postMessage(JSON.stringify({
                    type: 'log', message: '📦 [XHR] Captured Carnival bookings (' + xhrBookings.length + ')', logType: 'success'
                  }));
                }
              }
              if ((data.TierCode || data.PastGuestNumber || data.loyaltyTier) && !window.capturedPayloads.loyalty) {
                window.capturedPayloads.loyalty = data;
                postCarnivalNetworkPayload('loyalty', data, this._url);
                window.ReactNativeWebView.postMessage(JSON.stringify({
                  type: 'carnival_user_data', data: data
                }));
              }
            }
          } catch (e) {}
        }
      });
      
      return originalXHRSend.apply(this, args);
    };
    
    window.ReactNativeWebView.postMessage(JSON.stringify({
      type: 'log',
      message: '🌐 Network monitoring active - will capture all API payloads',
      logType: 'info'
    }));
  }

  function hasSessionToken() {
    try {
      var isCarnivalPage = !!(window.location && String(window.location.hostname || '').includes('carnival.com'));
      
      // Carnival-specific: check for their localStorage keys
      if (isCarnivalPage) {
        try {
          var allLsKeys = Object.keys(localStorage || {});
          for (var ci2 = 0; ci2 < allLsKeys.length; ci2++) {
            var ck = allLsKeys[ci2];
            var cv2 = localStorage.getItem(ck);
            if (!cv2) continue;
            // Carnival stores auth in various keys
            if (/oidc|okta|auth0|carnival.*token|token.*carnival|ccl.*auth|auth.*ccl/i.test(ck)) {
              if (cv2.length > 20) return true;
            }
            // JWT token stored directly
            if (cv2.length > 100 && /^ey[A-Za-z0-9]/.test(cv2)) return true;
            // JSON with access token
            if (cv2.length > 50) {
              try {
                var cParsed = JSON.parse(cv2);
                if (cParsed && (cParsed.access_token || cParsed.accessToken || cParsed.id_token || cParsed.idToken)) return true;
              } catch(e3) {}
            }
          }
        } catch(ce) {}
      }
      
      var sessionRaw = localStorage.getItem('persist:session');
      if (!sessionRaw && isCarnivalPage) {
        var carnivalKeys = ['persist:auth', 'persist:root', 'carnival-session', 'persist:user'];
        for (var ci = 0; ci < carnivalKeys.length; ci++) {
          var cv = localStorage.getItem(carnivalKeys[ci]);
          if (cv && cv.length > 30) { sessionRaw = cv; break; }
        }
        if (!sessionRaw) {
          var allKeys2 = Object.keys(localStorage || {});
          for (var ai = 0; ai < allKeys2.length; ai++) {
            var ak = allKeys2[ai];
            if (/persist:|session|auth|token/i.test(ak)) {
              var av = localStorage.getItem(ak);
              if (av && av.length > 30) { sessionRaw = av; break; }
            }
          }
        }
      }
      if (!sessionRaw) return false;
      var session = JSON.parse(sessionRaw);
      if (!session) return false;
      var token = session.token ? JSON.parse(session.token) : null;
      var user = session.user ? JSON.parse(session.user) : null;
      if (token && user && user.accountId) return true;
      if (session.accessToken || session.id_token || session.authToken || session.access_token) return true;
      if (session.user && typeof session.user === 'object' && (session.user.accountId || session.user.userId)) return true;
    } catch (e) {}
    try {
      var allKeys = Object.keys(localStorage || {});
      for (var i = 0; i < allKeys.length; i++) {
        var k = allKeys[i];
        if (/token/i.test(k) || /auth/i.test(k) || /session/i.test(k)) {
          var v = localStorage.getItem(k);
          if (v && v.length > 20) {
            try {
              var parsed = JSON.parse(v);
              if (parsed && (parsed.token || parsed.accessToken || parsed.access_token || parsed.idToken)) return true;
            } catch (e2) {
              if (/^ey[A-Za-z0-9]/.test(v)) return true;
            }
          }
        }
      }
    } catch (e) {}
    return false;
  }
  
  function checkAuthStatus() {
    checkCount++;
    var url = window.location.href;

    var hasToken = hasSessionToken();
    if (hasToken) {
      if (lastAuthState !== true) {
        lastAuthState = true;
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'auth_status',
          loggedIn: true
        }));
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'log',
          message: 'Authentication detected via session token - logged in',
          logType: 'info'
        }));
      }
      return;
    }

    var cookies = document.cookie;
    var hasCookies = cookies.includes('RCAUTH') || 
                     cookies.includes('auth') || 
                     cookies.includes('session') ||
                     cookies.length > 100;

    var pageText = '';
    var pageHTML = '';
    try {
      pageText = document.body ? (document.body.innerText || '') : '';
      pageHTML = document.body ? (document.body.innerHTML || '') : '';
    } catch (e) {}
    
    var accountLinks = document.querySelectorAll('a[href*="/account"]');
    var hasLogoutButton = document.querySelectorAll('a[href*="logout"], a[href*="sign-out"], button[aria-label*="sign out"], button[aria-label*="log out"]').length > 0;
    var upcomingCruisesLink = document.querySelector('a[href*="upcoming-cruises"]');
    var courtesyHoldsLink = document.querySelector('a[href*="courtesy-holds"]');
    var loyaltyStatusLink = document.querySelector('a[href*="loyalty-status"], a[href*="loyalty-programs"]');
    var myAccountLink = document.querySelector('a[href*="/account"]');
    var hasUserAvatar = document.querySelector('[data-testid*="avatar"], [class*="avatar"], [class*="user-icon"], [class*="profile-icon"], .user-menu, .account-menu') !== null;
    var hasSignInForm = document.querySelector('input[type="password"], form[action*="login"], form[action*="sign-in"], #login-form') !== null;
    var hasSignInText = pageText.toLowerCase().includes('sign in') && pageText.toLowerCase().includes('password');
    
    var lowerText = pageText.toLowerCase();
    var lowerHTML = pageHTML.toLowerCase();

    var isCarnival = url.includes('carnival.com');

    // Carnival-specific login signals
    var carnivalProfileLink = document.querySelector('a[href*="profilemanagement"]');
    var carnivalVifpEl = document.querySelector('[class*="vifp"], [id*="vifp"], [class*="loyalty"], [data-testid*="loyalty"], [data-testid*="vifp"]');
    var carnivalWelcomeBack = lowerText.includes('welcome back') || lowerHTML.includes('welcome back');
    var carnivalVifpText = lowerHTML.includes('vifp') || lowerText.includes('vifp club') || lowerHTML.includes('players club') || lowerHTML.includes('vifp#');
    var carnivalMemberNum = /vifp\\s*club[\\s\\S]{0,200}\\d{7,}/i.test(pageHTML) || /club#[:\\s]*\\d{7,}/i.test(pageHTML) || /vifp#[\\s]*\\d{4,}/i.test(pageHTML);
    var carnivalManageBookings = document.querySelector('a[href*="manage-booking"], a[href*="managebooking"], a[href*="my-cruises"]') !== null;
    // Public Carnival pages always include Manage Bookings and VIFP marketing.
    // Those generic navigation labels must never be treated as proof of authentication.
    var carnivalSignedInHeader = lowerHTML.includes('sign out') || lowerHTML.includes('signout') || (isCarnival && (lowerHTML.includes('welcome back') || lowerHTML.includes('ahoy,') || lowerHTML.includes('my profile')));
    var carnivalAccountPageUrl = isCarnival && (url.includes('/account') || url.includes('/profilemanagement'));
    // Carnival uses httpOnly cookies — document.cookie is USUALLY empty even when logged in
    // So we check any cookies OR any localStorage signals
    var carnivalHasCookies = isCarnival && (document.cookie.length > 0);
    var carnivalHasIdentityCookie = isCarnival && /(?:^|;\s*)(?:user|tgo)=/i.test(document.cookie || '');
    var carnivalNoSignInForm = !hasSignInForm;
    var carnivalProtectedApiAuthenticatedAt = Number(window.__easySeasCarnivalApiAuthenticatedAt || 0);
    var carnivalRecentProtectedApi = isCarnival && carnivalProtectedApiAuthenticatedAt > 0 && Date.now() - carnivalProtectedApiAuthenticatedAt < 300000;
    
    // Check for Carnival's user-name element in header (rendered after login)
    var carnivalUserNameEl = document.querySelector('[data-testid*="user"], [class*="user-name"], [class*="username"], [class*="firstName"], [aria-label*="account"], [aria-label*="profile"], nav [class*="logged"], header [class*="logged"]');
    var carnivalHasUserEl = carnivalUserNameEl !== null;
    
    // If window.__easySeasForceLoggedIn is set (by manual button), trust it
    var forceLoggedIn = !!(window.__easySeasForceLoggedIn);

    // Carnival profile URLs are useful context, but the URL alone is not authentication.
    // Public/error shells can render without a password form, so member identity is still required.
    var carnivalOnProfilePage = isCarnival && (url.includes('/profilemanagement') || url.includes('/profiles/cruises'));
    

    var strongAuthSignals = 
      forceLoggedIn ||
      upcomingCruisesLink || 
      courtesyHoldsLink || 
      loyaltyStatusLink ||
      hasLogoutButton ||
      hasUserAvatar ||
      (isCarnival && carnivalHasUserEl && (carnivalWelcomeBack || carnivalSignedInHeader || carnivalHasIdentityCookie)) ||
      (isCarnival && (carnivalWelcomeBack || carnivalMemberNum || carnivalSignedInHeader)) ||
      (isCarnival && carnivalProfileLink && carnivalHasIdentityCookie) ||
      (isCarnival && carnivalAccountPageUrl && carnivalNoSignInForm && carnivalHasIdentityCookie && document.readyState === 'complete');
    
    var accountFeatureCount = 
      (accountLinks.length > 0 ? 1 : 0) +
      (upcomingCruisesLink ? 1 : 0) +
      (courtesyHoldsLink ? 1 : 0) +
      (loyaltyStatusLink ? 1 : 0) +
      (myAccountLink ? 1 : 0) +
      (hasLogoutButton ? 1 : 0) +
      (hasUserAvatar ? 1 : 0) +
      (isCarnival && carnivalProfileLink ? 1 : 0) +
      (isCarnival && carnivalManageBookings ? 1 : 0) +
      (isCarnival && carnivalSignedInHeader ? 1 : 0);
    
    var contentSignals = 
      (lowerHTML.includes('member') ? 1 : 0) +
      (lowerHTML.includes('points') ? 1 : 0) +
      ((lowerHTML.includes('crown') || lowerHTML.includes('anchor')) ? 1 : 0) +
      (lowerHTML.includes('club royale') ? 1 : 0) +
      ((lowerHTML.includes('tier') || lowerHTML.includes('level')) ? 1 : 0) +
      (lowerText.includes('my cruises') ? 1 : 0) +
      (lowerText.includes('welcome') ? 1 : 0) +
      (isCarnival && carnivalVifpText ? 2 : 0) +
      (isCarnival && carnivalWelcomeBack ? 2 : 0) +
      (isCarnival && carnivalMemberNum ? 3 : 0);
    
    var isOnAccountPage = url.includes('/account/') || url.includes('/account?') || url.includes('loyalty-status') || url.includes('/club-royale') || url.includes('/blue-chip-club') || url.includes('/profilemanagement') || (isCarnival && (url.includes('/loyaltyInformation') || url.endsWith('/account')));
    var isOnLoginPage = (url.includes('/login') || url.includes('/sign-in') || url.includes('/signin')) && !carnivalOnProfilePage;
    
    var isLoggedIn = false;
    
    if (isCarnival) {
      // Carnival public pages contain VIFP, Manage Bookings, My Cruises and other account-like
      // marketing text. Never authenticate from those generic words or from the absence of a
      // password form. Require actual member identity, a signed-in header, an identity cookie,
      // or a real stored auth token on an account/profile page.
      if (isOnLoginPage && (hasSignInForm || hasSignInText)) {
        clearCarnivalProtectedApiAuthentication(url, 'Carnival login page is visible');
        isLoggedIn = false;
      } else {
        isLoggedIn = !!(
          forceLoggedIn ||
          carnivalRecentProtectedApi ||
          carnivalWelcomeBack ||
          carnivalMemberNum ||
          carnivalSignedInHeader ||
          (carnivalHasUserEl && carnivalAccountPageUrl) ||
          (carnivalHasIdentityCookie && carnivalAccountPageUrl) ||
          (hasToken && carnivalAccountPageUrl)
        );
      }
    } else if (isOnLoginPage && hasSignInForm) {
      isLoggedIn = false;
    } else if (strongAuthSignals) {
      isLoggedIn = true;
    } else if (accountFeatureCount >= 2) {
      isLoggedIn = true;
    } else if (hasCookies && (accountFeatureCount >= 1 || contentSignals >= 2)) {
      isLoggedIn = true;
    } else if (isOnAccountPage && !hasSignInForm && !hasSignInText) {
      isLoggedIn = true;
    } else if (hasCookies && contentSignals >= 3) {
      isLoggedIn = true;
    }
    
    if (lastAuthState !== isLoggedIn) {
      lastAuthState = isLoggedIn;
      
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'auth_status',
        loggedIn: isLoggedIn
      }));

      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'log',
        message: isLoggedIn 
          ? 'Authentication detected - logged in successfully' 
          : 'Not authenticated - please log in',
        logType: 'info'
      }));
    }
    
    if (checkCount % 10 === 0) {
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'log',
        message: 'Auth check #' + checkCount + ': ' + (isLoggedIn ? 'LOGGED IN' : 'NOT LOGGED IN') + 
                 ' (token: ' + hasToken + ', signals: ' + accountFeatureCount + ' account, ' + contentSignals + ' content, cookies: ' + hasCookies + (isCarnival ? ', carnival-strong: ' + !!strongAuthSignals : '') + ')',
        logType: 'info'
      }));
    }
  }

  function setupMutationObserver() {
    var observer = null;
    var mutationThrottle = null;
    var target = document.body || document.documentElement;
    if (target) {
      observer = new MutationObserver(function() {
        if (mutationThrottle) return;
        mutationThrottle = setTimeout(function() {
          mutationThrottle = null;
          checkAuthStatus();
        }, 500);
      });
      observer.observe(target, {
        childList: true,
        subtree: true
      });
    }
    return observer;
  }
  
  function initAuthDetection() {
    interceptNetworkCalls();
    
    setTimeout(checkAuthStatus, 500);
    setTimeout(checkAuthStatus, 1500);
    setTimeout(checkAuthStatus, 3000);
    
    var observer = null;
    
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', function() {
        setTimeout(checkAuthStatus, 300);
        setTimeout(checkAuthStatus, 1000);
        setTimeout(checkAuthStatus, 2500);
        observer = setupMutationObserver();
      });
    } else {
      setTimeout(checkAuthStatus, 800);
      observer = setupMutationObserver();
      if (!observer) {
        // body not yet available, try again shortly
        setTimeout(function() { observer = setupMutationObserver(); }, 500);
      }
    }
    
    // Also fire on page load/navigation events
    window.addEventListener('load', function() {
      setTimeout(checkAuthStatus, 500);
      setTimeout(checkAuthStatus, 1500);
      if (!observer) observer = setupMutationObserver();
    });
    
    var intervalId = setInterval(checkAuthStatus, 3000);

    setTimeout(function() {
      if (observer) observer.disconnect();
      clearInterval(intervalId);
      setInterval(checkAuthStatus, 5000);
    }, 60000);
  }
  
  initAuthDetection();
})();
`;

export function injectAuthDetection() {
  return AUTH_DETECTION_SCRIPT;
}
