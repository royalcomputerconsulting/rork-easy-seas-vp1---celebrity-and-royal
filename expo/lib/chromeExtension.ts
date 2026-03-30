import { Platform } from 'react-native';
import JSZipLib from 'jszip';

const EASY_SEAS_EXTENSION_VERSION = '3.2.0';

function getEasySeasExtensionFiles(): Record<string, string> {
  const manifestContent = `{
  "manifest_version": 3,
  "name": "Easy Seas™ — Sync Extension",
  "version": "${EASY_SEAS_EXTENSION_VERSION}",
  "description": "Syncs casino offers, booked cruises, and loyalty data from Royal Caribbean, Celebrity, and Carnival websites.",
  "permissions": ["storage", "downloads", "tabs"],
  "host_permissions": [
    "https://*.royalcaribbean.com/*",
    "https://*.celebritycruises.com/*",
    "https://aws-prd.api.rccl.com/*",
    "https://*.carnival.com/*"
  ],
  "background": {
    "service_worker": "background.js"
  },
  "content_scripts": [
    {
      "matches": [
        "https://*.royalcaribbean.com/*",
        "https://*.celebritycruises.com/*",
        "https://*.carnival.com/*"
      ],
      "js": ["content.js"],
      "css": ["overlay.css"],
      "run_at": "document_start",
      "all_frames": false
    }
  ],
  "web_accessible_resources": [
    {
      "resources": ["page-script.js"],
      "matches": [
        "https://*.royalcaribbean.com/*",
        "https://*.celebritycruises.com/*",
        "https://*.carnival.com/*"
      ]
    }
  ],
  "icons": {
    "16": "icons/icon16.png",
    "48": "icons/icon48.png",
    "128": "icons/icon128.png"
  },
  "action": {
    "default_title": "Easy Seas™ — Automated Cruise Data Sync",
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
    'page-script.js': getPageScriptJS(),
    'content.js': getContentJS(),
    'overlay.css': getOverlayCSS(),
  };
}

function getBackgroundJS(): string {
  return `console.log('[Easy Seas BG] Service worker v${EASY_SEAS_EXTENSION_VERSION} initialized');

chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  if (request.type === 'store_data') {
    chrome.storage.local.set(request.data).then(function() {
      sendResponse({ success: true });
    }).catch(function(error) {
      sendResponse({ success: false, error: error && error.message ? error.message : String(error) });
    });
    return true;
  }

  if (request.type === 'get_data') {
    chrome.storage.local.get(request.keys || []).then(function(result) {
      sendResponse({ success: true, data: result });
    }).catch(function(error) {
      sendResponse({ success: false, error: error && error.message ? error.message : String(error) });
    });
    return true;
  }

  if (request.type === 'open_sync_tabs') {
    var urls = Array.isArray(request.urls) ? request.urls : [];
    if (urls.length === 0) {
      sendResponse({ success: true, tabIds: [] });
      return true;
    }

    var tabIds = [];
    var completed = 0;

    urls.forEach(function(url) {
      chrome.tabs.create({ url: url, active: false }, function(tab) {
        if (tab && typeof tab.id === 'number') {
          tabIds.push(tab.id);
          setTimeout(function() {
            try { chrome.tabs.remove(tab.id, function() {}); } catch (e) {}
          }, 28000);
        }
        completed += 1;
        if (completed === urls.length) {
          sendResponse({ success: true, tabIds: tabIds });
        }
      });
    });

    return true;
  }

  if (request.type === 'close_self') {
    if (sender.tab && sender.tab.id) {
      try { chrome.tabs.remove(sender.tab.id, function() {}); } catch (e) {}
    }
    sendResponse({ success: true });
    return true;
  }

  sendResponse({ success: false, error: 'unknown_request' });
  return false;
});

chrome.runtime.onInstalled.addListener(function() {
  console.log('[Easy Seas BG] Extension installed/updated v${EASY_SEAS_EXTENSION_VERSION}');
});`;
}

function getPageScriptJS(): string {
  return `(function() {
  var SRC = 'easy-seas-page';

  function post(type, payload) {
    try {
      window.postMessage(Object.assign({ source: SRC, type: type }, payload || {}), '*');
    } catch (e) {}
  }

  function getCookieValue(name) {
    try {
      var parts = document.cookie ? document.cookie.split(';') : [];
      for (var i = 0; i < parts.length; i++) {
        var part = parts[i].trim();
        if (part.indexOf(name + '=') === 0) return part.substring(name.length + 1);
      }
    } catch (e) {}
    return '';
  }

  function parseCookieJson(raw) {
    if (!raw) return null;
    try { return JSON.parse(decodeURIComponent(raw)); } catch (e) {}
    try { return JSON.parse(raw); } catch (e2) {}
    return null;
  }

  function getCarnivalCookieAuth() {
    var userCookie = parseCookieJson(getCookieValue('user'));
    if (!userCookie || typeof userCookie !== 'object') return null;
    return {
      token: 'carnival-cookie-session',
      accountId: String(userCookie.PastGuestNumber || userCookie.EmailAddress || 'carnival-session'),
      loyaltyId: String(userCookie.PastGuestNumber || ''),
      firstName: String(userCookie.FirstName || ''),
      source: 'carnival-cookie'
    };
  }

  function getStoredSessionAuth() {
    var keysToTry = ['persist:session', 'persist:auth', 'ccl-session', 'ccl_session'];
    for (var ki = 0; ki < keysToTry.length; ki++) {
      try {
        var raw = localStorage.getItem(keysToTry[ki]);
        if (!raw) continue;
        var session = JSON.parse(raw);
        var token = session.token ? (typeof session.token === 'string' ? JSON.parse(session.token) : session.token) : null;
        var user = session.user ? (typeof session.user === 'string' ? JSON.parse(session.user) : session.user) : null;
        if (!token || !user || !user.accountId) continue;
        var tokenString = typeof token === 'string' ? token : (token && token.toString ? token.toString() : '');
        return {
          token: tokenString.indexOf('Bearer ') === 0 ? tokenString : 'Bearer ' + tokenString,
          accountId: String(user.accountId),
          loyaltyId: String(user.cruiseLoyaltyId || user.vifpClubNumber || ''),
          firstName: String(user.firstName || ''),
          source: 'persisted-session'
        };
      } catch (e) {}
    }
    return null;
  }

  function findAppKey() {
    try {
      var keys = Object.keys(localStorage || {});
      for (var i = 0; i < keys.length; i++) {
        if (/appkey|api[-_]?key/i.test(keys[i])) {
          var value = localStorage.getItem(keys[i]);
          if (value && value.length > 10) return value;
        }
      }
    } catch (e) {}
    try {
      var env = window.__ENV__ || window.__env__ || window.env || null;
      if (env) {
        var candidate = env.APPKEY || env.appKey || env.appkey || env.API_KEY || env.apiKey || env.apigeeApiKey || null;
        if (typeof candidate === 'string' && candidate.length > 10) return candidate;
      }
    } catch (e2) {}
    try {
      var winKey = window.RCLL_APPKEY || window.RCCL_APPKEY || window.APPKEY || null;
      if (typeof winKey === 'string' && winKey.length > 10) return winKey;
    } catch (e3) {}
    return '';
  }

  function sendAuth() {
    var auth = getStoredSessionAuth() || getCarnivalCookieAuth();
    post('auth_data', { auth: auth, appKey: findAppKey() });
  }

  function classifyUrl(url) {
    if (!url) return '';
    if (url.indexOf('/api/casino/casino-offers') !== -1 || url.indexOf('/players-club/offers') !== -1 || url.indexOf('/profilemanagement/api/offers') !== -1 || url.indexOf('/api/profile/offers') !== -1) {
      return 'offers';
    }
    if (url.indexOf('/profileBookings/enriched') !== -1 || url.indexOf('/api/account/upcoming-cruises') !== -1 || url.indexOf('/api/profile/bookings') !== -1 || url.indexOf('/upcomingCruises') !== -1 || url.indexOf('/profilemanagement/profiles/cruises') !== -1 || url.indexOf('/api/booking/cruises') !== -1 || url.indexOf('/profilemanagement/api/bookings') !== -1) {
      return 'upcomingCruises';
    }
    if (url.indexOf('/api/account/courtesy-holds') !== -1 || url.indexOf('/courtesyHolds') !== -1) {
      return 'courtesyHolds';
    }
    if (url.indexOf('/guestAccounts/loyalty') !== -1 || url.indexOf('/loyalty/info') !== -1 || url.indexOf('/loyalty-programs') !== -1 || url.indexOf('/account/loyalty') !== -1 || url.indexOf('/profilemanagement/profiles/loyalty') !== -1 || url.indexOf('/api/profile/loyalty') !== -1) {
      return 'loyalty';
    }
    return '';
  }

  var originalFetch = window.fetch;
  window.fetch = function() {
    var args = arguments;
    return originalFetch.apply(this, args).then(function(response) {
      try {
        var url = typeof args[0] === 'string' ? args[0] : (args[0] && args[0].url ? args[0].url : '');
        var key = classifyUrl(url);
        if (key && response && response.ok) {
          var clone = response.clone();
          clone.json().then(function(data) {
            post('api_captured', { key: key, data: data, url: url });
          }).catch(function() {});
        }
      } catch (e) {}
      return response;
    });
  };

  var originalOpen = XMLHttpRequest.prototype.open;
  var originalSend = XMLHttpRequest.prototype.send;

  XMLHttpRequest.prototype.open = function(method, url) {
    this.__easySeasUrl = url;
    return originalOpen.apply(this, arguments);
  };

  XMLHttpRequest.prototype.send = function() {
    var xhr = this;
    xhr.addEventListener('load', function() {
      try {
        var url = xhr.__easySeasUrl || xhr.responseURL || '';
        var key = classifyUrl(url);
        if (!key || xhr.status < 200 || xhr.status >= 300) return;
        var data = JSON.parse(xhr.responseText);
        post('api_captured', { key: key, data: data, url: url });
      } catch (e) {}
    });
    return originalSend.apply(this, arguments);
  };

  window.addEventListener('message', function(event) {
    if (event.data && event.data.source === 'easy-seas-ext' && event.data.type === 'get_auth') {
      sendAuth();
    }
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

  var hostname = window.location.hostname || '';
  var path = window.location.pathname || '';
  var cruiseLine = hostname.indexOf('celebrity') !== -1 ? 'celebrity' : (hostname.indexOf('carnival') !== -1 ? 'carnival' : 'royal');
  var isMainPage = cruiseLine === 'carnival'
    ? path.indexOf('/cruise-deals') !== -1
    : (cruiseLine === 'celebrity' ? path.indexOf('/blue-chip-club') !== -1 : path.indexOf('/club-royale') !== -1);
  var isHelperPage = !isMainPage && (path.indexOf('/account') !== -1 || path.indexOf('/profilemanagement') !== -1 || path.indexOf('/loyalty') !== -1 || path.indexOf('/profile') !== -1);
  var overlayElement = null;
  var authContext = null;
  var syncState = { isRunning: false, currentStep: 0, totalSteps: cruiseLine === 'carnival' ? 4 : 3 };
  var capturedData = {
    cruiseLine: cruiseLine,
    offers: null,
    upcomingCruises: null,
    courtesyHolds: null,
    loyalty: null,
    carnivalOffersRows: [],
    carnivalBookingsRows: [],
    isLoggedIn: false
  };

  var CARNIVAL_SHIPS = [
    'Carnival Breeze', 'Carnival Celebration', 'Carnival Conquest', 'Carnival Dream', 'Carnival Elation',
    'Carnival Firenze', 'Carnival Freedom', 'Carnival Glory', 'Carnival Horizon', 'Carnival Jubilee',
    'Carnival Legend', 'Carnival Liberty', 'Carnival Luminosa', 'Carnival Magic', 'Mardi Gras',
    'Carnival Miracle', 'Carnival Panorama', 'Carnival Paradise', 'Carnival Pride', 'Carnival Radiance',
    'Carnival Spirit', 'Carnival Splendor', 'Carnival Sunrise', 'Carnival Sunshine', 'Carnival Valor',
    'Carnival Venezia', 'Carnival Venice', 'Carnival Vista'
  ];

  var ROYAL_SHIPS = {
    AL: 'Allure of the Seas', AN: 'Anthem of the Seas', AD: 'Adventure of the Seas', BR: 'Brilliance of the Seas',
    EN: 'Enchantment of the Seas', EX: 'Explorer of the Seas', FR: 'Freedom of the Seas', GR: 'Grandeur of the Seas',
    HM: 'Harmony of the Seas', IC: 'Icon of the Seas', ID: 'Independence of the Seas', JW: 'Jewel of the Seas',
    LB: 'Liberty of the Seas', MR: 'Mariner of the Seas', NV: 'Navigator of the Seas', OA: 'Oasis of the Seas',
    OV: 'Ovation of the Seas', OY: 'Odyssey of the Seas', QN: 'Quantum of the Seas', RD: 'Radiance of the Seas',
    RH: 'Rhapsody of the Seas', SE: 'Serenade of the Seas', SP: 'Spectrum of the Seas', SY: 'Symphony of the Seas',
    UT: 'Utopia of the Seas', VI: 'Vision of the Seas', VY: 'Voyager of the Seas', WN: 'Wonder of the Seas'
  };

  var CABIN_TYPES = { I: 'Interior', O: 'Ocean View', B: 'Balcony', S: 'Suite' };
  var pricingCache = {};

  function normalizeText(value) {
    return String(value || '').replace(/\\s+/g, ' ').trim();
  }

  function getCookieValue(name) {
    try {
      var parts = document.cookie ? document.cookie.split(';') : [];
      for (var i = 0; i < parts.length; i++) {
        var part = parts[i].trim();
        if (part.indexOf(name + '=') === 0) return part.substring(name.length + 1);
      }
    } catch (e) {}
    return '';
  }

  function parseCookieJson(raw) {
    if (!raw) return null;
    try { return JSON.parse(decodeURIComponent(raw)); } catch (e) {}
    try { return JSON.parse(raw); } catch (e2) {}
    return null;
  }

  function parseCarnivalUserCookie() {
    var parsed = parseCookieJson(getCookieValue('user'));
    return parsed && typeof parsed === 'object' ? parsed : null;
  }

  function getCarnivalTierName(code) {
    if (code === '01') return 'Red';
    if (code === '02') return 'Gold';
    if (code === '03') return 'Platinum';
    if (code === '04') return 'Diamond';
    return code || 'VIFP Club';
  }

  function findCarnivalShipName(text) {
    var lower = normalizeText(text).toLowerCase();
    for (var i = 0; i < CARNIVAL_SHIPS.length; i++) {
      if (lower.indexOf(CARNIVAL_SHIPS[i].toLowerCase()) !== -1) return CARNIVAL_SHIPS[i];
    }
    return '';
  }

  function addLog(message, type) {
    var logElement = document.getElementById('easy-seas-log');
    if (!logElement) return;
    var entry = document.createElement('div');
    entry.className = 'es-log-entry es-log-' + (type || 'info');
    entry.textContent = '[' + new Date().toLocaleTimeString() + '] ' + message;
    logElement.appendChild(entry);
    logElement.scrollTop = logElement.scrollHeight;
    while (logElement.children.length > 80) {
      logElement.removeChild(logElement.firstChild);
    }
  }

  function injectPageScript() {
    if (window.__easySeasPageScriptInjected) return;
    window.__easySeasPageScriptInjected = true;
    var script = document.createElement('script');
    script.src = chrome.runtime.getURL('page-script.js');
    script.onload = function() { script.remove(); };
    script.onerror = function() { script.remove(); };
    (document.head || document.documentElement).appendChild(script);
  }

  function refreshCarnivalSession(logIt) {
    if (capturedData.cruiseLine !== 'carnival') return false;
    var userCookie = parseCarnivalUserCookie();
    var hasPasswordForm = false;
    try { hasPasswordForm = !!document.querySelector('input[type="password"]'); } catch (e) {}
    var bodyText = '';
    try { bodyText = normalizeText((document.body && (document.body.innerText || document.body.textContent)) || '').toLowerCase(); } catch (e2) {}
    var isLoggedIn = !!userCookie || (!hasPasswordForm && (bodyText.indexOf('ahoy') !== -1 || bodyText.indexOf('manage bookings') !== -1 || bodyText.indexOf('vifp') !== -1));
    if (!isLoggedIn) return false;
    capturedData.isLoggedIn = true;
    if (userCookie) {
      authContext = {
        token: 'carnival-cookie-session',
        accountId: String(userCookie.PastGuestNumber || userCookie.EmailAddress || 'carnival-session'),
        loyaltyId: String(userCookie.PastGuestNumber || ''),
        firstName: String(userCookie.FirstName || ''),
        appKey: ''
      };
      capturedData.loyalty = {
        loyaltyInformation: {
          crownAndAnchorLevel: getCarnivalTierName(String(userCookie.TierCode || '')),
          crownAndAnchorPoints: String(userCookie.PastGuestNumber || ''),
          clubRoyaleTier: getCarnivalTierName(String(userCookie.TierCode || '')),
          clubRoyalePoints: '',
          vifpNumber: String(userCookie.PastGuestNumber || ''),
          firstName: String(userCookie.FirstName || ''),
          lastName: String(userCookie.LastName || '')
        }
      };
    }
    if (logIt && !window.__easySeasCarnivalLoginLogged) {
      window.__easySeasCarnivalLoginLogged = true;
      addLog('Carnival session detected' + (authContext && authContext.firstName ? ' for ' + authContext.firstName : ''), 'success');
    }
    return true;
  }

  function dedupeRows(rows, getKey) {
    var seen = {};
    var result = [];
    for (var i = 0; i < rows.length; i++) {
      var key = getKey(rows[i], i);
      if (!key || seen[key]) continue;
      seen[key] = true;
      result.push(rows[i]);
    }
    return result;
  }

  function scrapeCarnivalOfferRowsFromDOM() {
    var selectors = ['[data-testid*="deal"]', '[data-testid*="cruise"]', '[class*="DealCard"]', '[class*="deal-card"]', '[class*="CruiseCard"]', '[class*="cruise-card"]', 'article', 'section'];
    var elements = [];
    for (var si = 0; si < selectors.length; si++) {
      try {
        var found = document.querySelectorAll(selectors[si]);
        if (found && found.length > 0) {
          elements = found;
          if (found.length > 4) break;
        }
      } catch (e) {}
    }
    var rows = [];
    for (var i = 0; i < elements.length; i++) {
      var element = elements[i];
      var text = normalizeText(element.textContent || '');
      if (!text || text.length < 24) continue;
      var heading = element.querySelector('h1, h2, h3, h4, strong, b');
      var offerName = normalizeText((heading && heading.textContent) || '').slice(0, 120);
      if (!offerName) offerName = text.slice(0, 120);
      var linkNode = element.querySelector('a[href]');
      var bookingLink = linkNode ? (linkNode.getAttribute('href') || '') : '';
      var fullLink = bookingLink && bookingLink.indexOf('http') !== 0 ? 'https://www.carnival.com' + (bookingLink.indexOf('/') === 0 ? '' : '/') + bookingLink : bookingLink;
      var shipName = findCarnivalShipName(text);
      var priceMatch = text.match(/\\$\\s*([\\d,]+)/);
      var nightsMatch = offerName.match(/(\\d+)\\s*[-\\s]?(?:Day|Night)/i) || text.match(/(\\d+)\\s*[-\\s]?(?:Day|Night)/i);
      var dateMatch = text.match(/([A-Z][a-z]{2,8}\\s+\\d{1,2},?\\s+\\d{4}|\\d{1,2}\\/\\d{1,2}\\/\\d{2,4}|\\d{4}-\\d{2}-\\d{2})/);
      var portMatch = text.match(/(?:Start|From|Departing|Departure)[:\\s-]+([^>|•]+)/i);
      var rateCode = '';
      try {
        var hrefMatch = fullLink.match(/rateCodes?=([A-Z0-9]+)/i);
        if (hrefMatch) rateCode = hrefMatch[1];
      } catch (e2) {}
      if (!offerName || (!priceMatch && !shipName && !fullLink)) continue;
      rows.push({
        sourcePage: 'Carnival Cruise Deals',
        offerName: offerName,
        offerCode: rateCode,
        offerExpirationDate: '',
        offerType: 'VIFP Club',
        shipName: shipName,
        sailingDate: dateMatch ? dateMatch[1] : '',
        nights: nightsMatch ? nightsMatch[1] : '',
        itinerary: offerName,
        departurePort: portMatch ? normalizeText(portMatch[1]) : '',
        roomType: '',
        guestsInfo: '2 Guests',
        perks: '',
        interiorPrice: priceMatch ? '$' + priceMatch[1].replace(/,/g, '') : '',
        oceanviewPrice: '',
        balconyPrice: '',
        suitePrice: '',
        taxesAndFees: '',
        portsAndTimes: '',
        bookingLink: fullLink
      });
    }
    return dedupeRows(rows, function(row) {
      return [row.offerName, row.shipName, row.sailingDate, row.interiorPrice, row.bookingLink].join('|');
    });
  }

  function scrapeCarnivalBookingsRowsFromDOM() {
    var selectors = ['[data-testid*="booking"]', '[data-testid*="cruise"]', '[class*="booking"]', '[class*="Cruise"]', '[class*="reservation"]', 'article', 'section', 'tr'];
    var elements = [];
    for (var si = 0; si < selectors.length; si++) {
      try {
        var found = document.querySelectorAll(selectors[si]);
        if (found && found.length > 0) {
          elements = found;
          if (found.length > 2) break;
        }
      } catch (e) {}
    }
    var rows = [];
    for (var i = 0; i < elements.length; i++) {
      var element = elements[i];
      var text = normalizeText(element.textContent || '');
      if (!text || text.length < 24) continue;
      var shipName = findCarnivalShipName(text);
      if (!shipName) continue;
      var nightsMatch = text.match(/(\\d+)\\s*[-\\s]?(?:Night|Nite|Day)/i);
      var dateMatch = text.match(/([A-Z][a-z]{2,8}\\s+\\d{1,2},?\\s+\\d{4}|\\d{1,2}\\/\\d{1,2}\\/\\d{2,4}|\\d{4}-\\d{2}-\\d{2})/);
      var bookingIdMatch = text.match(/(?:Booking|Confirmation|Reservation)\\s*(?:#|Number|:)?\\s*([A-Z0-9]{4,12})/i);
      var cabinMatch = text.match(/(?:Cabin|Stateroom|Room)\\s*(?:#|Number|:)?\\s*([A-Z]?\\d{3,5}[A-Z]?)/i);
      var portMatch = text.match(/(?:Start|From|Departing|Departure)[:\\s-]+([^>|•]+)/i);
      var status = 'Upcoming';
      var lower = text.toLowerCase();
      if (lower.indexOf('past') !== -1 || lower.indexOf('completed') !== -1) status = 'Completed';
      if (lower.indexOf('cancel') !== -1) status = 'Cancelled';
      rows.push({
        source: status,
        shipName: shipName,
        sailDate: dateMatch ? dateMatch[1] : '',
        returnDate: '',
        nights: nightsMatch ? nightsMatch[1] : '',
        itinerary: shipName,
        departurePort: portMatch ? normalizeText(portMatch[1]) : '',
        cabinType: '',
        cabinNumber: cabinMatch ? cabinMatch[1] : '',
        bookingId: bookingIdMatch ? bookingIdMatch[1] : '',
        status: status
      });
    }
    return dedupeRows(rows, function(row) {
      return [row.shipName, row.sailDate, row.bookingId, row.status].join('|');
    });
  }

  function captureCarnivalHelperPage() {
    if (capturedData.cruiseLine !== 'carnival') return;
    refreshCarnivalSession(false);
    var storageObj = {};
    if (capturedData.loyalty) {
      storageObj.es_loyalty = capturedData.loyalty;
      storageObj.es_loyalty_ts = Date.now();
    }
    if (path.indexOf('/cruise-deals') !== -1 || path.indexOf('/cruise-search') !== -1 || path.indexOf('/offers') !== -1) {
      var offerRows = scrapeCarnivalOfferRowsFromDOM();
      if (offerRows.length > 0) {
        storageObj.es_carnivalOffersRows = offerRows;
        storageObj.es_carnivalOffersRows_ts = Date.now();
      }
    }
    if (path.indexOf('/profilemanagement/profiles') !== -1 || path.indexOf('/manage-booking') !== -1 || path.indexOf('/booking') !== -1) {
      var bookingRows = scrapeCarnivalBookingsRowsFromDOM();
      if (bookingRows.length > 0) {
        storageObj.es_carnivalBookingsRows = bookingRows;
        storageObj.es_carnivalBookingsRows_ts = Date.now();
      }
    }
    try {
      if (Object.keys(storageObj).length > 0) {
        chrome.storage.local.set(storageObj);
      }
    } catch (e) {}
  }

  function extractBookings(data) {
    if (!data) return [];
    if (data.payload && Array.isArray(data.payload.sailingInfo)) return data.payload.sailingInfo;
    if (data.payload && Array.isArray(data.payload.profileBookings)) return data.payload.profileBookings;
    if (Array.isArray(data.sailingInfo)) return data.sailingInfo;
    if (Array.isArray(data.profileBookings)) return data.profileBookings;
    if (Array.isArray(data.bookings)) return data.bookings;
    if (Array.isArray(data.cruises)) return data.cruises;
    if (Array.isArray(data)) return data;
    return [];
  }

  function getOffersCount() {
    if (capturedData.cruiseLine === 'carnival') return Array.isArray(capturedData.carnivalOffersRows) ? capturedData.carnivalOffersRows.length : 0;
    if (capturedData.offers && Array.isArray(capturedData.offers.offers)) return capturedData.offers.offers.length;
    if (Array.isArray(capturedData.offers)) return capturedData.offers.length;
    return 0;
  }

  function getBookingsCount() {
    if (capturedData.cruiseLine === 'carnival') return Array.isArray(capturedData.carnivalBookingsRows) ? capturedData.carnivalBookingsRows.length : 0;
    return extractBookings(capturedData.upcomingCruises).length + extractBookings(capturedData.courtesyHolds).length;
  }

  function getLoyaltyLabel() {
    var loyaltyInfo = capturedData.loyalty && capturedData.loyalty.loyaltyInformation
      ? capturedData.loyalty.loyaltyInformation
      : (capturedData.loyalty && capturedData.loyalty.payload && capturedData.loyalty.payload.loyaltyInformation ? capturedData.loyalty.payload.loyaltyInformation : null);
    if (!loyaltyInfo) return '--';
    return loyaltyInfo.crownAndAnchorLevel || loyaltyInfo.clubRoyaleTier || 'Captured';
  }

  function updateUI() {
    if (!overlayElement) return;
    if (capturedData.cruiseLine === 'carnival') refreshCarnivalSession(false);
    var loginStatus = document.getElementById('login-status');
    if (loginStatus) {
      loginStatus.textContent = capturedData.isLoggedIn ? 'LOGGED IN' : 'NOT LOGGED IN';
      loginStatus.className = capturedData.isLoggedIn ? 'es-badge es-badge-success' : 'es-badge es-badge-warning';
    }
    var offerCount = document.getElementById('offer-count');
    if (offerCount) offerCount.textContent = String(getOffersCount());
    var bookingCount = document.getElementById('booking-count');
    if (bookingCount) bookingCount.textContent = String(getBookingsCount());
    var loyaltyStatus = document.getElementById('loyalty-status');
    if (loyaltyStatus) loyaltyStatus.textContent = getLoyaltyLabel();
    var cruiseLineEl = document.getElementById('cruise-line');
    if (cruiseLineEl) cruiseLineEl.textContent = cruiseLine === 'celebrity' ? 'Celebrity Cruises' : cruiseLine === 'carnival' ? 'Carnival Cruise Line' : 'Royal Caribbean';
    var syncButton = document.getElementById('sync-btn');
    if (syncButton) {
      syncButton.disabled = syncState.isRunning ? false : !capturedData.isLoggedIn;
      syncButton.className = syncState.isRunning ? 'es-button es-button-stop' : 'es-button es-button-primary';
      syncButton.innerHTML = syncState.isRunning ? '<div class="es-spinner"></div><span>SYNCING...</span>' : '<span>START SYNC</span>';
    }
    var downloadButton = document.getElementById('download-btn');
    if (downloadButton) downloadButton.disabled = syncState.isRunning || (getOffersCount() === 0 && getBookingsCount() === 0);
  }

  function updateProgress(step, total, message) {
    var progressRoot = document.getElementById('easy-seas-progress');
    var fill = document.getElementById('progress-fill');
    var text = progressRoot ? progressRoot.querySelector('.es-progress-text') : null;
    if (progressRoot) progressRoot.classList.add('active');
    if (fill) fill.style.width = ((step / total) * 100) + '%';
    if (text) text.textContent = message || ('Step ' + step + ' of ' + total);
    var steps = document.querySelectorAll('.es-step');
    for (var i = 0; i < steps.length; i++) {
      steps[i].classList.remove('active', 'completed');
      if (i + 1 < step) steps[i].classList.add('completed');
      if (i + 1 === step) steps[i].classList.add('active');
    }
  }

  function createOverlay() {
    if (document.getElementById('easy-seas-overlay')) {
      overlayElement = document.getElementById('easy-seas-overlay');
      return;
    }
    if (!document.body) {
      setTimeout(createOverlay, 200);
      return;
    }
    var overlay = document.createElement('div');
    overlay.id = 'easy-seas-overlay';
    overlay.innerHTML = '' +
      '<div id="easy-seas-header">' +
      '<div id="easy-seas-icon">⚓</div>' +
      '<div style="flex:1">' +
      '<div id="easy-seas-title">Easy Seas™</div>' +
      '<div id="easy-seas-subtitle">Automated Cruise Data Sync</div>' +
      '</div>' +
      '</div>' +
      '<div id="easy-seas-content">' +
      '<div id="easy-seas-progress">' +
      '<div class="es-step-indicator">' +
      '<div class="es-step"></div><div class="es-step"></div><div class="es-step"></div><div class="es-step"></div>' +
      '</div>' +
      '<div class="es-progress-text">Ready</div>' +
      '<div class="es-progress-bar"><div class="es-progress-fill" id="progress-fill"></div></div>' +
      '</div>' +
      '<div class="es-status-row"><span class="es-status-label">Login Status</span><span class="es-badge es-badge-warning" id="login-status">CHECKING...</span></div>' +
      '<div class="es-status-row"><span class="es-status-label">Casino Offers</span><span class="es-status-value" id="offer-count">0</span></div>' +
      '<div class="es-status-row"><span class="es-status-label">Booked Cruises</span><span class="es-status-value" id="booking-count">0</span></div>' +
      '<div class="es-status-row"><span class="es-status-label">Loyalty</span><span class="es-status-value" id="loyalty-status">--</span></div>' +
      '<div class="es-status-row"><span class="es-status-label">Cruise Line</span><span class="es-status-value" id="cruise-line">--</span></div>' +
      '<div id="easy-seas-buttons">' +
      '<button class="es-button es-button-primary" id="sync-btn" disabled><span>START SYNC</span></button>' +
      '<button class="es-button es-button-secondary" id="download-btn" disabled><span>DOWNLOAD CSVs</span></button>' +
      '</div>' +
      '<div id="easy-seas-log"></div>' +
      '</div>';
    document.body.appendChild(overlay);
    overlayElement = overlay;
    document.getElementById('sync-btn').addEventListener('click', toggleSync);
    document.getElementById('download-btn').addEventListener('click', downloadCSVs);
    updateUI();
  }

  function ensureOverlay() {
    if (!document.getElementById('easy-seas-overlay') && document.body) {
      overlayElement = null;
      createOverlay();
    }
  }

  function watchForOverlayRemoval() {
    if (!document.body) {
      setTimeout(watchForOverlayRemoval, 300);
      return;
    }
    var observer = new MutationObserver(function() { ensureOverlay(); });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  function closeSelf() {
    try { window.close(); } catch (e) {
      try { chrome.runtime.sendMessage({ type: 'close_self' }); } catch (innerError) {}
    }
  }

  function storeCapturedData(key, data) {
    try {
      var payload = {};
      payload['es_' + key] = data;
      payload['es_' + key + '_ts'] = Date.now();
      chrome.storage.local.set(payload);
    } catch (e) {}
  }

  window.addEventListener('message', function(event) {
    if (!event.data || event.data.source !== 'easy-seas-page') return;

    if (event.data.type === 'auth_data') {
      if (event.data.auth && event.data.auth.accountId) {
        authContext = {
          token: event.data.auth.token || '',
          accountId: event.data.auth.accountId,
          loyaltyId: event.data.auth.loyaltyId || '',
          firstName: event.data.auth.firstName || '',
          appKey: event.data.appKey || ''
        };
        capturedData.isLoggedIn = true;
        if (!isHelperPage) addLog('User logged in' + (authContext.firstName ? ' as ' + authContext.firstName : ''), 'success');
        updateUI();
      } else if (capturedData.cruiseLine === 'carnival') {
        refreshCarnivalSession(false);
        updateUI();
      }
      return;
    }

    if (event.data.type === 'api_captured' && event.data.key) {
      capturedData[event.data.key] = event.data.data;
      storeCapturedData(event.data.key, event.data.data);
      if (!isHelperPage) {
        addLog('Captured ' + event.data.key + (event.data.url ? ' from ' + String(event.data.url).replace(/https:[/][/][^/]+/, '') : ''), 'success');
        updateUI();
      }
    }
  });

  function openRealTabs(urls) {
    return new Promise(function(resolve) {
      try {
        chrome.runtime.sendMessage({ type: 'open_sync_tabs', urls: urls }, function(response) {
          resolve(response || { success: true });
        });
      } catch (error) {
        urls.forEach(function(url) {
          try { window.open(url, '_blank', 'width=1,height=1'); } catch (innerError) {}
        });
        resolve({ success: true });
      }
    });
  }

  function pollForHelperData(timeoutMs) {
    return new Promise(function(resolve) {
      var end = Date.now() + timeoutMs;
      var lastSeen = {};
      function poll() {
        if (!syncState.isRunning) {
          resolve();
          return;
        }
        try {
          chrome.storage.local.get([
            'es_offers', 'es_offers_ts',
            'es_upcomingCruises', 'es_upcomingCruises_ts',
            'es_courtesyHolds', 'es_courtesyHolds_ts',
            'es_loyalty', 'es_loyalty_ts',
            'es_carnivalOffersRows', 'es_carnivalOffersRows_ts',
            'es_carnivalBookingsRows', 'es_carnivalBookingsRows_ts'
          ], function(result) {
            var mappings = [
              { storageKey: 'es_offers', tsKey: 'es_offers_ts', targetKey: 'offers' },
              { storageKey: 'es_upcomingCruises', tsKey: 'es_upcomingCruises_ts', targetKey: 'upcomingCruises' },
              { storageKey: 'es_courtesyHolds', tsKey: 'es_courtesyHolds_ts', targetKey: 'courtesyHolds' },
              { storageKey: 'es_loyalty', tsKey: 'es_loyalty_ts', targetKey: 'loyalty' },
              { storageKey: 'es_carnivalOffersRows', tsKey: 'es_carnivalOffersRows_ts', targetKey: 'carnivalOffersRows' },
              { storageKey: 'es_carnivalBookingsRows', tsKey: 'es_carnivalBookingsRows_ts', targetKey: 'carnivalBookingsRows' }
            ];
            for (var i = 0; i < mappings.length; i++) {
              var mapping = mappings[i];
              var ts = result[mapping.tsKey] || 0;
              if (result[mapping.storageKey] && ts > (lastSeen[mapping.storageKey] || 0)) {
                lastSeen[mapping.storageKey] = ts;
                capturedData[mapping.targetKey] = result[mapping.storageKey];
                if (!isHelperPage) {
                  addLog('Helper tab captured ' + mapping.targetKey, 'success');
                  updateUI();
                }
              }
            }

            var haveOffers = getOffersCount() > 0;
            var haveBookings = getBookingsCount() > 0;
            var haveLoyalty = !!capturedData.loyalty;
            var shouldResolve = capturedData.cruiseLine === 'carnival'
              ? (haveOffers || haveBookings || haveLoyalty)
              : ((haveOffers || haveBookings) && haveLoyalty);

            if (shouldResolve || Date.now() >= end) {
              resolve();
            } else {
              setTimeout(poll, 1500);
            }
          });
        } catch (error) {
          if (Date.now() >= end) resolve();
          else setTimeout(poll, 1500);
        }
      }
      poll();
    });
  }

  function buildHeaders() {
    var headers = {
      accept: 'application/json',
      'content-type': 'application/json'
    };
    if (authContext && authContext.accountId) headers['account-id'] = authContext.accountId;
    if (authContext && authContext.token && authContext.token !== 'carnival-cookie-session') headers.authorization = authContext.token;
    if (authContext && authContext.appKey) {
      headers.appkey = authContext.appKey;
      headers['x-api-key'] = authContext.appKey;
    }
    return headers;
  }

  async function fetchWithRetry(url, options, retries) {
    var maxRetries = typeof retries === 'number' ? retries : 1;
    for (var attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        var response = await fetch(url, options);
        if (response && response.ok) return response;
      } catch (error) {}
      await new Promise(function(resolve) { setTimeout(resolve, 1000); });
    }
    return null;
  }

  async function fetchLoyaltyDirect() {
    if (!authContext || capturedData.cruiseLine === 'carnival') return false;
    var headers = buildHeaders();
    var url = capturedData.cruiseLine === 'celebrity'
      ? 'https://aws-prd.api.rccl.com/en/celebrity/web/v3/guestAccounts/' + encodeURIComponent(authContext.accountId)
      : 'https://aws-prd.api.rccl.com/en/royal/web/v1/guestAccounts/loyalty/info';
    var response = await fetchWithRetry(url, { method: 'GET', headers: headers, credentials: 'omit' }, 1);
    if (!response) return false;
    try {
      capturedData.loyalty = await response.json();
      storeCapturedData('loyalty', capturedData.loyalty);
      addLog('Captured loyalty data via direct API call', 'success');
      updateUI();
      return true;
    } catch (error) {
      return false;
    }
  }

  function clearCapturedStorage() {
    try {
      chrome.storage.local.remove([
        'es_offers', 'es_offers_ts',
        'es_upcomingCruises', 'es_upcomingCruises_ts',
        'es_courtesyHolds', 'es_courtesyHolds_ts',
        'es_loyalty', 'es_loyalty_ts',
        'es_carnivalOffersRows', 'es_carnivalOffersRows_ts',
        'es_carnivalBookingsRows', 'es_carnivalBookingsRows_ts',
        'esSyncActive', 'esSyncTimestamp', 'esSyncPending'
      ]);
    } catch (error) {}
  }

  function resetCapturedData() {
    capturedData.offers = null;
    capturedData.upcomingCruises = null;
    capturedData.courtesyHolds = null;
    capturedData.loyalty = capturedData.cruiseLine === 'carnival' ? capturedData.loyalty : null;
    capturedData.carnivalOffersRows = [];
    capturedData.carnivalBookingsRows = [];
    pricingCache = {};
  }

  function finishSync() {
    syncState.isRunning = false;
    updateProgress(syncState.totalSteps, syncState.totalSteps, 'Sync complete!');
    addLog('Sync complete! ' + getOffersCount() + ' offers, ' + getBookingsCount() + ' bookings' + (capturedData.loyalty ? ', loyalty captured' : ', no loyalty'), 'success');
    try {
      chrome.storage.local.set({
        esLastData: capturedData,
        esLastSync: Date.now(),
        esSyncPending: false,
        esSyncActive: false
      });
    } catch (error) {}
    updateUI();
  }

  function stopSync() {
    syncState.isRunning = false;
    try { chrome.storage.local.remove(['esSyncActive', 'esSyncTimestamp']); } catch (error) {}
    addLog('Sync stopped', 'warning');
    updateUI();
  }

  async function runSync() {
    syncState.isRunning = true;
    syncState.currentStep = 0;
    syncState.totalSteps = capturedData.cruiseLine === 'carnival' ? 4 : 3;
    clearCapturedStorage();
    resetCapturedData();
    injectPageScript();
    refreshCarnivalSession(true);
    updateUI();

    if (!capturedData.isLoggedIn) {
      addLog('Please log in first', 'error');
      syncState.isRunning = false;
      updateUI();
      return;
    }

    try {
      chrome.storage.local.set({ esSyncActive: true, esSyncTimestamp: Date.now(), esSyncPending: true });
    } catch (error) {}

    if (capturedData.cruiseLine === 'carnival') {
      updateProgress(1, 4, 'Step 1/4: Opening Carnival pages...');
      addLog('Opening Carnival personalized offers and account pages...', 'info');
      var currentCarnivalUrl = window.location.href || 'https://www.carnival.com/';
      var carnivalHelperUrls = [
        currentCarnivalUrl,
        'https://www.carnival.com/profilemanagement/profiles/cruises',
        'https://www.carnival.com/profilemanagement/profiles',
        'https://www.carnival.com/profilemanagement/profiles/offers'
      ].filter(function(url, index, array) {
        return !!url && array.indexOf(url) === index;
      });
      await openRealTabs(carnivalHelperUrls);

      updateProgress(2, 4, 'Step 2/4: Capturing Carnival data...');
      await pollForHelperData(22000);

      if ((path.indexOf('/cruise-deals') !== -1 || path.indexOf('/cruise-search') !== -1 || path.indexOf('/offers') !== -1) && capturedData.carnivalOffersRows.length === 0) {
        capturedData.carnivalOffersRows = scrapeCarnivalOfferRowsFromDOM();
      }
      if (path.indexOf('/profilemanagement/profiles') !== -1 && capturedData.carnivalBookingsRows.length === 0) {
        capturedData.carnivalBookingsRows = scrapeCarnivalBookingsRowsFromDOM();
      }
      if (capturedData.carnivalOffersRows.length > 0) addLog('Captured ' + capturedData.carnivalOffersRows.length + ' Carnival deal rows', 'success');
      if (capturedData.carnivalBookingsRows.length > 0) addLog('Captured ' + capturedData.carnivalBookingsRows.length + ' Carnival booking rows', 'success');

      updateProgress(3, 4, 'Step 3/4: Verifying Carnival session...');
      refreshCarnivalSession(true);
      if (capturedData.carnivalOffersRows.length === 0 && capturedData.carnivalBookingsRows.length === 0) {
        addLog('No Carnival rows were captured. Keep the Carnival tab signed in and retry.', 'warning');
      }

      updateProgress(4, 4, 'Step 4/4: Finalizing Carnival sync...');
      finishSync();
      return;
    }

    var helperUrls = capturedData.cruiseLine === 'celebrity'
      ? [
          'https://www.celebritycruises.com/blue-chip-club/offers',
          'https://www.celebritycruises.com/account/upcoming-cruises',
          'https://www.celebritycruises.com/account/loyalty-programs'
        ]
      : [
          'https://www.royalcaribbean.com/club-royale/offers',
          'https://www.royalcaribbean.com/account/upcoming-cruises',
          'https://www.royalcaribbean.com/account/courtesy-holds',
          'https://www.royalcaribbean.com/account/loyalty-programs'
        ];

    updateProgress(1, 3, 'Step 1/3: Opening cruise pages...');
    addLog('Opening offers and account pages...', 'info');
    await openRealTabs(helperUrls);

    updateProgress(2, 3, 'Step 2/3: Capturing offers, bookings, and loyalty...');
    await pollForHelperData(26000);

    updateProgress(3, 3, 'Step 3/3: Finishing sync...');
    if (!capturedData.loyalty) {
      await fetchLoyaltyDirect();
    }
    finishSync();
  }

  function toggleSync() {
    if (syncState.isRunning) {
      stopSync();
      return;
    }
    void runSync();
  }

  function esc(value) {
    var stringValue = String(value == null ? '' : value);
    return '"' + stringValue.replace(/"/g, '""') + '"';
  }

  function fmtDate(value) {
    if (!value) return '';
    try {
      var date = new Date(value);
      if (isNaN(date.getTime())) return String(value);
      return date.toISOString().split('T')[0];
    } catch (error) {
      return String(value);
    }
  }

  function fmtPrice(value) {
    if (value == null || value === '') return '';
    var numberValue = typeof value === 'number' ? value : parseFloat(String(value).replace(/[^\\d.]/g, ''));
    if (isNaN(numberValue)) return String(value);
    return '$' + numberValue.toFixed(2);
  }

  function getOfferTypeStr(offer) {
    if (!offer) return 'Offer';
    if (offer.offerType) return String(offer.offerType);
    if (offer.tradeInValue) return 'Trade-In Offer';
    return 'Casino Offer';
  }

  function buildOffersCSV() {
    var loyaltyInfo = capturedData.loyalty && capturedData.loyalty.loyaltyInformation
      ? capturedData.loyalty.loyaltyInformation
      : (capturedData.loyalty && capturedData.loyalty.payload && capturedData.loyalty.payload.loyaltyInformation ? capturedData.loyalty.payload.loyaltyInformation : null);
    var loyaltyLevel = loyaltyInfo ? (loyaltyInfo.crownAndAnchorLevel || loyaltyInfo.clubRoyaleTier || '') : '';
    var loyaltyPoints = loyaltyInfo ? (loyaltyInfo.crownAndAnchorPoints || loyaltyInfo.vifpNumber || '') : '';

    var header = ['Source Page','Offer Name','Offer Code','Offer Expiration Date','Offer Type','Ship Name','Sailing Date','Nights','Itinerary','Departure Port','Room Type','Guests Info','Perks','Loyalty Level','Loyalty Points','Interior Price','Oceanview Price','Balcony Price','Suite Price','Port Taxes & Fees','Ports & Times'].map(esc).join(',');

    if (capturedData.cruiseLine === 'carnival') {
      if (!capturedData.carnivalOffersRows.length) return null;
      var carnivalRows = [header];
      capturedData.carnivalOffersRows.forEach(function(row) {
        carnivalRows.push([
          esc(row.sourcePage || 'Carnival Cruise Deals'), esc(row.offerName || ''), esc(row.offerCode || ''), esc(row.offerExpirationDate || ''), esc(row.offerType || 'VIFP Club'),
          esc(row.shipName || ''), esc(row.sailingDate || ''), esc(row.nights || ''), esc(row.itinerary || ''), esc(row.departurePort || ''),
          esc(row.roomType || ''), esc(row.guestsInfo || '2 Guests'), esc(row.perks || ''), esc(loyaltyLevel), esc(loyaltyPoints),
          esc(row.interiorPrice || ''), esc(row.oceanviewPrice || ''), esc(row.balconyPrice || ''), esc(row.suitePrice || ''), esc(row.taxesAndFees || ''), esc(row.portsAndTimes || '')
        ].join(','));
      });
      return carnivalRows.join('\n');
    }

    if (!capturedData.offers) return null;
    var offers = Array.isArray(capturedData.offers.offers) ? capturedData.offers.offers : (Array.isArray(capturedData.offers) ? capturedData.offers : []);
    if (!offers.length) return null;
    var rows = [header];
    offers.forEach(function(entry) {
      var offer = entry.campaignOffer || entry;
      var sailings = Array.isArray(offer.sailings) && offer.sailings.length > 0 ? offer.sailings : [{}];
      sailings.forEach(function(sailing) {
        var shipCode = String(sailing.shipCode || '').trim();
        var shipName = sailing.shipName || ROYAL_SHIPS[shipCode] || shipCode || '';
        rows.push([
          esc(capturedData.cruiseLine === 'celebrity' ? 'Blue Chip Club' : 'Club Royale Offers'),
          esc(offer.name || offer.offerName || ''),
          esc(offer.offerCode || ''),
          esc(fmtDate(offer.reserveByDate || offer.expirationDate || '')),
          esc(getOfferTypeStr(offer)),
          esc(shipName),
          esc(fmtDate(sailing.sailDate || '')),
          esc(sailing.numberOfNights || sailing.duration || ''),
          esc(sailing.itineraryDescription || ''),
          esc(sailing.departurePort && sailing.departurePort.name ? sailing.departurePort.name : (sailing.departurePort || '')),
          esc(sailing.roomType || sailing.cabinType || ''),
          esc(sailing.isGOBO ? '1 Guest' : '2 Guests'),
          esc(offer.tradeInValue ? '$' + offer.tradeInValue + ' trade-in' : ''),
          esc(loyaltyLevel),
          esc(loyaltyPoints),
          esc(fmtPrice(sailing.interiorPrice || '')),
          esc(fmtPrice(sailing.oceanviewPrice || '')),
          esc(fmtPrice(sailing.balconyPrice || '')),
          esc(fmtPrice(sailing.suitePrice || '')),
          esc(fmtPrice(sailing.taxes || '')),
          esc('')
        ].join(','));
      });
    });
    return rows.join('\n');
  }

  function buildBookedCSV() {
    var loyaltyInfo = capturedData.loyalty && capturedData.loyalty.loyaltyInformation
      ? capturedData.loyalty.loyaltyInformation
      : (capturedData.loyalty && capturedData.loyalty.payload && capturedData.loyalty.payload.loyaltyInformation ? capturedData.loyalty.payload.loyaltyInformation : null);
    var loyaltyLevel = loyaltyInfo ? (loyaltyInfo.crownAndAnchorLevel || loyaltyInfo.clubRoyaleTier || '') : '';
    var loyaltyPoints = loyaltyInfo ? (loyaltyInfo.crownAndAnchorPoints || loyaltyInfo.vifpNumber || '') : '';
    var header = ['Source','Ship Name','Sail Date','Return Date','Nights','Itinerary','Departure Port','Cabin Type','Cabin #','Booking ID','Status','Loyalty Level','Loyalty Points'].map(esc).join(',');

    if (capturedData.cruiseLine === 'carnival') {
      if (!capturedData.carnivalBookingsRows.length) return null;
      var carnivalRows = [header];
      capturedData.carnivalBookingsRows.forEach(function(row) {
        carnivalRows.push([
          esc(row.source || row.status || 'Upcoming'), esc(row.shipName || ''), esc(row.sailDate || ''), esc(row.returnDate || ''), esc(row.nights || ''),
          esc(row.itinerary || ''), esc(row.departurePort || ''), esc(row.cabinType || ''), esc(row.cabinNumber || ''), esc(row.bookingId || ''), esc(row.status || row.source || 'Upcoming'),
          esc(loyaltyLevel), esc(loyaltyPoints)
        ].join(','));
      });
      return carnivalRows.join('\n');
    }

    var rows = [header];
    var bookings = extractBookings(capturedData.upcomingCruises).map(function(entry) { return { source: 'Upcoming', data: entry }; })
      .concat(extractBookings(capturedData.courtesyHolds).map(function(entry) { return { source: 'Courtesy Hold', data: entry }; }));
    if (!bookings.length) return null;
    bookings.forEach(function(entry) {
      var booking = entry.data || {};
      var shipCode = String(booking.shipCode || '').trim();
      var shipName = ROYAL_SHIPS[shipCode] || booking.shipName || (shipCode ? shipCode + ' of the Seas' : '');
      var cabinType = CABIN_TYPES[booking.stateroomType || ''] || booking.stateroomType || booking.cabinType || '';
      rows.push([
        esc(entry.source),
        esc(shipName),
        esc(fmtDate(booking.sailDate || '')),
        esc(fmtDate(booking.returnDate || booking.endDate || '')),
        esc(booking.numberOfNights || ''),
        esc(booking.cruiseTitle || booking.itineraryDescription || ''),
        esc(booking.departurePort && booking.departurePort.name ? booking.departurePort.name : (booking.departurePort || '')),
        esc(cabinType),
        esc(booking.stateroomNumber || booking.cabinNumber || ''),
        esc(booking.bookingId || booking.masterBookingId || ''),
        esc(booking.bookingStatus === 'OF' ? 'Courtesy Hold' : entry.source),
        esc(loyaltyLevel),
        esc(loyaltyPoints)
      ].join(','));
    });
    return rows.join('\n');
  }

  function triggerDownload(content, filename) {
    var blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
    var url = URL.createObjectURL(blob);
    var link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    setTimeout(function() {
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }, 200);
  }

  function downloadCSVs() {
    addLog('Generating CSV files...', 'info');
    var downloaded = 0;
    var offersCsv = buildOffersCSV();
    if (offersCsv) {
      triggerDownload(offersCsv, 'offers.csv');
      addLog('Exported offers.csv', 'success');
      downloaded += 1;
    }
    setTimeout(function() {
      var bookedCsv = buildBookedCSV();
      if (bookedCsv) {
        triggerDownload(bookedCsv, 'booked.csv');
        addLog('Exported booked.csv', 'success');
        downloaded += 1;
      }
      if (downloaded === 0) addLog('No data to export yet - run sync first', 'warning');
      else addLog('Downloaded ' + downloaded + ' CSV file(s)', 'success');
    }, 300);
  }

  if (isHelperPage) {
    try {
      chrome.storage.local.get(['esSyncActive', 'esSyncTimestamp'], function(result) {
        if (!result.esSyncActive) return;
        var age = Date.now() - (result.esSyncTimestamp || 0);
        if (age > 120000) return;
        injectPageScript();
        if (capturedData.cruiseLine === 'carnival') {
          setTimeout(function() { captureCarnivalHelperPage(); }, 4000);
          setTimeout(function() { captureCarnivalHelperPage(); }, 9000);
          setTimeout(function() { closeSelf(); }, 18000);
        } else {
          setTimeout(function() { closeSelf(); }, 25000);
        }
      });
    } catch (error) {
      injectPageScript();
      if (capturedData.cruiseLine === 'carnival') {
        setTimeout(function() { captureCarnivalHelperPage(); }, 5000);
      }
    }
    return;
  }

  function init() {
    injectPageScript();
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', function() {
        createOverlay();
        watchForOverlayRemoval();
        refreshCarnivalSession(true);
        addLog('Extension ready on ' + capturedData.cruiseLine, 'info');
      });
    } else {
      createOverlay();
      watchForOverlayRemoval();
      refreshCarnivalSession(true);
      addLog('Extension ready on ' + capturedData.cruiseLine, 'info');
    }
    setInterval(function() {
      ensureOverlay();
      refreshCarnivalSession(false);
      try { window.postMessage({ source: 'easy-seas-ext', type: 'get_auth' }, '*'); } catch (error) {}
      updateUI();
    }, 5000);
  }

  init();
}();`;
}

function getOverlayCSS(): string {
  return `#easy-seas-overlay {
  position: fixed !important;
  top: 20px !important;
  right: 20px !important;
  width: 400px !important;
  max-height: 600px !important;
  background: linear-gradient(135deg, #0f172a 0%, #1d4ed8 100%) !important;
  border-radius: 16px !important;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.45), 0 0 0 1px rgba(255, 255, 255, 0.08) !important;
  z-index: 2147483647 !important;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important;
  color: #fff !important;
  display: flex !important;
  flex-direction: column !important;
  overflow: hidden !important;
  backdrop-filter: blur(16px) !important;
}
#easy-seas-overlay * { box-sizing: border-box !important; }
#easy-seas-header { padding: 18px !important; display: flex !important; align-items: center !important; gap: 12px !important; border-bottom: 1px solid rgba(255,255,255,0.08) !important; }
#easy-seas-icon { width: 32px !important; height: 32px !important; font-size: 24px !important; display: flex !important; align-items: center !important; justify-content: center !important; }
#easy-seas-title { font-size: 18px !important; font-weight: 700 !important; color: #fff !important; }
#easy-seas-subtitle { font-size: 12px !important; color: rgba(255,255,255,0.7) !important; margin-top: 4px !important; }
#easy-seas-content { padding: 18px !important; max-height: 500px !important; overflow-y: auto !important; }
#easy-seas-progress { display: none !important; margin-bottom: 16px !important; }
#easy-seas-progress.active { display: block !important; }
.es-step-indicator { display: flex !important; gap: 8px !important; margin-bottom: 10px !important; }
.es-step { flex: 1 !important; height: 4px !important; border-radius: 999px !important; background: rgba(255,255,255,0.12) !important; }
.es-step.active { background: #38bdf8 !important; }
.es-step.completed { background: #10b981 !important; }
.es-progress-text { font-size: 12px !important; color: rgba(255,255,255,0.75) !important; margin-bottom: 8px !important; text-align: center !important; }
.es-progress-bar { height: 6px !important; border-radius: 999px !important; overflow: hidden !important; background: rgba(255,255,255,0.1) !important; }
.es-progress-fill { height: 100% !important; width: 0% !important; background: linear-gradient(90deg, #38bdf8, #10b981) !important; }
.es-status-row { display: flex !important; align-items: center !important; justify-content: space-between !important; gap: 12px !important; padding: 10px 0 !important; border-bottom: 1px solid rgba(255,255,255,0.06) !important; }
.es-status-label { font-size: 13px !important; color: rgba(255,255,255,0.75) !important; }
.es-status-value { font-size: 14px !important; font-weight: 600 !important; color: #fff !important; }
.es-badge { border-radius: 999px !important; padding: 5px 10px !important; font-size: 12px !important; font-weight: 700 !important; }
.es-badge-success { background: rgba(16,185,129,0.18) !important; color: #4ade80 !important; }
.es-badge-warning { background: rgba(245,158,11,0.18) !important; color: #fbbf24 !important; }
#easy-seas-buttons { display: flex !important; gap: 10px !important; margin-top: 18px !important; }
.es-button { flex: 1 !important; min-height: 44px !important; border-radius: 10px !important; border: none !important; font-size: 14px !important; font-weight: 700 !important; cursor: pointer !important; display: flex !important; align-items: center !important; justify-content: center !important; gap: 8px !important; }
.es-button:disabled { opacity: 0.45 !important; cursor: not-allowed !important; }
.es-button-primary { background: #10b981 !important; color: #fff !important; }
.es-button-secondary { background: rgba(59,130,246,0.18) !important; color: #93c5fd !important; border: 1px solid rgba(147,197,253,0.25) !important; }
.es-button-stop { background: rgba(239,68,68,0.16) !important; color: #fca5a5 !important; border: 1px solid rgba(252,165,165,0.28) !important; }
.es-spinner { width: 14px !important; height: 14px !important; border: 2px solid rgba(255,255,255,0.24) !important; border-top-color: #fff !important; border-radius: 999px !important; animation: easy-seas-spin 0.8s linear infinite !important; }
#easy-seas-log { margin-top: 16px !important; padding: 12px !important; border-radius: 10px !important; background: rgba(0,0,0,0.26) !important; max-height: 180px !important; overflow-y: auto !important; font-family: ui-monospace, SFMono-Regular, Menlo, monospace !important; font-size: 11px !important; line-height: 1.5 !important; }
.es-log-entry { margin-bottom: 4px !important; }
.es-log-success { color: #4ade80 !important; }
.es-log-warning { color: #fbbf24 !important; }
.es-log-error { color: #fca5a5 !important; }
.es-log-info { color: #93c5fd !important; }
@keyframes easy-seas-spin { to { transform: rotate(360deg); } }`;
}

export async function downloadScraperExtension(): Promise<{ success: boolean; error?: string; filesAdded?: number }> {
  if (Platform.OS !== 'web') {
    console.log('[ChromeExtension] Download only available on web');
    return { success: false, error: 'Download only available on web browser' };
  }

  try {
    console.log(`[ChromeExtension] Creating Easy Seas Sync extension ZIP v${EASY_SEAS_EXTENSION_VERSION}...`);
    const zip = new JSZipLib();
    const extensionFiles = getEasySeasExtensionFiles();

    for (const [filename, content] of Object.entries(extensionFiles)) {
      zip.file(filename, content);
      console.log(`[ChromeExtension] Added ${filename}`);
    }

    zip.file('icons/icon16.png', createPlaceholderIcon('ES', '#1d4ed8', 16));
    zip.file('icons/icon48.png', createPlaceholderIcon('ES', '#1d4ed8', 48));
    zip.file('icons/icon128.png', createPlaceholderIcon('ES', '#1d4ed8', 128));

    const fileCount = Object.keys(zip.files).length;
    const blob = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `Easy_Seas_Sync_v${EASY_SEAS_EXTENSION_VERSION}.zip`;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);

    console.log(`[ChromeExtension] Easy Seas Sync extension v${EASY_SEAS_EXTENSION_VERSION} download initiated successfully`);
    return { success: true, filesAdded: fileCount };
  } catch (error) {
    console.error('[ChromeExtension] Error creating extension ZIP:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
}

export async function downloadChromeExtension(): Promise<{ success: boolean; error?: string; filesAdded?: number }> {
  return downloadScraperExtension();
}

function createPlaceholderIcon(text: string = 'ES', bgColor: string = '#1d4ed8', size: number = 128): Uint8Array {
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
  for (let index = 0; index < binaryString.length; index += 1) {
    bytes[index] = binaryString.charCodeAt(index);
  }
  return bytes;
}
