import { CARNIVAL_CAPTURE_RUNTIME_SCRIPT } from '@/lib/carnival/carnivalInventoryRuntime';

export const AUTH_DETECTION_SCRIPT = `
(function() {
  ${CARNIVAL_CAPTURE_RUNTIME_SCRIPT}
  let lastAuthState = null;
  let checkCount = 0;
  
  if (!window.capturedPayloads) {
    window.capturedPayloads = {
      offers: null,
      upcomingCruises: null,
      courtesyHolds: null,
      loyalty: null,
      voyageEnrichment: null,
      pastTrips: null,
      carnivalVifpOffers: null
    };
  }

  function looksLikeTripRecord(item) {
    if (!item || typeof item !== 'object') return false;
    var providerId = item.bookingId || item.confirmationNumber || item.reservationId || item.reservationNumber;
    var ship = item.shipName || item.shipCode || (item.ship && (item.ship.name || item.ship.code));
    var sailDate = item.sailDate || item.departureDate || item.startDate || item.sailingStartDate;
    return !!(providerId || (ship && sailDate));
  }

  function firstTripArray(data, preferredKeys) {
    if (!data || typeof data !== 'object') return null;
    if (Array.isArray(data)) return data.length > 0 && looksLikeTripRecord(data[0]) ? data : null;
    for (var pk = 0; pk < preferredKeys.length; pk++) {
      var key = preferredKeys[pk];
      if (Array.isArray(data[key]) && (data[key].length === 0 || looksLikeTripRecord(data[key][0]))) return data[key];
    }
    var containers = [data.payload, data.data, data.result, data.response];
    for (var ci = 0; ci < containers.length; ci++) {
      var container = containers[ci];
      if (!container || typeof container !== 'object') continue;
      if (Array.isArray(container)) return container.length > 0 && looksLikeTripRecord(container[0]) ? container : null;
      for (var pk2 = 0; pk2 < preferredKeys.length; pk2++) {
        var nestedKey = preferredKeys[pk2];
        if (Array.isArray(container[nestedKey]) && (container[nestedKey].length === 0 || looksLikeTripRecord(container[nestedKey][0]))) return container[nestedKey];
      }
    }
    return null;
  }

  function looksLikeCarnivalOfferItem(item) {
    if (!item || typeof item !== 'object') return false;
    var campaign = item.campaignOffer || item.offer || item.promotion || item;
    var identity = item.OfferId || item.offerId || item.PlayerOfferId || item.playerOfferId || item.id || campaign.offerId || campaign.id;
    var code = item.RateCode || item.rateCode || item.offerCode || item.promoCode || campaign.offerCode || campaign.rateCode;
    var content = item.Title || item.title || item.name || item.CtaUrl || item.ctaUrl || item.bookingUrl || campaign.name;
    return !!(identity || code || (item.campaignOffer && content));
  }

  function firstCarnivalOfferArray(data, depth) {
    if (!data || depth > 5) return null;
    if (Array.isArray(data)) return data.length > 0 && looksLikeCarnivalOfferItem(data[0]) ? data : null;
    if (typeof data !== 'object') return null;
    var keys = ['Items', 'items', 'offers', 'personalizedOffers', 'eligibleOffers', 'memberOffers', 'vifpOffers', 'casinoOffers', 'promotions', 'deals', 'campaigns'];
    for (var keyIndex = 0; keyIndex < keys.length; keyIndex++) {
      var rows = data[keys[keyIndex]];
      if (Array.isArray(rows) && rows.length > 0 && looksLikeCarnivalOfferItem(rows[0])) return rows;
    }
    var containers = ['payload', 'data', 'result', 'response', 'content', 'model'];
    for (var containerIndex = 0; containerIndex < containers.length; containerIndex++) {
      var nested = firstCarnivalOfferArray(data[containers[containerIndex]], depth + 1);
      if (nested) return nested;
    }
    return null;
  }

  function captureCarnivalOfferPayload(data, url, sourceLabel) {
    try {
      var items = firstCarnivalOfferArray(data, 0);
      if (!items || items.length === 0) return false;
      var canonical = { Items: items };
      window.__carnivalVifpOffers = canonical;
      window.capturedPayloads.carnivalVifpOffers = canonical;
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'network_payload', endpoint: 'carnival_vifp_offers', data: canonical, url: url
      }));
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'log', message: '📦 ' + sourceLabel + ' captured ' + items.length + ' Carnival offer record(s) from ' + String(url || '').split('?')[0], logType: 'success'
      }));
      return true;
    } catch(e) {
      return false;
    }
  }

  function captureCarnivalSearchInventory(data, requestUrl, responseUrl, method, body, status, contentType, requestStartedAt) {
    try {
      if (!data || typeof data !== 'object') return false;
      var pageUrl = new URL(String(window.location.href || ''), 'https://www.carnival.com');
      if (!/(^|\.)carnival\.com$/i.test(pageUrl.hostname) || !/cruise-search/i.test(pageUrl.pathname)) return false;
      var expectedContext = null;
      try {
        var expectedContextRaw = window.sessionStorage && window.sessionStorage.getItem('__easySeasCarnivalSearchContext');
        expectedContext = expectedContextRaw ? JSON.parse(expectedContextRaw) : null;
      } catch (contextError) { expectedContext = null; }
      var pageCodes = String(pageUrl.searchParams.get('ratecodes') || pageUrl.searchParams.get('rateCodes') || pageUrl.searchParams.get('rateCode') || '').split(',').map(function(value) { return String(value || '').trim().toUpperCase(); }).filter(Boolean);
      var requestCodes = __esRequestCodes(String(requestUrl || ''), body);
      var contextCode = expectedContext && String(expectedContext.offerCode || '').trim().toUpperCase();
      var expectedCode = contextCode && pageCodes.indexOf(contextCode) >= 0
        ? contextCode
        : (pageCodes.length === 1 ? pageCodes[0] : (requestCodes.length === 1 ? requestCodes[0] : ''));
      if (!expectedCode) return false;
      var pageNumber = __esRequestNumber(String(requestUrl || ''), body, /^(page|pagenumber|page_number|pageindex|currentpage)$/i);
      if (pageNumber === null) pageNumber = Number(expectedContext && expectedContext.pageNumber || pageUrl.searchParams.get('pageNumber') || pageUrl.searchParams.get('page') || 1);
      if (pageNumber === 0) pageNumber = 1;
      var startedAt = Number(requestStartedAt || Date.now());
      var metadata = {
        requestUrl: String(requestUrl || ''),
        responseUrl: String(responseUrl || requestUrl || ''),
        method: String(method || 'GET'),
        body: body,
        status: Number(status || 0),
        contentType: String(contentType || ''),
        expectedOfferCode: expectedCode,
        expectedPageNumber: Math.max(1, Number(pageNumber || 1)),
        expectedUrl: String(expectedContext && expectedContext.expectedUrl || pageUrl.toString()),
        contextStartedAt: Number(expectedContext && expectedContext.startedAt || window.performance && window.performance.timeOrigin || startedAt),
        requestStartedAt: startedAt,
        navigationSequenceId: Number(expectedContext && expectedContext.navigationSequenceId || 1),
        expectedNavigationSequenceId: Number(expectedContext && expectedContext.navigationSequenceId || 1),
        runId: String(expectedContext && expectedContext.runId || ''),
        contextFingerprint: String(expectedContext && expectedContext.contextFingerprint || '')
      };
      var analysis = __esAnalyzeCarnivalPayload(data, metadata);
      if (!analysis || (analysis.kind !== 'inventory' && analysis.kind !== 'inventory_empty')) return false;
      if (!analysis.approvedEndpoint || !analysis.offerCodeMatched || !analysis.pageMatched) return false;
      if (analysis.offerProofSource === 'none' || analysis.pageProofSource === 'none') return false;
      window.capturedPayloads.carnivalSearchCandidates = window.capturedPayloads.carnivalSearchCandidates || [];
      window.capturedPayloads.carnivalSearchCandidates.push({
        data: data,
        analysis: analysis,
        metadata: metadata,
        capturedAt: Date.now(),
        pageUrl: pageUrl.toString()
      });
      if (window.capturedPayloads.carnivalSearchCandidates.length > 40) {
        window.capturedPayloads.carnivalSearchCandidates = window.capturedPayloads.carnivalSearchCandidates.slice(-40);
      }
      window.__easySeasCarnivalInventoryLogged = window.__easySeasCarnivalInventoryLogged || {};
      var diagnosticKey = expectedCode + '|' + Math.max(1, Number(pageNumber || 1));
      if (!window.__easySeasCarnivalInventoryLogged[diagnosticKey]) {
        window.__easySeasCarnivalInventoryLogged[diagnosticKey] = true;
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'log',
          message: '📦 Verified Carnival inventory for ' + expectedCode + ' page ' + Math.max(1, Number(pageNumber || 1)) + ': ' + Number(analysis.inventoryItems && analysis.inventoryItems.length || 0) + ' sailing row(s) via ' + String(analysis.adapterId || 'inventory adapter'),
          logType: 'success'
        }));
      }
      return true;
    } catch (e) {
      return false;
    }
  }

  function captureRoyalTripPayload(data, url, sourceLabel) {
    try {
      if (!data || typeof data !== 'object' || typeof url !== 'string') return false;
      var lowerUrl = url.toLowerCase();
      var isRoyalFamily = lowerUrl.includes('royalcaribbean.com') || lowerUrl.includes('celebritycruises.com') || lowerUrl.includes('aws-prd.api.rccl.com');
      if (!isRoyalFamily) return false;

      var forcePastTrips = !!window.__easySeasReadingPastTrips;
      var pastTrips = firstTripArray(data, ['pastCruises', 'pastTrips', 'past', 'completedCruises', 'completedTrips', 'previousTrips']);
      var isPastEndpoint = lowerUrl.includes('past') || lowerUrl.includes('previous') || lowerUrl.includes('completed');
      var isMyTripsEndpoint = lowerUrl.includes('my-trips') || lowerUrl.includes('mytrips') || lowerUrl.includes('/trips') || lowerUrl.includes('/trip');
      if (pastTrips && (forcePastTrips || isPastEndpoint || isMyTripsEndpoint || pastTrips.length > 0)) {
        window.capturedPayloads.pastTrips = data;
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'network_payload',
          endpoint: 'pastTrips',
          data: data,
          url: url
        }));
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'log',
          message: '📦 ' + sourceLabel + ' captured Royal Caribbean Past Trips payload with ' + pastTrips.length + ' cruise(s)',
          logType: 'success'
        }));
        return true;
      }

      var tripRows = firstTripArray(data, ['trips', 'reservations', 'bookings', 'profileBookings', 'sailingInfo', 'upcomingTrips', 'upcomingCruises']);
      if (tripRows && isMyTripsEndpoint && (forcePastTrips || !window.capturedPayloads.upcomingCruises)) {
        var endpoint = (forcePastTrips || isPastEndpoint) ? 'pastTrips' : 'upcomingCruises';
        window.capturedPayloads[endpoint] = data;
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'network_payload',
          endpoint: endpoint,
          data: data,
          url: url
        }));
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'log',
          message: '📦 ' + sourceLabel + ' captured My Trips payload with ' + tripRows.length + ' trip(s)',
          logType: 'success'
        }));
        return true;
      }
    } catch(e) {}
    return false;
  }


  function looksLikeRoyalOfferPayload(data, url) {
    try {
      if (!data || typeof data !== 'object') return false;
      var normalizedUrl = String(url || '').toLowerCase();
      if (normalizedUrl.includes('carnival.com')) return false;
      var isRoyalFamilyUrl = normalizedUrl.includes('royalcaribbean.com') || normalizedUrl.includes('celebritycruises.com') || normalizedUrl.includes('api.rccl.com');
      if (normalizedUrl && !isRoyalFamilyUrl) return false;
      if (normalizedUrl.includes('/i18n/') || normalizedUrl.includes('/translations/')) return false;
      var preview = JSON.stringify(data).slice(0, 240000).toLowerCase();
      var hasOfferShape = preview.includes('offercode') || preview.includes('campaignoffer') || preview.includes('casinooffers') || (preview.includes('sailings') && (preview.includes('reserveby') || preview.includes('expiration')));
      return normalizedUrl.includes('offer') || normalizedUrl.includes('club-royale') || hasOfferShape;
    } catch (e) {
      return false;
    }
  }

  function captureRoyalOfferCandidate(data, url, sourceLabel) {
    try {
      if (!looksLikeRoyalOfferPayload(data, url)) return false;
      window.capturedPayloads.offerCandidates = window.capturedPayloads.offerCandidates || [];
      window.capturedPayloads.offerCandidates.push({ data: data, url: String(url || ''), source: sourceLabel, timestamp: new Date().toISOString() });
      if (window.capturedPayloads.offerCandidates.length > 20) {
        window.capturedPayloads.offerCandidates = window.capturedPayloads.offerCandidates.slice(-20);
      }
      window.capturedPayloads.offers = data;
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'network_capture_offer_available',
        url: String(url || ''),
        source: sourceLabel
      }));
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'log',
        message: '📦 ' + sourceLabel + ' captured a live ' + (String(url || '').toLowerCase().includes('celebritycruises.com') ? 'Blue Chip Club' : 'Club Royale') + ' offer payload from ' + String(url || '').split('?')[0],
        logType: 'success'
      }));
      return true;
    } catch (e) {
      return false;
    }
  }

  function interceptNetworkCalls() {
    if (window.__easySeasNetworkIntercepted) return;
    window.__easySeasNetworkIntercepted = true;

    const originalFetch = window.fetch;
    window.fetch = function(...args) {
      const requestStartedAt = Date.now();
      const requestMethod = String((args[1] && args[1].method) || (args[0] && args[0].method) || 'GET');
      const requestBody = (args[1] && args[1].body) || (args[0] && args[0].body) || null;
      return originalFetch.apply(this, args).then(response => {
        const clonedResponse = response.clone();
        const url = (typeof args[0] === 'string') ? args[0] : (args[0] && args[0].url ? args[0].url : '');
        
        if (typeof url === 'string' && url) {
          if ((window.location && window.location.hostname || '').includes('carnival.com') && response.ok) {
            var carnivalInventoryClone = response.clone();
            carnivalInventoryClone.json().then(function(data) {
              var contentType = '';
              try { contentType = response.headers.get('content-type') || ''; } catch(e) {}
              captureCarnivalSearchInventory(data, url, response.url || url, requestMethod, requestBody, response.status, contentType, requestStartedAt);
            }).catch(function() {});
          }
          var offerProbeClone = response.clone();
          if (response.ok) {
            offerProbeClone.json().then(function(data) {
              captureRoyalOfferCandidate(data, url, '[Fetch]');
            }).catch(function() {});
          }

          var royalTripClone = response.clone();
          royalTripClone.json().then(function(data) {
            captureRoyalTripPayload(data, url, '[Fetch]');
          }).catch(function() {});

          if (url.includes('/api/casino/v2/offers/list') || url.includes('/api/casino/v2/offers/details') || url.includes('/api/casino/casino-offers') || url.includes('/casino-offers')) {
            if (response.ok && response.status === 200) {
              clonedResponse.json().then(data => {
                captureRoyalOfferCandidate(data, url, '[Fetch endpoint]');
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
                var bookingArr = data.bookings || data.cruises || data.reservations || data.upcoming || data.trips || data.payload || data.data || null;
                if (Array.isArray(data) && data.length > 0 && (data[0].bookingId || data[0].confirmationNumber || data[0].shipName)) bookingArr = data;
                if (Array.isArray(bookingArr) && bookingArr.length > 0 && (bookingArr[0].bookingId || bookingArr[0].confirmationNumber || bookingArr[0].shipName || bookingArr[0].sailDate || bookingArr[0].departureDate)) {
                  window.capturedPayloads.upcomingCruises = data;
                  window.ReactNativeWebView.postMessage(JSON.stringify({
                    type: 'network_payload', endpoint: 'upcomingCruises', data: data, url: url
                  }));
                  window.ReactNativeWebView.postMessage(JSON.stringify({
                    type: 'log', message: '📦 Captured Carnival bookings (' + bookingArr.length + ') from ' + url, logType: 'success'
                  }));
                }
                if (data.TierCode || data.PastGuestNumber || data.loyaltyTier || data.vifpNumber || data.loyaltyLevel) {
                  if (!window.capturedPayloads.loyalty) {
                    window.capturedPayloads.loyalty = data;
                    window.ReactNativeWebView.postMessage(JSON.stringify({
                      type: 'network_payload', endpoint: 'loyalty', data: data, url: url
                    }));
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
                captureCarnivalOfferPayload(data, url, 'Fetch');
              }).catch(function() {});
            }
            if (lowerUrl.includes('/api/profile/loyalty') || lowerUrl.includes('loyaltyinformation') || lowerUrl.includes('/vifp') || lowerUrl.includes('/loyalty') || lowerUrl.includes('/pastguest') || lowerUrl.includes('/tier')) {
              clonedResponse.clone().json().then(function(data) {
                if (data && !window.capturedPayloads.loyalty) {
                  window.capturedPayloads.loyalty = data;
                  window.ReactNativeWebView.postMessage(JSON.stringify({
                    type: 'network_payload', endpoint: 'loyalty', data: data, url: url
                  }));
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
                  captureCarnivalOfferPayload(jsonData, url, 'Fetch JSON probe');
                  if (!window.capturedPayloads.upcomingCruises) {
                    var autoBookings = jsonData.bookings || jsonData.cruises || jsonData.reservations || jsonData.upcoming || null;
                    if (!autoBookings && Array.isArray(jsonData) && jsonData.length > 0 && (jsonData[0].bookingId || jsonData[0].confirmationNumber || jsonData[0].shipName)) autoBookings = jsonData;
                    if (Array.isArray(autoBookings) && autoBookings.length > 0 && (autoBookings[0].bookingId || autoBookings[0].confirmationNumber || autoBookings[0].shipName)) {
                      window.capturedPayloads.upcomingCruises = jsonData;
                      window.ReactNativeWebView.postMessage(JSON.stringify({
                        type: 'network_payload', endpoint: 'upcomingCruises', data: jsonData, url: url
                      }));
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
    
    XMLHttpRequest.prototype.open = function(method, url, ...rest) {
      this._url = url;
      this._method = method;
      return originalXHROpen.apply(this, [method, url, ...rest]);
    };
    
    XMLHttpRequest.prototype.send = function(...args) {
      this._requestStartedAt = Date.now();
      this._requestBody = args.length > 0 ? args[0] : null;
      this.addEventListener('load', function() {
        if (this._url) {
          try {
            const data = JSON.parse(this.responseText);
            captureCarnivalSearchInventory(
              data,
              String(this._url || ''),
              String(this.responseURL || this._url || ''),
              String(this._method || 'GET'),
              this._requestBody,
              Number(this.status || 0),
              String(this.getResponseHeader && this.getResponseHeader('content-type') || ''),
              Number(this._requestStartedAt || Date.now())
            );
            captureRoyalTripPayload(data, String(this._url || ''), '[XHR]');
            captureRoyalOfferCandidate(data, String(this._url || ''), '[XHR]');
            
            if (this._url.includes('/api/casino/v2/offers/list') || this._url.includes('/api/casino/v2/offers/details') || this._url.includes('/api/casino/casino-offers') || this._url.includes('/casino-offers')) {
              captureRoyalOfferCandidate(data, String(this._url || ''), '[XHR endpoint]');
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
              captureCarnivalOfferPayload(data, this._url, 'XHR');
              if (!window.capturedPayloads.upcomingCruises) {
                var xhrBookings = data.bookings || data.cruises || data.reservations || data.upcoming || null;
                if (!xhrBookings && Array.isArray(data) && data.length > 0 && (data[0].bookingId || data[0].confirmationNumber || data[0].shipName)) xhrBookings = data;
                if (Array.isArray(xhrBookings) && xhrBookings.length > 0 && (xhrBookings[0].bookingId || xhrBookings[0].confirmationNumber || xhrBookings[0].shipName)) {
                  window.capturedPayloads.upcomingCruises = data;
                  window.ReactNativeWebView.postMessage(JSON.stringify({
                    type: 'network_payload', endpoint: 'upcomingCruises', data: data, url: this._url
                  }));
                  window.ReactNativeWebView.postMessage(JSON.stringify({
                    type: 'log', message: '📦 [XHR] Captured Carnival bookings (' + xhrBookings.length + ')', logType: 'success'
                  }));
                }
              }
              if ((data.TierCode || data.PastGuestNumber || data.loyaltyTier) && !window.capturedPayloads.loyalty) {
                window.capturedPayloads.loyalty = data;
                window.ReactNativeWebView.postMessage(JSON.stringify({
                  type: 'network_payload', endpoint: 'loyalty', data: data, url: this._url
                }));
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
    var signInInput = document.querySelector('input[type="password"], form[action*="login"] input, form[action*="sign-in"] input, #login-form input');
    var hasSignInForm = signInInput !== null;
    var hasVisibleSignInForm = false;
    try {
      if (signInInput) {
        var signInStyle = window.getComputedStyle(signInInput);
        hasVisibleSignInForm = signInStyle.display !== 'none' && signInStyle.visibility !== 'hidden' && signInInput.getClientRects().length > 0;
      }
    } catch (e) {}
    var hasSignInText = pageText.toLowerCase().includes('sign in') && pageText.toLowerCase().includes('password');
    
    var lowerText = pageText.toLowerCase();
    var lowerHTML = pageHTML.toLowerCase();

    var isCarnival = url.includes('carnival.com');

    // Never try to work around provider anti-bot or human-verification pages.
    // We emit only named markers, never page text, cookies, or credentials.
    var carnivalChallenge = isCarnival && (
      document.querySelector('iframe[src*="captcha"], iframe[src*="recaptcha"], iframe[src*="hcaptcha"], [data-testid*="captcha"], [class*="captcha"], [id*="captcha"]') !== null ||
      /verify (?:you are )?human|security challenge|access denied|unusual activity|robot check/i.test(pageText)
    );

    // Carnival-specific login signals
    var carnivalProfileLink = document.querySelector('a[href*="profilemanagement"]');
    var carnivalVifpEl = document.querySelector('[class*="vifp"], [id*="vifp"], [class*="loyalty"], [data-testid*="loyalty"], [data-testid*="vifp"]');
    var carnivalWelcomeBack = lowerText.includes('welcome back') || lowerHTML.includes('welcome back');
    var carnivalVifpText = lowerHTML.includes('vifp') || lowerText.includes('vifp club') || lowerHTML.includes('players club') || lowerHTML.includes('vifp#');
    var carnivalMemberNum = /vifp\\s*club[\\s\\S]{0,200}\\d{7,}/i.test(pageHTML) || /club#[:\\s]*\\d{7,}/i.test(pageHTML) || /vifp#[\\s]*\\d{4,}/i.test(pageHTML);
    var carnivalManageBookings = document.querySelector('a[href*="manage-booking"], a[href*="managebooking"], a[href*="my-cruises"]') !== null;
    var carnivalSignedInHeader = lowerHTML.includes('sign out') || lowerHTML.includes('signout') || (isCarnival && (lowerHTML.includes('my profile') || lowerHTML.includes('manage bookings') || lowerHTML.includes('my account') || lowerHTML.includes('hello,') || lowerHTML.includes('my bookings') || lowerHTML.includes('view bookings')));
    var carnivalAccountPageUrl = isCarnival && (url.includes('/account') || url.includes('/profilemanagement') || url.includes('/cruise-deals'));
    // Carnival uses httpOnly cookies — document.cookie is USUALLY empty even when logged in
    // So we check any cookies OR any localStorage signals
    var carnivalHasCookies = isCarnival && (document.cookie.length > 0);
    var carnivalNoSignInForm = !hasSignInForm;
    
    // Check for Carnival's user-name element in header (rendered after login)
    var carnivalUserNameEl = document.querySelector('[data-testid*="user"], [class*="user-name"], [class*="username"], [class*="firstName"], [aria-label*="account"], [aria-label*="profile"], nav [class*="logged"], header [class*="logged"]');
    var carnivalHasUserEl = carnivalUserNameEl !== null;
    
    // If window.__easySeasForceLoggedIn is set (by manual button), trust it
    var forceLoggedIn = !!(window.__easySeasForceLoggedIn);

    // Carnival ALWAYS redirects unauthenticated users away from /profilemanagement
    // So if we are ON that page, the user is definitively logged in
    var carnivalOnProfilePage = isCarnival && (url.includes('/profilemanagement') || url.includes('/profiles/cruises'));
    
    // Carnival cruise-deals page: if loaded without a sign-in form, user is logged in
    // (Carnival renders a generic offers page for non-auth, but the DOM will differ)
    var carnivalOnCruiseDeals = isCarnival && url.includes('/cruise-deals') && carnivalNoSignInForm && document.readyState === 'complete';
    var carnivalProfileSignals = !!(
      carnivalProfileLink || carnivalVifpEl || carnivalManageBookings || carnivalHasUserEl ||
      carnivalWelcomeBack || carnivalVifpText || carnivalMemberNum || carnivalSignedInHeader || carnivalOnProfilePage
    );
    var carnivalOfferSignals = !!(
      carnivalOnCruiseDeals ||
      document.querySelector('[data-testid*="offer"], [class*="offer-card"], [class*="cruise-card"], a[href*="cruise-deals"]') ||
      /(?:casino|personalized) offers|cruise deals/i.test(pageText)
    );

    var strongAuthSignals = 
      forceLoggedIn ||
      upcomingCruisesLink || 
      courtesyHoldsLink || 
      loyaltyStatusLink ||
      hasLogoutButton ||
      hasUserAvatar ||
      carnivalOnProfilePage ||
      (isCarnival && carnivalHasUserEl) ||
      (isCarnival && (carnivalWelcomeBack || carnivalVifpEl || carnivalMemberNum || carnivalProfileLink || carnivalSignedInHeader || carnivalVifpText)) ||
      (isCarnival && carnivalAccountPageUrl && carnivalNoSignInForm && document.readyState === 'complete') ||
      (isCarnival && carnivalHasCookies && carnivalAccountPageUrl);
    
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
    
    var isOnAccountPage = url.includes('/account/') || url.includes('/account?') || url.includes('loyalty-status') || url.includes('/club-royale') || url.includes('/blue-chip-club') || url.includes('/profilemanagement') || (isCarnival && (url.includes('/cruise-deals') || url.includes('/loyaltyInformation') || url.endsWith('/account')));
    var isOnLoginPage = (url.includes('/login') || url.includes('/sign-in') || url.includes('/signin')) && !carnivalOnProfilePage;
    
    var isLoggedIn = false;
    
    if (carnivalChallenge) {
      isLoggedIn = false;
    } else if (hasVisibleSignInForm && !forceLoggedIn && !hasToken && !hasLogoutButton) {
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

    if (isCarnival) {
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'carnival_runtime_probe',
        url: url,
        loggedIn: isLoggedIn,
        challengeDetected: carnivalChallenge,
        profileSignals: carnivalProfileSignals,
        offerSignals: carnivalOfferSignals,
        evidence: [
          carnivalChallenge ? 'challenge_marker' : '',
          carnivalProfileSignals ? 'profile_marker' : '',
          carnivalOfferSignals ? 'offer_marker' : '',
          hasVisibleSignInForm ? 'visible_sign_in_form' : ''
        ].filter(Boolean),
        observedAt: new Date().toISOString()
      }));
    }
    
    if (lastAuthState !== isLoggedIn) {
      lastAuthState = isLoggedIn;
      
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'auth_status',
        loggedIn: isLoggedIn,
        evidence: hasToken ? 'session_token' : hasVisibleSignInForm ? 'visible_sign_in_form' : strongAuthSignals ? 'authenticated_page_signal' : 'page_heuristics',
        url: url
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

    window.addEventListener('popstate', function() {
      setTimeout(checkAuthStatus, 300);
    });
    window.addEventListener('hashchange', function() {
      setTimeout(checkAuthStatus, 300);
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
