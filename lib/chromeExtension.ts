import JSZip from 'jszip';
import { Platform } from 'react-native';

const EASY_SEAS_EXTENSION_VERSION = '2.0.0';

function getEasySeasExtensionFiles(): Record<string, string> {
  const manifestContent = `{
  "manifest_version": 3,
  "name": "Easy Seas\u2122 \u2014 Sync Extension",
  "version": "2.0.0",
  "description": "Syncs casino offers, booked cruises, and loyalty data from Royal Caribbean & Celebrity Cruises websites via direct API calls.",
  "permissions": [
    "storage",
    "downloads"
  ],
  "host_permissions": [
    "https://*.royalcaribbean.com/*",
    "https://*.celebritycruises.com/*",
    "https://aws-prd.api.rccl.com/*"
  ],
  "background": {
    "service_worker": "background.js"
  },
  "content_scripts": [
    {
      "matches": [
        "https://*.royalcaribbean.com/*",
        "https://*.celebritycruises.com/*"
      ],
      "js": ["content.js"],
      "css": ["overlay.css"],
      "run_at": "document_start",
      "all_frames": false
    }
  ],
  "icons": {
    "16": "icons/icon16.png",
    "48": "icons/icon48.png",
    "128": "icons/icon128.png"
  },
  "web_accessible_resources": [
    {
      "resources": ["page-script.js"],
      "matches": [
        "https://*.royalcaribbean.com/*",
        "https://*.celebritycruises.com/*"
      ]
    }
  ],
  "action": {
    "default_title": "Easy Seas\u2122 \u2014 Automated Cruise Data Sync",
    "default_icon": {
      "16": "icons/icon16.png",
      "48": "icons/icon48.png",
      "128": "icons/icon128.png"
    }
  }
}`;

  return {
    'manifest.json': manifestContent,
    'background.js': getBackgroundJS(),
    'content.js': getContentJS(),
    'page-script.js': getPageScriptJS(),
    'overlay.css': getOverlayCSS(),
  };
}

function getBackgroundJS(): string {
  return `console.log('[Easy Seas BG] Service worker v2 initialized');

chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  if (request.type === 'store_data') {
    chrome.storage.local.set(request.data).then(function() {
      sendResponse({ success: true });
    }).catch(function(err) {
      sendResponse({ success: false, error: err.message });
    });
    return true;
  }
  if (request.type === 'get_data') {
    chrome.storage.local.get(request.keys).then(function(result) {
      sendResponse({ success: true, data: result });
    }).catch(function(err) {
      sendResponse({ success: false, error: err.message });
    });
    return true;
  }
});

chrome.runtime.onInstalled.addListener(function() {
  console.log('[Easy Seas BG] Extension installed/updated');
});`;
}

function getPageScriptJS(): string {
  return `(function() {
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
})();`;
}

function getContentJS(): string {
  return `void function() {
  'use strict';
  if (window.__easySeasLoaded) return;
  window.__easySeasLoaded = true;
  console.log('[Easy Seas] Content script v2 loaded on', window.location.href);

  var overlayElement = null;
  var authContext = null;
  var capturedData = {
    offers: null, upcomingCruises: null, courtesyHolds: null, loyalty: null,
    isLoggedIn: false,
    cruiseLine: window.location.hostname.includes('celebrity') ? 'celebrity' : 'royal'
  };
  var syncState = { isRunning: false, currentStep: 0, totalSteps: 3 };

  function injectPageScript() {
    var s = document.createElement('script');
    s.src = chrome.runtime.getURL('page-script.js');
    s.onload = function() { s.remove(); console.log('[Easy Seas] Page world script injected via src'); };
    s.onerror = function() { console.error('[Easy Seas] Failed to inject page-script.js'); s.remove(); };
    (document.head || document.documentElement).appendChild(s);
  }

  window.addEventListener('message', function(e) {
    if (!e.data || e.data.source !== 'easy-seas-page') return;
    if (e.data.type === 'auth_data') {
      if (e.data.auth && e.data.auth.token && e.data.auth.accountId) {
        authContext = {
          token: e.data.auth.token, accountId: e.data.auth.accountId,
          loyaltyId: e.data.auth.loyaltyId || '', firstName: e.data.auth.firstName || '',
          appKey: e.data.appKey || ''
        };
        capturedData.isLoggedIn = true;
        addLog('User logged in' + (authContext.firstName ? ' as ' + authContext.firstName : ''), 'success');
      } else { checkAuthFromDOM(); }
      updateUI();
    }
    if (e.data.type === 'api_captured' && e.data.data) {
      capturedData[e.data.key] = e.data.data;
      var cnt = countItems(e.data.key, e.data.data);
      addLog('Captured ' + e.data.key + (cnt ? ' (' + cnt + ' items)' : ''), 'success');
      updateUI();
      try { chrome.storage.local.set({ ['es_' + e.data.key]: e.data.data }); } catch(ex) {}
    }
  });

  function extractBookings(data) {
    if (!data) return [];
    if (data.payload && Array.isArray(data.payload.sailingInfo)) return data.payload.sailingInfo;
    if (data.payload && Array.isArray(data.payload.profileBookings)) return data.payload.profileBookings;
    if (Array.isArray(data.sailingInfo)) return data.sailingInfo;
    if (Array.isArray(data.profileBookings)) return data.profileBookings;
    if (Array.isArray(data)) return data;
    if (data.bookings && Array.isArray(data.bookings)) return data.bookings;
    return [];
  }

  function countItems(key, data) {
    if (!data) return 0;
    if (key === 'offers') return (data.offers && data.offers.length) || 0;
    if (key === 'upcomingCruises') return extractBookings(data).length;
    if (key === 'courtesyHolds') {
      if (data.payload && data.payload.sailingInfo) return data.payload.sailingInfo.length;
      return (data.sailingInfo && data.sailingInfo.length) || 0;
    }
    return 0;
  }

  function getBookingsCount() {
    var upcoming = extractBookings(capturedData.upcomingCruises).length;
    var holds = 0;
    if (capturedData.courtesyHolds) {
      if (capturedData.courtesyHolds.payload && capturedData.courtesyHolds.payload.sailingInfo)
        holds = capturedData.courtesyHolds.payload.sailingInfo.length;
      else if (capturedData.courtesyHolds.sailingInfo)
        holds = capturedData.courtesyHolds.sailingInfo.length;
    }
    return upcoming + holds;
  }

  function checkAuthFromDOM() {
    var c = document.cookie;
    var hasCookies = c.indexOf('RCAUTH') !== -1 || c.indexOf('auth') !== -1 || c.length > 100;
    var hasLogout = document.querySelectorAll('a[href*="logout"], a[href*="sign-out"], [class*="logout"]').length > 0;
    var hasAccount = document.querySelectorAll('a[href*="/account/"], [class*="myAccount"]').length > 0;
    var isAccountPage = window.location.href.indexOf('/account/') !== -1 || window.location.href.indexOf('club-royale') !== -1 || window.location.href.indexOf('blue-chip') !== -1;
    var hasProfile = document.querySelectorAll('[class*="profile"], [class*="user-name"], [class*="greeting"]').length > 0;
    capturedData.isLoggedIn = hasLogout || hasProfile || (hasCookies && (isAccountPage || hasAccount));
  }

  function createOverlay() {
    if (document.getElementById('easy-seas-overlay')) { overlayElement = document.getElementById('easy-seas-overlay'); return; }
    if (!document.body) { setTimeout(createOverlay, 200); return; }
    var overlay = document.createElement('div');
    overlay.id = 'easy-seas-overlay';
    overlay.innerHTML = '<div id="easy-seas-header">' +
      '<div id="easy-seas-icon">\\u2693</div>' +
      '<div style="flex: 1;">' +
      '<div id="easy-seas-title">Easy Seas\\u2122</div>' +
      '<div id="easy-seas-subtitle">Automated Cruise Data Sync</div>' +
      '</div></div>' +
      '<div id="easy-seas-content">' +
      '<div id="easy-seas-progress">' +
      '<div class="es-step-indicator">' +
      '<div class="es-step" data-step="1"></div>' +
      '<div class="es-step" data-step="2"></div>' +
      '<div class="es-step" data-step="3"></div>' +
      '</div>' +
      '<div class="es-progress-text">Syncing Data...</div>' +
      '<div class="es-progress-bar"><div class="es-progress-fill" id="progress-fill"></div></div>' +
      '</div>' +
      '<div class="es-status-row"><span class="es-status-label">Login Status</span>' +
      '<span class="es-badge es-badge-warning" id="login-status">CHECKING...</span></div>' +
      '<div class="es-status-row"><span class="es-status-label">Casino Offers</span>' +
      '<span class="es-status-value" id="offer-count">0</span></div>' +
      '<div class="es-status-row"><span class="es-status-label">Booked Cruises</span>' +
      '<span class="es-status-value" id="booking-count">0</span></div>' +
      '<div class="es-status-row"><span class="es-status-label">Cruise Line</span>' +
      '<span class="es-status-value" id="cruise-line">Royal Caribbean</span></div>' +
      '<div id="easy-seas-buttons">' +
      '<button class="es-button es-button-primary" id="sync-btn" disabled><span>START SYNC</span></button>' +
      '<button class="es-button es-button-secondary" id="download-btn" disabled><span>DOWNLOAD CSV</span></button>' +
      '</div>' +
      '<div id="easy-seas-log"></div></div>';
    document.body.appendChild(overlay);
    overlayElement = overlay;
    document.getElementById('sync-btn').addEventListener('click', toggleSync);
    document.getElementById('download-btn').addEventListener('click', downloadCSV);
    updateUI();
  }

  function ensureOverlay() {
    if (!document.getElementById('easy-seas-overlay') && document.body) { overlayElement = null; createOverlay(); }
  }

  function updateUI() {
    if (!overlayElement) return;
    var loginEl = document.getElementById('login-status');
    if (loginEl) {
      loginEl.textContent = capturedData.isLoggedIn ? 'LOGGED IN' : 'NOT LOGGED IN';
      loginEl.className = capturedData.isLoggedIn ? 'es-badge es-badge-success' : 'es-badge es-badge-warning';
    }
    var offerEl = document.getElementById('offer-count');
    if (offerEl) offerEl.textContent = (capturedData.offers && capturedData.offers.offers && capturedData.offers.offers.length) || 0;
    var bookEl = document.getElementById('booking-count');
    if (bookEl) bookEl.textContent = getBookingsCount();
    var lineEl = document.getElementById('cruise-line');
    if (lineEl) lineEl.textContent = capturedData.cruiseLine === 'celebrity' ? 'Celebrity Cruises' : 'Royal Caribbean';
    var syncBtn = document.getElementById('sync-btn');
    if (syncBtn) {
      if (syncState.isRunning) {
        syncBtn.className = 'es-button es-button-stop';
        syncBtn.innerHTML = '<div class="es-spinner"></div><span>SYNCING...</span>';
        syncBtn.disabled = false;
      } else {
        syncBtn.className = 'es-button es-button-primary';
        syncBtn.innerHTML = '<span>START SYNC</span>';
        syncBtn.disabled = !capturedData.isLoggedIn;
      }
    }
    var dlBtn = document.getElementById('download-btn');
    if (dlBtn) {
      var hasData = (capturedData.offers && capturedData.offers.offers && capturedData.offers.offers.length > 0) || getBookingsCount() > 0;
      dlBtn.disabled = !hasData || syncState.isRunning;
    }
  }

  function updateProgress(step, total, message) {
    var progressEl = document.getElementById('easy-seas-progress');
    var fillEl = document.getElementById('progress-fill');
    var textEl = progressEl ? progressEl.querySelector('.es-progress-text') : null;
    if (progressEl) progressEl.classList.add('active');
    if (fillEl) fillEl.style.width = ((step / total) * 100) + '%';
    if (textEl) textEl.textContent = message || ('Step ' + step + ' of ' + total);
    var steps = document.querySelectorAll('.es-step');
    for (var i = 0; i < steps.length; i++) {
      steps[i].classList.remove('active', 'completed');
      if (i + 1 < step) steps[i].classList.add('completed');
      else if (i + 1 === step) steps[i].classList.add('active');
    }
    if (step >= total) { setTimeout(function() { if (progressEl) progressEl.classList.remove('active'); }, 3000); }
  }

  function addLog(message, type) {
    type = type || 'info';
    console.log('[Easy Seas] ' + message);
    var logEl = document.getElementById('easy-seas-log');
    if (logEl) {
      var entry = document.createElement('div');
      entry.className = 'es-log-entry es-log-' + type;
      entry.textContent = '[' + new Date().toLocaleTimeString() + '] ' + message;
      logEl.appendChild(entry);
      logEl.scrollTop = logEl.scrollHeight;
      if (logEl.children.length > 50) logEl.removeChild(logEl.firstChild);
    }
  }

  function toggleSync() {
    if (syncState.isRunning) { syncState.isRunning = false; addLog('Sync stopped', 'warning'); updateUI(); return; }
    if (!capturedData.isLoggedIn || !authContext) { addLog('Please log in first', 'error'); return; }
    runSync();
  }

  async function runSync() {
    syncState.isRunning = true;
    syncState.currentStep = 0;
    updateUI();
    addLog('Starting automated sync (mirrors iOS flow)...', 'info');
    var isCeleb = capturedData.cruiseLine === 'celebrity';
    var baseUrl = isCeleb ? 'https://www.celebritycruises.com' : 'https://www.royalcaribbean.com';
    var brand = isCeleb ? 'C' : 'R';
    var headers = { 'accept': 'application/json', 'content-type': 'application/json', 'account-id': authContext.accountId, 'authorization': authContext.token };
    if (authContext.appKey) { headers['appkey'] = authContext.appKey; headers['x-api-key'] = authContext.appKey; }
    try {
      syncState.currentStep = 1;
      updateProgress(1, 3, 'Step 1: Fetching casino offers...');
      addLog('Step 1: Calling casino offers API...', 'info');
      try {
        var offersUrl = baseUrl + (brand === 'C' ? '/api/casino/casino-offers/v2' : '/api/casino/casino-offers/v1');
        var offersResp = await fetch(offersUrl, {
          method: 'POST', headers: headers, credentials: 'omit',
          body: JSON.stringify({ cruiseLoyaltyId: authContext.loyaltyId, offerCode: '', brand: brand })
        });
        if (offersResp.ok) {
          var offersData = await offersResp.json();
          capturedData.offers = offersData;
          addLog('Captured ' + ((offersData.offers && offersData.offers.length) || 0) + ' casino offers', 'success');
          if (offersData.offers) {
            var emptyOffers = offersData.offers.filter(function(o) {
              return o && o.campaignOffer && o.campaignOffer.offerCode &&
                Array.isArray(o.campaignOffer.sailings) &&
                (o.campaignOffer.sailings.length === 0 || (o.campaignOffer.sailings[0] && o.campaignOffer.sailings[0].itineraryCode === null));
            });
            if (emptyOffers.length > 0) {
              addLog('Re-fetching ' + emptyOffers.length + ' offers with empty sailings...', 'info');
              for (var ei = 0; ei < emptyOffers.length; ei++) {
                if (!syncState.isRunning) break;
                var code = emptyOffers[ei].campaignOffer.offerCode.trim();
                try {
                  var rfResp = await fetch(offersUrl, { method: 'POST', headers: headers, credentials: 'omit',
                    body: JSON.stringify({ cruiseLoyaltyId: authContext.loyaltyId, offerCode: code, brand: brand }) });
                  if (rfResp.ok) {
                    var rfData = await rfResp.json();
                    var refreshed = rfData.offers && rfData.offers.find(function(o) { return o && o.campaignOffer && o.campaignOffer.offerCode === code; });
                    if (refreshed && refreshed.campaignOffer.sailings && refreshed.campaignOffer.sailings.length > 0) {
                      var origIdx = offersData.offers.findIndex(function(o) { return o && o.campaignOffer && o.campaignOffer.offerCode === code; });
                      if (origIdx !== -1) { offersData.offers[origIdx].campaignOffer.sailings = refreshed.campaignOffer.sailings; }
                    }
                  }
                } catch(rfe) {}
                await new Promise(function(r) { setTimeout(r, 300); });
              }
              capturedData.offers = offersData;
            }
            offersData.offers.forEach(function(offer) {
              var co = offer.campaignOffer || offer;
              addLog('  ' + (co.name || 'Offer') + ': ' + ((co.sailings || []).length) + ' sailings', 'info');
            });
          }
        } else {
          addLog('Offers API returned ' + offersResp.status, 'warning');
          if (offersResp.status === 403) { addLog('Session expired - please refresh and log in again', 'error'); syncState.isRunning = false; updateUI(); return; }
        }
      } catch(oe) { addLog('Offers fetch error: ' + oe.message, 'warning'); }
      if (!syncState.isRunning) { updateUI(); return; }

      syncState.currentStep = 2;
      updateProgress(2, 3, 'Step 2: Fetching booked cruises...');
      addLog('Step 2: Fetching booked cruises...', 'info');
      if (capturedData.upcomingCruises && extractBookings(capturedData.upcomingCruises).length > 0) {
        addLog('Using captured bookings (' + extractBookings(capturedData.upcomingCruises).length + ' cruises)', 'success');
      } else {
        var bookingsFound = false;
        var bookingsUrls = [baseUrl + '/api/profile/bookings', baseUrl + '/api/account/upcoming-cruises'];
        for (var bi = 0; bi < bookingsUrls.length && !bookingsFound; bi++) {
          try {
            var bResp = await fetch(bookingsUrls[bi], { method: 'GET', headers: headers, credentials: 'include' });
            if (bResp.ok) {
              var bData = await bResp.json();
              if (extractBookings(bData).length > 0) { capturedData.upcomingCruises = bData; bookingsFound = true;
                addLog('Captured ' + extractBookings(bData).length + ' bookings via API', 'success'); }
            }
          } catch(be) {}
        }
        if (!bookingsFound) {
          addLog('Navigating to bookings page to capture data...', 'info');
          await chrome.storage.local.set({ esSyncPending: true, esOffers: capturedData.offers, esLoyalty: capturedData.loyalty, esAuth: authContext, esCruiseLine: capturedData.cruiseLine });
          window.location.href = baseUrl + '/account/upcoming-cruises';
          return;
        }
      }
      if (!syncState.isRunning) { updateUI(); return; }
      await fetchLoyalty(headers, isCeleb);
      finishSync();
    } catch(err) { addLog('Sync error: ' + err.message, 'error'); syncState.isRunning = false; updateUI(); }
  }

  async function fetchLoyalty(headers, isCeleb) {
    syncState.currentStep = 3;
    updateProgress(3, 3, 'Step 3: Fetching loyalty status...');
    addLog('Step 3: Fetching loyalty status...', 'info');
    if (capturedData.loyalty) { addLog('Using captured loyalty data', 'success'); return; }
    try {
      var loyaltyUrl = isCeleb
        ? 'https://aws-prd.api.rccl.com/en/celebrity/web/v3/guestAccounts/' + encodeURIComponent(authContext.accountId)
        : 'https://aws-prd.api.rccl.com/en/royal/web/v1/guestAccounts/loyalty/info';
      var lResp = await fetch(loyaltyUrl, { method: 'GET', headers: headers, credentials: 'omit' });
      if (lResp.ok) { capturedData.loyalty = await lResp.json(); addLog('Captured loyalty data', 'success'); }
      else { addLog('Loyalty API returned ' + lResp.status, 'warning'); }
    } catch(le) { addLog('Loyalty fetch error: ' + le.message, 'warning'); }
  }

  function finishSync() {
    syncState.isRunning = false;
    var offers = capturedData.offers && capturedData.offers.offers ? capturedData.offers.offers.length : 0;
    var bookings = getBookingsCount();
    updateProgress(3, 3, 'Sync complete!');
    addLog('Sync complete! ' + offers + ' offers, ' + bookings + ' bookings' + (capturedData.loyalty ? ', loyalty captured' : ''), 'success');
    try { chrome.storage.local.set({ esLastData: capturedData, esLastSync: Date.now(), esSyncPending: false }); } catch(e) {}
    updateUI();
  }

  async function checkPendingSync() {
    try {
      var r = await chrome.storage.local.get(['esSyncPending', 'esOffers', 'esLoyalty', 'esAuth', 'esCruiseLine']);
      if (!r.esSyncPending) return;
      addLog('Resuming sync - waiting for bookings data...', 'info');
      if (r.esOffers) capturedData.offers = r.esOffers;
      if (r.esLoyalty) capturedData.loyalty = r.esLoyalty;
      if (r.esAuth) authContext = r.esAuth;
      if (r.esCruiseLine) capturedData.cruiseLine = r.esCruiseLine;
      capturedData.isLoggedIn = !!authContext;
      syncState.isRunning = true; syncState.currentStep = 2;
      updateProgress(2, 3, 'Waiting for bookings...'); updateUI();
      var waited = 0;
      while (waited < 15000) {
        if (extractBookings(capturedData.upcomingCruises).length > 0) break;
        await new Promise(function(resolve) { setTimeout(resolve, 1000); });
        waited += 1000;
      }
      if (extractBookings(capturedData.upcomingCruises).length > 0) { addLog('Captured ' + extractBookings(capturedData.upcomingCruises).length + ' bookings', 'success'); }
      else { addLog('No bookings captured after 15s', 'warning'); }
      var isCeleb = capturedData.cruiseLine === 'celebrity';
      var headers = { 'accept': 'application/json', 'content-type': 'application/json', 'account-id': authContext.accountId, 'authorization': authContext.token };
      if (authContext.appKey) { headers['appkey'] = authContext.appKey; headers['x-api-key'] = authContext.appKey; }
      await fetchLoyalty(headers, isCeleb);
      await chrome.storage.local.remove(['esSyncPending', 'esOffers', 'esLoyalty', 'esAuth', 'esCruiseLine']);
      finishSync();
    } catch(e) { console.error('[Easy Seas] Pending sync error:', e); try { await chrome.storage.local.remove(['esSyncPending']); } catch(ex) {} }
  }

  var SHIP_CODES = {
    'AL': 'Allure of the Seas', 'AN': 'Anthem of the Seas', 'AD': 'Adventure of the Seas',
    'BR': 'Brilliance of the Seas', 'FR': 'Freedom of the Seas', 'GR': 'Grandeur of the Seas',
    'HM': 'Harmony of the Seas', 'IC': 'Icon of the Seas', 'ID': 'Independence of the Seas',
    'JW': 'Jewel of the Seas', 'LB': 'Liberty of the Seas', 'MR': 'Mariner of the Seas',
    'NV': 'Navigator of the Seas', 'OA': 'Oasis of the Seas', 'OV': 'Ovation of the Seas',
    'OY': 'Odyssey of the Seas', 'QN': 'Quantum of the Seas', 'RD': 'Radiance of the Seas',
    'SE': 'Serenade of the Seas', 'SY': 'Symphony of the Seas', 'UT': 'Utopia of the Seas',
    'VI': 'Vision of the Seas', 'VY': 'Voyager of the Seas', 'WN': 'Wonder of the Seas'
  };
  var CABIN_TYPES = { 'I': 'Interior', 'O': 'Ocean View', 'B': 'Balcony', 'S': 'Suite' };

  function esc(v) {
    if (v == null) return '';
    var s = String(v);
    if (s.indexOf(',') !== -1 || s.indexOf('"') !== -1 || s.indexOf('\\n') !== -1) return '"' + s.replace(/"/g, '""') + '"';
    return s;
  }
  function fmtDate(d) {
    if (!d) return '';
    try { var dt = new Date(d); if (isNaN(dt.getTime())) return d;
      return String(dt.getMonth() + 1).padStart(2, '0') + '/' + String(dt.getDate()).padStart(2, '0') + '/' + dt.getFullYear();
    } catch(e) { return d; }
  }

  function downloadCSV() {
    addLog('Generating CSV...', 'info');
    var rows = [];
    if (capturedData.offers && capturedData.offers.offers) {
      rows.push(['Source Page','Offer Name','Offer Code','Offer Expiry','Ship Name','Sailing Date','Itinerary','Departure Port','Cabin Type','Guests','Perks'].map(esc).join(','));
      capturedData.offers.offers.forEach(function(offer) {
        var co = offer.campaignOffer || offer;
        (co.sailings || []).forEach(function(s) {
          rows.push([esc('Club Royale Offers'), esc(co.name || ''), esc(co.offerCode || ''), esc(fmtDate(co.reserveByDate)),
            esc(s.shipName || ''), esc(fmtDate(s.sailDate)), esc(s.itineraryDescription || ''),
            esc(s.departurePort && s.departurePort.name ? s.departurePort.name : ''),
            esc(s.roomType || ''), esc(s.isGOBO ? '1' : '2'), esc(co.tradeInValue ? '$' + co.tradeInValue : '')].join(','));
        });
      });
    }
    var bookings = extractBookings(capturedData.upcomingCruises);
    if (bookings.length > 0) {
      if (rows.length > 0) rows.push('');
      rows.push(['Source','Ship Name','Sail Date','Nights','Itinerary','Cabin Type','Cabin #','Booking ID','Status','Paid'].map(esc).join(','));
      bookings.forEach(function(b) {
        var sc = b.shipCode || '';
        var sn = SHIP_CODES[sc] || b.shipName || (sc ? sc + ' of the Seas' : '');
        var ct = CABIN_TYPES[b.stateroomType || ''] || b.stateroomType || '';
        var cn = b.stateroomNumber === 'GTY' ? 'GTY' : (b.stateroomNumber || '');
        var st = b.bookingStatus === 'OF' ? 'Courtesy Hold' : 'Upcoming';
        rows.push([esc(st), esc(sn), esc(fmtDate(b.sailDate)), esc(b.numberOfNights || ''),
          esc(b.cruiseTitle || (b.numberOfNights ? b.numberOfNights + ' Night Cruise' : '')),
          esc(ct), esc(cn), esc(b.bookingId || ''), esc(st), esc(b.paidInFull ? 'Yes' : 'No')].join(','));
      });
    }
    if (rows.length === 0) { addLog('No data to export', 'error'); return; }
    var csv = rows.join('\\n');
    var blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    var url = URL.createObjectURL(blob);
    var ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    var filename = 'easy-seas-' + capturedData.cruiseLine + '-' + ts + '.csv';
    var a = document.createElement('a');
    a.href = url; a.download = filename; a.style.display = 'none';
    document.body.appendChild(a); a.click();
    setTimeout(function() { document.body.removeChild(a); URL.revokeObjectURL(url); }, 200);
    addLog('CSV exported: ' + filename, 'success');
  }

  function watchForOverlayRemoval() {
    if (!document.body) { setTimeout(watchForOverlayRemoval, 300); return; }
    var observer = new MutationObserver(function() { ensureOverlay(); });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  function init() {
    injectPageScript();
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', function() {
        createOverlay(); watchForOverlayRemoval();
        addLog('Extension ready on ' + capturedData.cruiseLine, 'info');
        checkPendingSync();
      });
    } else {
      createOverlay(); watchForOverlayRemoval();
      addLog('Extension ready on ' + capturedData.cruiseLine, 'info');
      checkPendingSync();
    }
    setInterval(function() {
      ensureOverlay();
      if (!authContext) { checkAuthFromDOM(); window.postMessage({ source: 'easy-seas-ext', type: 'get_auth' }, '*'); updateUI(); }
    }, 5000);
  }

  init();
}();`;
}

function getOverlayCSS(): string {
  return `/* Easy Seas Floating Overlay */
#easy-seas-overlay {
  position: fixed !important;
  top: 20px !important;
  right: 20px !important;
  width: 400px !important;
  max-height: 600px !important;
  background: linear-gradient(135deg, #1e3a8a 0%, #0f172a 100%) !important;
  border-radius: 16px !important;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.1) !important;
  z-index: 2147483647 !important;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important;
  color: #fff !important;
  display: flex !important;
  flex-direction: column !important;
  overflow: hidden !important;
  backdrop-filter: blur(20px) !important;
}
#easy-seas-overlay * { box-sizing: border-box !important; margin: 0 !important; padding: 0 !important; }
#easy-seas-header { padding: 20px !important; border-bottom: 1px solid rgba(255, 255, 255, 0.1) !important; display: flex !important; align-items: center !important; gap: 12px !important; }
#easy-seas-icon { width: 32px !important; height: 32px !important; font-size: 24px !important; }
#easy-seas-title { flex: 1 !important; font-size: 18px !important; font-weight: 600 !important; color: #fff !important; }
#easy-seas-subtitle { font-size: 12px !important; color: rgba(255, 255, 255, 0.6) !important; margin-top: 4px !important; }
#easy-seas-content { padding: 20px !important; overflow-y: auto !important; max-height: 450px !important; }
#easy-seas-content::-webkit-scrollbar { width: 6px !important; }
#easy-seas-content::-webkit-scrollbar-track { background: rgba(255, 255, 255, 0.05) !important; border-radius: 3px !important; }
#easy-seas-content::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.2) !important; border-radius: 3px !important; }
.es-status-row { display: flex !important; justify-content: space-between !important; align-items: center !important; padding: 12px 0 !important; border-bottom: 1px solid rgba(255, 255, 255, 0.05) !important; }
.es-status-label { font-size: 13px !important; color: rgba(255, 255, 255, 0.7) !important; }
.es-status-value { font-size: 14px !important; font-weight: 600 !important; color: #fff !important; }
.es-badge { padding: 4px 10px !important; border-radius: 12px !important; font-size: 12px !important; font-weight: 600 !important; }
.es-badge-success { background: rgba(16, 185, 129, 0.2) !important; color: #10b981 !important; }
.es-badge-warning { background: rgba(245, 158, 11, 0.2) !important; color: #f59e0b !important; }
.es-badge-error { background: rgba(239, 68, 68, 0.2) !important; color: #ef4444 !important; }
.es-badge-info { background: rgba(59, 130, 246, 0.2) !important; color: #3b82f6 !important; }
#easy-seas-progress { margin: 16px 0 !important; display: none !important; }
#easy-seas-progress.active { display: block !important; }
.es-progress-bar { height: 6px !important; background: rgba(255, 255, 255, 0.1) !important; border-radius: 3px !important; overflow: hidden !important; margin-bottom: 12px !important; }
.es-progress-fill { height: 100% !important; background: linear-gradient(90deg, #3b82f6, #10b981) !important; border-radius: 3px !important; transition: width 0.3s ease !important; width: 0% !important; }
.es-progress-text { font-size: 12px !important; color: rgba(255, 255, 255, 0.7) !important; text-align: center !important; margin-bottom: 8px !important; }
.es-step-indicator { display: flex !important; gap: 8px !important; margin-bottom: 12px !important; }
.es-step { flex: 1 !important; height: 4px !important; background: rgba(255, 255, 255, 0.1) !important; border-radius: 2px !important; transition: background 0.3s ease !important; }
.es-step.completed { background: #10b981 !important; }
.es-step.active { background: #3b82f6 !important; animation: pulse 1.5s ease-in-out infinite !important; }
@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
#easy-seas-buttons { display: flex !important; gap: 12px !important; margin-top: 20px !important; }
.es-button { flex: 1 !important; padding: 12px 20px !important; border: none !important; border-radius: 8px !important; font-size: 14px !important; font-weight: 600 !important; cursor: pointer !important; transition: all 0.2s ease !important; display: flex !important; align-items: center !important; justify-content: center !important; gap: 8px !important; }
.es-button:disabled { opacity: 0.5 !important; cursor: not-allowed !important; }
.es-button-primary { background: #10b981 !important; color: #fff !important; }
.es-button-primary:hover:not(:disabled) { background: #059669 !important; transform: translateY(-1px) !important; }
.es-button-secondary { background: rgba(59, 130, 246, 0.2) !important; color: #3b82f6 !important; border: 1px solid #3b82f6 !important; }
.es-button-secondary:hover:not(:disabled) { background: rgba(59, 130, 246, 0.3) !important; }
.es-button-stop { background: rgba(239, 68, 68, 0.2) !important; color: #ef4444 !important; border: 1px solid #ef4444 !important; }
.es-button-stop:hover:not(:disabled) { background: rgba(239, 68, 68, 0.3) !important; }
.es-spinner { width: 14px !important; height: 14px !important; border: 2px solid rgba(255, 255, 255, 0.3) !important; border-top-color: #fff !important; border-radius: 50% !important; animation: spin 0.8s linear infinite !important; }
@keyframes spin { to { transform: rotate(360deg); } }
#easy-seas-log { margin-top: 16px !important; max-height: 120px !important; overflow-y: auto !important; padding: 12px !important; background: rgba(0, 0, 0, 0.3) !important; border-radius: 8px !important; font-size: 11px !important; font-family: 'Monaco', 'Menlo', monospace !important; color: rgba(255, 255, 255, 0.7) !important; line-height: 1.6 !important; }
#easy-seas-log::-webkit-scrollbar { width: 4px !important; }
#easy-seas-log::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.2) !important; border-radius: 2px !important; }
.es-log-entry { margin-bottom: 4px !important; padding: 4px 0 !important; }
.es-log-success { color: #10b981 !important; }
.es-log-warning { color: #f59e0b !important; }
.es-log-error { color: #ef4444 !important; }
.es-log-info { color: #3b82f6 !important; }`;
}

export async function downloadScraperExtension(): Promise<{ success: boolean; error?: string; filesAdded?: number }> {
  if (Platform.OS !== 'web') {
    console.log('[ChromeExtension] Download only available on web');
    return { success: false, error: 'Download only available on web browser' };
  }

  try {
    console.log('[ChromeExtension] Creating Easy Seas Sync extension ZIP...');
    const zip = new JSZip();

    const extensionFiles = getEasySeasExtensionFiles();

    for (const [filename, content] of Object.entries(extensionFiles)) {
      zip.file(filename, content);
      console.log(`[ChromeExtension] Added ${filename}`);
    }

    const icon16 = createPlaceholderIcon('ES', '#1e3a8a', 16);
    const icon48 = createPlaceholderIcon('ES', '#1e3a8a', 48);
    const icon128 = createPlaceholderIcon('ES', '#1e3a8a', 128);
    zip.file('icons/icon16.png', icon16);
    zip.file('icons/icon48.png', icon48);
    zip.file('icons/icon128.png', icon128);
    console.log('[ChromeExtension] Added extension icons');

    const fileCount = Object.keys(zip.files).length;
    console.log(`[ChromeExtension] Generating Easy Seas Sync ZIP with ${fileCount} files...`);
    const blob = await zip.generateAsync({ type: 'blob' });

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Easy Seas Sync.zip`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    console.log('[ChromeExtension] Easy Seas Sync extension download initiated successfully');
    return { success: true, filesAdded: fileCount };
  } catch (error) {
    console.error('[ChromeExtension] Error creating extension ZIP:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    };
  }
}

export async function downloadChromeExtension(): Promise<{ success: boolean; error?: string; filesAdded?: number }> {
  return downloadScraperExtension();
}

function createPlaceholderIcon(text: string = 'ES', bgColor: string = '#1e3a8a', size: number = 128): Uint8Array {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');

  if (ctx) {
    const radius = size * 0.2;
    ctx.beginPath();
    ctx.moveTo(radius, 0);
    ctx.lineTo(size - radius, 0);
    ctx.quadraticCurveTo(size, 0, size, radius);
    ctx.lineTo(size, size - radius);
    ctx.quadraticCurveTo(size, size, size - radius, size);
    ctx.lineTo(radius, size);
    ctx.quadraticCurveTo(0, size, 0, size - radius);
    ctx.lineTo(0, radius);
    ctx.quadraticCurveTo(0, 0, radius, 0);
    ctx.closePath();
    ctx.fillStyle = bgColor;
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    const fontSize = Math.round(size * 0.375);
    ctx.font = `bold ${fontSize}px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, size / 2, size / 2);
  }

  const dataUrl = canvas.toDataURL('image/png');
  const base64 = dataUrl.split(',')[1];
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}
