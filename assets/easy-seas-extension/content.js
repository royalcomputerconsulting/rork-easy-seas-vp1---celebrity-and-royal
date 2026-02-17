(function() {
  if (window.__easySeasExtensionLoaded) {
    console.log('[Easy Seas] Extension already loaded, skipping');
    return;
  }
  window.__easySeasExtensionLoaded = true;
  console.log('[Easy Seas] Content script loaded');

  let overlayElement = null;
  let capturedData = {
    offers: null,
    upcomingCruises: null,
    courtesyHolds: null,
    loyalty: null,
    isLoggedIn: false,
    cruiseLine: window.location.hostname.includes('celebrity') ? 'celebrity' : 'royal'
  };

  let syncState = {
    isRunning: false,
    currentStep: 0,
    totalSteps: 4,
    logs: []
  };

  function createOverlay() {
    if (overlayElement) return;

    const overlay = document.createElement('div');
    overlay.id = 'easy-seas-overlay';
    overlay.innerHTML = `
      <div id="easy-seas-header">
        <div id="easy-seas-icon">⚓</div>
        <div style="flex: 1;">
          <div id="easy-seas-title">Easy Seas™</div>
          <div id="easy-seas-subtitle">Automated Cruise Data Sync</div>
        </div>
      </div>
      <div id="easy-seas-content">
        <div id="easy-seas-progress">
          <div class="es-step-indicator">
            <div class="es-step" data-step="1"></div>
            <div class="es-step" data-step="2"></div>
            <div class="es-step" data-step="3"></div>
            <div class="es-step" data-step="4"></div>
          </div>
          <div class="es-progress-text">Syncing Data...</div>
          <div class="es-progress-bar">
            <div class="es-progress-fill" id="progress-fill"></div>
          </div>
        </div>
        <div class="es-status-row">
          <span class="es-status-label">Login Status</span>
          <span class="es-badge es-badge-warning" id="login-status">NOT LOGGED IN</span>
        </div>
        <div class="es-status-row">
          <span class="es-status-label">Casino Offers</span>
          <span class="es-status-value" id="offer-count">0</span>
        </div>
        <div class="es-status-row">
          <span class="es-status-label">Booked Cruises</span>
          <span class="es-status-value" id="booking-count">0</span>
        </div>
        <div class="es-status-row">
          <span class="es-status-label">Cruise Line</span>
          <span class="es-status-value" id="cruise-line">Royal Caribbean</span>
        </div>
        <div id="easy-seas-buttons">
          <button class="es-button es-button-primary" id="sync-btn">
            <span>START SYNC</span>
          </button>
          <button class="es-button es-button-secondary" id="download-btn" disabled>
            <span>DOWNLOAD CSV</span>
          </button>
        </div>
        <div id="easy-seas-log"></div>
      </div>
    `;

    document.body.appendChild(overlay);
    overlayElement = overlay;

    document.getElementById('sync-btn').addEventListener('click', toggleSync);
    document.getElementById('download-btn').addEventListener('click', downloadCSV);

    console.log('[Easy Seas] Overlay created');
  }

  function updateUI() {
    if (!overlayElement) return;

    const loginStatus = document.getElementById('login-status');
    const offerCount = document.getElementById('offer-count');
    const bookingCount = document.getElementById('booking-count');
    const cruiseLine = document.getElementById('cruise-line');
    const syncBtn = document.getElementById('sync-btn');
    const downloadBtn = document.getElementById('download-btn');

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
      const count = capturedData.offers?.offers?.length || 0;
      offerCount.textContent = count;
    }

    if (bookingCount) {
      const upcomingCount = capturedData.upcomingCruises?.profileBookings?.length || 0;
      const holdsCount = capturedData.courtesyHolds?.payload?.sailingInfo?.length || 0;
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
      const hasData = (capturedData.offers?.offers?.length > 0) || 
                      (capturedData.upcomingCruises?.profileBookings?.length > 0) ||
                      (capturedData.courtesyHolds?.payload?.sailingInfo?.length > 0);
      downloadBtn.disabled = !hasData || syncState.isRunning;
    }
  }

  function updateProgress(step, total, message) {
    const progressEl = document.getElementById('easy-seas-progress');
    const progressFill = document.getElementById('progress-fill');
    const progressText = progressEl?.querySelector('.es-progress-text');

    if (progressEl) {
      progressEl.classList.add('active');
    }

    if (progressFill) {
      const percentage = (step / total) * 100;
      progressFill.style.width = `${percentage}%`;
    }

    if (progressText) {
      progressText.textContent = message || `Step ${step} of ${total}`;
    }

    document.querySelectorAll('.es-step').forEach((stepEl, idx) => {
      stepEl.classList.remove('active', 'completed');
      if (idx + 1 < step) {
        stepEl.classList.add('completed');
      } else if (idx + 1 === step) {
        stepEl.classList.add('active');
      }
    });

    if (step >= total) {
      setTimeout(() => {
        if (progressEl) progressEl.classList.remove('active');
      }, 2000);
    }
  }

  function addLog(message, type = 'info') {
    console.log(`[Easy Seas] ${message}`);
    
    syncState.logs.push({ message, type, timestamp: new Date().toISOString() });
    if (syncState.logs.length > 50) syncState.logs.shift();

    const logContainer = document.getElementById('easy-seas-log');
    if (logContainer) {
      const logEntry = document.createElement('div');
      logEntry.className = `es-log-entry es-log-${type}`;
      logEntry.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
      logContainer.appendChild(logEntry);
      logContainer.scrollTop = logContainer.scrollHeight;

      if (logContainer.children.length > 50) {
        logContainer.removeChild(logContainer.firstChild);
      }
    }
  }

  function interceptNetworkCalls() {
    const originalFetch = window.fetch;
    window.fetch = function(...args) {
      return originalFetch.apply(this, args).then(response => {
        const clonedResponse = response.clone();
        const url = typeof args[0] === 'string' ? args[0] : (args[0]?.url || '');

        if (typeof url === 'string' && url) {
          if (url.includes('/api/casino/casino-offers')) {
            clonedResponse.json().then(data => {
              capturedData.offers = data;
              addLog(`✅ Captured ${data?.offers?.length || 0} casino offers`, 'success');
              updateUI();
              chrome.runtime.sendMessage({
                type: 'data_captured',
                dataKey: 'offers',
                data: data
              }).catch(() => {});
            }).catch(() => {});
          }

          if (url.includes('/profileBookings/enriched') || url.includes('/api/account/upcoming-cruises')) {
            clonedResponse.json().then(data => {
              capturedData.upcomingCruises = data;
              const count = data?.profileBookings?.length || 0;
              addLog(`✅ Captured ${count} upcoming cruises`, 'success');
              updateUI();
              chrome.runtime.sendMessage({
                type: 'data_captured',
                dataKey: 'upcomingCruises',
                data: data
              }).catch(() => {});
            }).catch(() => {});
          }

          if (url.includes('/api/account/courtesy-holds')) {
            clonedResponse.json().then(data => {
              capturedData.courtesyHolds = data;
              const count = data?.payload?.sailingInfo?.length || 0;
              addLog(`✅ Captured ${count} courtesy holds`, 'success');
              updateUI();
              chrome.runtime.sendMessage({
                type: 'data_captured',
                dataKey: 'courtesyHolds',
                data: data
              }).catch(() => {});
            }).catch(() => {});
          }

          if (url.includes('/guestAccounts/loyalty/info')) {
            clonedResponse.json().then(data => {
              capturedData.loyalty = data;
              addLog(`✅ Captured loyalty data`, 'success');
              updateUI();
              chrome.runtime.sendMessage({
                type: 'data_captured',
                dataKey: 'loyalty',
                data: data
              }).catch(() => {});
            }).catch(() => {});
          }
        }

        return response;
      });
    };

    addLog('Network monitoring active', 'info');
  }

  function checkAuthStatus() {
    const cookies = document.cookie;
    const hasCookies = cookies.includes('RCAUTH') || cookies.includes('auth') || cookies.length > 100;
    const hasLogoutButton = document.querySelectorAll('a[href*="logout"], a[href*="sign-out"]').length > 0;
    const isOnAccountPage = window.location.href.includes('/account/') || 
                             window.location.href.includes('club-royale') || 
                             window.location.href.includes('blue-chip');

    const wasLoggedIn = capturedData.isLoggedIn;
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
    
    const script = document.createElement('script');
    script.src = chrome.runtime.getURL('csv-exporter.js');
    script.onload = () => {
      if (typeof window.exportToCSV === 'function') {
        const result = window.exportToCSV(capturedData, true, true);
        if (result.success) {
          addLog(`✅ CSV exported: ${result.filename}`, 'success');
        } else {
          addLog(`❌ Export failed: ${result.error}`, 'error');
        }
      }
    };
    document.head.appendChild(script);
  }

  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
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
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => {
        setTimeout(() => {
          createOverlay();
          interceptNetworkCalls();
          checkAuthStatus();
          updateUI();
        }, 1000);
      });
    } else {
      setTimeout(() => {
        createOverlay();
        interceptNetworkCalls();
        checkAuthStatus();
        updateUI();
      }, 1000);
    }

    const observer = new MutationObserver(checkAuthStatus);
    if (document.body) {
      observer.observe(document.body, { childList: true, subtree: true });
    }

    setInterval(checkAuthStatus, 3000);
  }

  init();
})();
