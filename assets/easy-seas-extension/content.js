void function() {
  'use strict';

  if (window.__easySeasLoaded) return;
  window.__easySeasLoaded = true;
  console.log('[Easy Seas] Content script v5 loaded on', window.location.href);

  var overlayElement = null;
  var authContext = null;
  var pricingCache = {};
  var capturedData = {
    offers: null, upcomingCruises: null, courtesyHolds: null, loyalty: null,
    isLoggedIn: false,
    cruiseLine: window.location.hostname.includes('celebrity') ? 'celebrity' : 'royal'
  };

  var SYNC_STEPS = {
    IDLE: 'idle',
    OFFERS: 'offers',
    PRICING: 'pricing',
    UPCOMING: 'upcoming',
    COURTESY: 'courtesy',
    LOYALTY: 'loyalty',
    BOUNCE_UPCOMING: 'bounce_upcoming',
    BOUNCE_OFFERS: 'bounce_offers',
    BOUNCE_COURTESY: 'bounce_courtesy',
    BOUNCE_LOYALTY: 'bounce_loyalty',
    DONE: 'done'
  };

  function getBaseUrl() {
    return capturedData.cruiseLine === 'celebrity'
      ? 'https://www.celebritycruises.com'
      : 'https://www.royalcaribbean.com';
  }

  function getPageUrls() {
    var base = getBaseUrl();
    var isCeleb = capturedData.cruiseLine === 'celebrity';
    return {
      offers: base + (isCeleb ? '/blue-chip/offers' : '/club-royale/offers'),
      upcoming: base + '/account/upcoming-cruises',
      courtesy: base + '/account/courtesy-holds',
      loyalty: base + (isCeleb ? '/account/blue-chip' : '/account/club-royale')
    };
  }

  function injectPageScript() {
    var s = document.createElement('script');
    s.src = chrome.runtime.getURL('page-script.js');
    s.onload = function() { s.remove(); };
    s.onerror = function() { s.remove(); };
    (document.head || document.documentElement).appendChild(s);
  }

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
        addLog('User logged in' + (authContext.firstName ? ' as ' + authContext.firstName : ''), 'success');
        saveCapturedToStorage();
      } else {
        checkAuthFromDOM();
      }
      updateUI();
    }
    if (e.data.type === 'api_captured' && e.data.data) {
      capturedData[e.data.key] = e.data.data;
      var cnt = countItems(e.data.key, e.data.data);
      addLog('Passively captured ' + e.data.key + (cnt ? ' (' + cnt + ' items)' : ''), 'success');
      saveCapturedToStorage();
      updateUI();
    }
  });

  function saveCapturedToStorage() {
    try {
      var toSave = {};
      if (capturedData.offers) toSave.es_offers = capturedData.offers;
      if (capturedData.upcomingCruises) toSave.es_upcomingCruises = capturedData.upcomingCruises;
      if (capturedData.courtesyHolds) toSave.es_courtesyHolds = capturedData.courtesyHolds;
      if (capturedData.loyalty) toSave.es_loyalty = capturedData.loyalty;
      if (authContext) toSave.es_auth = authContext;
      if (Object.keys(pricingCache).length) toSave.es_pricingCache = pricingCache;
      toSave.es_cruiseLine = capturedData.cruiseLine;
      toSave.es_isLoggedIn = capturedData.isLoggedIn;
      chrome.storage.local.set(toSave);
    } catch(ex) { console.error('[Easy Seas] Storage save error:', ex); }
  }

  async function loadCapturedFromStorage() {
    try {
      var r = await chrome.storage.local.get([
        'es_offers', 'es_upcomingCruises', 'es_courtesyHolds', 'es_loyalty',
        'es_auth', 'es_cruiseLine', 'es_isLoggedIn', 'es_pricingCache'
      ]);
      if (r.es_offers) capturedData.offers = r.es_offers;
      if (r.es_upcomingCruises) capturedData.upcomingCruises = r.es_upcomingCruises;
      if (r.es_courtesyHolds) capturedData.courtesyHolds = r.es_courtesyHolds;
      if (r.es_loyalty) capturedData.loyalty = r.es_loyalty;
      if (r.es_auth) { authContext = r.es_auth; capturedData.isLoggedIn = true; }
      if (r.es_cruiseLine) capturedData.cruiseLine = r.es_cruiseLine;
      if (r.es_isLoggedIn) capturedData.isLoggedIn = r.es_isLoggedIn;
      if (r.es_pricingCache) pricingCache = r.es_pricingCache;
    } catch(ex) { console.error('[Easy Seas] Storage load error:', ex); }
  }

  async function getSyncState() {
    try {
      var r = await chrome.storage.local.get(['es_syncStep', 'es_syncBounceCount', 'es_syncLogs']);
      return {
        step: r.es_syncStep || SYNC_STEPS.IDLE,
        bounceCount: r.es_syncBounceCount || 0,
        logs: r.es_syncLogs || []
      };
    } catch(ex) { return { step: SYNC_STEPS.IDLE, bounceCount: 0, logs: [] }; }
  }

  async function setSyncState(step, bounceCount) {
    try {
      var toSave = { es_syncStep: step };
      if (bounceCount !== undefined) toSave.es_syncBounceCount = bounceCount;
      await chrome.storage.local.set(toSave);
    } catch(ex) {}
  }

  async function clearSyncState() {
    try {
      await chrome.storage.local.remove(['es_syncStep', 'es_syncBounceCount', 'es_syncLogs', 'es_navTarget']);
    } catch(ex) {}
  }

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
    if (document.getElementById('easy-seas-overlay')) {
      overlayElement = document.getElementById('easy-seas-overlay');
      return;
    }
    if (!document.body) { setTimeout(createOverlay, 200); return; }

    var overlay = document.createElement('div');
    overlay.id = 'easy-seas-overlay';
    overlay.innerHTML = '<div id="easy-seas-header">' +
      '<div id="easy-seas-icon">\u2693</div>' +
      '<div style="flex: 1;">' +
      '<div id="easy-seas-title">Easy Seas\u2122</div>' +
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
      '<div class="es-step" data-step="6"></div>' +
      '</div>' +
      '<div class="es-progress-text">Syncing Data...</div>' +
      '<div class="es-progress-bar"><div class="es-progress-fill" id="progress-fill"></div></div>' +
      '</div>' +
      '<div class="es-status-row"><span class="es-status-label">Login Status</span>' +
      '<span class="es-badge es-badge-warning" id="login-status">CHECKING...</span></div>' +
      '<div class="es-status-row"><span class="es-status-label">Casino Offers</span>' +
      '<span class="es-status-value" id="offer-count">0</span></div>' +
      '<div class="es-status-row"><span class="es-status-label">Pricing Data</span>' +
      '<span class="es-status-value" id="pricing-count">0 sailings</span></div>' +
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

  function updateUI() {
    if (!overlayElement) return;
    var loginEl = document.getElementById('login-status');
    if (loginEl) {
      loginEl.textContent = capturedData.isLoggedIn ? 'LOGGED IN' : 'NOT LOGGED IN';
      loginEl.className = capturedData.isLoggedIn ? 'es-badge es-badge-success' : 'es-badge es-badge-warning';
    }
    var offerEl = document.getElementById('offer-count');
    if (offerEl) offerEl.textContent = (capturedData.offers && capturedData.offers.offers && capturedData.offers.offers.length) || 0;

    var pricingEl = document.getElementById('pricing-count');
    if (pricingEl) {
      var pCount = Object.keys(pricingCache).length;
      pricingEl.textContent = pCount + ' sailing' + (pCount !== 1 ? 's' : '');
    }

    var bookEl = document.getElementById('booking-count');
    if (bookEl) bookEl.textContent = getBookingsCount();

    var loyaltyEl = document.getElementById('loyalty-status');
    if (loyaltyEl) loyaltyEl.textContent = capturedData.loyalty ? 'Captured' : '--';

    var lineEl = document.getElementById('cruise-line');
    if (lineEl) lineEl.textContent = capturedData.cruiseLine === 'celebrity' ? 'Celebrity Cruises' : 'Royal Caribbean';

    getSyncState().then(function(state) {
      var isRunning = state.step !== SYNC_STEPS.IDLE && state.step !== SYNC_STEPS.DONE;
      var syncBtn = document.getElementById('sync-btn');
      if (syncBtn) {
        if (isRunning) {
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
        dlBtn.disabled = !hasData || isRunning;
      }
    });
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
    if (step >= total) {
      setTimeout(function() { if (progressEl) progressEl.classList.remove('active'); }, 3000);
    }
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
      if (logEl.children.length > 80) logEl.removeChild(logEl.firstChild);
    }
  }

  function toggleSync() {
    getSyncState().then(function(state) {
      var isRunning = state.step !== SYNC_STEPS.IDLE && state.step !== SYNC_STEPS.DONE;
      if (isRunning) {
        clearSyncState();
        addLog('Sync stopped', 'warning');
        updateUI();
        return;
      }
      if (!capturedData.isLoggedIn || !authContext) {
        addLog('Please log in to the website first', 'error');
        return;
      }
      startSync();
    });
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

  async function fetchWithRetry(url, options, retries) {
    retries = retries || 2;
    for (var i = 0; i <= retries; i++) {
      try {
        var resp = await fetch(url, options);
        if (resp.ok) return resp;
        if (resp.status === 403 || resp.status === 401) {
          addLog('Auth error (' + resp.status + ') on attempt ' + (i + 1), 'warning');
          if (i < retries) await new Promise(function(r) { setTimeout(r, 1500); });
        }
      } catch(e) {
        if (i < retries) await new Promise(function(r) { setTimeout(r, 1000); });
      }
    }
    return null;
  }

  function navigateTo(url, callback) {
    var shortUrl = url.replace(/https:\/\/www\.[^/]+/, '');
    addLog('Navigating to ' + shortUrl, 'info');
    console.log('[Easy Seas] navigateTo:', url, '| from:', window.location.href);
    chrome.storage.local.set({ es_navTarget: url, es_navFrom: window.location.href, es_navAttemptTs: Date.now() });
    var beforeUrl = window.location.href;

    var bgNavSent = false;
    try {
      chrome.runtime.sendMessage({ type: 'navigate', url: url }, function(resp) {
        if (resp && resp.success) {
          addLog('Background nav sent for ' + shortUrl, 'info');
          bgNavSent = true;
        } else {
          var errMsg = (resp && resp.error) ? resp.error : 'no response';
          addLog('Background nav failed (' + errMsg + '), falling back...', 'warning');
          tryWindowNav();
        }
      });
    } catch(e) {
      addLog('Background nav error, falling back...', 'warning');
      tryWindowNav();
    }

    function tryWindowNav() {
      try {
        window.location.href = url;
      } catch(e1) {
        try { window.location.assign(url); } catch(e2) {
          try { window.location.replace(url); } catch(e3) {}
        }
      }
    }

    setTimeout(function() {
      if (window.location.href === beforeUrl) {
        addLog('Still on same page after 2s, trying window.location...', 'warning');
        tryWindowNav();
      } else {
        addLog('Nav confirmed: ' + window.location.href, 'success');
      }
    }, 2000);

    setTimeout(function() {
      if (window.location.href === beforeUrl) {
        addLog('Still stuck after 5s, trying anchor click...', 'warning');
        try {
          var a = document.createElement('a');
          a.href = url;
          a.target = '_self';
          (document.body || document.documentElement).appendChild(a);
          a.click();
          a.remove();
        } catch(e) {}
      }
    }, 5000);

    if (callback) callback();
  }

  // ===== PRICING FETCH (mirrors iOS sync flow) =====

  function resolveStateroomCategory(code) {
    var up = String(code || '').trim().toUpperCase().replace(/\s+/g, ' ');
    var INTERIOR = ['I', 'IN', 'INT', 'INSIDE', 'INTERIOR'];
    var OCEANVIEW = ['O', 'OV', 'OB', 'E', 'OCEAN', 'OCEANVIEW', 'OCEAN VIEW', 'OUTSIDE'];
    var BALCONY = ['B', 'BAL', 'BK', 'BALCONY'];
    var SUITE = ['D', 'DLX', 'DELUXE', 'JS', 'SU', 'SUITE', 'JUNIOR SUITE', 'JR SUITE', 'JRSUITE'];
    if (INTERIOR.indexOf(up) !== -1) return 'INTERIOR';
    if (OCEANVIEW.indexOf(up) !== -1) return 'OCEANVIEW';
    if (BALCONY.indexOf(up) !== -1) return 'BALCONY';
    if (SUITE.indexOf(up) !== -1) return 'SUITE';
    return null;
  }

  function formatPortsAndTimes(days) {
    if (!Array.isArray(days) || !days.length) return '';
    return days.map(function(day) {
      var dayNum = day.number || '';
      var type = (day.type || '').toUpperCase();
      var ports = Array.isArray(day.ports) ? day.ports : [];
      if (!ports.length) {
        return 'Day ' + dayNum + ': ' + (type === 'AT_SEA' ? 'At Sea' : (type || 'At Sea'));
      }
      var portStrs = ports.map(function(pp) {
        var portName = (pp.port && pp.port.name) || '';
        var arrival = (pp.arrivalTime || '').replace(':00:00', '').replace(':00', '');
        var depart = (pp.departureTime || '').replace(':00:00', '').replace(':00', '');
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

    addLog('Step 2: Fetching pricing & itinerary data for all sailings...', 'info');

    // Collect unique ship+date combos grouped by ship code
    var shipGroups = {};
    var totalSailings = 0;
    offers.forEach(function(offer) {
      var co = offer.campaignOffer || offer;
      var sailings = co.sailings || [];
      sailings.forEach(function(s) {
        var shipCode = (s.shipCode || '').toString().trim();
        var sailDate = (s.sailDate || '').toString().trim().slice(0, 10);
        if (!shipCode || !sailDate || sailDate.length < 10) return;
        if (!shipGroups[shipCode]) {
          shipGroups[shipCode] = { minDate: sailDate, maxDate: sailDate, count: 0 };
        }
        if (sailDate < shipGroups[shipCode].minDate) shipGroups[shipCode].minDate = sailDate;
        if (sailDate > shipGroups[shipCode].maxDate) shipGroups[shipCode].maxDate = sailDate;
        shipGroups[shipCode].count++;
        totalSailings++;
      });
    });

    var shipList = Object.keys(shipGroups);
    if (!shipList.length) {
      addLog('No ship codes found in offers — pricing will be empty. Sailings may be missing shipCode.', 'warning');
      return;
    }

    addLog('Fetching pricing for ' + shipList.length + ' ship(s), ' + totalSailings + ' total sailings...', 'info');

    var isCeleb = capturedData.cruiseLine === 'celebrity';
    var graphEndpoint = isCeleb
      ? 'https://www.celebritycruises.com/graph'
      : 'https://www.royalcaribbean.com/graph';

    var GQL_QUERY = 'query cruiseSearch_Cruises($filters:String,$qualifiers:String,$sort:CruiseSearchSort,$pagination:CruiseSearchPagination,$nlSearch:String){cruiseSearch(filters:$filters,qualifiers:$qualifiers,sort:$sort,pagination:$pagination,nlSearch:$nlSearch){results{cruises{masterSailing{itinerary{name code days{number type ports{activity arrivalTime departureTime port{code name region}}}departurePort{code name}destination{code name}sailingNights totalNights ship{code name}}}sailings{id sailDate taxesAndFees{value}taxesAndFeesIncluded stateroomClassPricing{price{value currency{code}}stateroomClass{id content{code}}}}}}}}';

    var fetchedCount = 0;

    for (var si = 0; si < shipList.length; si++) {
      var shipCode = shipList[si];
      var group = shipGroups[shipCode];
      var filtersValue = 'startDate:' + group.minDate + '~' + group.maxDate + '|ship:' + shipCode;
      var paginationCount = Math.min(group.count * 4, 200);

      addLog('  Pricing fetch: ship ' + shipCode + ' (' + group.minDate + ' to ' + group.maxDate + ')...', 'info');

      try {
        var resp = await fetch(graphEndpoint, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'accept': 'application/json',
            'apollographql-client-name': 'rci-NextGen-Cruise-Search',
            'apollographql-query-name': 'cruiseSearch_Cruises',
            'skip_authentication': 'true'
          },
          body: JSON.stringify({
            query: GQL_QUERY,
            variables: { filters: filtersValue, pagination: { count: paginationCount, skip: 0 } }
          })
        });

        if (resp && resp.ok) {
          var data = await resp.json();
          var cruises = (data && data.data && data.data.cruiseSearch && data.data.cruiseSearch.results && data.data.cruiseSearch.results.cruises) || [];
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

              // Parse stateroom pricing — per-person * 2 = dual occupancy cabin price
              var pricing = { interior: null, oceanview: null, balcony: null, suite: null, taxes: null, nights: totalNights, portsAndTimes: portsAndTimes };
              var spArr = Array.isArray(s.stateroomClassPricing) ? s.stateroomClassPricing : [];
              spArr.forEach(function(p) {
                var code = (p.stateroomClass && ((p.stateroomClass.content && p.stateroomClass.content.code) || p.stateroomClass.id)) || '';
                var cat = resolveStateroomCategory(code);
                var priceVal = (p.price && p.price.value != null) ? Number(p.price.value) : null;
                if (!cat || priceVal == null || !isFinite(priceVal) || priceVal <= 0) return;
                var dualPrice = Math.round(priceVal * 2);
                if (cat === 'INTERIOR' && (pricing.interior == null || dualPrice < pricing.interior)) pricing.interior = dualPrice;
                if (cat === 'OCEANVIEW' && (pricing.oceanview == null || dualPrice < pricing.oceanview)) pricing.oceanview = dualPrice;
                if (cat === 'BALCONY' && (pricing.balcony == null || dualPrice < pricing.balcony)) pricing.balcony = dualPrice;
                if (cat === 'SUITE' && (pricing.suite == null || dualPrice < pricing.suite)) pricing.suite = dualPrice;
              });

              // Taxes & fees — per person * 2 = dual occupancy total
              if (s.taxesAndFees && s.taxesAndFees.value != null) {
                var taxVal = Number(s.taxesAndFees.value);
                if (isFinite(taxVal) && taxVal > 0) pricing.taxes = Math.round(taxVal * 2);
              }

              if (!pricingCache[cacheKey]) {
                pricingCache[cacheKey] = pricing;
                fetchedCount++;
                shipFetched++;
              } else {
                // Merge: fill in any missing values
                var existing = pricingCache[cacheKey];
                if (existing.interior == null && pricing.interior != null) existing.interior = pricing.interior;
                if (existing.oceanview == null && pricing.oceanview != null) existing.oceanview = pricing.oceanview;
                if (existing.balcony == null && pricing.balcony != null) existing.balcony = pricing.balcony;
                if (existing.suite == null && pricing.suite != null) existing.suite = pricing.suite;
                if (existing.taxes == null && pricing.taxes != null) existing.taxes = pricing.taxes;
                if (!existing.portsAndTimes && pricing.portsAndTimes) existing.portsAndTimes = pricing.portsAndTimes;
                if (!existing.nights && pricing.nights) existing.nights = pricing.nights;
              }
            });
          });

          addLog('  Ship ' + shipCode + ': ' + shipFetched + ' sailings priced (' + cruises.length + ' cruise results)', 'success');
        } else {
          addLog('  Pricing API returned error for ship ' + shipCode, 'warning');
        }
      } catch(e) {
        addLog('  Pricing fetch error for ship ' + shipCode + ': ' + e.message, 'warning');
      }

      // Small delay between ship requests
      if (si < shipList.length - 1) {
        await new Promise(function(r) { setTimeout(r, 300); });
      }
    }

    addLog('Pricing fetch complete: ' + fetchedCount + ' sailings with data (cache: ' + Object.keys(pricingCache).length + ' total)', 'success');

    // Persist pricing cache
    try {
      await chrome.storage.local.set({ es_pricingCache: pricingCache });
    } catch(ex) { console.warn('[Easy Seas] Could not persist pricing cache:', ex); }

    updateUI();
  }

  async function startSync() {
    addLog('Starting automated sync (mirrors iOS flow)...', 'info');

    await chrome.storage.local.remove([
      'es_offers', 'es_upcomingCruises', 'es_courtesyHolds', 'es_loyalty', 'es_pricingCache'
    ]);
    capturedData.offers = null;
    capturedData.upcomingCruises = null;
    capturedData.courtesyHolds = null;
    capturedData.loyalty = null;
    pricingCache = {};

    saveCapturedToStorage();

    var isCeleb = capturedData.cruiseLine === 'celebrity';
    var baseUrl = getBaseUrl();
    var brand = isCeleb ? 'C' : 'R';
    var headers = buildHeaders();

    updateProgress(1, 6, 'Step 1/6: Fetching casino offers...');
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
        addLog('Captured ' + offerCount + ' casino offers', 'success');

        if (offersData.offers) {
          var emptyOffers = offersData.offers.filter(function(o) {
            return o && o.campaignOffer && o.campaignOffer.offerCode &&
              Array.isArray(o.campaignOffer.sailings) &&
              (o.campaignOffer.sailings.length === 0 || (o.campaignOffer.sailings[0] && o.campaignOffer.sailings[0].itineraryCode === null));
          });

          if (emptyOffers.length > 0) {
            addLog('Re-fetching ' + emptyOffers.length + ' offers with empty sailings...', 'info');
            for (var ei = 0; ei < emptyOffers.length; ei++) {
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
                    if (origIdx !== -1) {
                      offersData.offers[origIdx].campaignOffer.sailings = refreshed.campaignOffer.sailings;
                      addLog('  ' + (offersData.offers[origIdx].campaignOffer.name || code) + ': ' + refreshed.campaignOffer.sailings.length + ' sailings', 'success');
                    }
                  }
                }
              } catch(rfe) {}
              await new Promise(function(r) { setTimeout(r, 300); });
            }
            capturedData.offers = offersData;
          }

          offersData.offers.forEach(function(offer) {
            var co = offer.campaignOffer || offer;
            addLog('  ' + (co.name || 'Offer') + ': ' + (co.sailings || []).length + ' sailings', 'info');
          });
        }
      } else {
        addLog('Offers API failed after retries', 'warning');
      }
    } catch(oe) {
      addLog('Offers fetch error: ' + oe.message, 'warning');
    }

    saveCapturedToStorage();

    // Step 2: Fetch pricing & itinerary for all offer sailings (public GraphQL, no auth needed)
    updateProgress(2, 6, 'Step 2/6: Fetching pricing & itinerary data...');
    if (capturedData.offers && capturedData.offers.offers && capturedData.offers.offers.length > 0) {
      await fetchOfferPricing(capturedData.offers.offers);
    } else {
      addLog('Step 2: Skipped pricing fetch (no offers captured)', 'warning');
    }

    saveCapturedToStorage();
    await setSyncState(SYNC_STEPS.UPCOMING, 0);

    var urls = getPageUrls();
    addLog('Step 3: Navigating to upcoming cruises...', 'info');
    navigateTo(urls.upcoming);
  }

  async function waitForPassiveCapture(key, timeoutMs) {
    timeoutMs = timeoutMs || 12000;
    var waited = 0;
    var interval = 1000;
    while (waited < timeoutMs) {
      await new Promise(function(r) { setTimeout(r, interval); });
      waited += interval;

      try {
        var stored = await chrome.storage.local.get(['es_' + key]);
        if (stored['es_' + key]) {
          capturedData[key] = stored['es_' + key];
          return true;
        }
      } catch(ex) {}

      if (capturedData[key]) return true;
    }
    return !!capturedData[key];
  }

  async function tryDirectBookingsAPI() {
    if (!authContext) return false;
    var headers = buildHeaders();
    var baseUrl = getBaseUrl();
    var bookingsUrls = [baseUrl + '/api/profile/bookings', baseUrl + '/api/account/upcoming-cruises'];
    for (var i = 0; i < bookingsUrls.length; i++) {
      try {
        var resp = await fetchWithRetry(bookingsUrls[i], { method: 'GET', headers: headers, credentials: 'include' });
        if (resp) {
          var data = await resp.json();
          if (extractBookings(data).length > 0) {
            capturedData.upcomingCruises = data;
            saveCapturedToStorage();
            addLog('Captured ' + extractBookings(data).length + ' bookings via direct API', 'success');
            return true;
          }
        }
      } catch(e) {}
    }
    return false;
  }

  async function tryDirectCourtesyAPI() {
    if (!authContext) return false;
    var headers = buildHeaders();
    var baseUrl = getBaseUrl();
    try {
      var resp = await fetchWithRetry(baseUrl + '/api/account/courtesy-holds', { method: 'GET', headers: headers, credentials: 'include' });
      if (resp) {
        var data = await resp.json();
        capturedData.courtesyHolds = data;
        saveCapturedToStorage();
        var holdCount = 0;
        if (data.payload && data.payload.sailingInfo) holdCount = data.payload.sailingInfo.length;
        else if (data.sailingInfo) holdCount = data.sailingInfo.length;
        addLog('Captured ' + holdCount + ' courtesy holds', 'success');
        return true;
      }
    } catch(e) {}
    return false;
  }

  async function tryDirectLoyaltyAPI() {
    if (!authContext) return false;
    var headers = buildHeaders();
    var isCeleb = capturedData.cruiseLine === 'celebrity';
    try {
      var loyaltyUrl = isCeleb
        ? 'https://aws-prd.api.rccl.com/en/celebrity/web/v3/guestAccounts/' + encodeURIComponent(authContext.accountId)
        : 'https://aws-prd.api.rccl.com/en/royal/web/v1/guestAccounts/loyalty/info';
      var resp = await fetchWithRetry(loyaltyUrl, { method: 'GET', headers: headers, credentials: 'omit' });
      if (resp) {
        capturedData.loyalty = await resp.json();
        saveCapturedToStorage();
        addLog('Captured loyalty data via direct API', 'success');
        return true;
      }
    } catch(e) {}
    return false;
  }

  function getMissingSections() {
    var missing = [];
    if (!capturedData.offers || !capturedData.offers.offers || capturedData.offers.offers.length === 0) missing.push('offers');
    if (extractBookings(capturedData.upcomingCruises).length === 0) missing.push('upcomingCruises');
    if (!capturedData.loyalty) missing.push('loyalty');
    return missing;
  }

  function isOnExpectedPage(expectedPath) {
    var currentUrl = window.location.href.toLowerCase();
    var expectedLower = expectedPath.toLowerCase();
    var currentPath = '';
    var targetPath = '';
    try {
      currentPath = new URL(currentUrl).pathname.toLowerCase();
      targetPath = new URL(expectedLower).pathname.toLowerCase();
    } catch(e) {}
    var match = currentUrl.indexOf(expectedLower) !== -1 || (currentPath && targetPath && (currentPath === targetPath || currentPath.indexOf(targetPath) !== -1));
    addLog('Nav check: current=' + window.location.href + ' | expected=' + expectedPath + ' | match=' + (match ? 'yes' : 'no'), match ? 'success' : 'warning');
    return match;
  }

  async function resumeSync() {
    var state = await getSyncState();
    if (state.step === SYNC_STEPS.IDLE || state.step === SYNC_STEPS.DONE) return;

    await loadCapturedFromStorage();
    updateUI();

    var urls = getPageUrls();
    var currentUrl = window.location.href;
    addLog('Resuming sync step: ' + state.step + ' (on: ' + window.location.pathname + ')', 'info');

    try {
      var navTarget = (await chrome.storage.local.get(['es_navTarget'])).es_navTarget;
      if (navTarget) {
        await chrome.storage.local.remove(['es_navTarget']);
        if (!isOnExpectedPage(navTarget)) {
          addLog('Page did not navigate to expected URL, retrying...', 'warning');
          navigateTo(navTarget);
          return;
        } else {
          addLog('Confirmed on correct page: ' + window.location.pathname, 'success');
        }
      }
    } catch(ex) { console.error('[Easy Seas] Nav target check error:', ex); }

    if (state.step === SYNC_STEPS.UPCOMING || state.step === SYNC_STEPS.BOUNCE_UPCOMING) {
      if (!isOnExpectedPage(urls.upcoming)) {
        addLog('Not on upcoming cruises page yet, navigating...', 'warning');
        await setSyncState(state.step, state.bounceCount);
        navigateTo(urls.upcoming);
        return;
      }
      updateProgress(3, 6, 'Step 3/6: Waiting for upcoming cruises data...');
      addLog('Waiting for upcoming cruises API to fire...', 'info');

      var gotBookings = await waitForPassiveCapture('upcomingCruises', 10000);
      if (!gotBookings) {
        addLog('No passive capture, trying direct API...', 'info');
        gotBookings = await tryDirectBookingsAPI();
      }
      if (gotBookings) {
        addLog('Got ' + extractBookings(capturedData.upcomingCruises).length + ' bookings', 'success');
      } else {
        addLog('No bookings captured on this page', 'warning');
      }

      updateUI();
      await setSyncState(SYNC_STEPS.COURTESY, state.bounceCount);
      updateProgress(4, 6, 'Step 4/6: Checking courtesy holds...');
      addLog('Step 4: Fetching courtesy holds...', 'info');

      await tryDirectCourtesyAPI();
      updateUI();

      await setSyncState(SYNC_STEPS.LOYALTY, state.bounceCount);
      addLog('Step 5: Navigating to loyalty page...', 'info');
      navigateTo(urls.loyalty);
      return;
    }

    if (state.step === SYNC_STEPS.LOYALTY || state.step === SYNC_STEPS.BOUNCE_LOYALTY) {
      if (!isOnExpectedPage(urls.loyalty)) {
        addLog('Not on loyalty page yet, navigating...', 'warning');
        await setSyncState(state.step, state.bounceCount);
        navigateTo(urls.loyalty);
        return;
      }
      updateProgress(5, 6, 'Step 5/6: Waiting for loyalty data...');
      addLog('Waiting for loyalty API to fire...', 'info');

      var gotLoyalty = await waitForPassiveCapture('loyalty', 10000);
      if (!gotLoyalty) {
        addLog('No passive capture, trying direct API...', 'info');
        gotLoyalty = await tryDirectLoyaltyAPI();
      }
      if (gotLoyalty) {
        addLog('Loyalty data captured!', 'success');
      } else {
        addLog('Loyalty not captured on this page', 'warning');
      }

      updateUI();

      var missing = getMissingSections();
      if (missing.length > 0 && state.bounceCount < 2) {
        addLog('Missing: ' + missing.join(', ') + ' — bouncing (attempt ' + (state.bounceCount + 1) + '/2)...', 'warning');
        await setSyncState(SYNC_STEPS.BOUNCE_UPCOMING, state.bounceCount + 1);
        navigateTo(urls.upcoming);
        return;
      }

      updateProgress(6, 6, 'Step 6/6: Sync complete!');
      var offers = capturedData.offers && capturedData.offers.offers ? capturedData.offers.offers.length : 0;
      var bookings = getBookingsCount();
      var pricedCount = Object.keys(pricingCache).length;
      var hasLoyalty = !!capturedData.loyalty;
      addLog('Sync complete! ' + offers + ' offers, ' + pricedCount + ' sailings priced, ' + bookings + ' bookings' + (hasLoyalty ? ', loyalty captured' : ''), 'success');

      if (missing.length > 0) {
        addLog('Could not capture: ' + missing.join(', '), 'warning');
      }

      await setSyncState(SYNC_STEPS.DONE);
      updateUI();
      return;
    }

    if (state.step === SYNC_STEPS.COURTESY || state.step === SYNC_STEPS.BOUNCE_COURTESY) {
      updateProgress(4, 6, 'Step 4/6: Checking courtesy holds...');
      await tryDirectCourtesyAPI();
      updateUI();

      await setSyncState(SYNC_STEPS.LOYALTY, state.bounceCount);
      addLog('Step 5: Navigating to loyalty page...', 'info');
      navigateTo(urls.loyalty);
      return;
    }

    if (state.step === SYNC_STEPS.BOUNCE_OFFERS) {
      if (!isOnExpectedPage(urls.offers)) {
        addLog('Not on offers page yet, navigating...', 'warning');
        await setSyncState(state.step, state.bounceCount);
        navigateTo(urls.offers);
        return;
      }
      updateProgress(2, 6, 'Bounce: Re-checking offers page...');
      addLog('On offers page, waiting for passive capture...', 'info');
      await waitForPassiveCapture('offers', 8000);
      updateUI();

      await setSyncState(SYNC_STEPS.BOUNCE_UPCOMING, state.bounceCount);
      navigateTo(urls.upcoming);
      return;
    }
  }

  // ===== CSV EXPORT =====

  var SHIP_CODES = {
    'AL': 'Allure of the Seas', 'AN': 'Anthem of the Seas', 'AD': 'Adventure of the Seas',
    'BR': 'Brilliance of the Seas', 'EN': 'Enchantment of the Seas', 'EX': 'Explorer of the Seas',
    'FR': 'Freedom of the Seas', 'GR': 'Grandeur of the Seas', 'HM': 'Harmony of the Seas',
    'IC': 'Icon of the Seas', 'ID': 'Independence of the Seas', 'JW': 'Jewel of the Seas',
    'LB': 'Liberty of the Seas', 'MR': 'Mariner of the Seas', 'NV': 'Navigator of the Seas',
    'OA': 'Oasis of the Seas', 'OV': 'Ovation of the Seas', 'OY': 'Odyssey of the Seas',
    'QN': 'Quantum of the Seas', 'RD': 'Radiance of the Seas', 'SE': 'Serenade of the Seas',
    'SP': 'Spectrum of the Seas', 'SY': 'Symphony of the Seas', 'UT': 'Utopia of the Seas',
    'VI': 'Vision of the Seas', 'VY': 'Voyager of the Seas', 'WN': 'Wonder of the Seas',
    'SN': 'Star of the Seas'
  };
  var CABIN_TYPES = { 'I': 'Interior', 'O': 'Ocean View', 'B': 'Balcony', 'S': 'Suite' };

  function esc(v) {
    if (v == null) return '';
    var s = String(v);
    if (s.indexOf(',') !== -1 || s.indexOf('"') !== -1 || s.indexOf('\n') !== -1) return '"' + s.replace(/"/g, '""') + '"';
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

  // Extract a plain string from offerType regardless of whether it's a string or object
  function getOfferTypeStr(co) {
    var t = co.offerType || co.type;
    if (!t) return 'Free Play';
    if (typeof t === 'string') return t;
    if (typeof t === 'object') {
      // Handle common API shapes: { name, label, code, description }
      return t.name || t.label || t.description || t.code || 'Free Play';
    }
    return String(t);
  }

  // Extract nights count from itinerary description string (e.g. "7 Night Caribbean")
  function getNightsFromItinerary(itinerary) {
    if (!itinerary) return '';
    var m = itinerary.match(/^\s*(\d+)\s*N(?:IGHT|T)?S?\b/i);
    return m ? m[1] : '';
  }

  function buildOffersCSV() {
    if (!capturedData.offers || !capturedData.offers.offers || capturedData.offers.offers.length === 0) return null;

    var loyaltyInfo = capturedData.loyalty && capturedData.loyalty.payload && capturedData.loyalty.payload.loyaltyInformation
      ? capturedData.loyalty.payload.loyaltyInformation : null;
    var loyaltyLevel = loyaltyInfo ? (loyaltyInfo.crownAndAnchorLevel || '') : '';
    var loyaltyPoints = loyaltyInfo ? (loyaltyInfo.crownAndAnchorPoints || '') : '';

    // Column names exactly matching what the Easy Seas app CSV import expects
    var rows = [];
    rows.push([
      'Source Page', 'Offer Name', 'Offer Code', 'Offer Expiration Date', 'Offer Type',
      'Ship Name', 'Sailing Date', 'Nights', 'Itinerary', 'Departure Port',
      'Room Type', 'Guests Info', 'Perks', 'Loyalty Level', 'Loyalty Points',
      'Interior Price', 'Oceanview Price', 'Balcony Price', 'Suite Price',
      'Port Taxes & Fees', 'Ports & Times'
    ].map(esc).join(','));

    var totalRows = 0;

    capturedData.offers.offers.forEach(function(offer) {
      var co = offer.campaignOffer || offer;
      var sailings = co.sailings || [];
      var offerType = getOfferTypeStr(co);

      sailings.forEach(function(s) {
        var shipCode = (s.shipCode || '').toString().trim();
        var sailDateISO = (s.sailDate || '').toString().trim().slice(0, 10);
        var cacheKey = shipCode + '_' + sailDateISO;
        var pc = pricingCache[cacheKey] || {};

        var itinerary = s.itineraryDescription || '';
        var nightsFromItin = getNightsFromItinerary(itinerary);
        var nights = pc.nights || nightsFromItin || '';

        var perks = '';
        var perkCodes = co.perkCodes || (co.campaignOffer && co.campaignOffer.perkCodes);
        if (Array.isArray(perkCodes) && perkCodes.length) {
          perks = perkCodes.map(function(p) { return p.perkName || p.perkCode || ''; }).filter(Boolean).join(' | ');
        }
        if (!perks && co.tradeInValue) {
          perks = '$' + co.tradeInValue + ' trade-in';
        }

        var deptPort = s.departurePort && typeof s.departurePort === 'object'
          ? (s.departurePort.name || '')
          : (s.departurePort || '');

        rows.push([
          esc('Club Royale Offers'),
          esc(co.name || co.offerName || ''),
          esc(co.offerCode || ''),
          esc(fmtDate(co.reserveByDate || co.expirationDate || '')),
          esc(offerType),
          esc(s.shipName || SHIP_CODES[shipCode] || shipCode || ''),
          esc(fmtDate(sailDateISO || s.sailDate || '')),
          esc(nights),
          esc(itinerary),
          esc(deptPort),
          esc(s.roomType || s.cabinType || ''),
          esc(s.isGOBO ? '1 Guest' : '2 Guests'),
          esc(perks || '-'),
          esc(loyaltyLevel),
          esc(loyaltyPoints),
          esc(fmtPrice(pc.interior)),
          esc(fmtPrice(pc.oceanview)),
          esc(fmtPrice(pc.balcony)),
          esc(fmtPrice(pc.suite)),
          esc(fmtPrice(pc.taxes)),
          esc(pc.portsAndTimes || '')
        ].join(','));

        totalRows++;
      });
    });

    if (rows.length <= 1) return null;
    addLog('Built offers CSV: ' + totalRows + ' rows (' + capturedData.offers.offers.length + ' offers)', 'info');

    var pricedRows = 0;
    capturedData.offers.offers.forEach(function(offer) {
      var co = offer.campaignOffer || offer;
      (co.sailings || []).forEach(function(s) {
        var key = (s.shipCode || '').trim() + '_' + (s.sailDate || '').toString().trim().slice(0, 10);
        if (pricingCache[key] && (pricingCache[key].interior || pricingCache[key].balcony)) pricedRows++;
      });
    });
    addLog('  Sailings with pricing data: ' + pricedRows + ' of ' + totalRows, pricedRows > 0 ? 'success' : 'warning');

    return rows.join('\n');
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

    var loyaltyInfo = capturedData.loyalty && capturedData.loyalty.payload && capturedData.loyalty.payload.loyaltyInformation
      ? capturedData.loyalty.payload.loyaltyInformation : null;
    var loyaltyLevel = loyaltyInfo ? (loyaltyInfo.crownAndAnchorLevel || '') : '';
    var loyaltyPoints = loyaltyInfo ? (loyaltyInfo.crownAndAnchorPoints || '') : '';

    var rows = [];
    rows.push(['Source', 'Ship Name', 'Sail Date', 'Return Date', 'Nights', 'Itinerary', 'Departure Port', 'Cabin Type', 'Cabin #', 'Booking ID', 'Status', 'Loyalty Level', 'Loyalty Points'].map(esc).join(','));

    allBookings.forEach(function(entry) {
      var b = entry.data;
      var shipCode = b.shipCode || '';
      var shipName = SHIP_CODES[shipCode] || b.shipName || (shipCode ? shipCode + ' of the Seas' : '');
      var cabinType = CABIN_TYPES[b.stateroomType || ''] || b.stateroomType || '';
      var cabin = b.stateroomNumber === 'GTY' ? 'GTY' : (b.stateroomNumber || '');
      var status = entry.source;
      if (b.bookingStatus === 'OF') status = 'Courtesy Hold';
      var nights = b.numberOfNights || '';
      var returnDate = b.returnDate || '';
      if (!returnDate && b.sailDate && nights) {
        try {
          var sd = new Date(b.sailDate);
          if (!isNaN(sd.getTime())) {
            sd.setDate(sd.getDate() + parseInt(nights, 10));
            returnDate = sd.toISOString().split('T')[0];
          }
        } catch(e) {}
      }
      var deptPort = b.departurePort && typeof b.departurePort === 'object'
        ? (b.departurePort.name || '')
        : (b.departurePort || '');
      rows.push([
        esc(status), esc(shipName), esc(fmtDate(b.sailDate)), esc(fmtDate(returnDate)),
        esc(nights), esc(b.cruiseTitle || b.itineraryDescription || (nights ? nights + ' Night Cruise' : '')),
        esc(deptPort), esc(cabinType), esc(cabin),
        esc(b.bookingId || b.masterBookingId || ''), esc(status),
        esc(loyaltyLevel), esc(loyaltyPoints)
      ].join(','));
    });

    return rows.length > 1 ? rows.join('\n') : null;
  }

  function triggerDownload(csvContent, filename) {
    var blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url; a.download = filename; a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    setTimeout(function() { document.body.removeChild(a); URL.revokeObjectURL(url); }, 200);
  }

  function downloadCSVs() {
    addLog('Generating CSV files...', 'info');
    var pricedCount = Object.keys(pricingCache).length;
    addLog('Pricing cache has ' + pricedCount + ' sailings. Run SYNC first if pricing is empty.', pricedCount > 0 ? 'info' : 'warning');

    var ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    var line = capturedData.cruiseLine || 'royal';
    var downloaded = 0;

    var offersCSV = buildOffersCSV();
    if (offersCSV) {
      triggerDownload(offersCSV, 'easy-seas-' + line + '-offers-' + ts + '.csv');
      addLog('Exported offers CSV', 'success');
      downloaded++;
    } else {
      addLog('No offers data to export', 'warning');
    }

    setTimeout(function() {
      var bookedCSV = buildBookedCSV();
      if (bookedCSV) {
        triggerDownload(bookedCSV, 'easy-seas-' + line + '-booked-' + ts + '.csv');
        addLog('Exported booked cruises CSV', 'success');
        downloaded++;
      } else {
        addLog('No booked cruise data to export', 'warning');
      }

      if (downloaded === 0) addLog('No data to export', 'error');
      else addLog('Downloaded ' + downloaded + ' CSV file(s)', 'success');
    }, 500);
  }

  function watchForOverlayRemoval() {
    if (!document.body) { setTimeout(watchForOverlayRemoval, 300); return; }
    var observer = new MutationObserver(function() { ensureOverlay(); });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  async function init() {
    injectPageScript();

    await loadCapturedFromStorage();

    var onReady = async function() {
      createOverlay();
      watchForOverlayRemoval();
      addLog('Extension ready on ' + capturedData.cruiseLine + ' (' + window.location.pathname + ')', 'info');
      updateUI();

      await new Promise(function(r) { setTimeout(r, 2000); });

      await loadCapturedFromStorage();
      updateUI();

      var state = await getSyncState();
      if (state.step !== SYNC_STEPS.IDLE && state.step !== SYNC_STEPS.DONE) {
        addLog('Detected in-progress sync at step: ' + state.step, 'info');
        await new Promise(function(r) { setTimeout(r, 3000); });
        resumeSync();
      }
    };

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', onReady);
    } else {
      onReady();
    }

    setInterval(function() {
      ensureOverlay();
      if (!authContext) {
        checkAuthFromDOM();
        window.postMessage({ source: 'easy-seas-ext', type: 'get_auth' }, '*');
        updateUI();
      }
    }, 5000);
  }

  init();
}();
