void function() {
  'use strict';

  if (window.__easySeasExtensionLoaded) {
    console.log('[Easy Seas] Extension already loaded, skipping');
    return;
  }
  window.__easySeasExtensionLoaded = true;

  console.log('[Easy Seas] Content script loaded on', window.location.href);

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

  var networkIntercepted = false;

  function createOverlay() {
    var existing = document.getElementById('easy-seas-overlay');
    if (existing) {
      overlayElement = existing;
      console.log('[Easy Seas] Overlay already exists in DOM');
      return;
    }

    if (!document.body) {
      console.log('[Easy Seas] document.body not ready, retrying...');
      setTimeout(createOverlay, 200);
      return;
    }

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

    var syncBtn = document.getElementById('sync-btn');
    var downloadBtn = document.getElementById('download-btn');
    if (syncBtn) syncBtn.addEventListener('click', toggleSync);
    if (downloadBtn) downloadBtn.addEventListener('click', downloadCSV);

    console.log('[Easy Seas] Overlay created and appended to body');
    updateUI();
  }

  function ensureOverlay() {
    var existing = document.getElementById('easy-seas-overlay');
    if (!existing && document.body) {
      console.log('[Easy Seas] Overlay missing from DOM, re-creating...');
      overlayElement = null;
      createOverlay();
    }
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
    if (networkIntercepted) return;
    networkIntercepted = true;

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

    var originalXHROpen = XMLHttpRequest.prototype.open;
    var originalXHRSend = XMLHttpRequest.prototype.send;

    XMLHttpRequest.prototype.open = function(method, url) {
      this._easySeasUrl = url;
      return originalXHROpen.apply(this, arguments);
    };

    XMLHttpRequest.prototype.send = function() {
      var xhr = this;
      var url = xhr._easySeasUrl || '';

      xhr.addEventListener('load', function() {
        try {
          if (typeof url === 'string' && url && xhr.responseText) {
            var data = null;
            try { data = JSON.parse(xhr.responseText); } catch(e) { return; }

            if (url.indexOf('/api/casino/casino-offers') !== -1 && data) {
              capturedData.offers = data;
              addLog('XHR: Captured ' + ((data.offers && data.offers.length) || 0) + ' casino offers', 'success');
              updateUI();
              chrome.runtime.sendMessage({ type: 'data_captured', dataKey: 'offers', data: data }).catch(function() {});
            }

            if ((url.indexOf('/profileBookings/enriched') !== -1 || url.indexOf('/api/account/upcoming-cruises') !== -1) && data) {
              capturedData.upcomingCruises = data;
              addLog('XHR: Captured ' + ((data.profileBookings && data.profileBookings.length) || 0) + ' upcoming cruises', 'success');
              updateUI();
              chrome.runtime.sendMessage({ type: 'data_captured', dataKey: 'upcomingCruises', data: data }).catch(function() {});
            }

            if (url.indexOf('/api/account/courtesy-holds') !== -1 && data) {
              capturedData.courtesyHolds = data;
              addLog('XHR: Captured courtesy holds', 'success');
              updateUI();
              chrome.runtime.sendMessage({ type: 'data_captured', dataKey: 'courtesyHolds', data: data }).catch(function() {});
            }

            if (url.indexOf('/guestAccounts/loyalty/info') !== -1 && data) {
              capturedData.loyalty = data;
              addLog('XHR: Captured loyalty data', 'success');
              updateUI();
              chrome.runtime.sendMessage({ type: 'data_captured', dataKey: 'loyalty', data: data }).catch(function() {});
            }
          }
        } catch(e) {
          console.warn('[Easy Seas] XHR intercept error:', e);
        }
      });

      return originalXHRSend.apply(this, arguments);
    };

    addLog('Network monitoring active (fetch + XHR)', 'info');
  }

  function checkAuthStatus() {
    var cookies = document.cookie;
    var hasCookies = cookies.indexOf('RCAUTH') !== -1 || cookies.indexOf('auth') !== -1 || cookies.length > 100;
    var hasLogoutButton = document.querySelectorAll('a[href*="logout"], a[href*="sign-out"], button[data-testid*="logout"], [class*="logout"], [class*="sign-out"]').length > 0;
    var hasAccountLinks = document.querySelectorAll('a[href*="/account/"], a[href*="/my-account"], [class*="myAccount"]').length > 0;
    var isOnAccountPage = window.location.href.indexOf('/account/') !== -1 ||
                          window.location.href.indexOf('club-royale') !== -1 ||
                          window.location.href.indexOf('blue-chip') !== -1;
    var hasProfileElements = document.querySelectorAll('[class*="profile"], [class*="user-name"], [class*="greeting"]').length > 0;

    var wasLoggedIn = capturedData.isLoggedIn;
    capturedData.isLoggedIn = hasLogoutButton || hasProfileElements || (hasCookies && (isOnAccountPage || hasAccountLinks));

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
      ensureOverlay();
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

  function bootstrap() {
    console.log('[Easy Seas] Bootstrapping overlay...');
    createOverlay();
    interceptNetworkCalls();
    checkAuthStatus();
    updateUI();
    addLog('Extension ready on ' + capturedData.cruiseLine, 'info');
  }

  function watchForOverlayRemoval() {
    if (!document.body) {
      setTimeout(watchForOverlayRemoval, 300);
      return;
    }

    var observer = new MutationObserver(function() {
      ensureOverlay();
      checkAuthStatus();
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });

    console.log('[Easy Seas] MutationObserver watching for DOM changes');
  }

  function init() {
    console.log('[Easy Seas] Initializing, readyState:', document.readyState);

    interceptNetworkCalls();

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', function() {
        console.log('[Easy Seas] DOMContentLoaded fired');
        bootstrap();
        watchForOverlayRemoval();
      });
    } else {
      bootstrap();
      watchForOverlayRemoval();
    }

    setInterval(function() {
      ensureOverlay();
      checkAuthStatus();
    }, 2000);
  }

  init();
}();
