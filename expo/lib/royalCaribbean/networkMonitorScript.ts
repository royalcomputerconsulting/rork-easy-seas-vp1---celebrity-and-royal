export const NETWORK_MONITOR_SCRIPT = `
(function() {
  // Always create these first. v8.9.8 logs showed window.networkMonitorInstalled could be true
  // while window.capturedPayloads was missing after Royal document transitions, causing Step 2
  // to fail before it could even inspect captured bookings.
  window.capturedPayloads = window.capturedPayloads || {};
  window.capturedRequestHeaders = window.capturedRequestHeaders || {};
  window.capturedOfferPayloads = window.capturedOfferPayloads || [];
  if (window.networkMonitorInstalled) {
    console.log('[NetworkMonitor] Already installed; payload containers verified');
    return;
  }
  window.networkMonitorInstalled = true;
  
  console.log('[NetworkMonitor] Installing comprehensive network monitor');
  
  function log(message, type = 'info') {
    try {
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'log',
        message: message,
        logType: type
      }));
    } catch (e) {
      console.log('[NetworkMonitor]', message);
    }
  }
  
  log('🌐 Network monitoring active - will capture all API payloads', 'info');


  function normalizeRoyalHistorySailingsPayload(data) {
    try {
      const isSailing = (item) => {
        if (!item || typeof item !== 'object') return false;
        const ship = item.shipCode || item.ship || item.shipCd || item.shipName || item.shipDescription || item.shipDisplayName || item.shipLongName || item.vesselName;
        const date = item.sailDate || item.departureDate || item.startDate || item.sailingDate || item.date || item.voyageStartDate || item.embarkDate || item.embarkationDate;
        return !!(ship && date);
      };
      const direct = data?.payload?.sailings || data?.sailings || data?.data?.sailings || data?.payload?.pastSailings || data?.payload?.completedCruises || data?.data?.pastSailings || data?.data?.completedCruises || [];
      if (Array.isArray(direct) && direct.some(isSailing)) return direct.filter(isSailing);
      let best = [];
      const seen = new Set();
      const walk = (value, depth) => {
        if (!value || depth > 9) return;
        if (typeof value === 'object') { if (seen.has(value)) return; seen.add(value); }
        if (Array.isArray(value)) {
          const rows = value.filter(isSailing);
          if (rows.length > best.length) best = rows;
          value.forEach(v => walk(v, depth + 1));
          return;
        }
        if (typeof value === 'object') {
          Object.keys(value).forEach(k => {
            const lower = String(k).toLowerCase();
            if (lower.includes('sailing') || lower.includes('cruise') || lower.includes('history') || lower.includes('past') || lower.includes('completed') || lower === 'payload' || lower === 'data' || lower === 'items' || lower === 'results') walk(value[k], depth + 1);
          });
        }
      };
      walk(data, 0);
      return best;
    } catch (e) { return []; }
  }

  function isRoyalLoyaltyHistoryUrl(url) {
    return typeof url === 'string' && /\/guestAccounts\/loyalty\/history(?:\/|\?|$)/.test(url);
  }

  function postRoyalHistorySailings(url, data, transport) {
    try {
      const sailings = normalizeRoyalHistorySailingsPayload(data);
      if (!sailings.length) return false;
      window.capturedPayloads.completedCruises = data;
      window.capturedPayloads.loyaltyHistory = data;
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'network_capture',
        endpoint: 'royalLoyaltyHistory',
        data: data,
        url: url
      }));
      log('📦 [' + transport + '] Captured Royal Caribbean Loyalty History payload with ' + sailings.length + ' completed cruise(s) from ' + url, 'success');
      return true;
    } catch (e) {
      return false;
    }
  }
  
  function extractHeaderValue(headers, name) {
    try {
      if (!headers) return undefined;
      const lower = name.toLowerCase();
      if (typeof headers.get === 'function') {
        return headers.get(name) || headers.get(lower) || undefined;
      }
      if (Array.isArray(headers)) {
        for (const pair of headers) {
          if (!pair || pair.length < 2) continue;
          const k = String(pair[0] || '').toLowerCase();
          if (k === lower) return String(pair[1] ?? '');
        }
      }
      if (typeof headers === 'object') {
        for (const k of Object.keys(headers)) {
          if (k.toLowerCase() === lower) return String(headers[k] ?? '');
        }
      }
      return undefined;
    } catch (e) {
      return undefined;
    }
  }

  function captureRequestHeaders(url, options) {
    try {
      if (!url || typeof url !== 'string') return;
      if (!url.includes('aws-prd.api.rccl.com')) return;

      const headers = options?.headers;
      const apiKey = extractHeaderValue(headers, 'x-api-key') || extractHeaderValue(headers, 'X-Api-Key');
      const authorization = extractHeaderValue(headers, 'authorization');
      const accountId = extractHeaderValue(headers, 'account-id');

      if (apiKey) window.capturedRequestHeaders.apiKey = apiKey;
      if (authorization) window.capturedRequestHeaders.authorization = authorization;
      if (accountId) window.capturedRequestHeaders.accountId = accountId;

      if (apiKey || authorization || accountId) {
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'network_capture_headers',
          url,
          hasApiKey: !!apiKey,
          hasAuthorization: !!authorization,
          hasAccountId: !!accountId,
        }));
      }
    } catch (e) {
      // ignore
    }
  }

  const originalFetch = window.fetch;
  window.fetch = function(...args) {
    const url = typeof args[0] === 'string' ? args[0] : args[0]?.url || '';
    const options = args[1] || {};

    captureRequestHeaders(url, options);

    return originalFetch.apply(this, args).then(async (response) => {
      const clonedResponse = response.clone();
      
      try {
        if (url.includes('/casino-offers') || url.includes('/api/casino/casino-offers') || url.includes('/api/casino/v2/offers/merged')) {
          log('📦 Captured Casino Offers API payload', 'info');
          const data = await clonedResponse.json();
          const offers = data?.payload?.casinoOffers || data?.payload?.offers || data?.casinoOffers || data?.offers || [];
          window.capturedPayloads.offers = data;
          window.capturedPayloads.offerPayloads = window.capturedPayloads.offerPayloads || [];
          window.capturedPayloads.offerPayloads.push({ url: url, data: data, transport: 'Fetch', capturedAt: new Date().toISOString() });
          window.capturedOfferPayloads = window.capturedOfferPayloads || [];
          window.capturedOfferPayloads.push({ url: url, data: data, transport: 'Fetch', capturedAt: new Date().toISOString() });
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'network_payload',
            endpoint: 'offers',
            data: data,
            url: url
          }));
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'log',
            message: \`📦 Captured Casino Offers API payload with \${Array.isArray(offers) ? offers.length : 0} offers from \${url}\`,
            logType: 'success'
          }));
        }
        
        else if (
          url.includes('/profileBookings/enriched') ||
          url.includes('/upcomingCruises') ||
          url.includes('/profilemanagement/profiles/cruises') ||
          url.includes('/api/profile/bookings') ||
          url.includes('/api/booking/cruises') ||
          url.includes('/pastCruises') ||
          url.includes('/completedCruises') ||
          url.includes('/profileBookings') ||
          url.includes('/api/v3/bookings') ||
          url.includes('/myaccount/api/') ||
          url.includes('/v1/guestAccounts/') && /(bookings?|sailings?|cruises?)/i.test(url) ||
          url.includes('/api/v1/cruises') ||
          url.includes('/api/v2/cruises') ||
          url.includes('/manageBooking/cruises')
        ) {
          const data = await clonedResponse.json();
          const bookings = data?.payload?.profileBookings || data?.payload?.sailingInfo || data?.profileBookings || data?.sailingInfo || data?.bookings || [];
          window.capturedPayloads.upcomingCruises = data;
          
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'network_capture',
            endpoint: 'upcomingCruises',
            data: data,
            url: url
          }));
          
          log(\`📦 [Fetch] Captured Bookings API payload with \${Array.isArray(bookings) ? bookings.length : 0} bookings from \${url}\`, 'info');
        }
        
        else if (url.includes('/voyages/') && url.includes('/enriched')) {
          const data = await clonedResponse.json();
          window.capturedPayloads.voyageEnrichment = data;
          
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'network_capture',
            endpoint: 'voyageEnrichment',
            data: data
          }));
          
          log(\`📦 [Fetch] Captured Voyage Enrichment data from \${url}\`, 'info');
        }
        
        else if (isRoyalLoyaltyHistoryUrl(url)) {
          const data = await clonedResponse.json();
          postRoyalHistorySailings(url, data, 'Fetch');
        }
        
        else if (url.includes('/guestAccounts/loyalty/info')) {
          const data = await clonedResponse.json();
          window.capturedPayloads.loyalty = data;
          
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'network_capture',
            endpoint: 'loyalty',
            data: data,
            url: url
          }));
          
          log(\`📦 [Fetch] Captured Loyalty API payload from \${url}\`, 'success');
          
          const loyaltyInfo = data?.payload?.loyaltyInformation || data?.loyaltyInformation || data;
          if (loyaltyInfo?.crownAndAnchorSocietyLoyaltyTier || loyaltyInfo?.clubRoyaleLoyaltyTier) {
            if (loyaltyInfo.crownAndAnchorSocietyLoyaltyTier) {
              log(\`   👑 Crown & Anchor: \${loyaltyInfo.crownAndAnchorSocietyLoyaltyTier}\`, 'info');
            }
            if (loyaltyInfo.clubRoyaleLoyaltyTier) {
              log(\`   🎰 Club Royale: \${loyaltyInfo.clubRoyaleLoyaltyTier}\`, 'info');
            }
          }
        }
        
        else if (url.includes('/manage/api/v1/bookings') || url.includes('/manage/api/')) {
          const data = await clonedResponse.json();
          window.capturedPayloads.manageBooking = window.capturedPayloads.manageBooking || [];
          window.capturedPayloads.manageBooking.push({ url, data, timestamp: new Date().toISOString() });
          
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'network_capture',
            endpoint: 'manageBooking',
            data: data,
            url: url
          }));
          
          log(\`💰 [Fetch] Captured Booking Management API from \${url}\`, 'info');
        }
        
        else if (url.includes('/graph') && (url.includes('royalcaribbean.com') || url.includes('celebritycruises.com'))) {
          const data = await clonedResponse.json();
          window.capturedPayloads.graphQL = window.capturedPayloads.graphQL || [];
          window.capturedPayloads.graphQL.push({ url, data, timestamp: new Date().toISOString() });
          
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'network_capture',
            endpoint: 'graphQL',
            data: data,
            url: url
          }));
          
          log(\`📊 [Fetch] Captured GraphQL API from \${url}\`, 'info');
        }
        
        else if (url.includes('/booked/') || url.includes('token=')) {
          const data = await clonedResponse.json();
          window.capturedPayloads.bookedDetails = window.capturedPayloads.bookedDetails || [];
          window.capturedPayloads.bookedDetails.push({ url, data, timestamp: new Date().toISOString() });
          
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'network_capture',
            endpoint: 'bookedDetails',
            data: data,
            url: url
          }));
          
          log(\`🎫 [Fetch] Captured Booked Cruise Details from \${url}\`, 'info');
        }
        
        else if (url.includes('carnival.com') && (url.includes('/api/') || url.includes('/profilemanagement/'))) {
          try {
            const ct = clonedResponse.headers.get('content-type') || '';
            if (ct.includes('json')) {
              const data = await clonedResponse.json();
              
              if (url.includes('/offers') || url.includes('/vifp')) {
                if (data.Items && Array.isArray(data.Items)) {
                  window.capturedPayloads.carnivalVifpOffers = data;
                  window.__carnivalVifpOffers = data;
                  window.ReactNativeWebView.postMessage(JSON.stringify({
                    type: 'network_payload',
                    endpoint: 'carnival_vifp_offers',
                    data: data,
                    url: url
                  }));
                  log(\`🎪 [Fetch] Captured Carnival VIFP offers: \${data.Items.length} items from \${url}\`, 'success');
                }
              }
              
              if (url.includes('/bookings') || url.includes('/cruises') || url.includes('/reservation')) {
                let bookings = null;
                if (Array.isArray(data)) bookings = data;
                else if (data.bookings && Array.isArray(data.bookings)) bookings = data.bookings;
                else if (data.cruises && Array.isArray(data.cruises)) bookings = data.cruises;
                else if (data.data && Array.isArray(data.data)) bookings = data.data;
                else if (data.payload && Array.isArray(data.payload)) bookings = data.payload;
                else if (data.upcoming && Array.isArray(data.upcoming)) bookings = data.upcoming;
                else if (data.upcomingCruises && Array.isArray(data.upcomingCruises)) bookings = data.upcomingCruises;
                else if (data.pastCruises && Array.isArray(data.pastCruises)) bookings = data.pastCruises;
                
                if (bookings && bookings.length > 0) {
                  window.capturedPayloads.upcomingCruises = data;
                  window.ReactNativeWebView.postMessage(JSON.stringify({
                    type: 'network_payload',
                    endpoint: 'bookings',
                    data: data,
                    url: url
                  }));
                  log(\`🎪 [Fetch] Captured Carnival bookings: \${bookings.length} from \${url}\`, 'success');
                }
              }
            }
          } catch (carnivalErr) {
            // ignore carnival parse errors
          }
        }
      } catch (err) {
        console.log('[NetworkMonitor] Error processing response:', err);
      }
      
      return response;
    });
  };
  
  const OriginalXHR = XMLHttpRequest;
  XMLHttpRequest = function() {
    const xhr = new OriginalXHR();

    let _url = '';
    let _headers = {};

    const originalOpen = xhr.open;
    xhr.open = function(method, url) {
      try {
        _url = String(url || '');
      } catch (e) {
        _url = '';
      }
      return originalOpen.apply(this, arguments);
    };

    const originalSetRequestHeader = xhr.setRequestHeader;
    xhr.setRequestHeader = function(name, value) {
      try {
        _headers[String(name || '').toLowerCase()] = String(value ?? '');

        if (_url.includes('aws-prd.api.rccl.com')) {
          const apiKey = _headers['x-api-key'];
          const authorization = _headers['authorization'];
          const accountId = _headers['account-id'];

          if (apiKey) window.capturedRequestHeaders.apiKey = apiKey;
          if (authorization) window.capturedRequestHeaders.authorization = authorization;
          if (accountId) window.capturedRequestHeaders.accountId = accountId;
        }
      } catch (e) {
        // ignore
      }
      return originalSetRequestHeader.apply(this, arguments);
    };

    xhr.addEventListener('load', function() {
      if (this.readyState === 4 && this.status === 200) {
        const url = this.responseURL || _url || '';
        
        try {
          if (url.includes('/casino-offers') || url.includes('/api/casino/casino-offers') || url.includes('/api/casino/v2/offers/merged')) {
            const data = JSON.parse(this.responseText);
            const offers = data?.payload?.casinoOffers || data?.payload?.offers || data?.casinoOffers || data?.offers || [];
            window.capturedPayloads.offers = data;
            window.capturedPayloads.offerPayloads = window.capturedPayloads.offerPayloads || [];
            window.capturedPayloads.offerPayloads.push({ url: url, data: data, transport: 'XHR', capturedAt: new Date().toISOString() });
            window.capturedOfferPayloads = window.capturedOfferPayloads || [];
            window.capturedOfferPayloads.push({ url: url, data: data, transport: 'XHR', capturedAt: new Date().toISOString() });
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'network_payload',
              endpoint: 'offers',
              data: data,
              url: url
            }));
            log(\`📦 [XHR] Captured Casino Offers API payload with \${Array.isArray(offers) ? offers.length : 0} offers from \${url}\`, 'success');
          }
          else if (
            url.includes('/profileBookings/enriched') ||
            url.includes('/upcomingCruises') ||
            url.includes('/profilemanagement/profiles/cruises') ||
            url.includes('/api/profile/bookings') ||
            url.includes('/api/booking/cruises') ||
            url.includes('/pastCruises') ||
            url.includes('/completedCruises') ||
            url.includes('/profileBookings') ||
            url.includes('/api/v3/bookings') ||
            url.includes('/myaccount/api/') ||
            url.includes('/v1/guestAccounts/') && /(bookings?|sailings?|cruises?)/i.test(url) ||
            url.includes('/api/v1/cruises') ||
            url.includes('/api/v2/cruises') ||
            url.includes('/manageBooking/cruises')
          ) {
            const data = JSON.parse(this.responseText);
            const bookings = data?.payload?.profileBookings || data?.payload?.sailingInfo || data?.profileBookings || data?.sailingInfo || data?.bookings || [];
            window.capturedPayloads.upcomingCruises = data;
            
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'network_capture',
              endpoint: 'upcomingCruises',
              data: data,
              url: url
            }));
            
            log(\`📦 [XHR] Captured Bookings API payload with \${Array.isArray(bookings) ? bookings.length : 0} bookings from \${url}\`, 'info');
          }
          
          else if (url.includes('/voyages/') && url.includes('/enriched')) {
            const data = JSON.parse(this.responseText);
            window.capturedPayloads.voyageEnrichment = data;
            
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'network_capture',
              endpoint: 'voyageEnrichment',
              data: data
            }));
            
            log(\`📦 [XHR] Captured Voyage Enrichment data from \${url}\`, 'info');
          }
          
          else if (isRoyalLoyaltyHistoryUrl(url)) {
            const data = JSON.parse(this.responseText);
            postRoyalHistorySailings(url, data, 'XHR');
          }
          
          else if (url.includes('/guestAccounts/loyalty/info')) {
            const data = JSON.parse(this.responseText);
            window.capturedPayloads.loyalty = data;
            
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'network_capture',
              endpoint: 'loyalty',
              data: data,
              url: url
            }));
            
            log(\`📦 [XHR] Captured Loyalty API from \${url}\`, 'success');
            
            const loyaltyInfo = data?.payload?.loyaltyInformation || data?.loyaltyInformation || data;
            if (loyaltyInfo?.crownAndAnchorSocietyLoyaltyTier || loyaltyInfo?.clubRoyaleLoyaltyTier) {
              if (loyaltyInfo.crownAndAnchorSocietyLoyaltyTier) {
                log(\`   👑 Crown & Anchor: \${loyaltyInfo.crownAndAnchorSocietyLoyaltyTier}\`, 'info');
              }
              if (loyaltyInfo.clubRoyaleLoyaltyTier) {
                log(\`   🎰 Club Royale: \${loyaltyInfo.clubRoyaleLoyaltyTier}\`, 'info');
              }
            }
          }
          
          else if (url.includes('/manage/api/v1/bookings') || url.includes('/manage/api/')) {
            const data = JSON.parse(this.responseText);
            window.capturedPayloads.manageBooking = window.capturedPayloads.manageBooking || [];
            window.capturedPayloads.manageBooking.push({ url, data, timestamp: new Date().toISOString() });
            
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'network_capture',
              endpoint: 'manageBooking',
              data: data,
              url: url
            }));
            
            log(\`💰 [XHR] Captured Booking Management API from \${url}\`, 'info');
          }
          
          else if (url.includes('/graph') && (url.includes('royalcaribbean.com') || url.includes('celebritycruises.com'))) {
            const data = JSON.parse(this.responseText);
            window.capturedPayloads.graphQL = window.capturedPayloads.graphQL || [];
            window.capturedPayloads.graphQL.push({ url, data, timestamp: new Date().toISOString() });
            
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'network_capture',
              endpoint: 'graphQL',
              data: data,
              url: url
            }));
            
            log(\`📊 [XHR] Captured GraphQL API from \${url}\`, 'info');
          }
          
          else if (url.includes('/booked/') || url.includes('token=')) {
            const data = JSON.parse(this.responseText);
            window.capturedPayloads.bookedDetails = window.capturedPayloads.bookedDetails || [];
            window.capturedPayloads.bookedDetails.push({ url, data, timestamp: new Date().toISOString() });
            
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'network_capture',
              endpoint: 'bookedDetails',
              data: data,
              url: url
            }));
            
            log(\`🎫 [XHR] Captured Booked Cruise Details from \${url}\`, 'info');
          }
          
          else if (url.includes('carnival.com') && (url.includes('/api/') || url.includes('/profilemanagement/'))) {
            try {
              const data = JSON.parse(this.responseText);
              
              if (url.includes('/offers') || url.includes('/vifp')) {
                if (data.Items && Array.isArray(data.Items)) {
                  window.capturedPayloads.carnivalVifpOffers = data;
                  window.__carnivalVifpOffers = data;
                  window.ReactNativeWebView.postMessage(JSON.stringify({
                    type: 'network_payload',
                    endpoint: 'carnival_vifp_offers',
                    data: data,
                    url: url
                  }));
                  log(\`🎪 [XHR] Captured Carnival VIFP offers: \${data.Items.length} items from \${url}\`, 'success');
                }
              }
              
              if (url.includes('/bookings') || url.includes('/cruises') || url.includes('/reservation')) {
                let bookings = null;
                if (Array.isArray(data)) bookings = data;
                else if (data.bookings && Array.isArray(data.bookings)) bookings = data.bookings;
                else if (data.cruises && Array.isArray(data.cruises)) bookings = data.cruises;
                else if (data.data && Array.isArray(data.data)) bookings = data.data;
                else if (data.payload && Array.isArray(data.payload)) bookings = data.payload;
                
                if (bookings && bookings.length > 0) {
                  window.capturedPayloads.upcomingCruises = data;
                  window.ReactNativeWebView.postMessage(JSON.stringify({
                    type: 'network_payload',
                    endpoint: 'bookings',
                    data: data,
                    url: url
                  }));
                  log(\`🎪 [XHR] Captured Carnival bookings: \${bookings.length} from \${url}\`, 'success');
                }
              }
            } catch (carnivalErr) {
              // ignore
            }
          }
        } catch (err) {
          console.log('[NetworkMonitor] Error processing XHR response:', err);
        }
      }
    });
    
    return xhr;
  };
  
  XMLHttpRequest.prototype = OriginalXHR.prototype;
  
  log('✅ Network monitor installed - tracking fetch() and XMLHttpRequest', 'success');
})();
`;
