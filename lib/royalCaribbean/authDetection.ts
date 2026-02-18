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
    if (window.__easySeasNetworkIntercepted) return;
    window.__easySeasNetworkIntercepted = true;

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

  function hasSessionToken() {
    try {
      var sessionRaw = localStorage.getItem('persist:session');
      if (!sessionRaw) return false;
      var session = JSON.parse(sessionRaw);
      if (!session) return false;
      var token = session.token ? JSON.parse(session.token) : null;
      var user = session.user ? JSON.parse(session.user) : null;
      if (token && user && user.accountId) return true;
    } catch (e) {}
    try {
      var keys = Object.keys(localStorage || {});
      for (var i = 0; i < keys.length; i++) {
        var k = keys[i];
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
    var carnivalVifpEl = document.querySelector('[class*="vifp"], [id*="vifp"], [class*="loyalty"]');
    var carnivalWelcomeBack = lowerText.includes('welcome back') || lowerHTML.includes('welcome back');
    var carnivalVifpText = lowerHTML.includes('vifp') || lowerText.includes('vifp club');
    var carnivalMemberNum = /vifp\s*club[\s\S]{0,200}\d{7,}/i.test(pageHTML) || /club#[:\s]*\d{7,}/i.test(pageHTML);
    var carnivalManageBookings = document.querySelector('a[href*="manage-booking"], a[href*="managebooking"], a[href*="my-cruises"]') !== null;
    var carnivalSignedInHeader = lowerHTML.includes('sign out') || lowerHTML.includes('signout') || (isCarnival && (lowerHTML.includes('my profile') || lowerHTML.includes('manage bookings')));

    var strongAuthSignals = 
      upcomingCruisesLink || 
      courtesyHoldsLink || 
      loyaltyStatusLink ||
      hasLogoutButton ||
      hasUserAvatar ||
      (isCarnival && (carnivalWelcomeBack || carnivalVifpEl || carnivalMemberNum || carnivalProfileLink));
    
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
    
    var isOnAccountPage = url.includes('/account/') || url.includes('loyalty-status') || url.includes('/club-royale') || url.includes('/blue-chip-club') || url.includes('/profilemanagement') || (isCarnival && (url.includes('/cruise-deals') || url.includes('/loyaltyInformation')));
    var isOnLoginPage = url.includes('/login') || url.includes('/sign-in') || url.includes('/signin');
    
    var isLoggedIn = false;
    
    if (isOnLoginPage && hasSignInForm) {
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
                 ' (token: ' + hasToken + ', signals: ' + accountFeatureCount + ' account, ' + contentSignals + ' content, cookies: ' + hasCookies + ')',
        logType: 'info'
      }));
    }
  }

  function initAuthDetection() {
    interceptNetworkCalls();
    
    setTimeout(checkAuthStatus, 500);
    
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', function() {
        setTimeout(checkAuthStatus, 800);
      });
    } else {
      setTimeout(checkAuthStatus, 800);
    }

    var observer = null;
    var mutationThrottle = null;
    if (document.body) {
      observer = new MutationObserver(function() {
        if (mutationThrottle) return;
        mutationThrottle = setTimeout(function() {
          mutationThrottle = null;
          checkAuthStatus();
        }, 500);
      });
      observer.observe(document.body, {
        childList: true,
        subtree: true
      });
    }
    
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
