void function() {
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

  // ===== INJECT PAGE WORLD SCRIPT =====
  // Loads page-script.js as an external file to avoid CSP inline script blocks
  function injectPageScript() {
    var s = document.createElement('script');
    s.src = chrome.runtime.getURL('page-script.js');
    s.onload = function() { s.remove(); console.log('[Easy Seas] Page world script injected via src'); };
    s.onerror = function() { console.error('[Easy Seas] Failed to inject page-script.js'); s.remove(); };
    (document.head || document.documentElement).appendChild(s);
  }

  // ===== MESSAGE HANDLER =====
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
      } else {
        checkAuthFromDOM();
      }
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

  // ===== OVERLAY UI =====
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
      '<div id="easy-seas-log"></div>' +
      '</div>';

    document.body.appendChild(overlay);
    overlayElement = overlay;

    document.getElementById('sync-btn').addEventListener('click', toggleSync);
    document.getElementById('download-btn').addEventListener('click', downloadCSV);
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

  // ===== SYNC LOGIC =====
  function toggleSync() {
    if (syncState.isRunning) {
      syncState.isRunning = false;
      addLog('Sync stopped', 'warning');
      updateUI();
      return;
    }
    if (!capturedData.isLoggedIn || !authContext) {
      addLog('Please log in to the website first', 'error');
      return;
    }
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

    try {
      // ===== STEP 1: CASINO OFFERS (direct API call, same as iOS) =====
      syncState.currentStep = 1;
      updateProgress(1, 3, 'Step 1: Fetching casino offers...');
      addLog('Step 1: Calling casino offers API...', 'info');

      try {
        var offersUrl = baseUrl + (brand === 'C' ? '/api/casino/casino-offers/v2' : '/api/casino/casino-offers/v1');
        var offersResp = await fetch(offersUrl, {
          method: 'POST',
          headers: headers,
          credentials: 'omit',
          body: JSON.stringify({ cruiseLoyaltyId: authContext.loyaltyId, offerCode: '', brand: brand })
        });

        if (offersResp.ok) {
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
                      if (origIdx !== -1) {
                        offersData.offers[origIdx].campaignOffer.sailings = refreshed.campaignOffer.sailings;
                        addLog('  Updated ' + code + ': ' + refreshed.campaignOffer.sailings.length + ' sailings', 'success');
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
              var sailCount = (co.sailings || []).length;
              addLog('  ' + (co.name || 'Offer') + ': ' + sailCount + ' sailings', 'info');
            });
          }
        } else {
          addLog('Offers API returned ' + offersResp.status, 'warning');
          if (offersResp.status === 403) {
            addLog('Session expired - please refresh and log in again', 'error');
            syncState.isRunning = false; updateUI(); return;
          }
        }
      } catch(oe) {
        addLog('Offers fetch error: ' + oe.message, 'warning');
        if (capturedData.offers) addLog('Using passively captured offers', 'info');
      }

      if (!syncState.isRunning) { updateUI(); return; }

      // ===== STEP 2: BOOKED CRUISES =====
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
              if (extractBookings(bData).length > 0) {
                capturedData.upcomingCruises = bData;
                bookingsFound = true;
                addLog('Captured ' + extractBookings(bData).length + ' bookings via API', 'success');
              }
            }
          } catch(be) {}
        }

        if (!bookingsFound) {
          addLog('Navigating to bookings page to capture data...', 'info');
          await chrome.storage.local.set({
            esSyncPending: true,
            esOffers: capturedData.offers,
            esLoyalty: capturedData.loyalty,
            esAuth: authContext,
            esCruiseLine: capturedData.cruiseLine
          });
          window.location.href = baseUrl + '/account/upcoming-cruises';
          return;
        }
      }

      if (!syncState.isRunning) { updateUI(); return; }

      // ===== STEP 3: LOYALTY =====
      await fetchLoyalty(headers, isCeleb);

      finishSync();
    } catch(err) {
      addLog('Sync error: ' + err.message, 'error');
      syncState.isRunning = false;
      updateUI();
    }
  }

  async function fetchLoyalty(headers, isCeleb) {
    syncState.currentStep = 3;
    updateProgress(3, 3, 'Step 3: Fetching loyalty status...');
    addLog('Step 3: Fetching loyalty status...', 'info');

    if (capturedData.loyalty) {
      addLog('Using captured loyalty data', 'success');
      return;
    }
    try {
      var loyaltyUrl = isCeleb
        ? 'https://aws-prd.api.rccl.com/en/celebrity/web/v3/guestAccounts/' + encodeURIComponent(authContext.accountId)
        : 'https://aws-prd.api.rccl.com/en/royal/web/v1/guestAccounts/loyalty/info';
      var lResp = await fetch(loyaltyUrl, { method: 'GET', headers: headers, credentials: 'omit' });
      if (lResp.ok) {
        capturedData.loyalty = await lResp.json();
        addLog('Captured loyalty data', 'success');
      } else {
        addLog('Loyalty API returned ' + lResp.status + ' (may need appkey)', 'warning');
      }
    } catch(le) {
      addLog('Loyalty fetch error: ' + le.message, 'warning');
    }
  }

  function finishSync() {
    syncState.isRunning = false;
    var offers = capturedData.offers && capturedData.offers.offers ? capturedData.offers.offers.length : 0;
    var bookings = getBookingsCount();
    var hasLoyalty = !!capturedData.loyalty;
    updateProgress(3, 3, 'Sync complete!');
    addLog('Sync complete! ' + offers + ' offers, ' + bookings + ' bookings' + (hasLoyalty ? ', loyalty captured' : ''), 'success');
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

      syncState.isRunning = true;
      syncState.currentStep = 2;
      updateProgress(2, 3, 'Waiting for bookings...');
      updateUI();

      var waited = 0;
      while (waited < 15000) {
        if (extractBookings(capturedData.upcomingCruises).length > 0) break;
        await new Promise(function(resolve) { setTimeout(resolve, 1000); });
        waited += 1000;
        if (waited % 5000 === 0) addLog('Still waiting for bookings (' + (waited / 1000) + 's)...', 'info');
      }

      if (extractBookings(capturedData.upcomingCruises).length > 0) {
        addLog('Captured ' + extractBookings(capturedData.upcomingCruises).length + ' bookings', 'success');
      } else {
        addLog('No bookings captured after 15s. The page may still be loading.', 'warning');
      }

      var isCeleb = capturedData.cruiseLine === 'celebrity';
      var headers = {
        'accept': 'application/json', 'content-type': 'application/json',
        'account-id': authContext.accountId, 'authorization': authContext.token
      };
      if (authContext.appKey) { headers['appkey'] = authContext.appKey; headers['x-api-key'] = authContext.appKey; }

      await fetchLoyalty(headers, isCeleb);
      await chrome.storage.local.remove(['esSyncPending', 'esOffers', 'esLoyalty', 'esAuth', 'esCruiseLine']);
      finishSync();
    } catch(e) {
      console.error('[Easy Seas] Pending sync error:', e);
      try { await chrome.storage.local.remove(['esSyncPending']); } catch(ex) {}
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
    'VI': 'Vision of the Seas', 'VY': 'Voyager of the Seas', 'WN': 'Wonder of the Seas'
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

  function downloadCSV() {
    addLog('Generating CSV...', 'info');
    var rows = [];

    if (capturedData.offers && capturedData.offers.offers) {
      rows.push(['Source Page','Offer Name','Offer Code','Offer Expiry','Ship Name','Sailing Date','Itinerary','Departure Port','Cabin Type','Guests','Perks'].map(esc).join(','));
      capturedData.offers.offers.forEach(function(offer) {
        var co = offer.campaignOffer || offer;
        var sailings = co.sailings || [];
        sailings.forEach(function(s) {
          rows.push([
            esc('Club Royale Offers'), esc(co.name || ''), esc(co.offerCode || ''),
            esc(fmtDate(co.reserveByDate)), esc(s.shipName || ''), esc(fmtDate(s.sailDate)),
            esc(s.itineraryDescription || ''), esc(s.departurePort && s.departurePort.name ? s.departurePort.name : ''),
            esc(s.roomType || ''), esc(s.isGOBO ? '1' : '2'), esc(co.tradeInValue ? '$' + co.tradeInValue : '')
          ].join(','));
        });
      });
    }

    var bookings = extractBookings(capturedData.upcomingCruises);
    if (bookings.length > 0) {
      if (rows.length > 0) rows.push('');
      rows.push(['Source','Ship Name','Sail Date','Nights','Itinerary','Cabin Type','Cabin #','Booking ID','Status','Paid'].map(esc).join(','));
      bookings.forEach(function(b) {
        var shipCode = b.shipCode || '';
        var shipName = SHIP_CODES[shipCode] || b.shipName || (shipCode ? shipCode + ' of the Seas' : '');
        var cabinType = CABIN_TYPES[b.stateroomType || ''] || b.stateroomType || '';
        var cabin = b.stateroomNumber === 'GTY' ? 'GTY' : (b.stateroomNumber || '');
        var status = b.bookingStatus === 'OF' ? 'Courtesy Hold' : 'Upcoming';
        rows.push([
          esc(status), esc(shipName), esc(fmtDate(b.sailDate)),
          esc(b.numberOfNights || ''), esc(b.cruiseTitle || (b.numberOfNights ? b.numberOfNights + ' Night Cruise' : '')),
          esc(cabinType), esc(cabin), esc(b.bookingId || ''), esc(status),
          esc(b.paidInFull ? 'Yes' : 'No')
        ].join(','));
      });
    }

    if (rows.length === 0) { addLog('No data to export', 'error'); return; }

    var csv = rows.join('\n');
    var blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    var url = URL.createObjectURL(blob);
    var ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    var filename = 'easy-seas-' + capturedData.cruiseLine + '-' + ts + '.csv';
    var a = document.createElement('a');
    a.href = url; a.download = filename; a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    setTimeout(function() { document.body.removeChild(a); URL.revokeObjectURL(url); }, 200);
    addLog('CSV exported: ' + filename, 'success');
  }

  // ===== INIT =====
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
        checkPendingSync();
      });
    } else {
      createOverlay();
      watchForOverlayRemoval();
      addLog('Extension ready on ' + capturedData.cruiseLine, 'info');
      checkPendingSync();
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
