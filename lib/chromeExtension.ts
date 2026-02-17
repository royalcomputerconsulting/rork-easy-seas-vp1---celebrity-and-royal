import JSZip from 'jszip';
import { Platform } from 'react-native';

const EASY_SEAS_EXTENSION_VERSION = '1.0.0';

function getEasySeasExtensionFiles(): Record<string, string> {
  const manifestContent = `{
  "manifest_version": 3,
  "name": "Easy Seas™ — Sync Extension",
  "version": "1.0.0",
  "description": "Syncs casino offers, booked cruises, and loyalty data from Royal Caribbean & Celebrity Cruises websites. Mirrors the in-app sync functionality.",
  "permissions": [
    "storage",
    "downloads",
    "tabs",
    "scripting",
    "alarms"
  ],
  "host_permissions": [
    "https://*.royalcaribbean.com/*",
    "https://*.celebritycruises.com/*"
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
  "web_accessible_resources": [
    {
      "resources": ["csv-exporter.js"],
      "matches": [
        "https://*.royalcaribbean.com/*",
        "https://*.celebritycruises.com/*"
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
    'content.js': getContentJS(),
    'overlay.css': getOverlayCSS(),
    'csv-exporter.js': getCSVExporterJS()
  };
}

function getBackgroundJS(): string {
  return `var syncState = {
  isRunning: false,
  tabId: null,
  step: 0,
  totalSteps: 4,
  capturedData: {
    offers: null,
    upcomingCruises: null,
    courtesyHolds: null,
    loyalty: null
  },
  cruiseLine: 'royal',
  baseUrl: ''
};

var SYNC_STEPS = [
  {
    name: 'Casino Offers',
    royal: '/club-royale/offers',
    celebrity: '/blue-chip-club/offers',
    waitFor: '/api/casino/casino-offers',
    dataKey: 'offers'
  },
  {
    name: 'Upcoming Cruises',
    royal: '/account/upcoming-cruises',
    celebrity: '/account/upcoming-cruises',
    waitFor: '/profileBookings/enriched',
    dataKey: 'upcomingCruises'
  },
  {
    name: 'Courtesy Holds',
    royal: '/account/courtesy-holds',
    celebrity: '/account/courtesy-holds',
    waitFor: '/api/account/courtesy-holds',
    dataKey: 'courtesyHolds'
  },
  {
    name: 'Loyalty Info',
    royal: '/account/loyalty-status',
    celebrity: '/account/loyalty-status',
    waitFor: '/guestAccounts/loyalty/info',
    dataKey: 'loyalty'
  }
];

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'data_captured') {
    console.log(\`[Easy Seas BG] Data captured: \${request.dataKey}\`);

    if (syncState.isRunning && request.data) {
      syncState.capturedData[request.dataKey] = request.data;

      broadcastProgress({
        step: syncState.step,
        totalSteps: syncState.totalSteps,
        message: \`\\u2705 \${SYNC_STEPS[syncState.step - 1]?.name || 'Step'} completed\`,
        status: 'completed'
      }).catch(err => console.error('[Easy Seas BG] Broadcast error:', err));

      chrome.alarms.create('next_step_success', { delayInMinutes: 0.025 });
    }
    sendResponse({ success: true });
    return true;
  }

  if (request.type === 'start_sync') {
    startSync(sender.tab?.id, request.cruiseLine)
      .then(result => sendResponse(result))
      .catch(err => sendResponse({ success: false, error: err.message }));
    return true;
  }

  if (request.type === 'stop_sync') {
    stopSync();
    sendResponse({ success: true });
    return true;
  }
});

async function startSync(tabId, cruiseLine = 'royal') {
  if (syncState.isRunning) {
    return { success: false, error: 'Sync already running' };
  }

  try {
    let targetTabId = tabId;
    if (!targetTabId) {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tabs[0]) return { success: false, error: 'No active tab' };
      targetTabId = tabs[0].id;
    }

    const tab = await chrome.tabs.get(targetTabId);
    const isCelebrity = tab.url.includes('celebrity');
    const baseUrl = isCelebrity ? 'https://www.celebritycruises.com' : 'https://www.royalcaribbean.com';

    syncState = {
      isRunning: true,
      tabId: targetTabId,
      step: 0,
      totalSteps: SYNC_STEPS.length,
      capturedData: { offers: null, upcomingCruises: null, courtesyHolds: null, loyalty: null },
      cruiseLine: isCelebrity ? 'celebrity' : 'royal',
      baseUrl: baseUrl
    };

    await chrome.storage.local.set({ syncState, lastCapturedData: null });

    broadcastProgress({
      step: 0,
      totalSteps: syncState.totalSteps,
      message: 'Initializing sync...',
      status: 'started'
    });

    nextStep();
    return { success: true };
  } catch (error) {
    console.error('[Easy Seas BG] Start error:', error);
    return { success: false, error: error.message };
  }
}

function stopSync() {
  syncState.isRunning = false;
  broadcastProgress({
    step: syncState.step,
    totalSteps: syncState.totalSteps,
    message: 'Sync stopped',
    status: 'stopped'
  });
}

async function nextStep() {
  if (!syncState.isRunning) return;

  syncState.step++;

  if (syncState.step > syncState.totalSteps) {
    await finishSync();
    return;
  }

  const step = SYNC_STEPS[syncState.step - 1];
  const url = syncState.cruiseLine === 'celebrity' ? step.celebrity : step.royal;
  const fullUrl = \`\${syncState.baseUrl}\${url}\`;

  await broadcastProgress({
    step: syncState.step,
    totalSteps: syncState.totalSteps,
    message: \`Loading \${step.name}...\`,
    status: 'loading'
  });

  try {
    await chrome.tabs.update(syncState.tabId, { url: fullUrl });
    await chrome.storage.local.set({ syncState });

    await chrome.alarms.create(\`timeout_step_\${syncState.step}\`, { delayInMinutes: 0.5 });
  } catch (error) {
    console.error(\`[Easy Seas BG] Error at step \${step.name}:\`, error);
    await broadcastProgress({
      step: syncState.step,
      totalSteps: syncState.totalSteps,
      message: \`Failed to load \${step.name}\`,
      status: 'error'
    });
    await chrome.alarms.create('next_step_error', { delayInMinutes: 0.03 });
  }
}

async function finishSync() {
  syncState.isRunning = false;

  const totalCaptured = {
    offers: syncState.capturedData.offers?.offers?.length || 0,
    bookings: (syncState.capturedData.upcomingCruises?.profileBookings?.length || 0) +
              (syncState.capturedData.courtesyHolds?.payload?.sailingInfo?.length || 0),
    hasLoyalty: !!syncState.capturedData.loyalty
  };

  broadcastProgress({
    step: syncState.totalSteps,
    totalSteps: syncState.totalSteps,
    message: \`Sync complete! \${totalCaptured.offers} offers, \${totalCaptured.bookings} bookings\`,
    status: 'completed',
    capturedData: syncState.capturedData
  });

  await chrome.storage.local.set({
    syncState,
    lastCapturedData: syncState.capturedData
  });
}

async function broadcastProgress(progress) {
  if (syncState.tabId) {
    try {
      const tab = await chrome.tabs.get(syncState.tabId);
      if (tab) {
        await chrome.tabs.sendMessage(syncState.tabId, {
          type: 'sync_progress',
          ...progress
        });
      }
    } catch (err) {
      console.log('[Easy Seas BG] Tab not available for message:', err.message);
    }
  }

  try {
    await chrome.storage.local.set({
      syncProgress: { ...progress, timestamp: Date.now() }
    });
  } catch (err) {
    console.error('[Easy Seas BG] Storage error:', err);
  }
}

chrome.alarms.onAlarm.addListener(async (alarm) => {
  const result = await chrome.storage.local.get(['syncState']);
  if (result.syncState) {
    syncState = { ...syncState, ...result.syncState };
  }

  if (alarm.name.startsWith('timeout_step_')) {
    const stepNum = parseInt(alarm.name.split('_')[2]);
    if (syncState.isRunning && syncState.step === stepNum) {
      const step = SYNC_STEPS[stepNum - 1];
      if (step && !syncState.capturedData[step.dataKey]) {
        console.warn(\`[Easy Seas BG] Timeout for \${step.name}\`);
        await broadcastProgress({
          step: syncState.step,
          totalSteps: syncState.totalSteps,
          message: \`\${step.name} timed out, continuing...\`,
          status: 'warning'
        });
        await chrome.alarms.create('next_step_timeout', { delayInMinutes: 0.017 });
      }
    }
  }

  if (alarm.name === 'next_step_success' || alarm.name === 'next_step_error' || alarm.name === 'next_step_timeout') {
    if (syncState.isRunning) {
      await nextStep();
    }
  }
});

(async () => {
  try {
    const result = await chrome.storage.local.get(['syncState']);
    if (result.syncState) {
      syncState = { ...syncState, ...result.syncState, isRunning: false };
      console.log('[Easy Seas BG] Service worker initialized, restored state');
    }
    await chrome.alarms.clearAll();
  } catch (err) {
    console.error('[Easy Seas BG] Init error:', err);
  }
})();

chrome.runtime.onInstalled.addListener(() => {
  console.log('[Easy Seas BG] Extension installed/updated');
  chrome.alarms.clearAll();
});

chrome.runtime.onStartup.addListener(() => {
  console.log('[Easy Seas BG] Browser startup');
  chrome.alarms.clearAll();
});`;
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

#easy-seas-overlay * {
  box-sizing: border-box !important;
  margin: 0 !important;
  padding: 0 !important;
}

#easy-seas-header {
  padding: 20px !important;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1) !important;
  display: flex !important;
  align-items: center !important;
  gap: 12px !important;
}

#easy-seas-icon {
  width: 32px !important;
  height: 32px !important;
  font-size: 24px !important;
}

#easy-seas-title {
  flex: 1 !important;
  font-size: 18px !important;
  font-weight: 600 !important;
  color: #fff !important;
}

#easy-seas-subtitle {
  font-size: 12px !important;
  color: rgba(255, 255, 255, 0.6) !important;
  margin-top: 4px !important;
}

#easy-seas-content {
  padding: 20px !important;
  overflow-y: auto !important;
  max-height: 450px !important;
}

#easy-seas-content::-webkit-scrollbar {
  width: 6px !important;
}

#easy-seas-content::-webkit-scrollbar-track {
  background: rgba(255, 255, 255, 0.05) !important;
  border-radius: 3px !important;
}

#easy-seas-content::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.2) !important;
  border-radius: 3px !important;
}

.es-status-row {
  display: flex !important;
  justify-content: space-between !important;
  align-items: center !important;
  padding: 12px 0 !important;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05) !important;
}

.es-status-label {
  font-size: 13px !important;
  color: rgba(255, 255, 255, 0.7) !important;
}

.es-status-value {
  font-size: 14px !important;
  font-weight: 600 !important;
  color: #fff !important;
}

.es-badge {
  padding: 4px 10px !important;
  border-radius: 12px !important;
  font-size: 12px !important;
  font-weight: 600 !important;
}

.es-badge-success {
  background: rgba(16, 185, 129, 0.2) !important;
  color: #10b981 !important;
}

.es-badge-warning {
  background: rgba(245, 158, 11, 0.2) !important;
  color: #f59e0b !important;
}

.es-badge-error {
  background: rgba(239, 68, 68, 0.2) !important;
  color: #ef4444 !important;
}

.es-badge-info {
  background: rgba(59, 130, 246, 0.2) !important;
  color: #3b82f6 !important;
}

#easy-seas-progress {
  margin: 16px 0 !important;
  display: none !important;
}

#easy-seas-progress.active {
  display: block !important;
}

.es-progress-bar {
  height: 6px !important;
  background: rgba(255, 255, 255, 0.1) !important;
  border-radius: 3px !important;
  overflow: hidden !important;
  margin-bottom: 12px !important;
}

.es-progress-fill {
  height: 100% !important;
  background: linear-gradient(90deg, #3b82f6, #10b981) !important;
  border-radius: 3px !important;
  transition: width 0.3s ease !important;
  width: 0% !important;
}

.es-progress-text {
  font-size: 12px !important;
  color: rgba(255, 255, 255, 0.7) !important;
  text-align: center !important;
  margin-bottom: 8px !important;
}

.es-step-indicator {
  display: flex !important;
  gap: 8px !important;
  margin-bottom: 12px !important;
}

.es-step {
  flex: 1 !important;
  height: 4px !important;
  background: rgba(255, 255, 255, 0.1) !important;
  border-radius: 2px !important;
  transition: background 0.3s ease !important;
}

.es-step.completed {
  background: #10b981 !important;
}

.es-step.active {
  background: #3b82f6 !important;
  animation: pulse 1.5s ease-in-out infinite !important;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

#easy-seas-buttons {
  display: flex !important;
  gap: 12px !important;
  margin-top: 20px !important;
}

.es-button {
  flex: 1 !important;
  padding: 12px 20px !important;
  border: none !important;
  border-radius: 8px !important;
  font-size: 14px !important;
  font-weight: 600 !important;
  cursor: pointer !important;
  transition: all 0.2s ease !important;
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
  gap: 8px !important;
}

.es-button:disabled {
  opacity: 0.5 !important;
  cursor: not-allowed !important;
}

.es-button-primary {
  background: #10b981 !important;
  color: #fff !important;
}

.es-button-primary:hover:not(:disabled) {
  background: #059669 !important;
  transform: translateY(-1px) !important;
}

.es-button-secondary {
  background: rgba(59, 130, 246, 0.2) !important;
  color: #3b82f6 !important;
  border: 1px solid #3b82f6 !important;
}

.es-button-secondary:hover:not(:disabled) {
  background: rgba(59, 130, 246, 0.3) !important;
}

.es-button-stop {
  background: rgba(239, 68, 68, 0.2) !important;
  color: #ef4444 !important;
  border: 1px solid #ef4444 !important;
}

.es-button-stop:hover:not(:disabled) {
  background: rgba(239, 68, 68, 0.3) !important;
}

.es-spinner {
  width: 14px !important;
  height: 14px !important;
  border: 2px solid rgba(255, 255, 255, 0.3) !important;
  border-top-color: #fff !important;
  border-radius: 50% !important;
  animation: spin 0.8s linear infinite !important;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

#easy-seas-log {
  margin-top: 16px !important;
  max-height: 120px !important;
  overflow-y: auto !important;
  padding: 12px !important;
  background: rgba(0, 0, 0, 0.3) !important;
  border-radius: 8px !important;
  font-size: 11px !important;
  font-family: 'Monaco', 'Menlo', monospace !important;
  color: rgba(255, 255, 255, 0.7) !important;
  line-height: 1.6 !important;
}

#easy-seas-log::-webkit-scrollbar {
  width: 4px !important;
}

#easy-seas-log::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.2) !important;
  border-radius: 2px !important;
}

.es-log-entry {
  margin-bottom: 4px !important;
  padding: 4px 0 !important;
}

.es-log-success {
  color: #10b981 !important;
}

.es-log-warning {
  color: #f59e0b !important;
}

.es-log-error {
  color: #ef4444 !important;
}

.es-log-info {
  color: #3b82f6 !important;
}`;
}

function getContentJS(): string {
  return `void function() {
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
}();`;
}

function getCSVExporterJS(): string {
  return `function escapeCSVField(value) {
  if (value === null || value === undefined) return '';
  var stringValue = String(value);
  if (stringValue.indexOf(',') !== -1 || stringValue.indexOf('"') !== -1 || stringValue.indexOf('\\n') !== -1 || stringValue.indexOf('\\r') !== -1) {
    return '"' + stringValue.replace(/"/g, '""') + '"';
  }
  return stringValue;
}

function parseDate(dateStr) {
  if (!dateStr) return '';
  var trimmed = dateStr.trim();

  try {
    var isoMatch = trimmed.match(/^(\\d{4})-(\\d{2})-(\\d{2})/);
    if (isoMatch) {
      var year = isoMatch[1];
      var month = isoMatch[2];
      var day = isoMatch[3];
      return month + '-' + day + '-' + year;
    }

    var mmddyyyyDash = trimmed.match(/^(\\d{1,2})-(\\d{1,2})-(\\d{4})$/);
    if (mmddyyyyDash) {
      var month2 = mmddyyyyDash[1].padStart(2, '0');
      var day2 = mmddyyyyDash[2].padStart(2, '0');
      var year2 = mmddyyyyDash[3];
      return month2 + '-' + day2 + '-' + year2;
    }

    var mmddyyyySlash = trimmed.match(/^(\\d{1,2})\\/(\\d{1,2})\\/(\\d{2,4})$/);
    if (mmddyyyySlash) {
      var month3 = mmddyyyySlash[1].padStart(2, '0');
      var day3 = mmddyyyySlash[2].padStart(2, '0');
      var year3 = mmddyyyySlash[3].length === 2 ? '20' + mmddyyyySlash[3] : mmddyyyySlash[3];
      return month3 + '-' + day3 + '-' + year3;
    }

    var date = new Date(trimmed);
    if (!isNaN(date.getTime())) {
      var month4 = String(date.getMonth() + 1).padStart(2, '0');
      var day4 = String(date.getDate()).padStart(2, '0');
      var year4 = String(date.getFullYear());
      return month4 + '-' + day4 + '-' + year4;
    }
  } catch (e) {
    console.warn('[CSV Export] Failed to parse date:', dateStr);
  }

  return dateStr;
}

function extractNightsFromText(text) {
  if (!text) return null;
  var nightsMatch = text.match(/(\\d+)\\s*[-]?\\s*night/i);
  if (nightsMatch) {
    var nights = parseInt(nightsMatch[1], 10);
    if (nights > 0 && nights <= 365) return nights;
  }
  return null;
}

function generateOffersCSV(offersData, loyaltyData) {
  if (!offersData || !offersData.offers || offersData.offers.length === 0) {
    console.log('[CSV Export] No offers to export');
    return null;
  }

  var offers = offersData.offers;
  var headers = [
    'Source Page',
    'Offer Name',
    'Offer Code',
    'Offer Expiration Date',
    'Offer Type',
    'Ship Name',
    'Sailing Date',
    'Itinerary',
    'Departure Port',
    'Cabin Type',
    'Number of Guests',
    'Perks',
    'Loyalty Level',
    'Loyalty Points',
    'Interior Price',
    'Oceanview Price',
    'Balcony Price',
    'Suite Price',
    'Port List'
  ];

  var rows = [headers.join(',')];
  var totalSailings = 0;

  for (var i = 0; i < offers.length; i++) {
    var offer = offers[i];
    var campaignOffer = offer.campaignOffer || offer;
    var sailings = campaignOffer.sailings || [];

    var offerCode = campaignOffer.offerCode || '';
    var offerName = campaignOffer.name || campaignOffer.offerName || '';
    var offerExpiryDate = parseDate(campaignOffer.reserveByDate || campaignOffer.expiryDate || '');
    var offerType = campaignOffer.offerType || campaignOffer.type || 'Free Play';

    for (var j = 0; j < sailings.length; j++) {
      var sailing = sailings[j];
      var itinerary = sailing.itineraryDescription || sailing.itinerary || '';
      var nights = extractNightsFromText(itinerary) || sailing.numberOfNights || 7;

      var shipName = sailing.shipName || '';
      var sailingDate = parseDate(sailing.sailDate || sailing.sailingDate || '');
      var cabinType = sailing.roomType || sailing.cabinType || 'Balcony';
      var numberOfGuests = sailing.numberOfGuests || (sailing.isGOBO ? '1' : '2');
      var departurePort = sailing.departurePort && sailing.departurePort.name ? sailing.departurePort.name : (sailing.departurePort || '');

      var portList = Array.isArray(sailing.portList) ? sailing.portList.join(', ') : '';
      var perks = '-';

      var loyaltyLevel = loyaltyData && loyaltyData.crownAndAnchorLevel ? loyaltyData.crownAndAnchorLevel : '';
      var loyaltyPoints = loyaltyData && loyaltyData.crownAndAnchorPoints ? loyaltyData.crownAndAnchorPoints : '';

      var row = [
        escapeCSVField('Club Royale Offers'),
        escapeCSVField(offerName),
        escapeCSVField(offerCode),
        escapeCSVField(offerExpiryDate),
        escapeCSVField(offerType),
        escapeCSVField(shipName),
        escapeCSVField(sailingDate),
        escapeCSVField(itinerary),
        escapeCSVField(departurePort),
        escapeCSVField(cabinType),
        escapeCSVField(numberOfGuests),
        escapeCSVField(perks),
        escapeCSVField(loyaltyLevel),
        escapeCSVField(loyaltyPoints),
        escapeCSVField(sailing.interiorPrice || ''),
        escapeCSVField(sailing.oceanviewPrice || ''),
        escapeCSVField(sailing.balconyPrice || ''),
        escapeCSVField(sailing.suitePrice || ''),
        escapeCSVField(portList)
      ];

      rows.push(row.join(','));
      totalSailings++;
    }
  }

  console.log('[CSV Export] Generated', totalSailings, 'offer sailings from', offers.length, 'offers');
  return rows.join('\\n');
}

function generateBookedCruisesCSV(bookingsData, loyaltyData) {
  var bookings = [];

  if (bookingsData.upcomingCruises && bookingsData.upcomingCruises.profileBookings) {
    for (var i = 0; i < bookingsData.upcomingCruises.profileBookings.length; i++) {
      var b = bookingsData.upcomingCruises.profileBookings[i];
      bookings.push(Object.assign({}, b, { source: 'Upcoming' }));
    }
  }

  if (bookingsData.courtesyHolds && bookingsData.courtesyHolds.payload && bookingsData.courtesyHolds.payload.sailingInfo) {
    for (var j = 0; j < bookingsData.courtesyHolds.payload.sailingInfo.length; j++) {
      var c = bookingsData.courtesyHolds.payload.sailingInfo[j];
      bookings.push(Object.assign({}, c, { source: 'Courtesy Hold' }));
    }
  } else if (bookingsData.courtesyHolds && bookingsData.courtesyHolds.sailingInfo) {
    for (var k = 0; k < bookingsData.courtesyHolds.sailingInfo.length; k++) {
      var d = bookingsData.courtesyHolds.sailingInfo[k];
      bookings.push(Object.assign({}, d, { source: 'Courtesy Hold' }));
    }
  }

  if (bookings.length === 0) {
    console.log('[CSV Export] No bookings to export');
    return null;
  }

  var headers = [
    'Source Page',
    'Ship Name',
    'Sailing Start Date',
    'Sailing End Date',
    'Sailing Date(s)',
    'Itinerary',
    'Departure Port',
    'Cabin Type',
    'Cabin Number/GTY',
    'Booking ID',
    'Status',
    'Loyalty Level',
    'Loyalty Points'
  ];

  var rows = [headers.join(',')];

  var SHIP_CODE_MAP = {
    'AL': 'Allure of the Seas', 'AN': 'Anthem of the Seas', 'AD': 'Adventure of the Seas',
    'BR': 'Brilliance of the Seas', 'EN': 'Enchantment of the Seas', 'EX': 'Explorer of the Seas',
    'FR': 'Freedom of the Seas', 'GR': 'Grandeur of the Seas', 'HM': 'Harmony of the Seas',
    'IC': 'Icon of the Seas', 'ID': 'Independence of the Seas', 'JW': 'Jewel of the Seas',
    'LB': 'Liberty of the Seas', 'LE': 'Legend of the Seas', 'MJ': 'Majesty of the Seas',
    'MR': 'Mariner of the Seas', 'NV': 'Navigator of the Seas', 'OA': 'Oasis of the Seas',
    'OV': 'Ovation of the Seas', 'OY': 'Odyssey of the Seas', 'QN': 'Quantum of the Seas',
    'RD': 'Radiance of the Seas', 'RH': 'Rhapsody of the Seas', 'SE': 'Serenade of the Seas',
    'SP': 'Spectrum of the Seas', 'SY': 'Symphony of the Seas', 'UT': 'Utopia of the Seas',
    'VI': 'Vision of the Seas', 'VY': 'Voyager of the Seas', 'WN': 'Wonder of the Seas'
  };

  var STATEROOM_TYPE_MAP = {
    'I': 'Interior', 'O': 'Ocean View', 'B': 'Balcony', 'S': 'Suite'
  };

  for (var n = 0; n < bookings.length; n++) {
    var booking = bookings[n];
    var shipCode = booking.shipCode || '';
    var shipName = SHIP_CODE_MAP[shipCode] || booking.shipName || (shipCode ? shipCode + ' of the Seas' : '');

    var sailDate = parseDate(booking.sailDate || booking.sailingStartDate || '');
    var nights = booking.numberOfNights || 7;

    var returnDate = parseDate(booking.returnDate || booking.sailingEndDate || '');
    if (!returnDate && sailDate && nights) {
      var startParts = sailDate.match(/(\\d{1,2})-(\\d{1,2})-(\\d{4})/);
      if (startParts) {
        var month = startParts[1];
        var day = startParts[2];
        var year = startParts[3];
        var startDateObj = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
        startDateObj.setDate(startDateObj.getDate() + nights);
        returnDate = String(startDateObj.getMonth() + 1).padStart(2, '0') + '-' + String(startDateObj.getDate()).padStart(2, '0') + '-' + startDateObj.getFullYear();
      }
    }

    var sailingDates = booking.sailingDates || (sailDate + ' - ' + returnDate);
    var itinerary = booking.itinerary || booking.cruiseTitle || booking.itineraryDescription || (nights + ' Night Cruise');
    var departurePort = booking.departurePort && booking.departurePort.name ? booking.departurePort.name : (booking.departurePort || '');

    var stateroomType = booking.stateroomType || '';
    var cabinType = STATEROOM_TYPE_MAP[stateroomType] || booking.cabinType || stateroomType || '';

    var stateroomNumber = booking.stateroomNumber || '';
    var cabinNumberOrGTY = stateroomNumber === 'GTY' ? 'GTY' : stateroomNumber;

    var bookingId = booking.bookingId || booking.masterBookingId || '';

    var status = booking.source || 'Upcoming';
    if (booking.bookingStatus === 'OF') status = 'Courtesy Hold';
    else if (booking.status) status = booking.status;

    var loyaltyLevel = loyaltyData && loyaltyData.crownAndAnchorLevel ? loyaltyData.crownAndAnchorLevel : '';
    var loyaltyPoints = loyaltyData && loyaltyData.crownAndAnchorPoints ? loyaltyData.crownAndAnchorPoints : '';

    var row = [
      escapeCSVField(status),
      escapeCSVField(shipName),
      escapeCSVField(sailDate),
      escapeCSVField(returnDate),
      escapeCSVField(sailingDates),
      escapeCSVField(itinerary),
      escapeCSVField(departurePort),
      escapeCSVField(cabinType),
      escapeCSVField(cabinNumberOrGTY),
      escapeCSVField(bookingId),
      escapeCSVField(status),
      escapeCSVField(loyaltyLevel),
      escapeCSVField(loyaltyPoints)
    ];

    rows.push(row.join(','));
  }

  console.log('[CSV Export] Generated', bookings.length, 'booking rows');
  return rows.join('\\n');
}

window.exportToCSV = function(capturedData, includeOffers, includeBookings) {
  console.log('[CSV Export] Starting export with data:', {
    hasOffers: !!capturedData.offers,
    hasUpcomingCruises: !!capturedData.upcomingCruises,
    hasCourtesyHolds: !!capturedData.courtesyHolds,
    includeOffers: includeOffers,
    includeBookings: includeBookings
  });

  var loyaltyData = capturedData.loyalty && capturedData.loyalty.payload && capturedData.loyalty.payload.loyaltyInformation ? capturedData.loyalty.payload.loyaltyInformation : null;

  var csvContent = '';

  if (includeOffers && capturedData.offers) {
    var offersCSV = generateOffersCSV(capturedData.offers, loyaltyData);
    if (offersCSV) {
      csvContent += offersCSV;
    }
  }

  if (includeBookings) {
    var bookingsCSV = generateBookedCruisesCSV(capturedData, loyaltyData);
    if (bookingsCSV) {
      if (csvContent) csvContent += '\\n\\n';
      csvContent += bookingsCSV;
    }
  }

  if (!csvContent) {
    console.error('[CSV Export] No data to export');
    return { success: false, error: 'No data to export' };
  }

  var blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  var url = URL.createObjectURL(blob);
  var timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
  var cruiseLine = capturedData.cruiseLine === 'celebrity' ? 'celebrity' : 'royal';
  var filename = 'easy-seas-' + cruiseLine + '-offers-' + timestamp + '.csv';

  console.log('[CSV Export] Initiating download:', filename);

  chrome.downloads.download({
    url: url,
    filename: filename,
    saveAs: true
  }, function(downloadId) {
    if (chrome.runtime.lastError) {
      console.error('[CSV Export] Download failed:', chrome.runtime.lastError);
      return;
    }
    console.log('[CSV Export] Download started with ID:', downloadId);
    setTimeout(function() { URL.revokeObjectURL(url); }, 1000);
  });

  return { success: true, filename: filename };
};`;
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
