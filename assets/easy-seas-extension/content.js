void function() {
  'use strict';

  if (window.__easySeasLoaded) return;
  window.__easySeasLoaded = true;
  console.log('[Easy Seas] Content script v4 loaded on', window.location.href);

  var overlayElement = null;
  var authContext = null;
  var capturedData = {
    offers: null, upcomingCruises: null, courtesyHolds: null, loyalty: null,
    isLoggedIn: false,
    cruiseLine: window.location.hostname.includes('celebrity') ? 'celebrity' : 'royal'
  };

  var SYNC_STEPS = {
    IDLE: 'idle',
    OFFERS: 'offers',
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
      toSave.es_cruiseLine = capturedData.cruiseLine;
      toSave.es_isLoggedIn = capturedData.isLoggedIn;
      chrome.storage.local.set(toSave);
    } catch(ex) { console.error('[Easy Seas] Storage save error:', ex); }
  }

  async function loadCapturedFromStorage() {
    try {
      var r = await chrome.storage.local.get([
        'es_offers', 'es_upcomingCruises', 'es_courtesyHolds', 'es_loyalty',
        'es_auth', 'es_cruiseLine', 'es_isLoggedIn'
      ]);
      if (r.es_offers) capturedData.offers = r.es_offers;
      if (r.es_upcomingCruises) capturedData.upcomingCruises = r.es_upcomingCruises;
      if (r.es_courtesyHolds) capturedData.courtesyHolds = r.es_courtesyHolds;
      if (r.es_loyalty) capturedData.loyalty = r.es_loyalty;
      if (r.es_auth) { authContext = r.es_auth; capturedData.isLoggedIn = true; }
      if (r.es_cruiseLine) capturedData.cruiseLine = r.es_cruiseLine;
      if (r.es_isLoggedIn) capturedData.isLoggedIn = r.es_isLoggedIn;
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
      await chrome.storage.local.remove(['es_syncStep', 'es_syncBounceCount', 'es_syncLogs']);
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
      if (logEl.children.length > 50) logEl.removeChild(logEl.firstChild);
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

  function navigateTo(url) {
    addLog('Navigating to ' + url.replace(/https:\/\/www\.[^/]+/, ''), 'info');
    try {
      chrome.runtime.sendMessage({ type: 'navigate', url: url }, function(resp) {
        if (chrome.runtime.lastError || !resp || !resp.success) {
          console.log('[Easy Seas] Background navigate failed, using fallback');
          window.location.assign(url);
        }
      });
    } catch(e) {
      console.log('[Easy Seas] Navigate error, using fallback:', e);
      window.location.assign(url);
    }
  }

  async function startSync() {
    addLog('Starting automated sync...', 'info');

    await chrome.storage.local.remove([
      'es_offers', 'es_upcomingCruises', 'es_courtesyHolds', 'es_loyalty'
    ]);
    capturedData.offers = null;
    capturedData.upcomingCruises = null;
    capturedData.courtesyHolds = null;
    capturedData.loyalty = null;

    saveCapturedToStorage();

    var isCeleb = capturedData.cruiseLine === 'celebrity';
    var baseUrl = getBaseUrl();
    var brand = isCeleb ? 'C' : 'R';
    var headers = buildHeaders();

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
    await setSyncState(SYNC_STEPS.UPCOMING, 0);

    var urls = getPageUrls();
    addLog('Step 2: Navigating to upcoming cruises...', 'info');
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

  async function resumeSync() {
    var state = await getSyncState();
    if (state.step === SYNC_STEPS.IDLE || state.step === SYNC_STEPS.DONE) return;

    await loadCapturedFromStorage();
    updateUI();

    var urls = getPageUrls();
    addLog('Resuming sync step: ' + state.step, 'info');

    if (state.step === SYNC_STEPS.UPCOMING || state.step === SYNC_STEPS.BOUNCE_UPCOMING) {
      updateProgress(2, 5, 'Step 2/5: Waiting for upcoming cruises data...');
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
      updateProgress(3, 5, 'Step 3/5: Checking courtesy holds...');
      addLog('Step 3: Fetching courtesy holds...', 'info');

      await tryDirectCourtesyAPI();
      updateUI();

      await setSyncState(SYNC_STEPS.LOYALTY, state.bounceCount);
      addLog('Step 4: Navigating to loyalty page...', 'info');
      navigateTo(urls.loyalty);
      return;
    }

    if (state.step === SYNC_STEPS.LOYALTY || state.step === SYNC_STEPS.BOUNCE_LOYALTY) {
      updateProgress(4, 5, 'Step 4/5: Waiting for loyalty data...');
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

      updateProgress(5, 5, 'Step 5/5: Sync complete!');
      var offers = capturedData.offers && capturedData.offers.offers ? capturedData.offers.offers.length : 0;
      var bookings = getBookingsCount();
      var hasLoyalty = !!capturedData.loyalty;
      addLog('Sync complete! ' + offers + ' offers, ' + bookings + ' bookings' + (hasLoyalty ? ', loyalty captured' : ''), 'success');

      if (missing.length > 0) {
        addLog('Could not capture: ' + missing.join(', '), 'warning');
      }

      await setSyncState(SYNC_STEPS.DONE);
      updateUI();
      return;
    }

    if (state.step === SYNC_STEPS.COURTESY || state.step === SYNC_STEPS.BOUNCE_COURTESY) {
      updateProgress(3, 5, 'Step 3/5: Checking courtesy holds...');
      await tryDirectCourtesyAPI();
      updateUI();

      await setSyncState(SYNC_STEPS.LOYALTY, state.bounceCount);
      addLog('Step 4: Navigating to loyalty page...', 'info');
      navigateTo(urls.loyalty);
      return;
    }

    if (state.step === SYNC_STEPS.BOUNCE_OFFERS) {
      updateProgress(2, 5, 'Bounce: Re-checking offers page...');
      addLog('On offers page, waiting for passive capture...', 'info');
      await waitForPassiveCapture('offers', 8000);
      updateUI();

      await setSyncState(SYNC_STEPS.BOUNCE_UPCOMING, state.bounceCount);
      navigateTo(urls.upcoming);
      return;
    }
  }

  // ===== CSV EXPORT — SEPARATE FILES =====
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

  function buildOffersCSV() {
    if (!capturedData.offers || !capturedData.offers.offers || capturedData.offers.offers.length === 0) return null;
    var rows = [];
    rows.push(['Source Page','Offer Name','Offer Code','Offer Expiry','Offer Type','Ship Name','Sailing Date','Itinerary','Departure Port','Cabin Type','Guests','Perks','Loyalty Level','Loyalty Points'].map(esc).join(','));

    var loyaltyInfo = capturedData.loyalty && capturedData.loyalty.payload && capturedData.loyalty.payload.loyaltyInformation ? capturedData.loyalty.payload.loyaltyInformation : null;
    var loyaltyLevel = loyaltyInfo ? (loyaltyInfo.crownAndAnchorLevel || '') : '';
    var loyaltyPoints = loyaltyInfo ? (loyaltyInfo.crownAndAnchorPoints || '') : '';

    capturedData.offers.offers.forEach(function(offer) {
      var co = offer.campaignOffer || offer;
      var sailings = co.sailings || [];
      sailings.forEach(function(s) {
        rows.push([
          esc('Club Royale Offers'), esc(co.name || ''), esc(co.offerCode || ''),
          esc(fmtDate(co.reserveByDate)), esc(co.offerType || co.type || 'Free Play'),
          esc(s.shipName || ''), esc(fmtDate(s.sailDate)),
          esc(s.itineraryDescription || ''), esc(s.departurePort && s.departurePort.name ? s.departurePort.name : ''),
          esc(s.roomType || ''), esc(s.isGOBO ? '1' : '2'),
          esc(co.tradeInValue ? '$' + co.tradeInValue : ''),
          esc(loyaltyLevel), esc(loyaltyPoints)
        ].join(','));
      });
    });

    return rows.length > 1 ? rows.join('\n') : null;
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
      rows.push([
        esc(status), esc(shipName), esc(fmtDate(b.sailDate)), esc(fmtDate(returnDate)),
        esc(nights), esc(b.cruiseTitle || b.itineraryDescription || (nights ? nights + ' Night Cruise' : '')),
        esc(b.departurePort && b.departurePort.name ? b.departurePort.name : (b.departurePort || '')),
        esc(cabinType), esc(cabin), esc(b.bookingId || b.masterBookingId || ''), esc(status),
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
