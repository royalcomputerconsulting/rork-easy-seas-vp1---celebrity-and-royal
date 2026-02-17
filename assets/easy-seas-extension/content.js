(function() {
  console.log('[Easy Seas] Content script loaded on:', window.location.href);

  let capturedData = {
    offers: null,
    upcomingCruises: null,
    courtesyHolds: null,
    loyalty: null,
    voyageEnrichment: null,
    isLoggedIn: false,
    lastUpdate: null,
    cruiseLine: window.location.hostname.includes('celebrity') ? 'celebrity' : 'royal'
  };

  function sendStatusUpdate() {
    chrome.runtime.sendMessage({
      type: 'status_update',
      data: {
        isLoggedIn: capturedData.isLoggedIn,
        hasOffers: !!capturedData.offers,
        hasBookings: !!capturedData.upcomingCruises || !!capturedData.courtesyHolds,
        offerCount: capturedData.offers?.offers?.length || 0,
        bookingCount: (capturedData.upcomingCruises?.profileBookings?.length || 0) + 
                      (capturedData.courtesyHolds?.payload?.sailingInfo?.length || 0),
        cruiseLine: capturedData.cruiseLine,
        lastUpdate: capturedData.lastUpdate
      }
    }).catch(() => {});
  }

  function interceptNetworkCalls() {
    const originalFetch = window.fetch;
    window.fetch = function(...args) {
      return originalFetch.apply(this, args).then(response => {
        const clonedResponse = response.clone();
        const url = (typeof args[0] === 'string') ? args[0] : (args[0] && args[0].url ? args[0].url : '');
        
        if (typeof url === 'string' && url) {
          if (url.includes('/api/casino/casino-offers')) {
            if (response.ok && response.status === 200) {
              clonedResponse.json().then(data => {
                capturedData.offers = data;
                capturedData.lastUpdate = new Date().toISOString();
                console.log('[Easy Seas] Captured Casino Offers:', data?.offers?.length || 0, 'offers');
                chrome.runtime.sendMessage({
                  type: 'data_captured',
                  endpoint: 'offers',
                  count: data?.offers?.length || 0,
                  dataKey: 'offers',
                  data: data
                }).catch(() => {});
                sendStatusUpdate();
              }).catch(() => {});
            }
          }
          
          if (url.includes('/profileBookings/enriched') || url.includes('/api/account/upcoming-cruises') || url.includes('/api/profile/bookings')) {
            if (response.ok && response.status === 200) {
              clonedResponse.json().then(data => {
                capturedData.upcomingCruises = data;
                capturedData.lastUpdate = new Date().toISOString();
                const count = data?.profileBookings?.length || data?.payload?.sailingInfo?.length || data?.sailingInfo?.length || 0;
                console.log('[Easy Seas] Captured Bookings:', count);
                chrome.runtime.sendMessage({
                  type: 'data_captured',
                  endpoint: 'bookings',
                  count: count,
                  dataKey: 'upcomingCruises',
                  data: data
                }).catch(() => {});
                sendStatusUpdate();
              }).catch(() => {});
            }
          }
          
          if (url.includes('/api/account/courtesy-holds')) {
            if (response.ok && response.status === 200) {
              clonedResponse.json().then(data => {
                capturedData.courtesyHolds = data;
                capturedData.lastUpdate = new Date().toISOString();
                const count = data?.payload?.sailingInfo?.length || data?.sailingInfo?.length || 0;
                console.log('[Easy Seas] Captured Courtesy Holds:', count);
                chrome.runtime.sendMessage({
                  type: 'data_captured',
                  endpoint: 'holds',
                  count: count,
                  dataKey: 'courtesyHolds',
                  data: data
                }).catch(() => {});
                sendStatusUpdate();
              }).catch(() => {});
            }
          }
          
          if (url.includes('/ships/voyages') && url.includes('/enriched')) {
            if (response.ok && response.status === 200) {
              clonedResponse.json().then(data => {
                if (!capturedData.voyageEnrichment) {
                  capturedData.voyageEnrichment = {};
                }
                Object.assign(capturedData.voyageEnrichment, data);
                capturedData.lastUpdate = new Date().toISOString();
                console.log('[Easy Seas] Captured Voyage Enrichment');
                sendStatusUpdate();
              }).catch(() => {});
            }
          }
          
          if (url.includes('/guestAccounts/loyalty/info') || url.includes('/en/celebrity/web/v3/guestAccounts/')) {
            clonedResponse.text().then(text => {
              let data = null;
              try { data = JSON.parse(text); } catch (e) { data = { raw: text }; }
              capturedData.loyalty = data;
              capturedData.lastUpdate = new Date().toISOString();
              console.log('[Easy Seas] Captured Loyalty Data');
              chrome.runtime.sendMessage({
                type: 'data_captured',
                endpoint: 'loyalty',
                count: 1,
                dataKey: 'loyalty',
                data: data
              }).catch(() => {});
              sendStatusUpdate();
            }).catch(() => {});
          }
        }
        
        return response;
      });
    };

    const originalXHROpen = XMLHttpRequest.prototype.open;
    const originalXHRSend = XMLHttpRequest.prototype.send;
    
    XMLHttpRequest.prototype.open = function(method, url, ...rest) {
      this._url = url;
      return originalXHROpen.apply(this, [method, url, ...rest]);
    };
    
    XMLHttpRequest.prototype.send = function(...args) {
      this.addEventListener('load', function() {
        if (this._url) {
          try {
            const data = JSON.parse(this.responseText);
            
            if (this._url.includes('/api/casino/casino-offers')) {
              capturedData.offers = data;
              capturedData.lastUpdate = new Date().toISOString();
              console.log('[Easy Seas] [XHR] Captured Casino Offers');
              chrome.runtime.sendMessage({
                type: 'data_captured',
                endpoint: 'offers',
                count: data?.offers?.length || 0,
                dataKey: 'offers',
                data: data
              }).catch(() => {});
              sendStatusUpdate();
            }
            
            if (this._url.includes('/profileBookings/enriched') || this._url.includes('/api/account/upcoming-cruises') || this._url.includes('/api/profile/bookings')) {
              capturedData.upcomingCruises = data;
              capturedData.lastUpdate = new Date().toISOString();
              const count = data?.profileBookings?.length || data?.payload?.sailingInfo?.length || data?.sailingInfo?.length || 0;
              console.log('[Easy Seas] [XHR] Captured Bookings:', count);
              chrome.runtime.sendMessage({
                type: 'data_captured',
                endpoint: 'bookings',
                count: count,
                dataKey: 'upcomingCruises',
                data: data
              }).catch(() => {});
              sendStatusUpdate();
            }
            
            if (this._url.includes('/api/account/courtesy-holds')) {
              capturedData.courtesyHolds = data;
              capturedData.lastUpdate = new Date().toISOString();
              console.log('[Easy Seas] [XHR] Captured Courtesy Holds');
              chrome.runtime.sendMessage({
                type: 'data_captured',
                endpoint: 'holds',
                count: data?.payload?.sailingInfo?.length || 0,
                dataKey: 'courtesyHolds',
                data: data
              }).catch(() => {});
              sendStatusUpdate();
            }
            
            if (this._url.includes('/guestAccounts/loyalty/info') || this._url.includes('/en/celebrity/web/v3/guestAccounts/')) {
              capturedData.loyalty = data;
              capturedData.lastUpdate = new Date().toISOString();
              console.log('[Easy Seas] [XHR] Captured Loyalty Data');
              chrome.runtime.sendMessage({
                type: 'data_captured',
                endpoint: 'loyalty',
                count: 1,
                dataKey: 'loyalty',
                data: data
              }).catch(() => {});
              sendStatusUpdate();
            }
          } catch (e) {}
        }
      });
      
      return originalXHRSend.apply(this, args);
    };
    
    console.log('[Easy Seas] Network monitoring active');
  }

  function checkAuthStatus() {
    const pageText = document.body?.innerText || '';
    const url = window.location.href;
    
    const cookies = document.cookie;
    const hasCookies = cookies.includes('RCAUTH') || 
                       cookies.includes('auth') || 
                       cookies.includes('session') ||
                       cookies.length > 100;
    
    const hasLogoutButton = document.querySelectorAll('a[href*="logout"], a[href*="sign-out"]').length > 0;
    const hasAccountLinks = document.querySelectorAll('a[href*="/account"]').length > 0;
    const isOnAccountPage = url.includes('/account/') || url.includes('loyalty-status') || url.includes('club-royale') || url.includes('blue-chip');
    
    const wasLoggedIn = capturedData.isLoggedIn;
    capturedData.isLoggedIn = hasLogoutButton || (hasCookies && hasAccountLinks) || (isOnAccountPage && !pageText.toLowerCase().includes('sign in to access'));
    
    if (wasLoggedIn !== capturedData.isLoggedIn) {
      console.log('[Easy Seas] Auth status changed:', capturedData.isLoggedIn ? 'LOGGED IN' : 'NOT LOGGED IN');
      sendStatusUpdate();
    }
  }

  function initAuthDetection() {
    interceptNetworkCalls();
    
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => {
        setTimeout(checkAuthStatus, 1500);
      });
    } else {
      setTimeout(checkAuthStatus, 1500);
    }

    const observer = new MutationObserver(() => {
      checkAuthStatus();
    });

    if (document.body) {
      observer.observe(document.body, {
        childList: true,
        subtree: true
      });
    }
    
    setInterval(checkAuthStatus, 3000);
    
    setTimeout(sendStatusUpdate, 2000);
  }

  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === 'get_captured_data') {
      sendResponse({ success: true, data: capturedData });
      return true;
    }
    
    if (request.type === 'clear_data') {
      capturedData = {
        offers: null,
        upcomingCruises: null,
        courtesyHolds: null,
        loyalty: null,
        voyageEnrichment: null,
        isLoggedIn: capturedData.isLoggedIn,
        lastUpdate: null,
        cruiseLine: capturedData.cruiseLine
      };
      sendResponse({ success: true });
      sendStatusUpdate();
      return true;
    }
  });

  initAuthDetection();
})();
