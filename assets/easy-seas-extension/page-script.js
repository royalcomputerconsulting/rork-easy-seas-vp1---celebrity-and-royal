(function() {
  var SRC = 'easy-seas-page';
  function post(type, payload) {
    try { window.postMessage(Object.assign({ source: SRC, type: type }, payload || {}), '*'); } catch(e) {}
  }
  function getAuth() {
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
  function findAppKey() {
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
        if (url.indexOf('/api/casino/casino-offers') !== -1)
          c.json().then(function(d) { post('api_captured', { key: 'offers', data: d }); }).catch(function(){});
        if (url.indexOf('/profileBookings/enriched') !== -1 || url.indexOf('/api/account/upcoming-cruises') !== -1 || url.indexOf('/api/profile/bookings') !== -1)
          c.json().then(function(d) { post('api_captured', { key: 'upcomingCruises', data: d }); }).catch(function(){});
        if (url.indexOf('/api/account/courtesy-holds') !== -1)
          c.json().then(function(d) { post('api_captured', { key: 'courtesyHolds', data: d }); }).catch(function(){});
        if (url.indexOf('/guestAccounts/loyalty') !== -1)
          c.json().then(function(d) { post('api_captured', { key: 'loyalty', data: d }); }).catch(function(){});
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
        if (u.indexOf('/api/casino/casino-offers') !== -1) post('api_captured', { key: 'offers', data: d });
        if (u.indexOf('/profileBookings/enriched') !== -1 || u.indexOf('/api/account/upcoming-cruises') !== -1 || u.indexOf('/api/profile/bookings') !== -1) post('api_captured', { key: 'upcomingCruises', data: d });
        if (u.indexOf('/api/account/courtesy-holds') !== -1) post('api_captured', { key: 'courtesyHolds', data: d });
        if (u.indexOf('/guestAccounts/loyalty') !== -1) post('api_captured', { key: 'loyalty', data: d });
      } catch(e) {}
    });
    return oS.apply(this, arguments);
  };

  window.addEventListener('message', function(e) {
    if (e.data && e.data.source === 'easy-seas-ext' && e.data.type === 'get_auth') sendAuth();
  });
  sendAuth();
  setTimeout(sendAuth, 3000);
  setTimeout(sendAuth, 8000);
})();
