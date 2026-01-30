export const NETWORK_MONITOR_SCRIPT = `
(function() {
  if (window.networkMonitorInstalled) {
    console.log('[NetworkMonitor] Already installed, skipping');
    return;
  }
  window.networkMonitorInstalled = true;
  
  console.log('[NetworkMonitor] Installing comprehensive network monitor');
  
  window.capturedPayloads = window.capturedPayloads || {};
  
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
  
  const originalFetch = window.fetch;
  window.fetch = function(...args) {
    const url = typeof args[0] === 'string' ? args[0] : args[0]?.url || '';
    
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
        
        else if (url.includes('/loyalty') || 
                 url.includes('/guestAccounts/loyalty') ||
                 url.includes('/loyaltyInformation') ||
                 url.includes('/loyalty-programs') ||
                 url.includes('/profile/loyalty') ||
                 url.includes('/account/loyalty')) {
          const data = await clonedResponse.json();
          window.capturedPayloads.loyalty = data;
          
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'network_capture',
            endpoint: 'loyalty',
            data: data
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
    
    xhr.addEventListener('load', function() {
      if (this.readyState === 4 && this.status === 200) {
        const url = this.responseURL || '';
        
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
          
          else if (url.includes('/loyalty') || 
                   url.includes('/guestAccounts/loyalty') ||
                   url.includes('/loyaltyInformation') ||
                   url.includes('/loyalty-programs') ||
                   url.includes('/profile/loyalty') ||
                   url.includes('/account/loyalty')) {
            const data = JSON.parse(this.responseText);
            window.capturedPayloads.loyalty = data;
            
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'network_capture',
              endpoint: 'loyalty',
              data: data
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
