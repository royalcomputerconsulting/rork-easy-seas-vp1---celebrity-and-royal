import JSZip from 'jszip';
import { Platform } from 'react-native';

const EASY_SEAS_EXTENSION_VERSION = '3.1.0';

function getEasySeasExtensionFiles(): Record<string, string> {
  const manifestContent = `{
  "manifest_version": 3,
  "name": "Easy Seas\u2122 \u2014 Sync Extension",
  "version": "3.1.0",
  "description": "Syncs casino offers, booked cruises, and loyalty data from Royal Caribbean & Celebrity Cruises websites via direct API calls.",
  "permissions": [
    "storage",
    "downloads",
    "tabs"
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
  return `console.log('[Easy Seas BG] Service worker v3.1 initialized');

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
  // Open multiple background tabs for data capture
  if (request.type === 'open_sync_tabs') {
    var urls = request.urls || [];
    var opened = 0;
    var tabIds = [];
    if (urls.length === 0) { sendResponse({ success: true, tabIds: [] }); return true; }
    urls.forEach(function(url) {
      chrome.tabs.create({ url: url, active: false }, function(tab) {
        tabIds.push(tab.id);
        opened++;
        // Auto-close each tab after 28 seconds
        setTimeout(function() {
          chrome.tabs.remove(tab.id, function() {});
        }, 28000);
        if (opened === urls.length) {
          sendResponse({ success: true, tabIds: tabIds });
        }
      });
    });
    return true;
  }
  // Close the tab that sent this message
  if (request.type === 'close_self') {
    if (sender.tab && sender.tab.id) {
      chrome.tabs.remove(sender.tab.id, function() {});
    }
    sendResponse({ success: true });
    return true;
  }
});

chrome.runtime.onInstalled.addListener(function() {
  console.log('[Easy Seas BG] Extension installed/updated v3.1');
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
          c.json().then(function(d) { post('api_captured', { key: 'offers', data: d, url: url }); }).catch(function(){});
        if (url.indexOf('/profileBookings/enriched') !== -1 || url.indexOf('/api/account/upcoming-cruises') !== -1 || url.indexOf('/api/profile/bookings') !== -1 || url.indexOf('/upcomingCruises') !== -1)
          c.json().then(function(d) { post('api_captured', { key: 'upcomingCruises', data: d, url: url }); }).catch(function(){});
        if (url.indexOf('/api/account/courtesy-holds') !== -1 || url.indexOf('/courtesyHolds') !== -1)
          c.json().then(function(d) { post('api_captured', { key: 'courtesyHolds', data: d, url: url }); }).catch(function(){});
        if (url.indexOf('/guestAccounts/loyalty') !== -1 || url.indexOf('/loyalty/info') !== -1 || url.indexOf('/loyalty-programs') !== -1 || url.indexOf('/account/loyalty') !== -1)
          c.json().then(function(d) { post('api_captured', { key: 'loyalty', data: d, url: url }); }).catch(function(){});
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
        var u = x.__esUrl || x.responseURL || '';
        if (!u || x.status < 200 || x.status >= 300) return;
        var d = JSON.parse(x.responseText);
        if (u.indexOf('/api/casino/casino-offers') !== -1) post('api_captured', { key: 'offers', data: d, url: u });
        if (u.indexOf('/profileBookings/enriched') !== -1 || u.indexOf('/api/account/upcoming-cruises') !== -1 || u.indexOf('/api/profile/bookings') !== -1 || u.indexOf('/upcomingCruises') !== -1) post('api_captured', { key: 'upcomingCruises', data: d, url: u });
        if (u.indexOf('/api/account/courtesy-holds') !== -1 || u.indexOf('/courtesyHolds') !== -1) post('api_captured', { key: 'courtesyHolds', data: d, url: u });
        if (u.indexOf('/guestAccounts/loyalty') !== -1 || u.indexOf('/loyalty/info') !== -1 || u.indexOf('/loyalty-programs') !== -1 || u.indexOf('/account/loyalty') !== -1) post('api_captured', { key: 'loyalty', data: d, url: u });
      } catch(e) {}
    });
    return oS.apply(this, arguments);
  };
  window.addEventListener('message', function(e) {
    if (e.data && e.data.source === 'easy-seas-ext' && e.data.type === 'get_auth') sendAuth();
  });
  sendAuth();
  setTimeout(sendAuth, 2000);
  setTimeout(sendAuth, 6000);
})();`;
}

function getContentJS(): string {
  return `void function() {
  'use strict';
  if (window.__easySeasLoaded) return;
  window.__easySeasLoaded = true;

  var path = window.location.pathname;
  var hostname = window.location.hostname;

  // Determine if this is the main overlay page or a helper capture page
  var IS_MAIN_PAGE = (
    path.indexOf('/club-royale') !== -1 ||
    path.indexOf('/blue-chip-club') !== -1
  );
  var IS_HELPER_PAGE = !IS_MAIN_PAGE && (
    path.indexOf('/account') !== -1 ||
    path.indexOf('/loyalty') !== -1
  );

  console.log('[Easy Seas v3.1] Loaded on', path, '| main:', IS_MAIN_PAGE, '| helper:', IS_HELPER_PAGE);

  var authContext = null;
  var capturedData = {
    offers: null, upcomingCruises: null, courtesyHolds: null, loyalty: null,
    isLoggedIn: false,
    cruiseLine: hostname.includes('celebrity') ? 'celebrity' : 'royal'
  };
  var syncState = { isRunning: false, currentStep: 0, totalSteps: 5 };
  var overlayElement = null;

  function injectPageScript() {
    if (window.__easySeasPageScriptInjected) return;
    window.__easySeasPageScriptInjected = true;
    var s = document.createElement('script');
    s.src = chrome.runtime.getURL('page-script.js');
    s.onload = function() { s.remove(); };
    s.onerror = function() { s.remove(); };
    (document.head || document.documentElement).appendChild(s);
  }

  // Listen for messages from page-script.js (page world)
  window.addEventListener('message', function(e) {
    if (!e.data || e.data.source !== 'easy-seas-page') return;

    if (e.data.type === 'auth_data') {
      if (e.data.auth && e.data.auth.token && e.data.auth.accountId) {
        authContext = {
          token: e.data.auth.token,
          accountId: e.data.auth.accountId,
          loyaltyId: e.data.auth.loyaltyId || '',
          firstName: e.data.auth.firstName || '',
          appKey: e.data.appKey || ''
        };
        capturedData.isLoggedIn = true;
        if (!IS_HELPER_PAGE) {
          addLog('User logged in' + (authContext.firstName ? ' as ' + authContext.firstName : ''), 'success');
          updateUI();
        }
      }
    }

    if (e.data.type === 'api_captured' && e.data.data) {
      var key = e.data.key;
      var data = e.data.data;
      var url = e.data.url || '';
      capturedData[key] = data;

      if (!IS_HELPER_PAGE) {
        var cnt = countItems(key, data);
        addLog('Captured ' + key + (cnt ? ' (' + cnt + ' items)' : '') + (url ? ' from ' + url.replace(/https:\\/\\/[^/]+/, '') : ''), 'success');
        updateUI();
      }

      // Always store captured data in chrome.storage so other tabs can see it
      try {
        var storageObj = {};
        storageObj['es_' + key] = data;
        storageObj['es_' + key + '_ts'] = Date.now();
        chrome.storage.local.set(storageObj);
      } catch(ex) {}

      // If this is a helper page, close self after storing data
      if (IS_HELPER_PAGE) {
        var helperKeys = ['upcomingCruises', 'courtesyHolds', 'loyalty'];
        var allDone = helperKeys.every(function(k) { return capturedData[k] !== null; }) ||
                      (capturedData.upcomingCruises !== null && capturedData.loyalty !== null);
        if (allDone) {
          setTimeout(function() { closeSelf(); }, 1000);
        }
      }
    }
  });

  function closeSelf() {
    try {
      window.close();
    } catch(e) {
      try { chrome.runtime.sendMessage({ type: 'close_self' }); } catch(ex) {}
    }
  }

  // ─── HELPER PAGE BEHAVIOR ───────────────────────────────────────
  if (IS_HELPER_PAGE) {
    // Check if there's an active sync before doing anything
    try {
      chrome.storage.local.get(['esSyncActive', 'esSyncTimestamp'], function(result) {
        if (!result.esSyncActive) return;
        var age = Date.now() - (result.esSyncTimestamp || 0);
        if (age > 120000) return; // Sync is too old
        // Inject page script to capture API calls
        injectPageScript();
        // Auto-close after 25s regardless
        setTimeout(function() { closeSelf(); }, 25000);
      });
    } catch(e) {
      injectPageScript();
    }
    return; // No overlay on helper pages
  }

  // ─── MAIN PAGE BEHAVIOR (club-royale / blue-chip) ───────────────
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
      '<div class="es-step" data-step="4"></div>' +
      '<div class="es-step" data-step="5"></div>' +
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
      '<div class="es-status-row"><span class="es-status-label">Loyalty</span>' +
      '<span class="es-status-value" id="loyalty-status">--</span></div>' +
      '<div class="es-status-row"><span class="es-status-label">Cruise Line</span>' +
      '<span class="es-status-value" id="cruise-line">Royal Caribbean</span></div>' +
      '<div id="easy-seas-buttons">' +
      '<button class="es-button es-button-primary" id="sync-btn" disabled><span>START SYNC</span></button>' +
      '<button class="es-button es-button-secondary" id="download-btn" disabled><span>DOWNLOAD CSVs</span></button>' +
      '</div>' +
      '<div id="easy-seas-log"></div></div>';
    document.body.appendChild(overlay);
    overlayElement = overlay;
    document.getElementById('sync-btn').addEventListener('click', toggleSync);
    document.getElementById('download-btn').addEventListener('click', downloadCSVs);
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
    var loyaltyEl = document.getElementById('loyalty-status');
    if (loyaltyEl) loyaltyEl.textContent = capturedData.loyalty ? 'Captured' : '--';
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
      if (logEl.children.length > 60) logEl.removeChild(logEl.firstChild);
    }
  }

  function toggleSync() {
    if (syncState.isRunning) { syncState.isRunning = false; addLog('Sync stopped', 'warning'); updateUI(); return; }
    if (!capturedData.isLoggedIn || !authContext) { addLog('Please log in first', 'error'); return; }
    runSync();
  }

  function buildHeaders() {
    var headers = {
      'accept': 'application/json',
      'content-type': 'application/json',
      'account-id': authContext.accountId,
      'authorization': authContext.token
    };
    if (authContext.appKey) {
      headers['appkey'] = authContext.appKey;
      headers['x-api-key'] = authContext.appKey;
    }
    return headers;
  }

  // Opens real browser tabs (NOT iframes) for passive API capture
  function openRealTabs(urls) {
    return new Promise(function(resolve) {
      try {
        chrome.runtime.sendMessage({ type: 'open_sync_tabs', urls: urls }, function(response) {
          resolve(response || { success: true });
        });
      } catch(e) {
        // Fallback: window.open (may be blocked by popup blocker but worth trying)
        urls.forEach(function(url) {
          try { window.open(url, '_blank', 'width=1,height=1'); } catch(ex) {}
        });
        resolve({ success: true });
      }
    });
  }

  // Poll chrome.storage for data captured by helper tabs
  function pollForHelperData(timeoutMs) {
    timeoutMs = timeoutMs || 30000;
    return new Promise(function(resolve) {
      var end = Date.now() + timeoutMs;
      var lastBookingTs = 0;
      var lastLoyaltyTs = 0;
      var lastHoldsTs = 0;

      function poll() {
        if (!syncState.isRunning) { resolve(); return; }
        try {
          chrome.storage.local.get(
            ['es_upcomingCruises', 'es_upcomingCruises_ts', 'es_courtesyHolds', 'es_courtesyHolds_ts', 'es_loyalty', 'es_loyalty_ts'],
            function(result) {
              // Grab new data only if timestamp is more recent than what we last saw
              if (result.es_upcomingCruises && (result.es_upcomingCruises_ts || 0) > lastBookingTs) {
                lastBookingTs = result.es_upcomingCruises_ts || Date.now();
                capturedData.upcomingCruises = result.es_upcomingCruises;
                var cnt = extractBookings(capturedData.upcomingCruises).length;
                addLog('\\u2705 Helper tab captured ' + cnt + ' bookings', 'success');
                updateUI();
              }
              if (result.es_courtesyHolds && (result.es_courtesyHolds_ts || 0) > lastHoldsTs) {
                lastHoldsTs = result.es_courtesyHolds_ts || Date.now();
                capturedData.courtesyHolds = result.es_courtesyHolds;
                var holdCnt = 0;
                if (capturedData.courtesyHolds.payload && capturedData.courtesyHolds.payload.sailingInfo) holdCnt = capturedData.courtesyHolds.payload.sailingInfo.length;
                else if (capturedData.courtesyHolds.sailingInfo) holdCnt = capturedData.courtesyHolds.sailingInfo.length;
                addLog('\\u2705 Helper tab captured ' + holdCnt + ' courtesy holds', 'success');
                updateUI();
              }
              if (result.es_loyalty && (result.es_loyalty_ts || 0) > lastLoyaltyTs) {
                lastLoyaltyTs = result.es_loyalty_ts || Date.now();
                capturedData.loyalty = result.es_loyalty;
                addLog('\\u2705 Helper tab captured loyalty data', 'success');
                updateUI();
              }

              var haveBookings = extractBookings(capturedData.upcomingCruises).length > 0;
              var haveLoyalty = !!capturedData.loyalty;

              if ((haveBookings && haveLoyalty) || Date.now() >= end) {
                if (!haveBookings) addLog('No booking data captured - you may have no upcoming cruises', 'warning');
                if (!haveLoyalty) addLog('Loyalty data not captured - will try direct API', 'warning');
                resolve();
              } else {
                setTimeout(poll, 1500);
              }
            }
          );
        } catch(e) {
          if (Date.now() >= end) resolve(); else setTimeout(poll, 1500);
        }
      }
      poll();
    });
  }

  async function fetchWithRetry(url, options, retries) {
    retries = retries || 2;
    for (var i = 0; i <= retries; i++) {
      try {
        var resp = await fetch(url, options);
        if (resp.ok) return resp;
        if (resp.status === 403 || resp.status === 401) {
          addLog('Auth error (' + resp.status + ') on attempt ' + (i + 1), 'warning');
          if (i < retries) await new Promise(function(r) { setTimeout(r, 1500); });
        } else {
          if (i < retries) await new Promise(function(r) { setTimeout(r, 1000); });
        }
      } catch(e) {
        addLog('Network error: ' + (e.message || 'unknown'), 'warning');
        if (i < retries) await new Promise(function(r) { setTimeout(r, 1000); });
      }
    }
    return null;
  }

  async function fetchLoyaltyDirect(headers, isCeleb) {
    try {
      var loyaltyUrl = isCeleb
        ? 'https://aws-prd.api.rccl.com/en/celebrity/web/v3/guestAccounts/' + encodeURIComponent(authContext.accountId)
        : 'https://aws-prd.api.rccl.com/en/royal/web/v1/guestAccounts/loyalty/info';
      addLog('Calling loyalty API directly: ' + loyaltyUrl.replace(/https:\\/\\/[^/]+/, ''), 'info');
      var lResp = await fetchWithRetry(loyaltyUrl, {
        method: 'GET',
        headers: headers,
        credentials: 'omit'
      });
      if (lResp) {
        capturedData.loyalty = await lResp.json();
        addLog('\\u2705 Captured loyalty data via direct API call', 'success');
        try {
          chrome.storage.local.set({ es_loyalty: capturedData.loyalty, es_loyalty_ts: Date.now() });
        } catch(ex) {}
        return true;
      } else {
        addLog('Loyalty direct API returned no response', 'warning');
        return false;
      }
    } catch(le) {
      addLog('Loyalty direct fetch error: ' + (le.message || ''), 'warning');
      return false;
    }
  }

  async function runSync() {
    syncState.isRunning = true;
    syncState.currentStep = 0;
    syncState.totalSteps = 5;
    updateUI();

    // Clear any old helper data from previous syncs
    try {
      chrome.storage.local.remove(['es_upcomingCruises', 'es_upcomingCruises_ts', 'es_courtesyHolds', 'es_courtesyHolds_ts', 'es_loyalty', 'es_loyalty_ts', 'esSyncActive', 'esSyncTimestamp']);
    } catch(e) {}

    // Reset captured data
    capturedData.upcomingCruises = null;
    capturedData.courtesyHolds = null;
    capturedData.loyalty = null;
    pricingCache = {};

    addLog('Starting automated sync v3.1 (multi-tab mode)...', 'info');
    var isCeleb = capturedData.cruiseLine === 'celebrity';
    var baseUrl = isCeleb ? 'https://www.celebritycruises.com' : 'https://www.royalcaribbean.com';
    var brand = isCeleb ? 'C' : 'R';
    var headers = buildHeaders();

    try {
      // ── STEP 1: Casino Offers ──────────────────────────────────────
      syncState.currentStep = 1;
      updateProgress(1, 5, 'Step 1/5: Fetching casino offers...');
      addLog('Step 1: Calling casino offers API...', 'info');

      try {
        var offersUrl = baseUrl + (brand === 'C' ? '/api/casino/casino-offers/v2' : '/api/casino/casino-offers/v1');
        var offersResp = await fetchWithRetry(offersUrl, {
          method: 'POST',
          headers: headers,
          credentials: 'omit',
          body: JSON.stringify({ cruiseLoyaltyId: authContext.loyaltyId, offerCode: '', brand: brand })
        });
        if (offersResp) {
          var offersData = await offersResp.json();
          capturedData.offers = offersData;
          var offerCount = (offersData.offers && offersData.offers.length) || 0;
          addLog('\\u2705 Captured ' + offerCount + ' casino offers', 'success');

          // Re-fetch offers with empty sailings
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
                  var rfResp = await fetch(offersUrl, {
                    method: 'POST', headers: headers, credentials: 'omit',
                    body: JSON.stringify({ cruiseLoyaltyId: authContext.loyaltyId, offerCode: code, brand: brand })
                  });
                  if (rfResp.ok) {
                    var rfData = await rfResp.json();
                    var refreshed = rfData.offers && rfData.offers.find(function(o) { return o && o.campaignOffer && o.campaignOffer.offerCode === code; });
                    if (refreshed && refreshed.campaignOffer.sailings && refreshed.campaignOffer.sailings.length > 0) {
                      var origIdx = offersData.offers.findIndex(function(o) { return o && o.campaignOffer && o.campaignOffer.offerCode === code; });
                      if (origIdx !== -1) offersData.offers[origIdx].campaignOffer.sailings = refreshed.campaignOffer.sailings;
                      addLog('  ' + code + ': ' + refreshed.campaignOffer.sailings.length + ' sailings', 'success');
                    }
                  }
                } catch(rfe) {}
                await new Promise(function(r) { setTimeout(r, 300); });
              }
              capturedData.offers = offersData;
            }
            offersData.offers.forEach(function(offer) {
              var co = offer.campaignOffer || offer;
              addLog('  ' + (co.name || co.offerCode || 'Offer') + ': ' + ((co.sailings || []).length) + ' sailings', 'info');
            });
          }
        } else {
          addLog('Offers API failed - using passively captured offers if available', 'warning');
        }
      } catch(oe) {
        addLog('Offers fetch error: ' + (oe.message || ''), 'warning');
      }

      if (!syncState.isRunning) { updateUI(); return; }

      // ── STEP 1.5: Fetch pricing & itinerary (public GraphQL) ───────
      if (capturedData.offers && capturedData.offers.offers && capturedData.offers.offers.length > 0) {
        await fetchOfferPricing(capturedData.offers.offers);
      } else {
        addLog('Skipped pricing fetch (no offers captured)', 'warning');
      }

      if (!syncState.isRunning) { updateUI(); return; }

      // ── STEP 2: Open REAL tabs (not iframes!) ─────────────────────
      syncState.currentStep = 2;
      updateProgress(2, 5, 'Step 2/5: Opening account pages in new tabs...');

      // Mark sync as active in storage so helper tabs know to capture
      try {
        chrome.storage.local.set({ esSyncActive: true, esSyncTimestamp: Date.now() });
      } catch(e) {}

      var pagesToOpen = isCeleb ? [
        baseUrl + '/account/upcoming-cruises',
        baseUrl + '/account/courtesy-holds',
        baseUrl + '/account/loyalty-programs'
      ] : [
        baseUrl + '/account',
        baseUrl + '/account/upcoming-cruises',
        baseUrl + '/account/courtesy-holds',
        baseUrl + '/account/club-royale',
        baseUrl + '/account/loyalty-programs'
      ];

      addLog('Step 2: Opening ' + pagesToOpen.length + ' background tabs to capture API data...', 'info');
      addLog('  (This replaces hidden iframes - real tabs capture real API calls)', 'info');
      pagesToOpen.forEach(function(u) {
        addLog('  \\u25b6 ' + u.replace(/https:\\/\\/www\\.[^/]+/, ''), 'info');
      });

      await openRealTabs(pagesToOpen);
      addLog('Background tabs opened - polling for captured data...', 'info');

      // Poll chrome.storage for data from helper tabs (up to 35s)
      await pollForHelperData(35000);

      if (!syncState.isRunning) { updateUI(); return; }

      // ── STEP 3: Courtesy Holds (direct fallback) ───────────────────
      syncState.currentStep = 3;
      updateProgress(3, 5, 'Step 3/5: Checking courtesy holds...');
      addLog('Step 3: Checking courtesy holds...', 'info');

      if (!capturedData.courtesyHolds) {
        try {
          var chResp = await fetchWithRetry(baseUrl + '/api/account/courtesy-holds', {
            method: 'GET',
            headers: headers,
            credentials: 'include'
          });
          if (chResp) {
            var chData = await chResp.json();
            capturedData.courtesyHolds = chData;
            var holdCount = 0;
            if (chData.payload && chData.payload.sailingInfo) holdCount = chData.payload.sailingInfo.length;
            else if (chData.sailingInfo) holdCount = chData.sailingInfo.length;
            addLog('\\u2705 Captured ' + holdCount + ' courtesy holds via direct API', 'success');
          } else {
            addLog('Courtesy holds: no response (may have none)', 'info');
          }
        } catch(che) {
          addLog('Courtesy holds API: ' + (che.message || ''), 'info');
        }
      } else {
        var heldCount = 0;
        if (capturedData.courtesyHolds.payload && capturedData.courtesyHolds.payload.sailingInfo)
          heldCount = capturedData.courtesyHolds.payload.sailingInfo.length;
        addLog('\\u2705 Using courtesy holds from helper tab (' + heldCount + ')', 'success');
      }

      if (!syncState.isRunning) { updateUI(); return; }

      // ── STEP 4: Loyalty (direct API fallback if helper tabs missed it) ──
      syncState.currentStep = 4;
      updateProgress(4, 5, 'Step 4/5: Fetching loyalty data...');
      addLog('Step 4: Checking loyalty data...', 'info');

      if (!capturedData.loyalty) {
        addLog('Loyalty not captured by helper tabs - trying direct API...', 'info');
        await fetchLoyaltyDirect(headers, isCeleb);
      } else {
        addLog('\\u2705 Loyalty data available from helper tabs', 'success');
      }

      if (capturedData.loyalty) {
        var loyaltyInfo = capturedData.loyalty.payload && capturedData.loyalty.payload.loyaltyInformation
          ? capturedData.loyalty.payload.loyaltyInformation
          : (capturedData.loyalty.loyaltyInformation || capturedData.loyalty);
        if (loyaltyInfo) {
          var tier = loyaltyInfo.crownAndAnchorSocietyLoyaltyTier || loyaltyInfo.crownAndAnchorLevel || '';
          var points = loyaltyInfo.crownAndAnchorSocietyCurrentPoints || loyaltyInfo.crownAndAnchorPoints || '';
          var casinoTier = loyaltyInfo.clubRoyaleLoyaltyTier || loyaltyInfo.clubRoyaleLevel || '';
          if (tier) addLog('  Crown & Anchor: ' + tier + (points ? ' (' + points + ' pts)' : ''), 'info');
          if (casinoTier) addLog('  Club Royale: ' + casinoTier, 'info');
        }
      } else {
        addLog('Loyalty data unavailable - syncing without it', 'warning');
      }

      if (!syncState.isRunning) { updateUI(); return; }

      // ── STEP 5: Verify & Finalize ──────────────────────────────────
      syncState.currentStep = 5;
      updateProgress(5, 5, 'Step 5/5: Finalizing sync...');
      addLog('Step 5: Verifying captured sections...', 'info');

      var missing = [];
      if (!capturedData.offers || !capturedData.offers.offers || capturedData.offers.offers.length === 0) missing.push('offers');
      if (extractBookings(capturedData.upcomingCruises).length === 0) missing.push('upcomingCruises');
      if (!capturedData.loyalty) missing.push('loyalty');

      if (missing.length > 0) {
        addLog('Missing sections: ' + missing.join(', '), 'warning');
      } else {
        addLog('\\u2705 All sections captured successfully!', 'success');
      }

      finishSync();

    } catch(err) {
      addLog('Sync error: ' + (err.message || String(err)), 'error');
      syncState.isRunning = false;
      updateUI();
    } finally {
      // Clean up sync state from storage
      try {
        chrome.storage.local.remove(['esSyncActive', 'esSyncTimestamp']);
      } catch(e) {}
    }
  }

  function finishSync() {
    syncState.isRunning = false;
    var offers = capturedData.offers && capturedData.offers.offers ? capturedData.offers.offers.length : 0;
    var bookings = getBookingsCount();
    updateProgress(5, 5, 'Sync complete!');
    addLog('\\u2705 Sync complete! ' + offers + ' offers, ' + bookings + ' bookings' + (capturedData.loyalty ? ', loyalty captured' : ', no loyalty'), 'success');
    try {
      chrome.storage.local.set({
        esLastData: capturedData,
        esLastSync: Date.now(),
        esSyncPending: false
      });
    } catch(e) {}
    updateUI();
  }

  var SHIP_CODES = {
    'AL': 'Allure of the Seas', 'AN': 'Anthem of the Seas', 'AD': 'Adventure of the Seas',
    'BR': 'Brilliance of the Seas', 'FR': 'Freedom of the Seas', 'GR': 'Grandeur of the Seas',
    'HM': 'Harmony of the Seas', 'IC': 'Icon of the Seas', 'ID': 'Independence of the Seas',
    'JW': 'Jewel of the Seas', 'LB': 'Liberty of the Seas', 'MR': 'Mariner of the Seas',
    'NV': 'Navigator of the Seas', 'OA': 'Oasis of the Seas', 'OV': 'Ovation of the Seas',
    'OY': 'Odyssey of the Seas', 'QN': 'Quantum of the Seas', 'RD': 'Radiance of the Seas',
    'SE': 'Serenade of the Seas', 'SY': 'Symphony of the Seas', 'UT': 'Utopia of the Seas',
    'VI': 'Vision of the Seas', 'VY': 'Voyager of the Seas', 'WN': 'Wonder of the Seas',
    'SN': 'Star of the Seas'
  };
  var CABIN_TYPES = { 'I': 'Interior', 'O': 'Ocean View', 'B': 'Balcony', 'S': 'Suite' };
  var pricingCache = {};

  function esc(v) {
    if (v == null) return '';
    var s = String(v);
    if (s.indexOf(',') !== -1 || s.indexOf('"') !== -1 || s.indexOf('\\n') !== -1) return '"' + s.replace(/"/g, '""') + '"';
    return s;
  }
  function fmtDate(d) {
    if (!d) return '';
    try {
      var dt = new Date(d);
      if (isNaN(dt.getTime())) return d;
      return String(dt.getMonth() + 1).padStart(2, '0') + '/' + String(dt.getDate()).padStart(2, '0') + '/' + dt.getFullYear();
    } catch(e) { return d; }
  }
  function fmtPrice(val) {
    if (val == null || val === '') return '';
    var n = Number(val);
    if (!isFinite(n) || n <= 0) return '';
    return '$' + n.toLocaleString();
  }
  function getOfferTypeStr(co) {
    var t = co.offerType || co.type;
    if (!t) return 'Free Play';
    if (typeof t === 'string' && t.trim()) return t.trim();
    if (typeof t === 'object') {
      var str = t.name || t.label || t.description || t.code || t.value || t.typeName || t.text || t.displayName || t.title;
      if (str && typeof str === 'string') return str;
      try {
        var vals = Object.values(t);
        for (var vi = 0; vi < vals.length; vi++) {
          if (typeof vals[vi] === 'string' && vals[vi].trim()) return vals[vi].trim();
        }
      } catch(e) {}
      return 'Free Play';
    }
    var s2 = String(t);
    return (s2 && s2 !== '[object Object]') ? s2 : 'Free Play';
  }
  function getNightsFromItinerary(itinerary) {
    if (!itinerary) return '';
    var m = itinerary.match(/^\s*(\d+)\s*N(?:IGHT|T)?S?\b/i);
    return m ? m[1] : '';
  }
  function resolveStateroomCategory(code) {
    var up = String(code || '').trim().toUpperCase().replace(/\s+/g, ' ');
    if (['I','IN','INT','INSIDE','INTERIOR'].indexOf(up) !== -1) return 'INTERIOR';
    if (['O','OV','OB','E','OCEAN','OCEANVIEW','OCEAN VIEW','OUTSIDE'].indexOf(up) !== -1) return 'OCEANVIEW';
    if (['B','BAL','BK','BALCONY'].indexOf(up) !== -1) return 'BALCONY';
    if (['D','DLX','DELUXE','JS','SU','SUITE','JUNIOR SUITE','JR SUITE','JRSUITE'].indexOf(up) !== -1) return 'SUITE';
    return null;
  }
  function formatPortsAndTimes(days) {
    if (!Array.isArray(days) || !days.length) return '';
    return days.map(function(day) {
      var dayNum = day.number || '';
      var type = (day.type || '').toUpperCase();
      var ports = Array.isArray(day.ports) ? day.ports : [];
      if (!ports.length) return 'Day ' + dayNum + ': ' + (type === 'AT_SEA' ? 'At Sea' : (type || 'At Sea'));
      var portStrs = ports.map(function(pp) {
        var portName = (pp.port && pp.port.name) || '';
        var arrival = (pp.arrivalTime || '').replace(':00:00','').replace(':00','');
        var depart = (pp.departureTime || '').replace(':00:00','').replace(':00','');
        var times = '';
        if (arrival && depart) times = ' (' + arrival + '-' + depart + ')';
        else if (arrival) times = ' (Arr ' + arrival + ')';
        else if (depart) times = ' (Dep ' + depart + ')';
        return portName + times;
      }).filter(Boolean).join(' & ');
      return 'Day ' + dayNum + ': ' + (portStrs || 'At Sea');
    }).join(' | ');
  }
  async function fetchOfferPricing(offers) {
    if (!offers || !offers.length) return;
    addLog('Fetching pricing & itinerary for all sailings...', 'info');
    var shipGroups = {};
    var totalSailings = 0;
    offers.forEach(function(offer) {
      var co = offer.campaignOffer || offer;
      (co.sailings || []).forEach(function(s) {
        var shipCode = (s.shipCode || '').toString().trim();
        var sailDate = (s.sailDate || '').toString().trim().slice(0, 10);
        if (!shipCode || !sailDate || sailDate.length < 10) return;
        if (!shipGroups[shipCode]) shipGroups[shipCode] = { minDate: sailDate, maxDate: sailDate, count: 0 };
        if (sailDate < shipGroups[shipCode].minDate) shipGroups[shipCode].minDate = sailDate;
        if (sailDate > shipGroups[shipCode].maxDate) shipGroups[shipCode].maxDate = sailDate;
        shipGroups[shipCode].count++;
        totalSailings++;
      });
    });
    var shipList = Object.keys(shipGroups);
    if (!shipList.length) { addLog('No ship codes in offers - pricing skipped', 'warning'); return; }
    addLog('Pricing: ' + shipList.length + ' ship(s), ' + totalSailings + ' total sailings...', 'info');
    var isCeleb = capturedData.cruiseLine === 'celebrity';
    var graphEndpoint = isCeleb ? 'https://www.celebritycruises.com/graph' : 'https://www.royalcaribbean.com/graph';
    var GQL = 'query cruiseSearch_Cruises($filters:String,$qualifiers:String,$sort:CruiseSearchSort,$pagination:CruiseSearchPagination,$nlSearch:String){cruiseSearch(filters:$filters,qualifiers:$qualifiers,sort:$sort,pagination:$pagination,nlSearch:$nlSearch){results{cruises{masterSailing{itinerary{name code days{number type ports{activity arrivalTime departureTime port{code name region}}}departurePort{code name}destination{code name}sailingNights totalNights ship{code name}}}sailings{id sailDate taxesAndFees{value}taxesAndFeesIncluded stateroomClassPricing{price{value currency{code}}stateroomClass{id content{code}}}}}}}}';
    var fetchedCount = 0;
    for (var si = 0; si < shipList.length; si++) {
      if (!syncState.isRunning) break;
      var shipCode = shipList[si];
      var group = shipGroups[shipCode];
      var filtersValue = 'startDate:' + group.minDate + '~' + group.maxDate + '|ship:' + shipCode;
      var paginationCount = Math.min(group.count * 4, 200);
      addLog('  Pricing: ship ' + shipCode + ' (' + group.minDate + ' to ' + group.maxDate + ')...', 'info');
      try {
        var pResp = await fetch(graphEndpoint, {
          method: 'POST',
          headers: { 'content-type': 'application/json', 'accept': 'application/json', 'apollographql-client-name': 'rci-NextGen-Cruise-Search', 'apollographql-query-name': 'cruiseSearch_Cruises', 'skip_authentication': 'true' },
          body: JSON.stringify({ query: GQL, variables: { filters: filtersValue, pagination: { count: paginationCount, skip: 0 } } })
        });
        if (pResp && pResp.ok) {
          var pData = await pResp.json();
          var cruises = (pData && pData.data && pData.data.cruiseSearch && pData.data.cruiseSearch.results && pData.data.cruiseSearch.results.cruises) || [];
          var shipFetched = 0;
          cruises.forEach(function(cruise) {
            var itin = (cruise.masterSailing && cruise.masterSailing.itinerary) || {};
            var itinShipCode = (itin.ship && itin.ship.code) || '';
            var days = Array.isArray(itin.days) ? itin.days : [];
            var portsAndTimes = formatPortsAndTimes(days);
            var totalNights = itin.totalNights || itin.sailingNights || null;
            var sailings = Array.isArray(cruise.sailings) ? cruise.sailings : [];
            sailings.forEach(function(s) {
              var sDate = (s.sailDate || '').toString().trim().slice(0, 10);
              var sShip = (s.shipCode || itinShipCode || shipCode).toString().trim();
              if (!sDate) return;
              var cacheKey = sShip + '_' + sDate;
              var pricing = { interior: null, oceanview: null, balcony: null, suite: null, taxes: null, nights: totalNights, portsAndTimes: portsAndTimes };
              var spArr = Array.isArray(s.stateroomClassPricing) ? s.stateroomClassPricing : [];
              spArr.forEach(function(p) {
                var pCode = (p.stateroomClass && ((p.stateroomClass.content && p.stateroomClass.content.code) || p.stateroomClass.id)) || '';
                var cat = resolveStateroomCategory(pCode);
                var priceVal = (p.price && p.price.value != null) ? Number(p.price.value) : null;
                if (!cat || priceVal == null || !isFinite(priceVal) || priceVal <= 0) return;
                var dualPrice = Math.round(priceVal * 2);
                if (cat === 'INTERIOR' && (pricing.interior == null || dualPrice < pricing.interior)) pricing.interior = dualPrice;
                if (cat === 'OCEANVIEW' && (pricing.oceanview == null || dualPrice < pricing.oceanview)) pricing.oceanview = dualPrice;
                if (cat === 'BALCONY' && (pricing.balcony == null || dualPrice < pricing.balcony)) pricing.balcony = dualPrice;
                if (cat === 'SUITE' && (pricing.suite == null || dualPrice < pricing.suite)) pricing.suite = dualPrice;
              });
              if (s.taxesAndFees && s.taxesAndFees.value != null) {
                var taxVal = Number(s.taxesAndFees.value);
                if (isFinite(taxVal) && taxVal > 0) pricing.taxes = Math.round(taxVal * 2);
              }
              if (!pricingCache[cacheKey]) { pricingCache[cacheKey] = pricing; fetchedCount++; shipFetched++; }
              else {
                var ex = pricingCache[cacheKey];
                if (ex.interior == null && pricing.interior != null) ex.interior = pricing.interior;
                if (ex.oceanview == null && pricing.oceanview != null) ex.oceanview = pricing.oceanview;
                if (ex.balcony == null && pricing.balcony != null) ex.balcony = pricing.balcony;
                if (ex.suite == null && pricing.suite != null) ex.suite = pricing.suite;
                if (ex.taxes == null && pricing.taxes != null) ex.taxes = pricing.taxes;
                if (!ex.portsAndTimes && pricing.portsAndTimes) ex.portsAndTimes = pricing.portsAndTimes;
                if (!ex.nights && pricing.nights) ex.nights = pricing.nights;
              }
            });
          });
          addLog('  Ship ' + shipCode + ': ' + shipFetched + ' sailings priced (' + cruises.length + ' results)', 'success');
        } else {
          addLog('  Pricing API error for ship ' + shipCode, 'warning');
        }
      } catch(pe) { addLog('  Pricing error for ' + shipCode + ': ' + (pe.message || ''), 'warning'); }
      if (si < shipList.length - 1) await new Promise(function(r) { setTimeout(r, 300); });
    }
    addLog('\u2705 Pricing complete: ' + fetchedCount + ' sailings priced', 'success');
    try { chrome.storage.local.set({ es_pricingCache: pricingCache }); } catch(ex) {}
    updateUI();
  }

  function buildOffersCSV() {
    if (!capturedData.offers || !capturedData.offers.offers || capturedData.offers.offers.length === 0) return null;
    var loyaltyInfo = capturedData.loyalty && capturedData.loyalty.payload && capturedData.loyalty.payload.loyaltyInformation ? capturedData.loyalty.payload.loyaltyInformation : null;
    var loyaltyLevel = loyaltyInfo ? (loyaltyInfo.crownAndAnchorLevel || '') : '';
    var loyaltyPoints = loyaltyInfo ? (loyaltyInfo.crownAndAnchorPoints || '') : '';
    var rows = [];
    rows.push(['Source Page','Offer Name','Offer Code','Offer Expiration Date','Offer Type','Ship Name','Sailing Date','Nights','Itinerary','Departure Port','Room Type','Guests Info','Perks','Loyalty Level','Loyalty Points','Interior Price','Oceanview Price','Balcony Price','Suite Price','Port Taxes & Fees','Ports & Times'].map(esc).join(','));
    var totalRows = 0;
    capturedData.offers.offers.forEach(function(offer) {
      var co = offer.campaignOffer || offer;
      var offerType = getOfferTypeStr(co);
      (co.sailings || []).forEach(function(s) {
        var shipCode = (s.shipCode || '').toString().trim();
        var sailDateISO = (s.sailDate || '').toString().trim().slice(0, 10);
        var cacheKey = shipCode + '_' + sailDateISO;
        var pc = pricingCache[cacheKey] || {};
        var itinerary = s.itineraryDescription || '';
        var nights = pc.nights || getNightsFromItinerary(itinerary) || '';
        var perks = '';
        var perkCodes = co.perkCodes || (co.campaignOffer && co.campaignOffer.perkCodes);
        if (Array.isArray(perkCodes) && perkCodes.length) perks = perkCodes.map(function(p) { return p.perkName || p.perkCode || ''; }).filter(Boolean).join(' | ');
        if (!perks && co.tradeInValue) perks = '$' + co.tradeInValue + ' trade-in';
        var deptPort = s.departurePort && typeof s.departurePort === 'object' ? (s.departurePort.name || '') : (s.departurePort || '');
        rows.push([
          esc('Club Royale Offers'), esc(co.name || co.offerName || ''), esc(co.offerCode || ''),
          esc(fmtDate(co.reserveByDate || co.expirationDate || '')), esc(offerType),
          esc(s.shipName || SHIP_CODES[shipCode] || shipCode || ''), esc(fmtDate(sailDateISO || s.sailDate || '')),
          esc(nights), esc(itinerary), esc(deptPort), esc(s.roomType || s.cabinType || ''),
          esc(s.isGOBO ? '1 Guest' : '2 Guests'), esc(perks || '-'),
          esc(loyaltyLevel), esc(loyaltyPoints),
          esc(fmtPrice(pc.interior)), esc(fmtPrice(pc.oceanview)), esc(fmtPrice(pc.balcony)), esc(fmtPrice(pc.suite)),
          esc(fmtPrice(pc.taxes)), esc(pc.portsAndTimes || '')
        ].join(','));
        totalRows++;
      });
    });
    if (rows.length <= 1) return null;
    addLog('Built offers CSV: ' + totalRows + ' rows', 'info');
    return rows.join('\\n');
  }

  function buildBookedCSV() {
    var bookings = extractBookings(capturedData.upcomingCruises);
    var courtesyBookings = [];
    if (capturedData.courtesyHolds) {
      if (capturedData.courtesyHolds.payload && capturedData.courtesyHolds.payload.sailingInfo)
        courtesyBookings = capturedData.courtesyHolds.payload.sailingInfo;
      else if (capturedData.courtesyHolds.sailingInfo)
        courtesyBookings = capturedData.courtesyHolds.sailingInfo;
    }
    var allBookings = [];
    bookings.forEach(function(b) { allBookings.push({ data: b, source: 'Upcoming' }); });
    courtesyBookings.forEach(function(b) { allBookings.push({ data: b, source: 'Courtesy Hold' }); });
    if (allBookings.length === 0) return null;
    var loyaltyInfo = capturedData.loyalty && capturedData.loyalty.payload && capturedData.loyalty.payload.loyaltyInformation ? capturedData.loyalty.payload.loyaltyInformation : null;
    var loyaltyLevel = loyaltyInfo ? (loyaltyInfo.crownAndAnchorLevel || '') : '';
    var loyaltyPoints = loyaltyInfo ? (loyaltyInfo.crownAndAnchorPoints || '') : '';
    var rows = [];
    rows.push(['Source','Ship Name','Sail Date','Return Date','Nights','Itinerary','Departure Port','Cabin Type','Cabin #','Booking ID','Status','Loyalty Level','Loyalty Points'].map(esc).join(','));
    allBookings.forEach(function(entry) {
      var b = entry.data;
      var sc = b.shipCode || '';
      var sn = SHIP_CODES[sc] || b.shipName || (sc ? sc + ' of the Seas' : '');
      var ct = CABIN_TYPES[b.stateroomType || ''] || b.stateroomType || '';
      var cn = b.stateroomNumber === 'GTY' ? 'GTY' : (b.stateroomNumber || '');
      var status = entry.source;
      if (b.bookingStatus === 'OF') status = 'Courtesy Hold';
      var nights = b.numberOfNights || '';
      var returnDate = b.returnDate || '';
      if (!returnDate && b.sailDate && nights) {
        try {
          var sd = new Date(b.sailDate);
          if (!isNaN(sd.getTime())) { sd.setDate(sd.getDate() + parseInt(nights, 10)); returnDate = sd.toISOString().split('T')[0]; }
        } catch(e) {}
      }
      rows.push([
        esc(status), esc(sn), esc(fmtDate(b.sailDate)), esc(fmtDate(returnDate)),
        esc(nights), esc(b.cruiseTitle || b.itineraryDescription || (nights ? nights + ' Night Cruise' : '')),
        esc(b.departurePort && b.departurePort.name ? b.departurePort.name : (b.departurePort || '')),
        esc(ct), esc(cn), esc(b.bookingId || b.masterBookingId || ''), esc(status),
        esc(loyaltyLevel), esc(loyaltyPoints)
      ].join(','));
    });
    return rows.length > 1 ? rows.join('\\n') : null;
  }

  function triggerDownload(csvContent, filename) {
    var blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url; a.download = filename; a.style.display = 'none';
    document.body.appendChild(a); a.click();
    setTimeout(function() { document.body.removeChild(a); URL.revokeObjectURL(url); }, 200);
  }

  function downloadCSVs() {
    addLog('Generating CSV files...', 'info');
    var pricedCount = Object.keys(pricingCache).length;
    addLog('Pricing cache: ' + pricedCount + ' sailings' + (pricedCount === 0 ? ' (run SYNC first for prices)' : ''), pricedCount > 0 ? 'info' : 'warning');
    var downloaded = 0;
    var offersCSV = buildOffersCSV();
    if (offersCSV) {
      triggerDownload(offersCSV, 'offers.csv');
      addLog('\\u2705 Exported offers.csv', 'success');
      downloaded++;
    } else {
      addLog('No offers data to export', 'warning');
    }
    setTimeout(function() {
      var bookedCSV = buildBookedCSV();
      if (bookedCSV) {
        triggerDownload(bookedCSV, 'booked.csv');
        addLog('\\u2705 Exported booked.csv', 'success');
        downloaded++;
      } else {
        addLog('No booked cruise data to export', 'warning');
      }
      if (downloaded === 0) addLog('No data to export yet - run sync first', 'error');
      else addLog('Downloaded ' + downloaded + ' CSV file(s)', 'success');
    }, 500);
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
        createOverlay();
        watchForOverlayRemoval();
        addLog('Extension ready on ' + capturedData.cruiseLine, 'info');
      });
    } else {
      createOverlay();
      watchForOverlayRemoval();
      addLog('Extension ready on ' + capturedData.cruiseLine, 'info');
    }
    setInterval(function() {
      ensureOverlay();
      if (!authContext) {
        window.postMessage({ source: 'easy-seas-ext', type: 'get_auth' }, '*');
        updateUI();
      }
    }, 5000);
  }

  init();
}();`;
}

function getOverlayCSS(): string {
  return `/* Easy Seas Floating Overlay v3.1 */
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
#easy-seas-log { margin-top: 16px !important; max-height: 140px !important; overflow-y: auto !important; padding: 12px !important; background: rgba(0, 0, 0, 0.3) !important; border-radius: 8px !important; font-size: 11px !important; font-family: 'Monaco', 'Menlo', monospace !important; color: rgba(255, 255, 255, 0.7) !important; line-height: 1.6 !important; }
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
    console.log('[ChromeExtension] Creating Easy Seas Sync extension ZIP v3.1...');
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

    console.log('[ChromeExtension] Easy Seas Sync extension v3.1 download initiated successfully');
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
