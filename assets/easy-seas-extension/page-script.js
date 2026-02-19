(function() {
  var SRC = 'easy-seas-page';
  function post(type, payload) {
    try { window.postMessage(Object.assign({ source: SRC, type: type }, payload || {}), '*'); } catch(e) {}
  }

  var isCarnival = window.location.hostname.indexOf('carnival.com') !== -1;
  var isCelebrity = window.location.hostname.indexOf('celebritycruises.com') !== -1;

  function getAuth() {
    if (isCarnival) {
      return getCarnivalAuth();
    }
    try {
      var raw = localStorage.getItem('persist:session');
      if (!raw) return null;
      var session = JSON.parse(raw);
      var token = session.token ? JSON.parse(session.token) : null;
      var user = session.user ? JSON.parse(session.user) : null;
      if (!token || !user || !user.accountId) return null;
      var t = typeof token === 'string' ? token : (token && token.toString ? token.toString() : '');
      return {
        token: t.indexOf('Bearer ') === 0 ? t : 'Bearer ' + t,
        accountId: String(user.accountId),
        loyaltyId: user.cruiseLoyaltyId || '',
        firstName: user.firstName || ''
      };
    } catch(e) { return null; }
  }

  function getCarnivalAuth() {
    try {
      var keys = Object.keys(localStorage || {});
      var authData = null;

      // Try common Carnival localStorage key patterns
      var carnivalPatterns = ['carnival_session', 'carnival_auth', 'cc_session', 'vifp_session', 'user_session', 'persist:auth', 'persist:user', 'persist:root'];
      for (var pi = 0; pi < carnivalPatterns.length; pi++) {
        var raw = localStorage.getItem(carnivalPatterns[pi]);
        if (!raw) continue;
        try {
          var parsed = JSON.parse(raw);
          if (parsed && (parsed.accountId || parsed.userId || parsed.loyaltyNumber || parsed.vifpNumber)) {
            authData = {
              token: parsed.token || parsed.accessToken || parsed.authToken || 'carnival_dom_auth',
              accountId: String(parsed.accountId || parsed.userId || parsed.loyaltyNumber || ''),
              loyaltyId: parsed.loyaltyNumber || parsed.vifpNumber || parsed.loyaltyId || '',
              firstName: parsed.firstName || parsed.name || ''
            };
            break;
          }
        } catch(e) {}
      }

      // Try scanning all localStorage keys for auth-like data
      if (!authData) {
        for (var ki = 0; ki < keys.length; ki++) {
          if (/token|auth|session|user|profile/i.test(keys[ki])) {
            try {
              var val = localStorage.getItem(keys[ki]);
              if (!val) continue;
              var obj = JSON.parse(val);
              if (obj && typeof obj === 'object' && (obj.accountId || obj.loyaltyNumber || obj.vifpNumber)) {
                authData = {
                  token: obj.token || obj.accessToken || 'carnival_dom_auth',
                  accountId: String(obj.accountId || obj.loyaltyNumber || obj.vifpNumber || ''),
                  loyaltyId: obj.loyaltyNumber || obj.vifpNumber || '',
                  firstName: obj.firstName || obj.name || ''
                };
                break;
              }
            } catch(e) {}
          }
        }
      }

      // Fall back to DOM-scraped identity (VIFP number visible on page)
      if (!authData) {
        var bodyText = document.body ? document.body.innerText : '';
        var bodyHTML = document.body ? document.body.innerHTML : '';
        var welcomeMatch = bodyText.match(/WELCOME\s+BACK[,\s]+([A-Z][A-Z]+)/i);
        // Try multiple VIFP number patterns
        var vifpMatch =
          bodyText.match(/VIFP\s*Club\s*#?\s*:?\s*(\d{6,12})/i) ||
          bodyText.match(/Club\s*#\s*:?\s*(\d{6,12})/i) ||
          bodyHTML.match(/vifp[^>]{0,200}>(\d{9,12})/i) ||
          bodyHTML.match(/loyalty[^>]{0,200}>(\d{9,12})/i);
        // Check nav for Manage Bookings (only shown when logged in)
        var allLinks = document.querySelectorAll('a, button');
        var hasManageBookingsNav = false;
        for (var ni = 0; ni < allLinks.length; ni++) {
          var txt = (allLinks[ni].textContent || '').trim().toUpperCase();
          if (txt === 'MANAGE BOOKINGS' || txt === 'MY PROFILE' || txt === 'SIGN OUT') {
            hasManageBookingsNav = true;
            break;
          }
        }
        var hasProfileLink = document.querySelectorAll('a[href*="/profilemanagement"], a[href*="/myprofile"]').length > 0;
        var isLoggedIn = welcomeMatch || vifpMatch || hasManageBookingsNav || hasProfileLink;
        if (isLoggedIn) {
          var vifpNum = vifpMatch ? vifpMatch[1] : '';
          var firstName = welcomeMatch ? welcomeMatch[1] : '';
          // If no name from welcome, try to grab from nav/header
          if (!firstName) {
            var nameEl = document.querySelector('[class*="user-name"], [class*="greeting"], [class*="member-name"], [class*="welcomeBack"]');
            if (nameEl) firstName = (nameEl.textContent || '').trim().replace(/WELCOME\s+BACK,?\s*/i, '').split(/\s/)[0] || '';
          }
          authData = {
            token: 'carnival_dom_auth',
            accountId: vifpNum || 'carnival_user',
            loyaltyId: vifpNum || '',
            firstName: firstName || ''
          };
        }
      }

      return authData;
    } catch(e) { return null; }
  }

  function findAppKey() {
    if (isCarnival) return '';
    try {
      var keys = Object.keys(localStorage || {});
      for (var i = 0; i < keys.length; i++) {
        if (/appkey|api[-_]?key/i.test(keys[i])) {
          var v = localStorage.getItem(keys[i]);
          if (v && v.length > 10) return v;
        }
      }
    } catch(e) {}
    try {
      var env = window.__ENV__ || window.__env__ || window.env || null;
      if (env) {
        var v2 = env.APPKEY || env.appKey || env.appkey || env.API_KEY || env.apiKey || env.apigeeApiKey || null;
        if (typeof v2 === 'string' && v2.length > 10) return v2;
      }
    } catch(e) {}
    try {
      var m = window.RCLL_APPKEY || window.RCCL_APPKEY || window.APPKEY || null;
      if (typeof m === 'string' && m.length > 10) return m;
    } catch(e) {}
    return '';
  }

  function sendAuth() { post('auth_data', { auth: getAuth(), appKey: findAppKey() }); }

  var oF = window.fetch;
  window.fetch = function() {
    var args = arguments;
    return oF.apply(this, args).then(function(r) {
      try {
        var url = typeof args[0] === 'string' ? args[0] : (args[0] && args[0].url ? args[0].url : '');
        if (typeof url !== 'string' || !url || !r.ok) return r;
        var c = r.clone();

        // Royal Caribbean / Celebrity patterns
        if (url.indexOf('/api/casino/casino-offers') !== -1)
          c.json().then(function(d) { post('api_captured', { key: 'offers', data: d }); }).catch(function(){});
        if (url.indexOf('/profileBookings/enriched') !== -1 || url.indexOf('/api/account/upcoming-cruises') !== -1 || url.indexOf('/api/profile/bookings') !== -1)
          c.json().then(function(d) { post('api_captured', { key: 'upcomingCruises', data: d }); }).catch(function(){});
        if (url.indexOf('/api/account/courtesy-holds') !== -1)
          c.json().then(function(d) { post('api_captured', { key: 'courtesyHolds', data: d }); }).catch(function(){});
        if (url.indexOf('/guestAccounts/loyalty') !== -1)
          c.json().then(function(d) { post('api_captured', { key: 'loyalty', data: d }); }).catch(function(){});

        // Carnival patterns
        if (isCarnival) {
          // Carnival cruise deals / offers API patterns
          if (url.indexOf('/cruise-deals') !== -1 || url.indexOf('/ListService') !== -1 ||
              url.indexOf('/sailings') !== -1 || url.indexOf('/deals') !== -1 ||
              url.indexOf('/getOffers') !== -1 || url.indexOf('/casino') !== -1 ||
              url.indexOf('/vifp') !== -1 || url.indexOf('/promotions') !== -1) {
            c.json().then(function(d) {
              if (d && (d.offers || d.sailings || d.results || d.data)) {
                var offersArr = d.offers || d.sailings || d.results || (d.data && d.data.offers) || [];
                if (Array.isArray(offersArr) && offersArr.length > 0) {
                  post('api_captured', { key: 'offers', data: { offers: offersArr, raw: d } });
                }
              }
            }).catch(function(){});
          }

          // Carnival profile / bookings patterns
          if (url.indexOf('/profilemanagement') !== -1 || url.indexOf('/profiles/cruises') !== -1 ||
              url.indexOf('/booking') !== -1 || url.indexOf('/reservations') !== -1 ||
              url.indexOf('/upcoming') !== -1 || url.indexOf('/myCruises') !== -1) {
            c.json().then(function(d) {
              if (d && (d.bookings || d.sailings || d.cruises || d.reservations)) {
                var arr = d.bookings || d.sailings || d.cruises || d.reservations || [];
                if (Array.isArray(arr) && arr.length > 0) {
                  post('api_captured', { key: 'upcomingCruises', data: d });
                }
              }
            }).catch(function(){});
          }

          // Carnival loyalty / VIFP patterns
          if (url.indexOf('/loyalty') !== -1 || url.indexOf('/vifp') !== -1 ||
              url.indexOf('/tier') !== -1 || url.indexOf('/membership') !== -1) {
            c.json().then(function(d) {
              if (d) post('api_captured', { key: 'loyalty', data: d });
            }).catch(function(){});
          }
        }
      } catch(e) {}
      return r;
    }).catch(function(e) { throw e; });
  };

  var oX = XMLHttpRequest.prototype.open;
  var oS = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.open = function(m, url) { this.__esUrl = url; return oX.apply(this, arguments); };
  XMLHttpRequest.prototype.send = function() {
    var x = this;
    x.addEventListener('load', function() {
      try {
        var u = x.__esUrl || '';
        if (!u || x.status < 200 || x.status >= 300) return;
        var d = JSON.parse(x.responseText);

        // Royal Caribbean / Celebrity
        if (u.indexOf('/api/casino/casino-offers') !== -1) post('api_captured', { key: 'offers', data: d });
        if (u.indexOf('/profileBookings/enriched') !== -1 || u.indexOf('/api/account/upcoming-cruises') !== -1 || u.indexOf('/api/profile/bookings') !== -1) post('api_captured', { key: 'upcomingCruises', data: d });
        if (u.indexOf('/api/account/courtesy-holds') !== -1) post('api_captured', { key: 'courtesyHolds', data: d });
        if (u.indexOf('/guestAccounts/loyalty') !== -1) post('api_captured', { key: 'loyalty', data: d });

        // Carnival XHR
        if (isCarnival) {
          if (u.indexOf('/ListService') !== -1 || u.indexOf('/getOffers') !== -1 || u.indexOf('/casino') !== -1) {
            var offersArr = d.offers || d.sailings || d.results || [];
            if (Array.isArray(offersArr) && offersArr.length > 0) post('api_captured', { key: 'offers', data: { offers: offersArr, raw: d } });
          }
          if (u.indexOf('/profilemanagement') !== -1 || u.indexOf('/booking') !== -1) {
            post('api_captured', { key: 'upcomingCruises', data: d });
          }
          if (u.indexOf('/loyalty') !== -1 || u.indexOf('/vifp') !== -1) {
            post('api_captured', { key: 'loyalty', data: d });
          }
        }
      } catch(e) {}
    });
    return oS.apply(this, arguments);
  };

  window.addEventListener('message', function(e) {
    if (e.data && e.data.source === 'easy-seas-ext' && e.data.type === 'get_auth') sendAuth();
  });

  sendAuth();
  setTimeout(sendAuth, 2000);
  setTimeout(sendAuth, 5000);
  // Extra retries for Carnival since DOM takes longer to render VIFP info
  if (isCarnival) {
    setTimeout(sendAuth, 8000);
    setTimeout(sendAuth, 12000);
  }
})();
