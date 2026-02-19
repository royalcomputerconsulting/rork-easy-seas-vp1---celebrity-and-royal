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
      carnivalVifpOffers: null
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
          var isCarnivalDomain = (window.location && window.location.hostname || '').includes('carnival.com');
          if (isCarnivalDomain && response.ok && response.status === 200) {
            var lowerUrl = url.toLowerCase();
            if (lowerUrl.includes('/api/profile') || lowerUrl.includes('/profilemanagement') || lowerUrl.includes('/api/booking') || lowerUrl.includes('/api/account')) {
              clonedResponse.clone().json().then(function(data) {
                if (data && (data.bookings || data.cruises || data.reservations || (Array.isArray(data) && data.length > 0 && data[0].bookingId))) {
                  window.capturedPayloads.upcomingCruises = data;
                  window.ReactNativeWebView.postMessage(JSON.stringify({
                    type: 'network_payload', endpoint: 'upcomingCruises', data: data, url: url
                  }));
                  window.ReactNativeWebView.postMessage(JSON.stringify({
                    type: 'log', message: '📦 Captured Carnival bookings API from ' + url, logType: 'success'
                  }));
                }
              }).catch(function() {});
            }
            if (lowerUrl.includes('personaliz') || lowerUrl.includes('vifp') || lowerUrl.includes('cruise-deals') || lowerUrl.includes('tgo') || lowerUrl.includes('member')) {
              clonedResponse.clone().json().then(function(data) {
                if (data && data.Items && Array.isArray(data.Items) && data.Items.length > 0 && data.Items[0].OfferId) {
                  window.capturedPayloads.carnivalVifpOffers = data;
                  window.__carnivalVifpOffers = data;
                  window.ReactNativeWebView.postMessage(JSON.stringify({
                    type: 'network_payload', endpoint: 'carnival_vifp_offers', data: data, url: url
                  }));
                  window.ReactNativeWebView.postMessage(JSON.stringify({
                    type: 'log', message: '📦 Captured Carnival VIFP offers (' + data.Items.length + ' offers) from ' + url, logType: 'success'
                  }));
                }
              }).catch(function() {});
            }
            if (lowerUrl.includes('/api/profile/loyalty') || lowerUrl.includes('loyaltyinformation') || lowerUrl.includes('/vifp')) {
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
            clonedResponse.clone().text().then(function(text) {
              try {
                var jsonData = JSON.parse(text);
                if (jsonData && jsonData.Items && Array.isArray(jsonData.Items) && jsonData.Items.length > 0 && jsonData.Items[0].OfferId && !window.__carnivalVifpOffers) {
                  window.__carnivalVifpOffers = jsonData;
                  window.capturedPayloads.carnivalVifpOffers = jsonData;
                  window.ReactNativeWebView.postMessage(JSON.stringify({
                    type: 'network_payload', endpoint: 'carnival_vifp_offers', data: jsonData, url: url
                  }));
                  window.ReactNativeWebView.postMessage(JSON.stringify({
                    type: 'log', message: '📦 Auto-captured Carnival VIFP offers from response body (' + jsonData.Items.length + ')', logType: 'success'
                  }));
                }
              } catch(e) {}
            }).catch(function() {});
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
            
            var xhrIsCarnival = (window.location && window.location.hostname || '').includes('carnival.com');
            if (xhrIsCarnival && this.status === 200) {
              if (data && data.Items && Array.isArray(data.Items) && data.Items.length > 0 && data.Items[0].OfferId && !window.__carnivalVifpOffers) {
                window.__carnivalVifpOffers = data;
                window.capturedPayloads.carnivalVifpOffers = data;
                window.ReactNativeWebView.postMessage(JSON.stringify({
                  type: 'network_payload', endpoint: 'carnival_vifp_offers', data: data, url: this._url
                }));
                window.ReactNativeWebView.postMessage(JSON.stringify({
                  type: 'log', message: '📦 [XHR] Captured Carnival VIFP offers (' + data.Items.length + ')', logType: 'success'
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
    var carnivalMemberNum = /vifp\s*club[\s\S]{0,200}\d{7,}/i.test(pageHTML) || /club#[:\s]*\d{7,}/i.test(pageHTML) || /vifp#[\s]*\d{4,}/i.test(pageHTML);
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
