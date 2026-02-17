void function() {
  'use strict';

  if (window.__easySeasExtensionLoaded) {
    console.log('[Easy Seas] Extension already loaded, skipping');
    return;
  }
  window.__easySeasExtensionLoaded = true;

  console.log('[Easy Seas] Content script loaded');

  var overlayElement = null;
  var capturedData = {
    offers: null,
    upcomingCruises: null,
    courtesyHolds: null,
    loyalty: null,
    isLoggedIn: false,
    cruiseLine: window.location.hostname.includes('celebrity') ? 'celebrity' : 'royal'
  };

  var syncState = {
    isRunning: false,
    currentStep: 0,
    totalSteps: 4,
    logs: []
  };

  function createOverlay() {
    if (overlayElement) return;

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
      '</div>' +
      '<div class="es-progress-text">Syncing Data...</div>' +
      '<div class="es-progress-bar"><div class="es-progress-fill" id="progress-fill"></div></div>' +
      '</div>' +
      '<div class="es-status-row"><span class="es-status-label">Login Status</span>' +
      '<span class="es-badge es-badge-warning" id="login-status">NOT LOGGED IN</span></div>' +
      '<div class="es-status-row"><span class="es-status-label">Casino Offers</span>' +
      '<span class="es-status-value" id="offer-count">0</span></div>' +
      '<div class="es-status-row"><span class="es-status-label">Booked Cruises</span>' +
      '<span class="es-status-value" id="booking-count">0</span></div>' +
      '<div class="es-status-row"><span class="es-status-label">Cruise Line</span>' +
      '<span class="es-status-value" id="cruise-line">Royal Caribbean</span></div>' +
      '<div id="easy-seas-buttons">' +
      '<button class="es-button es-button-primary" id="sync-btn"><span>START SYNC</span></button>' +
      '<button class="es-button es-button-secondary" id="download-btn" disabled><span>DOWNLOAD CSV</span></button>' +
      '</div>' +
      '<div id="easy-seas-log"></div>' +
      '</div>';

    document.body.appendChild(overlay);
    overlayElement = overlay;

    document.getElementById('sync-btn').addEventListener('click', toggleSync);
    document.getElementById('download-btn').addEventListener('click', downloadCSV);

    console.log('[Easy Seas] Overlay created');
  }

  function updateUI() {
    if (!overlayElement) return;

    var loginStatus = document.getElementById('login-status');
    var offerCount = document.getElementById('offer-count');
    var bookingCount = document.getElementById('booking-count');
    var cruiseLine = document.getElementById('cruise-line');
    var syncBtn = document.getElementById('sync-btn');
    var downloadBtn = document.getElementById('download-btn');

    if (loginStatus) {
      if (capturedData.isLoggedIn) {
        loginStatus.textContent = 'LOGGED IN';
        loginStatus.className = 'es-badge es-badge-success';
      } else {
        loginStatus.textContent = 'NOT LOGGED IN';
        loginStatus.className = 'es-badge es-badge-warning';
      }
    }

    if (offerCount) {
      offerCount.textContent = (capturedData.offers && capturedData.offers.offers && capturedData.offers.offers.length) || 0;
    }

    if (bookingCount) {
      var upcomingCount = (capturedData.upcomingCruises && capturedData.upcomingCruises.profileBookings && capturedData.upcomingCruises.profileBookings.length) || 0;
      var holdsCount = (capturedData.courtesyHolds && capturedData.courtesyHolds.payload && capturedData.courtesyHolds.payload.sailingInfo && capturedData.courtesyHolds.payload.sailingInfo.length) || 0;
      bookingCount.textContent = upcomingCount + holdsCount;
    }

    if (cruiseLine) {
      cruiseLine.textContent = capturedData.cruiseLine === 'celebrity' ? 'Celebrity Cruises' : 'Royal Caribbean';
    }

    if (syncBtn) {
      if (syncState.isRunning) {
        syncBtn.className = 'es-button es-button-stop';
        syncBtn.innerHTML = '<div class="es-spinner"></div><span>STOP SYNC</span>';
      } else {
        syncBtn.className = 'es-button es-button-primary';
        syncBtn.innerHTML = '<span>START SYNC</span>';
        syncBtn.disabled = !capturedData.isLoggedIn;
      }
    }

    if (downloadBtn) {
      var hasOffers = capturedData.offers && capturedData.offers.offers && capturedData.offers.offers.length > 0;
      var hasBookings = capturedData.upcomingCruises && capturedData.upcomingCruises.profileBookings && capturedData.upcomingCruises.profileBookings.length > 0;
      var hasHolds = capturedData.courtesyHolds && capturedData.courtesyHolds.payload && capturedData.courtesyHolds.payload.sailingInfo && capturedData.courtesyHolds.payload.sailingInfo.length > 0;
      downloadBtn.disabled = !(hasOffers || hasBookings || hasHolds) || syncState.isRunning;
    }
  }

  function updateProgress(step, total, message) {
    var progressEl = document.getElementById('easy-seas-progress');
    var progressFill = document.getElementById('progress-fill');
    var progressText = progressEl ? progressEl.querySelector('.es-progress-text') : null;

    if (progressEl) {
      progressEl.classList.add('active');
    }

    if (progressFill) {
      var percentage = (step / total) * 100;
      progressFill.style.width = percentage + '%';
    }

    if (progressText) {
      progressText.textContent = message || ('Step ' + step + ' of ' + total);
    }

    var stepEls = document.querySelectorAll('.es-step');
    for (var i = 0; i < stepEls.length; i++) {
      stepEls[i].classList.remove('active', 'completed');
      if (i + 1 < step) {
        stepEls[i].classList.add('completed');
      } else if (i + 1 === step) {
        stepEls[i].classList.add('active');
      }
    }

    if (step >= total) {
      setTimeout(function() {
        if (progressEl) progressEl.classList.remove('active');
      }, 2000);
    }
  }

  function addLog(message, type) {
    type = type || 'info';
    console.log('[Easy Seas] ' + message);

    syncState.logs.push({ message: message, type: type, timestamp: new Date().toISOString() });
    if (syncState.logs.length > 50) syncState.logs.shift();

    var logContainer = document.getElementById('easy-seas-log');
    if (logContainer) {
      var logEntry = document.createElement('div');
      logEntry.className = 'es-log-entry es-log-' + type;
      logEntry.textContent = '[' + new Date().toLocaleTimeString() + '] ' + message;
      logContainer.appendChild(logEntry);
      logContainer.scrollTop = logContainer.scrollHeight;

      if (logContainer.children.length > 50) {
        logContainer.removeChild(logContainer.firstChild);
      }
    }
  }

  function interceptNetworkCalls() {
    var originalFetch = window.fetch;
    window.fetch = function() {
      var args = arguments;
      return originalFetch.apply(this, args).then(function(response) {
        var clonedResponse = response.clone();
        var url = typeof args[0] === 'string' ? args[0] : (args[0] && args[0].url ? args[0].url : '');

        if (typeof url === 'string' && url) {
          if (url.indexOf('/api/casino/casino-offers') !== -1) {
            clonedResponse.json().then(function(data) {
              capturedData.offers = data;
              addLog('Captured ' + ((data && data.offers && data.offers.length) || 0) + ' casino offers', 'success');
              updateUI();
              chrome.runtime.sendMessage({ type: 'data_captured', dataKey: 'offers', data: data }).catch(function() {});
            }).catch(function() {});
          }

          if (url.indexOf('/profileBookings/enriched') !== -1 || url.indexOf('/api/account/upcoming-cruises') !== -1) {
            clonedResponse.json().then(function(data) {
              capturedData.upcomingCruises = data;
              var count = (data && data.profileBookings && data.profileBookings.length) || 0;
              addLog('Captured ' + count + ' upcoming cruises', 'success');
              updateUI();
              chrome.runtime.sendMessage({ type: 'data_captured', dataKey: 'upcomingCruises', data: data }).catch(function() {});
            }).catch(function() {});
          }

          if (url.indexOf('/api/account/courtesy-holds') !== -1) {
            clonedResponse.json().then(function(data) {
              capturedData.courtesyHolds = data;
              var count = (data && data.payload && data.payload.sailingInfo && data.payload.sailingInfo.length) || 0;
              addLog('Captured ' + count + ' courtesy holds', 'success');
              updateUI();
              chrome.runtime.sendMessage({ type: 'data_captured', dataKey: 'courtesyHolds', data: data }).catch(function() {});
            }).catch(function() {});
          }

          if (url.indexOf('/guestAccounts/loyalty/info') !== -1) {
            clonedResponse.json().then(function(data) {
              capturedData.loyalty = data;
              addLog('Captured loyalty data', 'success');
              updateUI();
              chrome.runtime.sendMessage({ type: 'data_captured', dataKey: 'loyalty', data: data }).catch(function() {});
            }).catch(function() {});
          }
        }

        return response;
      });
    };

    addLog('Network monitoring active', 'info');
  }

  function checkAuthStatus() {
    var cookies = document.cookie;
    var hasCookies = cookies.indexOf('RCAUTH') !== -1 || cookies.indexOf('auth') !== -1 || cookies.length > 100;
    var hasLogoutButton = document.querySelectorAll('a[href*="logout"], a[href*="sign-out"]').length > 0;
    var isOnAccountPage = window.location.href.indexOf('/account/') !== -1 ||
                          window.location.href.indexOf('club-royale') !== -1 ||
                          window.location.href.indexOf('blue-chip') !== -1;

    var wasLoggedIn = capturedData.isLoggedIn;
    capturedData.isLoggedIn = hasLogoutButton || (hasCookies && isOnAccountPage);

    if (wasLoggedIn !== capturedData.isLoggedIn) {
      addLog(capturedData.isLoggedIn ? 'User logged in' : 'User logged out', capturedData.isLoggedIn ? 'success' : 'warning');
      updateUI();
    }
  }

  function toggleSync() {
    if (syncState.isRunning) {
      chrome.runtime.sendMessage({ type: 'stop_sync' });
      syncState.isRunning = false;
      addLog('Sync stopped by user', 'warning');
      updateUI();
      return;
    }

    if (!capturedData.isLoggedIn) {
      addLog('Please log in to Royal Caribbean website first', 'error');
      return;
    }

    syncState.isRunning = true;
    syncState.currentStep = 0;
    syncState.logs = [];
    updateUI();

    addLog('Starting automated sync...', 'info');
    chrome.runtime.sendMessage({
      type: 'start_sync',
      cruiseLine: capturedData.cruiseLine
    });
  }

  function downloadCSV() {
    addLog('Generating CSV export...', 'info');

    var script = document.createElement('script');
    script.src = chrome.runtime.getURL('csv-exporter.js');
    script.onload = function() {
      if (typeof window.exportToCSV === 'function') {
        var result = window.exportToCSV(capturedData, true, true);
        if (result.success) {
          addLog('CSV exported: ' + result.filename, 'success');
        } else {
          addLog('Export failed: ' + result.error, 'error');
        }
      }
    };
    document.head.appendChild(script);
  }

  chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    if (request.type === 'sync_progress') {
      syncState.currentStep = request.step;
      syncState.totalSteps = request.totalSteps;
      updateProgress(request.step, request.totalSteps, request.message);
      if (request.message) addLog(request.message, request.status === 'error' ? 'error' : 'info');

      if (request.status === 'completed' || request.status === 'stopped') {
        syncState.isRunning = false;
        updateUI();
      }
    }

    if (request.type === 'clear_data') {
      capturedData = {
        offers: null,
        upcomingCruises: null,
        courtesyHolds: null,
        loyalty: null,
        isLoggedIn: capturedData.isLoggedIn,
        cruiseLine: capturedData.cruiseLine
      };
      syncState.logs = [];
      updateUI();
      sendResponse({ success: true });
    }
  });

  function init() {
    function bootstrap() {
      createOverlay();
      interceptNetworkCalls();
      checkAuthStatus();
      updateUI();
    }

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', function() {
        setTimeout(bootstrap, 1000);
      });
    } else {
      setTimeout(bootstrap, 1000);
    }

    if (document.body) {
      var observer = new MutationObserver(checkAuthStatus);
      observer.observe(document.body, { childList: true, subtree: true });
    }

    setInterval(checkAuthStatus, 3000);
  }

  init();
}();
