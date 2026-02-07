export const NETWORK_MONITOR_SCRIPT = `
(function() {
  if (window.networkMonitorInstalled) {
    console.log('[NetworkMonitor] Already installed, skipping');
    return;
  }
  window.networkMonitorInstalled = true;
  
  console.log('[NetworkMonitor] Installing comprehensive network monitor');
  
  window.capturedPayloads = window.capturedPayloads || {};
  window.capturedRequestHeaders = window.capturedRequestHeaders || {};
  
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
        if (url.includes('/casino-offers') || url.includes('/api/casino/casino-offers')) {
          log('📦 Captured Casino Offers API payload', 'info');
          const data = await clonedResponse.json();
          const offers = data?.payload?.casinoOffers || data?.casinoOffers || [];
          window.capturedPayloads.offers = data;
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'log',
            message: \`📦 Captured Casino Offers API payload with \${offers.length} offers\`,
            logType: 'info'
          }));
        }
        
        else if (url.includes('/profileBookings/enriched') || url.includes('/upcomingCruises')) {
          const data = await clonedResponse.json();
          const bookings = data?.payload?.profileBookings || [];
          window.capturedPayloads.upcomingCruises = data;
          
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'network_capture',
            endpoint: 'upcomingCruises',
            data: data
          }));
          
          log(\`📦 [Fetch] Captured Bookings API payload with \${bookings.length} bookings from \${url}\`, 'info');
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
          if (url.includes('/profileBookings/enriched')) {
            const data = JSON.parse(this.responseText);
            const bookings = data?.payload?.profileBookings || [];
            window.capturedPayloads.upcomingCruises = data;
            
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'network_capture',
              endpoint: 'upcomingCruises',
              data: data
            }));
            
            log(\`📦 [XHR] Captured Bookings API payload with \${bookings.length} bookings from \${url}\`, 'info');
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
