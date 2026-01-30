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
      voyageEnrichment: null
    };
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
                window.capturedPayloads.offers = data;
                window.ReactNativeWebView.postMessage(JSON.stringify({
                  type: 'network_payload',
                  endpoint: 'offers',
                  data: data,
                  url: url
                }));
                window.ReactNativeWebView.postMessage(JSON.stringify({
                  type: 'log',
                  message: '📦 Captured Casino Offers API payload with ' + (data?.offers?.length || 0) + ' offers',
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
              window.capturedPayloads.offers = data;
              window.ReactNativeWebView.postMessage(JSON.stringify({
                type: 'network_payload',
                endpoint: 'offers',
                data: data,
                url: this._url
              }));
              window.ReactNativeWebView.postMessage(JSON.stringify({
                type: 'log',
                message: '📦 [XHR] Captured Casino Offers API payload',
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
  
  function checkAuthStatus() {
    checkCount++;
    const pageText = document.body.innerText || '';
    const pageHTML = document.body.innerHTML || '';
    const url = window.location.href;
    
    const cookies = document.cookie;
    const hasCookies = cookies.includes('RCAUTH') || 
                       cookies.includes('auth') || 
                       cookies.includes('session') ||
                       cookies.length > 100;
    
    const indicators = {
      accountLinks: document.querySelectorAll('a[href*="/account"]'),
      logoutLinks: document.querySelectorAll('a[href*="logout"], button[onclick*="logout"], a[href*="sign-out"]'),
      signInButtons: document.querySelectorAll('button:not([type="submit"]):not([type="button"])')?.length,
      upcomingCruisesLink: document.querySelector('a[href*="upcoming-cruises"]'),
      courtesyHoldsLink: document.querySelector('a[href*="courtesy-holds"]'),
      loyaltyStatusLink: document.querySelector('a[href*="loyalty-status"]'),
      myAccountLink: document.querySelector('a[href*="/account"]'),
      myProfileText: pageText.toLowerCase().includes('my profile'),
      welcomeText: pageText.toLowerCase().includes('welcome'),
      memberText: pageHTML.toLowerCase().includes('member'),
      pointsText: pageHTML.toLowerCase().includes('points'),
      crownAnchorText: pageHTML.toLowerCase().includes('crown') || pageHTML.toLowerCase().includes('anchor'),
      clubRoyaleText: pageHTML.toLowerCase().includes('club royale'),
      tierText: pageHTML.toLowerCase().includes('tier') || pageHTML.toLowerCase().includes('level'),
      hasLogoutButton: document.querySelectorAll('a[href*="logout"], a[href*="sign-out"]').length > 0
    };

    const strongAuthSignals = 
      indicators.upcomingCruisesLink || 
      indicators.courtesyHoldsLink || 
      indicators.loyaltyStatusLink ||
      indicators.hasLogoutButton;
    
    const accountFeatureCount = 
      (indicators.accountLinks.length > 0 ? 1 : 0) +
      (indicators.upcomingCruisesLink ? 1 : 0) +
      (indicators.courtesyHoldsLink ? 1 : 0) +
      (indicators.loyaltyStatusLink ? 1 : 0) +
      (indicators.myAccountLink ? 1 : 0) +
      (indicators.hasLogoutButton ? 1 : 0);
    
    const contentSignals = 
      (indicators.memberText ? 1 : 0) +
      (indicators.pointsText ? 1 : 0) +
      (indicators.crownAnchorText ? 1 : 0) +
      (indicators.tierText ? 1 : 0);
    
    const isOnAccountPage = url.includes('/account/') || url.includes('loyalty-status');
    
    let isLoggedIn = false;
    
    if (strongAuthSignals) {
      isLoggedIn = true;
    } else if (accountFeatureCount >= 2) {
      isLoggedIn = true;
    } else if (hasCookies && (accountFeatureCount >= 1 || contentSignals >= 2)) {
      isLoggedIn = true;
    } else if (isOnAccountPage && !pageText.toLowerCase().includes('sign in to access')) {
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
    
    if (checkCount % 5 === 0) {
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'log',
        message: 'Auth check: ' + (isLoggedIn ? 'LOGGED IN' : 'NOT LOGGED IN') + 
                 ' (signals: ' + accountFeatureCount + ' account features, ' + contentSignals + ' content signals)',
        logType: 'info'
      }));
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
    
    const intervalId = setInterval(checkAuthStatus, 3000);

    setTimeout(() => {
      observer.disconnect();
      clearInterval(intervalId);
    }, 30000);
  }
  
  initAuthDetection();
})();
`;

export function injectAuthDetection() {
  return AUTH_DETECTION_SCRIPT;
}
