import JSZip from 'jszip';
import { Platform } from 'react-native';

const SCRAPER_EXTENSION_VERSION = '1.0.0';
const GRID_BUILDER_EXTENSION_VERSION = '2.0';

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
    "scripting"
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
  "action": {
    "default_title": "Easy Seas™ — Automated Cruise Data Sync"
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
  return `let syncState = {
  isLoggedIn: false,
  hasOffers: false,
  hasBookings: false,
  offerCount: 0,
  bookingCount: 0,
  cruiseLine: 'royal',
  lastUpdate: null,
  syncProgress: null
};

let syncState = {
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
  errors: []
};

const SYNC_STEPS = [
  {
    name: 'Casino Offers',
    url: '/account/club-royale/offers',
    waitForEndpoint: '/api/casino/casino-offers',
    dataKey: 'offers'
  },
  {
    name: 'Upcoming Cruises',
    url: '/account/upcoming-cruises',
    waitForEndpoint: '/profileBookings/enriched',
    dataKey: 'upcomingCruises'
  },
  {
    name: 'Courtesy Holds',
    url: '/account/courtesy-holds',
    waitForEndpoint: '/api/account/courtesy-holds',
    dataKey: 'courtesyHolds'
  },
  {
    name: 'Loyalty Info',
    url: '/account/loyalty-status',
    waitForEndpoint: '/guestAccounts/loyalty/info',
    dataKey: 'loyalty'
  }
];

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'status_update') {
    currentStatus = { ...currentStatus, ...request.data };
    chrome.storage.local.set({ status: currentStatus });
    
    chrome.action.setBadgeText({
      text: currentStatus.hasOffers || currentStatus.hasBookings ? '✓' : ''
    });
    chrome.action.setBadgeBackgroundColor({ color: '#10b981' });
  }
  
  if (request.type === 'data_captured') {
    console.log(\`[Easy Seas] Data captured: \${request.endpoint}, count: \${request.count}\`);
    
    if (syncState.isRunning && request.data) {
      syncState.capturedData[request.dataKey] = request.data;
      
      broadcastSyncProgress({
        step: syncState.step,
        stepName: SYNC_STEPS[syncState.step - 1]?.name || 'Unknown',
        status: 'completed',
        message: \`Captured \${request.count} items\`
      });
      
      setTimeout(() => nextSyncStep(), 1500);
    }
  }
  
  if (request.type === 'start_sync') {
    startSync(sender.tab?.id || request.tabId).then(result => {
      sendResponse(result);
    });
    return true;
  }
  
  if (request.type === 'stop_sync') {
    stopSync();
    sendResponse({ success: true });
    return true;
  }
  
  if (request.type === 'get_sync_state') {
    sendResponse({ 
      success: true, 
      isRunning: syncState.isRunning,
      step: syncState.step,
      totalSteps: syncState.totalSteps,
      capturedData: syncState.capturedData
    });
    return true;
  }
});

async function startSync(tabId) {
  if (syncState.isRunning) {
    return { success: false, error: 'Sync already running' };
  }
  
  try {
    let targetTabId = tabId;
    
    if (!targetTabId) {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tabs[0]) {
        return { success: false, error: 'No active tab found' };
      }
      targetTabId = tabs[0].id;
    }
    
    const tab = await chrome.tabs.get(targetTabId);
    
    if (!tab.url.includes('royalcaribbean.com') && !tab.url.includes('celebritycruises.com')) {
      return { success: false, error: 'Please open Royal Caribbean or Celebrity Cruises website first' };
    }
    
    syncState = {
      isRunning: true,
      tabId: targetTabId,
      step: 0,
      totalSteps: SYNC_STEPS.length,
      capturedData: {
        offers: null,
        upcomingCruises: null,
        courtesyHolds: null,
        loyalty: null
      },
      errors: [],
      cruiseLine: tab.url.includes('celebrity') ? 'celebrity' : 'royal',
      baseUrl: tab.url.includes('celebrity') ? 'https://www.celebritycruises.com' : 'https://www.royalcaribbean.com'
    };
    
    broadcastSyncProgress({
      step: 0,
      stepName: 'Starting',
      status: 'started',
      message: 'Initializing sync...'
    });
    
    await chrome.storage.local.set({ syncState });
    
    nextSyncStep();
    
    return { success: true, message: 'Sync started' };
  } catch (error) {
    console.error('[Easy Seas] Start sync error:', error);
    return { success: false, error: error.message };
  }
}

function stopSync() {
  syncState.isRunning = false;
  broadcastSyncProgress({
    step: syncState.step,
    stepName: 'Stopped',
    status: 'stopped',
    message: 'Sync stopped by user'
  });
  chrome.storage.local.set({ syncState });
}

async function nextSyncStep() {
  if (!syncState.isRunning) return;
  
  syncState.step++;
  
  if (syncState.step > syncState.totalSteps) {
    await finishSync();
    return;
  }
  
  const step = SYNC_STEPS[syncState.step - 1];
  
  broadcastSyncProgress({
    step: syncState.step,
    stepName: step.name,
    status: 'loading',
    message: \`Navigating to \${step.name}...\`
  });
  
  try {
    const fullUrl = \`\${syncState.baseUrl}\${step.url}\`;
    
    await chrome.tabs.update(syncState.tabId, { url: fullUrl });
    
    await chrome.storage.local.set({ syncState });
    
    setTimeout(() => {
      if (syncState.isRunning && syncState.step === SYNC_STEPS.indexOf(step) + 1) {
        checkStepTimeout(step);
      }
    }, 30000);
    
  } catch (error) {
    console.error(\`[Easy Seas] Error navigating to \${step.name}:\`, error);
    syncState.errors.push(\`\${step.name}: \${error.message}\`);
    
    broadcastSyncProgress({
      step: syncState.step,
      stepName: step.name,
      status: 'error',
      message: \`Failed to load \${step.name}\`
    });
    
    setTimeout(() => nextSyncStep(), 2000);
  }
}

function checkStepTimeout(step) {
  if (!syncState.capturedData[step.dataKey]) {
    console.warn(\`[Easy Seas] Timeout waiting for \${step.name} data\`);
    syncState.errors.push(\`\${step.name}: Timeout - no data captured\`);
    
    broadcastSyncProgress({
      step: syncState.step,
      stepName: step.name,
      status: 'warning',
      message: \`\${step.name} timed out, continuing...\`
    });
    
    setTimeout(() => nextSyncStep(), 1000);
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
  
  broadcastSyncProgress({
    step: syncState.totalSteps,
    stepName: 'Complete',
    status: 'completed',
    message: \`Sync complete! \${totalCaptured.offers} offers, \${totalCaptured.bookings} bookings\`,
    capturedData: syncState.capturedData,
    errors: syncState.errors
  });
  
  currentStatus = {
    ...currentStatus,
    hasOffers: totalCaptured.offers > 0,
    hasBookings: totalCaptured.bookings > 0,
    offerCount: totalCaptured.offers,
    bookingCount: totalCaptured.bookings,
    lastUpdate: new Date().toISOString()
  };
  
  await chrome.storage.local.set({ 
    status: currentStatus, 
    syncState,
    lastCapturedData: syncState.capturedData
  });
}

function broadcastSyncProgress(progress) {
  chrome.runtime.sendMessage({
    type: 'sync_progress',
    progress: {
      ...progress,
      step: syncState.step,
      totalSteps: syncState.totalSteps
    }
  }).catch(() => {});
  
  chrome.storage.local.set({ 
    syncProgress: {
      ...progress,
      step: syncState.step,
      totalSteps: syncState.totalSteps,
      timestamp: Date.now()
    }
  });
}

chrome.storage.local.get(['status'], (result) => {
  if (result.status) {
    currentStatus = result.status;
  }
});`;
}

function getOverlayCSS(): string {
  return `/* Easy Seas Floating Overlay */
#easy-seas-overlay{position:fixed!important;top:20px!important;right:20px!important;width:400px!important;max-height:600px!important;background:linear-gradient(135deg,#1e3a8a 0%,#0f172a 100%)!important;border-radius:16px!important;box-shadow:0 20px 60px rgba(0,0,0,0.5),0 0 0 1px rgba(255,255,255,0.1)!important;z-index:2147483647!important;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif!important;color:#fff!important;display:flex!important;flex-direction:column!important;overflow:hidden!important;backdrop-filter:blur(20px)!important}#easy-seas-overlay *{box-sizing:border-box!important;margin:0!important;padding:0!important}#easy-seas-header{padding:20px!important;border-bottom:1px solid rgba(255,255,255,0.1)!important;display:flex!important;align-items:center!important;gap:12px!important}#easy-seas-icon{width:32px!important;height:32px!important;font-size:24px!important}#easy-seas-title{flex:1!important;font-size:18px!important;font-weight:600!important;color:#fff!important}#easy-seas-subtitle{font-size:12px!important;color:rgba(255,255,255,0.6)!important;margin-top:4px!important}#easy-seas-content{padding:20px!important;overflow-y:auto!important;max-height:450px!important}#easy-seas-content::-webkit-scrollbar{width:6px!important}#easy-seas-content::-webkit-scrollbar-track{background:rgba(255,255,255,0.05)!important;border-radius:3px!important}#easy-seas-content::-webkit-scrollbar-thumb{background:rgba(255,255,255,0.2)!important;border-radius:3px!important}.es-status-row{display:flex!important;justify-content:space-between!important;align-items:center!important;padding:12px 0!important;border-bottom:1px solid rgba(255,255,255,0.05)!important}.es-status-label{font-size:13px!important;color:rgba(255,255,255,0.7)!important}.es-status-value{font-size:14px!important;font-weight:600!important;color:#fff!important}.es-badge{padding:4px 10px!important;border-radius:12px!important;font-size:12px!important;font-weight:600!important}.es-badge-success{background:rgba(16,185,129,0.2)!important;color:#10b981!important}.es-badge-warning{background:rgba(245,158,11,0.2)!important;color:#f59e0b!important}.es-badge-error{background:rgba(239,68,68,0.2)!important;color:#ef4444!important}.es-badge-info{background:rgba(59,130,246,0.2)!important;color:#3b82f6!important}#easy-seas-progress{margin:16px 0!important;display:none!important}#easy-seas-progress.active{display:block!important}.es-progress-bar{height:6px!important;background:rgba(255,255,255,0.1)!important;border-radius:3px!important;overflow:hidden!important;margin-bottom:12px!important}.es-progress-fill{height:100%!important;background:linear-gradient(90deg,#3b82f6,#10b981)!important;border-radius:3px!important;transition:width 0.3s ease!important;width:0%!important}.es-progress-text{font-size:12px!important;color:rgba(255,255,255,0.7)!important;text-align:center!important;margin-bottom:8px!important}.es-step-indicator{display:flex!important;gap:8px!important;margin-bottom:12px!important}.es-step{flex:1!important;height:4px!important;background:rgba(255,255,255,0.1)!important;border-radius:2px!important;transition:background 0.3s ease!important}.es-step.completed{background:#10b981!important}.es-step.active{background:#3b82f6!important;animation:pulse 1.5s ease-in-out infinite!important}@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.5}}#easy-seas-buttons{display:flex!important;gap:12px!important;margin-top:20px!important}.es-button{flex:1!important;padding:12px 20px!important;border:none!important;border-radius:8px!important;font-size:14px!important;font-weight:600!important;cursor:pointer!important;transition:all 0.2s ease!important;display:flex!important;align-items:center!important;justify-content:center!important;gap:8px!important}.es-button:disabled{opacity:0.5!important;cursor:not-allowed!important}.es-button-primary{background:#10b981!important;color:#fff!important}.es-button-primary:hover:not(:disabled){background:#059669!important;transform:translateY(-1px)!important}.es-button-secondary{background:rgba(59,130,246,0.2)!important;color:#3b82f6!important;border:1px solid #3b82f6!important}.es-button-secondary:hover:not(:disabled){background:rgba(59,130,246,0.3)!important}.es-button-stop{background:rgba(239,68,68,0.2)!important;color:#ef4444!important;border:1px solid #ef4444!important}.es-button-stop:hover:not(:disabled){background:rgba(239,68,68,0.3)!important}.es-spinner{width:14px!important;height:14px!important;border:2px solid rgba(255,255,255,0.3)!important;border-top-color:#fff!important;border-radius:50%!important;animation:spin 0.8s linear infinite!important}@keyframes spin{to{transform:rotate(360deg)}}#easy-seas-log{margin-top:16px!important;max-height:120px!important;overflow-y:auto!important;padding:12px!important;background:rgba(0,0,0,0.3)!important;border-radius:8px!important;font-size:11px!important;font-family:'Monaco','Menlo',monospace!important;color:rgba(255,255,255,0.7)!important;line-height:1.6!important}#easy-seas-log::-webkit-scrollbar{width:4px!important}#easy-seas-log::-webkit-scrollbar-thumb{background:rgba(255,255,255,0.2)!important;border-radius:2px!important}.es-log-entry{margin-bottom:4px!important;padding:4px 0!important}.es-log-success{color:#10b981!important}.es-log-warning{color:#f59e0b!important}.es-log-error{color:#ef4444!important}.es-log-info{color:#3b82f6!important}`;
}

function getContentJS(): string {
  return `(function() {
  console.log('[Easy Seas] Content script loaded');

  let capturedData = {
    offers: null,
    upcomingCruises: null,
    courtesyHolds: null,
    loyalty: null,
    voyageEnrichment: null,
    isLoggedIn: false,
    lastUpdate: null,
    cruiseLine: window.location.hostname.includes('celebrity') ? 'celebrity' : 'royal'
  };

  function sendStatusUpdate() {
    chrome.runtime.sendMessage({
      type: 'status_update',
      data: {
        isLoggedIn: capturedData.isLoggedIn,
        hasOffers: !!capturedData.offers,
        hasBookings: !!capturedData.upcomingCruises || !!capturedData.courtesyHolds,
        offerCount: capturedData.offers?.offers?.length || 0,
        bookingCount: (capturedData.upcomingCruises?.profileBookings?.length || 0) + 
                      (capturedData.courtesyHolds?.payload?.sailingInfo?.length || 0),
        cruiseLine: capturedData.cruiseLine,
        lastUpdate: capturedData.lastUpdate
      }
    }).catch(() => {});
  }

  function interceptNetworkCalls() {
    const originalFetch = window.fetch;
    window.fetch = function(...args) {
      return originalFetch.apply(this, args).then(response => {
        const clonedResponse = response.clone();
        const url = (typeof args[0] === 'string') ? args[0] : (args[0] && args[0].url ? args[0].url : '');
        
        if (typeof url === 'string' && url) {
          if (url.includes('/api/casino/casino-offers')) {
            if (response.ok && response.status === 200) {
              clonedResponse.json().then(data => {
                capturedData.offers = data;
                capturedData.lastUpdate = new Date().toISOString();
                console.log('[Easy Seas] Captured Casino Offers:', data?.offers?.length || 0, 'offers');
                chrome.runtime.sendMessage({
                  type: 'data_captured',
                  endpoint: 'offers',
                  count: data?.offers?.length || 0,
                  dataKey: 'offers',
                  data: data
                }).catch(() => {});
                sendStatusUpdate();
              }).catch(() => {});
            }
          }
          
          if (url.includes('/profileBookings/enriched') || url.includes('/api/account/upcoming-cruises') || url.includes('/api/profile/bookings')) {
            if (response.ok && response.status === 200) {
              clonedResponse.json().then(data => {
                capturedData.upcomingCruises = data;
                capturedData.lastUpdate = new Date().toISOString();
                const count = data?.profileBookings?.length || data?.payload?.sailingInfo?.length || data?.sailingInfo?.length || 0;
                console.log('[Easy Seas] Captured Bookings:', count);
                chrome.runtime.sendMessage({
                  type: 'data_captured',
                  endpoint: 'bookings',
                  count: count,
                  dataKey: 'upcomingCruises',
                  data: data
                }).catch(() => {});
                sendStatusUpdate();
              }).catch(() => {});
            }
          }
          
          if (url.includes('/api/account/courtesy-holds')) {
            if (response.ok && response.status === 200) {
              clonedResponse.json().then(data => {
                capturedData.courtesyHolds = data;
                capturedData.lastUpdate = new Date().toISOString();
                const count = data?.payload?.sailingInfo?.length || data?.sailingInfo?.length || 0;
                console.log('[Easy Seas] Captured Courtesy Holds:', count);
                chrome.runtime.sendMessage({
                  type: 'data_captured',
                  endpoint: 'holds',
                  count: count,
                  dataKey: 'courtesyHolds',
                  data: data
                }).catch(() => {});
                sendStatusUpdate();
              }).catch(() => {});
            }
          }
          
          if (url.includes('/ships/voyages') && url.includes('/enriched')) {
            if (response.ok && response.status === 200) {
              clonedResponse.json().then(data => {
                if (!capturedData.voyageEnrichment) {
                  capturedData.voyageEnrichment = {};
                }
                Object.assign(capturedData.voyageEnrichment, data);
                capturedData.lastUpdate = new Date().toISOString();
                console.log('[Easy Seas] Captured Voyage Enrichment');
                sendStatusUpdate();
              }).catch(() => {});
            }
          }
          
          if (url.includes('/guestAccounts/loyalty/info') || url.includes('/en/celebrity/web/v3/guestAccounts/')) {
            clonedResponse.text().then(text => {
              let data = null;
              try { data = JSON.parse(text); } catch (e) { data = { raw: text }; }
              capturedData.loyalty = data;
              capturedData.lastUpdate = new Date().toISOString();
              console.log('[Easy Seas] Captured Loyalty Data');
              chrome.runtime.sendMessage({
                type: 'data_captured',
                endpoint: 'loyalty',
                count: 1,
                dataKey: 'loyalty',
                data: data
              }).catch(() => {});
              sendStatusUpdate();
            }).catch(() => {});
          }
        }
        
        return response;
      });
    };

    const originalXHROpen = XMLHttpRequest.prototype.open;
    const originalXHRSend = XMLHttpRequest.prototype.send;
    
    XMLHttpRequest.prototype.open = function(method, url, ...rest) {
      this._url = url;
      return originalXHROpen.apply(this, [method, url, ...rest]);
    };
    
    XMLHttpRequest.prototype.send = function(...args) {
      this.addEventListener('load', function() {
        if (this._url) {
          try {
            const data = JSON.parse(this.responseText);
            
            if (this._url.includes('/api/casino/casino-offers')) {
              capturedData.offers = data;
              capturedData.lastUpdate = new Date().toISOString();
              console.log('[Easy Seas] [XHR] Captured Casino Offers');
              chrome.runtime.sendMessage({
                type: 'data_captured',
                endpoint: 'offers',
                count: data?.offers?.length || 0,
                dataKey: 'offers',
                data: data
              }).catch(() => {});
              sendStatusUpdate();
            }
            
            if (this._url.includes('/profileBookings/enriched') || this._url.includes('/api/account/upcoming-cruises') || this._url.includes('/api/profile/bookings')) {
              capturedData.upcomingCruises = data;
              capturedData.lastUpdate = new Date().toISOString();
              const count = data?.profileBookings?.length || data?.payload?.sailingInfo?.length || data?.sailingInfo?.length || 0;
              console.log('[Easy Seas] [XHR] Captured Bookings:', count);
              chrome.runtime.sendMessage({
                type: 'data_captured',
                endpoint: 'bookings',
                count: count,
                dataKey: 'upcomingCruises',
                data: data
              }).catch(() => {});
              sendStatusUpdate();
            }
            
            if (this._url.includes('/api/account/courtesy-holds')) {
              capturedData.courtesyHolds = data;
              capturedData.lastUpdate = new Date().toISOString();
              console.log('[Easy Seas] [XHR] Captured Courtesy Holds');
              chrome.runtime.sendMessage({
                type: 'data_captured',
                endpoint: 'holds',
                count: data?.payload?.sailingInfo?.length || 0,
                dataKey: 'courtesyHolds',
                data: data
              }).catch(() => {});
              sendStatusUpdate();
            }
            
            if (this._url.includes('/guestAccounts/loyalty/info') || this._url.includes('/en/celebrity/web/v3/guestAccounts/')) {
              capturedData.loyalty = data;
              capturedData.lastUpdate = new Date().toISOString();
              console.log('[Easy Seas] [XHR] Captured Loyalty Data');
              chrome.runtime.sendMessage({
                type: 'data_captured',
                endpoint: 'loyalty',
                count: 1,
                dataKey: 'loyalty',
                data: data
              }).catch(() => {});
              sendStatusUpdate();
            }
          } catch (e) {}
        }
      });
      
      return originalXHRSend.apply(this, args);
    };
    
    console.log('[Easy Seas] Network monitoring active');
  }

  function checkAuthStatus() {
    const pageText = document.body?.innerText || '';
    const url = window.location.href;
    
    const cookies = document.cookie;
    const hasCookies = cookies.includes('RCAUTH') || 
                       cookies.includes('auth') || 
                       cookies.includes('session') ||
                       cookies.length > 100;
    
    const hasLogoutButton = document.querySelectorAll('a[href*="logout"], a[href*="sign-out"]').length > 0;
    const hasAccountLinks = document.querySelectorAll('a[href*="/account"]').length > 0;
    const isOnAccountPage = url.includes('/account/') || url.includes('loyalty-status') || url.includes('club-royale') || url.includes('blue-chip');
    
    const wasLoggedIn = capturedData.isLoggedIn;
    capturedData.isLoggedIn = hasLogoutButton || (hasCookies && hasAccountLinks) || (isOnAccountPage && !pageText.toLowerCase().includes('sign in to access'));
    
    if (wasLoggedIn !== capturedData.isLoggedIn) {
      console.log('[Easy Seas] Auth status changed:', capturedData.isLoggedIn ? 'LOGGED IN' : 'NOT LOGGED IN');
      sendStatusUpdate();
    }
  }

  function initAuthDetection() {
    interceptNetworkCalls();
    
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => {
        setTimeout(checkAuthStatus, 1500);
      });
    } else {
      setTimeout(checkAuthStatus, 1500);
    }

    const observer = new MutationObserver(() => {
      checkAuthStatus();
    });

    if (document.body) {
      observer.observe(document.body, {
        childList: true,
        subtree: true
      });
    }
    
    setInterval(checkAuthStatus, 3000);
    
    setTimeout(sendStatusUpdate, 2000);
  }

  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === 'get_captured_data') {
      sendResponse({ success: true, data: capturedData });
      return true;
    }
    
    if (request.type === 'clear_data') {
      capturedData = {
        offers: null,
        upcomingCruises: null,
        courtesyHolds: null,
        loyalty: null,
        voyageEnrichment: null,
        isLoggedIn: capturedData.isLoggedIn,
        lastUpdate: null,
        cruiseLine: capturedData.cruiseLine
      };
      sendResponse({ success: true });
      sendStatusUpdate();
      return true;
    }
  });

  initAuthDetection();
})();`;
}

function getPopupHTML(): string {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Easy Seas™ Sync</title>
  <style>body{width:420px;min-height:550px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:linear-gradient(135deg,#0f172a 0%,#1e293b 100%);color:#e2e8f0;padding:0;margin:0}.header{background:linear-gradient(135deg,#3b82f6 0%,#2563eb 100%);padding:20px;text-align:center;border-bottom:2px solid #1e40af}.header h1{font-size:20px;font-weight:700;margin-bottom:4px;color:#fff}.header p{font-size:12px;color:#bfdbfe}.container{padding:20px}.sync-progress{background:#1e293b;border:2px solid #3b82f6;border-radius:12px;padding:16px;margin-bottom:16px;display:none}.sync-progress.active{display:block}.progress-bar{height:8px;background:#334155;border-radius:4px;overflow:hidden;margin-bottom:12px}.progress-fill{height:100%;background:linear-gradient(90deg,#3b82f6 0%,#60a5fa 100%);transition:width .3s ease;width:0}.status-card{background:#1e293b;border:1px solid #334155;border-radius:12px;padding:16px;margin-bottom:16px}.status-row{display:flex;align-items:center;justify-content:space-between;padding:8px 0;border-bottom:1px solid #334155}.status-row:last-child{border-bottom:none}.status-label{font-size:13px;color:#94a3b8}.status-value{font-size:14px;font-weight:600;color:#e2e8f0}.status-badge{display:inline-block;padding:4px 10px;border-radius:12px;font-size:11px;font-weight:600;text-transform:uppercase}.badge-success{background:#10b98120;color:#10b981}.badge-warning{background:#f59e0b20;color:#f59e0b}.button{width:100%;padding:16px;border:none;border-radius:8px;font-size:15px;font-weight:600;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px;transition:all .2s;margin-bottom:10px}.button:disabled{opacity:.5;cursor:not-allowed}.button-sync{background:linear-gradient(135deg,#10b981 0%,#059669 100%);color:#fff;font-size:16px;padding:18px;box-shadow:0 4px 12px rgba(16,185,129,.3)}.button-sync:hover:not(:disabled){background:linear-gradient(135deg,#059669 0%,#047857 100%);transform:translateY(-2px)}.button-primary{background:linear-gradient(135deg,#3b82f6 0%,#2563eb 100%);color:#fff}.button-secondary{background:#334155;color:#e2e8f0}.instructions{background:#1e293b;border-left:3px solid #3b82f6;padding:12px;border-radius:8px;margin-top:16px}.instructions h3{font-size:13px;font-weight:600;color:#60a5fa;margin-bottom:8px}.instructions ol{margin-left:18px;font-size:12px;color:#cbd5e1;line-height:1.6}.alert{background:#ef444410;border:1px solid #ef4444;border-radius:8px;padding:12px;margin-bottom:16px;font-size:12px;color:#fca5a5;display:none}.alert.show{display:block}.alert.success{background:#10b98110;border-color:#10b981;color:#6ee7b7}.spinner{display:inline-block;width:16px;height:16px;border:2px solid #ffffff40;border-top-color:#fff;border-radius:50%;animation:spin .6s linear infinite}@keyframes spin{to{transform:rotate(360deg)}}</style>
</head>
<body>
  <div class="header">
    <h1>⚓ Easy Seas™</h1>
    <p>Automated Cruise Data Sync</p>
  </div>
  
  <div class="container">
    <div id="alert" class="alert"></div>
    
    <div id="syncProgress" class="sync-progress">
      <div style="display:flex;justify-content:space-between;margin-bottom:12px">
        <div style="font-size:14px;font-weight:600;color:#60a5fa">🔄 Syncing Data</div>
        <div style="font-size:12px;color:#94a3b8"><span id="currentStep">0</span>/<span id="totalSteps">4</span></div>
      </div>
      <div class="progress-bar">
        <div id="progressFill" class="progress-fill"></div>
      </div>
      <div style="font-size:12px;color:#cbd5e1;display:flex;align-items:center;gap:8px">
        <div class="spinner"></div>
        <span id="progressMessage">Initializing...</span>
      </div>
    </div>
    
    <div class="status-card">
      <div class="status-row">
        <div class="status-label">Login Status</div>
        <div class="status-value">
          <span id="loginStatus" class="status-badge badge-warning">Not Logged In</span>
        </div>
      </div>
      <div class="status-row">
        <div class="status-label">Casino Offers</div>
        <div class="status-value"><span id="offerCount">0</span></div>
      </div>
      <div class="status-row">
        <div class="status-label">Booked Cruises</div>
        <div class="status-value"><span id="bookingCount">0</span></div>
      </div>
      <div class="status-row">
        <div class="status-label">Cruise Line</div>
        <div class="status-value"><span id="cruiseLine">Royal Caribbean</span></div>
      </div>
    </div>
    
    <button id="syncBtn" class="button button-sync">START SYNC</button>
    <button id="exportBtn" class="button button-primary" disabled>Download CSV</button>
    <button id="clearBtn" class="button button-secondary">Clear Data</button>
    
    <div class="instructions">
      <h3>📋 How to Use</h3>
      <ol>
        <li>Open <strong>royalcaribbean.com</strong> and log in</li>
        <li>Click <strong>"START SYNC"</strong> button above</li>
        <li>The extension will automatically navigate and capture all data</li>
        <li>When complete, click <strong>"Download CSV"</strong></li>
        <li>Import the CSV file into the Easy Seas app</li>
      </ol>
    </div>
  </div>
  
  <script src="csv-exporter.js"></script>
  <script src="popup.js"></script>
</body>
</html>`;
  return html;
}

function getPopupJS(): string {
  return `let currentStatus={isLoggedIn:!1,hasOffers:!1,hasBookings:!1,offerCount:0,bookingCount:0,cruiseLine:'royal',lastUpdate:null},isSyncing=!1,capturedData=null;function showAlert(e,t='error'){const n=document.getElementById('alert');n.textContent=e,n.className=\`alert show \${'success'===t?'success':''}\`,setTimeout(()=>{n.classList.remove('show')},5e3)}function updateUI(){const e=document.getElementById('loginStatus'),t=document.getElementById('offerCount'),n=document.getElementById('bookingCount'),o=document.getElementById('cruiseLine'),s=document.getElementById('exportBtn'),r=document.getElementById('syncBtn');currentStatus.isLoggedIn?(e.textContent='Logged In',e.className='status-badge badge-success'):(e.textContent='Not Logged In',e.className='status-badge badge-warning'),t.textContent=currentStatus.offerCount,n.textContent=currentStatus.bookingCount,o.textContent='celebrity'===currentStatus.cruiseLine?'Celebrity Cruises':'Royal Caribbean';const a=currentStatus.hasOffers||currentStatus.hasBookings;s.disabled=!a||isSyncing,isSyncing?(r.className='button button-stop',r.innerHTML='STOP SYNC'):(r.className='button button-sync',r.innerHTML='START SYNC',r.disabled=!1)}function updateSyncProgress(e){const t=document.getElementById('syncProgress'),n=document.getElementById('progressFill'),o=document.getElementById('progressMessage'),s=document.getElementById('currentStep'),r=document.getElementById('totalSteps');if(!e)return void t.classList.remove('active');t.classList.add('active');const a=e.step/e.totalSteps*100;n.style.width=\`\${a}%\`,s.textContent=e.step,r.textContent=e.totalSteps,o.textContent=e.message||'Processing...','completed'===e.status&&e.step===e.totalSteps&&setTimeout(()=>{t.classList.remove('active'),showAlert(e.message||'Sync completed!','success')},2e3)}async function loadStatus(){const e=await chrome.storage.local.get(['status','syncProgress','lastCapturedData']);e.status&&(currentStatus=e.status,updateUI()),e.syncProgress&&e.syncProgress.timestamp>Date.now()-6e4&&updateSyncProgress(e.syncProgress),e.lastCapturedData&&(capturedData=e.lastCapturedData)}async function toggleSync(){if(isSyncing)return chrome.runtime.sendMessage({type:'stop_sync'}),isSyncing=!1,updateUI(),void updateSyncProgress(null);const[e]=await chrome.tabs.query({active:!0,currentWindow:!0});if(!e||!e.url||!e.url.includes('royalcaribbean.com')&&!e.url.includes('celebritycruises.com'))return void showAlert('Please open Royal Caribbean or Celebrity Cruises website first');if(!currentStatus.isLoggedIn)return void showAlert('Please log in to Royal Caribbean website first');isSyncing=!0,updateUI();const t=await chrome.runtime.sendMessage({type:'start_sync',tabId:e.id});t.success||(showAlert(t.error||'Failed to start sync'),isSyncing=!1,updateUI())}async function clearData(){const e=document.getElementById('clearBtn'),t=e.innerHTML;e.disabled=!0,e.innerHTML='<div class="spinner"></div> Clearing...';try{const[t]=await chrome.tabs.query({active:!0,currentWindow:!0});t&&(t.url.includes('royalcaribbean.com')||t.url.includes('celebritycruises.com'))&&await chrome.tabs.sendMessage(t.id,{type:'clear_data'}),capturedData=null,currentStatus={isLoggedIn:currentStatus.isLoggedIn,hasOffers:!1,hasBookings:!1,offerCount:0,bookingCount:0,cruiseLine:currentStatus.cruiseLine,lastUpdate:null},await chrome.storage.local.set({status:currentStatus,lastCapturedData:null}),updateUI(),showAlert('Data cleared successfully','success')}catch(e){console.error('Clear error:',e),showAlert('Error clearing data')}finally{e.disabled=!1,e.innerHTML=t}}async function exportData(){const e=document.getElementById('exportBtn'),t=e.innerHTML;e.disabled=!0,e.innerHTML='<div class="spinner"></div> Exporting...';try{if(!capturedData){const e=await chrome.storage.local.get(['lastCapturedData']);capturedData=e.lastCapturedData}if(!capturedData)return showAlert('No data to export. Please run sync first.'),e.disabled=!1,void(e.innerHTML=t);const n=exportToCSV(capturedData,!0,!0);n.success?showAlert('CSV file downloaded successfully!','success'):showAlert(n.error||'Export failed')}catch(e){console.error('Export error:',e),showAlert('Error exporting data: '+e.message)}finally{setTimeout(()=>{e.disabled=!1,e.innerHTML=t},1e3)}}chrome.runtime.onMessage.addListener((e,t,n)=>{'sync_progress'===e.type&&(updateSyncProgress(e.progress),'completed'!==e.progress.status&&'stopped'!==e.progress.status||(isSyncing=!1,updateUI(),e.progress.capturedData&&(capturedData=e.progress.capturedData,currentStatus.hasOffers=!!capturedData.offers,currentStatus.hasBookings=!!capturedData.upcomingCruises||!!capturedData.courtesyHolds,currentStatus.offerCount=capturedData.offers?.offers?.length||0,currentStatus.bookingCount=(capturedData.upcomingCruises?.profileBookings?.length||0)+(capturedData.courtesyHolds?.payload?.sailingInfo?.length||0),currentStatus.lastUpdate=(new Date).toISOString(),updateUI())))}),document.addEventListener('DOMContentLoaded',()=>{loadStatus(),document.getElementById('syncBtn').addEventListener('click',toggleSync),document.getElementById('exportBtn').addEventListener('click',exportData),document.getElementById('clearBtn').addEventListener('click',clearData),chrome.storage.onChanged.addListener((e,t)=>{'local'===t&&(e.status&&(currentStatus=e.status.newValue,updateUI()),e.syncProgress&&updateSyncProgress(e.syncProgress.newValue),e.lastCapturedData&&(capturedData=e.lastCapturedData.newValue))}),setInterval(()=>{loadStatus()},5e3)});`;
}

function getCSVExporterJS(): string {
  return `function escapeCSVField(e){if(null==e)return'';const t=String(e);return t.includes(',')||t.includes('"')||t.includes('\n')||t.includes('\r')?\`"\${t.replace(/"/g,'""')}"\`:t}function parseDate(e){if(!e)return'';const t=e.trim();try{const e=t.match(/^(\d{4})-(\d{2})-(\d{2})/);if(e){const t=e[1],n=e[2],r=e[3];return\`\${n}-\${r}-\${t}\`}const n=t.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);if(n){const e=n[1].padStart(2,'0'),t=n[2].padStart(2,'0'),r=n[3];return\`\${e}-\${t}-\${r}\`}const r=t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);if(r){const e=r[1].padStart(2,'0'),t=r[2].padStart(2,'0'),n=2===r[3].length?'20'+r[3]:r[3];return\`\${e}-\${t}-\${n}\`}const a=new Date(t);if(!isNaN(a.getTime())){const e=String(a.getMonth()+1).padStart(2,'0'),t=String(a.getDate()).padStart(2,'0'),n=String(a.getFullYear());return\`\${e}-\${t}-\${n}\`}}catch(e){console.warn('[CSV Export] Failed to parse date:',e)}return e}function extractNightsFromText(e){if(!e)return null;const t=e.match(/(\d+)\s*[-]?\s*night/i);if(t){const e=parseInt(t[1],10);if(e>0&&e<=365)return e}return null}function transformOffersToCSV(e){const t=e.offers;if(!t||!t.offers||0===t.offers.length)return console.log('[CSV Export] No offers to export'),null;const n=t.offers,r=['Ship Name','Sailing Date','Itinerary','Offer Code','Real Offer Name','Room Type','Guests Info','Perks','Offer Value','Offer Expiry Date Alt','Offer Expiry Date','Price Interior','Price Ocean View','Price Balcony','Price Suite','Taxes & Fees','Ports & Times','Offer Type / Category','Nights','Departure Port'].join(','),a=[r];for(const e of n){const t=e.campaignOffer||e,n=t.sailings||[],r=t.offerCode||'',i=t.name||t.offerName||'',s=t.tradeInValue||0,o=t.reserveByDate||t.expiryDate||'';for(const e of n){const t=e.itineraryDescription||e.itinerary||'',n=extractNightsFromText(t)||e.numberOfNights||7,c=e.shipName||'',l=e.sailDate||e.sailingDate||'',d=e.roomType||e.cabinType||'Balcony',u=e.numberOfGuests||(e.isGOBO?'1 Guest':'2 Guests'),f=e.departurePort?.name||e.departurePort||'',m=e.portList||[],p=Array.isArray(m)?m.join(' → '):'',g=[escapeCSVField(c),parseDate(l),escapeCSVField(t),escapeCSVField(r),escapeCSVField(i),escapeCSVField(d),escapeCSVField(u),escapeCSVField('-'),escapeCSVField(s),'',parseDate(o),escapeCSVField(e.interiorPrice||0),escapeCSVField(e.oceanviewPrice||0),escapeCSVField(e.balconyPrice||0),escapeCSVField(e.suitePrice||0),escapeCSVField(e.taxesAndFees||0),escapeCSVField(p),escapeCSVField(u),escapeCSVField(n),escapeCSVField(f)];a.push(g.join(','))}}return console.log('[CSV Export] Generated',a.length-1,'offer rows'),a.join('\n')}function transformBookingsToCSV(e){const t=[];if(e.upcomingCruises?.profileBookings&&t.push(...e.upcomingCruises.profileBookings),e.courtesyHolds?.payload?.sailingInfo?t.push(...e.courtesyHolds.payload.sailingInfo):e.courtesyHolds?.sailingInfo&&t.push(...e.courtesyHolds.sailingInfo),0===t.length)return console.log('[CSV Export] No bookings to export'),null;const n=['id','ship','departureDate','returnDate','nights','itineraryName','departurePort','portsRoute','reservationNumber','guests','bookingId','isBooked','winningsBroughtHome','cruisePointsEarned'].join(','),r=[n];for(const e of t){const t=parseDate(e.sailDate||e.sailingStartDate||''),n=parseDate(e.returnDate||e.sailingEndDate||''),a=e.numberOfNights||e.nights||7,i=e.shipName||'',s=e.bookingId||e.masterBookingId||'',o=e.reservationNumber||e.confirmationNumber||'',c=e.itinerary||e.cruiseTitle||e.itineraryDescription||'',l=e.departurePort?.name||e.departurePort||'',d='Booked'===e.status||'Confirmed'===e.bookingStatus?'TRUE':'FALSE',u=e.portList||[],f=Array.isArray(u)?u.join(', '):'',m=[escapeCSVField(\`booked-\${i.replace(/\s+/g,'-').toLowerCase()}-\${Date.now()}\`),escapeCSVField(i),t,n,escapeCSVField(a),escapeCSVField(c),escapeCSVField(l),escapeCSVField(f),escapeCSVField(o),escapeCSVField(e.numberOfGuests||'2'),escapeCSVField(s),d,'',''];r.push(m.join(','))}return console.log('[CSV Export] Generated',r.length-1,'booking rows'),r.join('\n')}function exportToCSV(e,t,n){console.log('[CSV Export] Starting export with data:',{hasOffers:!!e.offers,hasUpcomingCruises:!!e.upcomingCruises,hasCourtesyHolds:!!e.courtesyHolds,includeOffers:t,includeBookings:n});let r='';if(t){const t=transformOffersToCSV(e);t&&(r+=t)}if(n){const t=transformBookingsToCSV(e);t&&(r&&(r+='\n\n'),r+=t)}if(!r)return console.error('[CSV Export] No data to export'),{success:!1,error:'No data to export'};const a=new Blob([r],{type:'text/csv;charset=utf-8;'}),i=URL.createObjectURL(a),s=(new Date).toISOString().replace(/[:.]/g,'-').slice(0,-5),o=\`easy-seas-\${e.cruiseLine||'royal'}-\${s}.csv\`;return console.log('[CSV Export] Initiating download:',o),chrome.downloads.download({url:i,filename:o,saveAs:!0},e=>{chrome.runtime.lastError?console.error('[CSV Export] Download failed:',chrome.runtime.lastError):(console.log('[CSV Export] Download started with ID:',e),setTimeout(()=>URL.revokeObjectURL(i),1e3))}),{success:!0,filename:o}}`;
}

export async function downloadScraperExtension(): Promise<{ success: boolean; error?: string; filesAdded?: number }> {
  if (Platform.OS !== 'web') {
    console.log('[ChromeExtension] Download only available on web');
    return { success: false, error: 'Download only available on web browser' };
  }

  try {
    console.log('[ChromeExtension] Creating Scraper extension ZIP from embedded files...');
    const zip = new JSZip();

    const extensionFiles = getEasySeasExtensionFiles();

    for (const [filename, content] of Object.entries(extensionFiles)) {
      zip.file(filename, content);
      console.log(`[ChromeExtension] ✓ Added ${filename}`);
    }

    const fileCount = Object.keys(zip.files).length;
    console.log(`[ChromeExtension] Generating Scraper ZIP blob with ${fileCount} files...`);
    const blob = await zip.generateAsync({ type: 'blob' });

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Easy Seas Sync.zip`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    console.log('[ChromeExtension] Scraper extension download initiated successfully');
    return { success: true, filesAdded: fileCount };
  } catch (error) {
    console.error('[ChromeExtension] Error creating Scraper ZIP:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error occurred' 
    };
  }
}

export async function downloadGridBuilderExtension(): Promise<{ success: boolean; error?: string; filesAdded?: number }> {
  if (Platform.OS !== 'web') {
    console.log('[ChromeExtension] Download only available on web');
    return { success: false, error: 'Download only available on web browser' };
  }

  try {
    console.log('[ChromeExtension] Creating Grid Builder extension ZIP...');
    const zip = new JSZip();

    const gridBuilderFiles = getGridBuilderFiles();
    for (const [filename, content] of Object.entries(gridBuilderFiles)) {
      zip.file(filename, content);
      console.log(`[ChromeExtension] ✓ Added ${filename}`);
    }

    const imagesFolder = zip.folder('images');
    if (imagesFolder) {
      const icon = createPlaceholderIcon('CR', '#1e40af');
      imagesFolder.file('percex-48.png', icon);
      imagesFolder.file('percex-128.png', icon);
      imagesFolder.file('percex-256.png', icon);
      imagesFolder.file('percex-512.png', icon);
      imagesFolder.file('percex-1024.png', icon);
      imagesFolder.file('facebook.png', createPlaceholderIcon('FB', '#1877f2'));
      imagesFolder.file('venmo.png', createPlaceholderIcon('V', '#3d95ce'));
      imagesFolder.file('link.png', createPlaceholderIcon('🔗', '#666666'));
      imagesFolder.file('link_off.png', createPlaceholderIcon('⛓', '#999999'));
      imagesFolder.file('royal-16.png', icon);
      console.log('[ChromeExtension] ✓ Added Grid Builder icons');
    }

    const stylesFolder = zip.folder('styles');
    if (stylesFolder) {
      const styles = getGridBuilderStyles();
      for (const [filename, content] of Object.entries(styles)) {
        stylesFolder.file(filename, content);
        console.log(`[ChromeExtension] ✓ Added styles/${filename}`);
      }
    }

    const utilsFolder = zip.folder('utils');
    if (utilsFolder) {
      const utils = getGridBuilderUtils();
      for (const [filename, content] of Object.entries(utils)) {
        utilsFolder.file(filename, content);
        console.log(`[ChromeExtension] ✓ Added utils/${filename}`);
      }
    }

    const featuresFolder = zip.folder('features');
    if (featuresFolder) {
      const features = getGridBuilderFeatures();
      for (const [filename, content] of Object.entries(features)) {
        featuresFolder.file(filename, content);
        console.log(`[ChromeExtension] ✓ Added features/${filename}`);
      }
    }

    const fileCount = Object.keys(zip.files).length;
    console.log(`[ChromeExtension] Generating Grid Builder ZIP blob with ${fileCount} files...`);
    const blob = await zip.generateAsync({ type: 'blob' });

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `EasySeas_Grid_Builder_Extension_v${GRID_BUILDER_EXTENSION_VERSION}.zip`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    console.log('[ChromeExtension] Grid Builder extension download initiated successfully');
    return { success: true, filesAdded: fileCount };
  } catch (error) {
    console.error('[ChromeExtension] Error creating Grid Builder ZIP:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error occurred' 
    };
  }
}

export async function downloadChromeExtension(): Promise<{ success: boolean; error?: string; filesAdded?: number; scraperResult?: { success: boolean; filesAdded?: number }; gridBuilderResult?: { success: boolean; filesAdded?: number } }> {
  if (Platform.OS !== 'web') {
    console.log('[ChromeExtension] Download only available on web');
    return { success: false, error: 'Download only available on web browser' };
  }

  try {
    console.log('[ChromeExtension] Downloading both extensions...');
    
    const scraperResult = await downloadScraperExtension();
    
    await new Promise(resolve => setTimeout(resolve, 500));
    
    const gridBuilderResult = await downloadGridBuilderExtension();
    
    const totalFiles = (scraperResult.filesAdded || 0) + (gridBuilderResult.filesAdded || 0);
    const success = scraperResult.success && gridBuilderResult.success;
    
    console.log('[ChromeExtension] Both extensions download completed', { scraperResult, gridBuilderResult });
    
    return { 
      success, 
      filesAdded: totalFiles,
      scraperResult: { success: scraperResult.success, filesAdded: scraperResult.filesAdded },
      gridBuilderResult: { success: gridBuilderResult.success, filesAdded: gridBuilderResult.filesAdded }
    };
  } catch (error) {
    console.error('[ChromeExtension] Error downloading extensions:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error occurred' 
    };
  }
}

function createPlaceholderIcon(text: string = 'ES', bgColor: string = '#5a2ea6'): Uint8Array {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  
  if (ctx) {
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, 128, 128);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 48px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 64, 64);
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

function getGridBuilderFiles(): Record<string, string> {
  return {
    'manifest.json': JSON.stringify({
      "browser_specific_settings": {
        "gecko": {
          "id": "club-royale-offers@percex.local",
          "strict_min_version": "102.0"
        }
      },
      "content_scripts": [{
        "css": ["styles/tailwind.min.css", "styles/table-base.css", "styles/table-columns.css", "styles/accordion.css", "styles/ui.css", "styles/tabs-badges.css", "styles/itinerary.css", "styles/advanced-search.css"],
        "js": ["safari-polyfill.js", "utils/consoleShim.js", "utils/roomCategory.js", "utils/utils_core.js", "utils/utils_row.js", "utils/domUtils.js", "utils/errorHandler.js", "utils/sortUtils.js", "utils/b2bUtils.js", "utils/utils_filter.js", "utils/apiClient.js", "features/storageShim.js", "features/itinerary.js", "features/advancedItinerarySearch.js", "features/profileIdManager.js", "features/buttonManager.js", "features/spinner.js", "features/accordionBuilder.js", "features/favorites.js", "features/offerCodeLookup.js", "features/filtering.js", "features/whatsNew.js", "features/settings.js", "features/advancedSearch.js", "features/advancedSearchAddField.js", "features/backToBackTool.js", "features/breadcrumbs.js", "styles.js", "modal.js", "tableBuilder.js", "tableRenderer.js", "app.js"],
        "matches": ["https://*.royalcaribbean.com/club-royale/*", "https://*.celebritycruises.com/blue-chip-club/*"],
        "run_at": "document_start"
      }],
      "description": "View Royal Caribbean & Celebrity comp offers in a sortable, groupable table and accordion.",
      "host_permissions": ["https://www.royalcaribbean.com/*", "https://www.celebritycruises.com/*", "https://royalcaribbean.com/*", "https://celebritycruises.com/*"],
      "icons": {
        "1024": "images/percex-1024.png",
        "128": "images/percex-128.png",
        "256": "images/percex-256.png",
        "48": "images/percex-48.png",
        "512": "images/percex-512.png"
      },
      "manifest_version": 3,
      "name": "Club Royale & Blue Chip Offers",
      "permissions": ["storage"],
      "short_name": "Club Royale Offers",
      "version": "2.0",
      "web_accessible_resources": [{
        "matches": ["<all_urls>"],
        "resources": ["images/*", "styles/*"]
      }]
    }, null, 2),
    
    'safari-polyfill.js': `// Safari polyfill for Chrome extension APIs
(function() {
  if (typeof chrome === 'undefined') {
    window.chrome = { runtime: { getURL: (path) => path } };
  }
})();`,
    
    'styles.js': `// styles.js - Grid Builder button styling
(function(){
  const css = \`
    .gobo-show-all-btn {
      position: fixed; z-index: 2147483646; right: 16px; bottom: 70px;
      padding: 10px 14px; background: #1e40af; color: #fff; border: none; border-radius: 12px;
      font-weight: 600; box-shadow: 0 6px 18px rgba(0,0,0,.25); cursor: pointer;
    }
    .gobo-show-all-btn:hover { background: #1e3a8a; }
    .gobo-show-all-btn:active { transform: translateY(1px); }
  \`;
  const style = document.createElement('style');
  style.textContent = css;
  document.documentElement.appendChild(style);
})();`,
    
    'modal.js': getGridBuilderModalContent(),
    'tableBuilder.js': getGridBuilderTableBuilderContent(),
    'tableRenderer.js': getGridBuilderTableRendererContent(),
    'app.js': getGridBuilderAppContent()
  };
}

function getGridBuilderStyles(): Record<string, string> {
  return {
    'tailwind.min.css': '/* Tailwind CSS minimal reset */\n* { box-sizing: border-box; margin: 0; padding: 0; }\n.fixed { position: fixed; }\n.inset-0 { top: 0; right: 0; bottom: 0; left: 0; }\n.z-50 { z-index: 50; }\n.flex { display: flex; }\n.hidden { display: none; }\n.w-full { width: 100%; }\n.border { border: 1px solid #e5e7eb; }\n.border-collapse { border-collapse: collapse; }\n.table-auto { table-layout: auto; }\n.p-2 { padding: 0.5rem; }\n.text-left { text-align: left; }\n.text-center { text-align: center; }\n.font-semibold { font-weight: 600; }\n.cursor-pointer { cursor: pointer; }\n.bg-black { background-color: #000; }\n.bg-opacity-50 { opacity: 0.5; }\n.bg-white { background-color: #fff; }\n.rounded { border-radius: 0.25rem; }\n.shadow-lg { box-shadow: 0 10px 15px -3px rgba(0,0,0,0.1); }',
    'table-base.css': '/* Table base styles */\n.gobo-offers-table { width: 100%; border-collapse: collapse; font-size: 13px; }\n.gobo-offers-table th, .gobo-offers-table td { padding: 8px 12px; border: 1px solid #e5e7eb; text-align: left; }\n.gobo-offers-table th { background: #f9fafb; font-weight: 600; position: sticky; top: 0; z-index: 10; }\n.gobo-offers-table tr:hover { background: #f3f4f6; }\n.table-scroll-container { max-height: 80vh; overflow-y: auto; background: #fff; border-radius: 8px; padding: 16px; }',
    'table-columns.css': '/* Column-specific styles */\n.col-ship { min-width: 120px; }\n.col-date { min-width: 100px; }\n.col-code { min-width: 80px; }\n.col-value { min-width: 80px; text-align: right; }',
    'accordion.css': '/* Accordion styles */\n.accordion-header { padding: 12px 16px; background: #f9fafb; border: 1px solid #e5e7eb; cursor: pointer; display: flex; justify-content: space-between; align-items: center; }\n.accordion-header:hover { background: #f3f4f6; }\n.accordion-content { display: none; padding: 0; }\n.accordion-content.open { display: block; }\n.accordion-arrow { transition: transform 0.2s; }\n.accordion-content.open + .accordion-arrow { transform: rotate(90deg); }',
    'ui.css': '/* UI elements */\n.close-button, .export-csv-button { padding: 8px 16px; border-radius: 6px; font-weight: 600; cursor: pointer; margin: 4px; }\n.close-button { background: #ef4444; color: white; border: none; }\n.close-button:hover { background: #dc2626; }\n.export-csv-button { background: #10b981; color: white; border: none; }\n.export-csv-button:hover { background: #059669; }\n.table-footer-container { display: flex; justify-content: center; gap: 8px; padding: 12px; border-top: 1px solid #e5e7eb; }',
    'tabs-badges.css': '/* Profile tabs */\n.profile-tab { padding: 8px 16px; border: 1px solid #e5e7eb; border-bottom: none; border-radius: 8px 8px 0 0; cursor: pointer; background: #f9fafb; }\n.profile-tab.active { background: #fff; border-bottom: 1px solid #fff; margin-bottom: -1px; font-weight: 600; }\n.profile-tabs-container { display: flex; gap: 4px; padding: 0 16px; }',
    'itinerary.css': '/* Itinerary links */\n.gobo-itinerary-link { color: #2563eb; text-decoration: none; }\n.gobo-itinerary-link:hover { text-decoration: underline; }',
    'advanced-search.css': '/* Advanced search */\n.advanced-search-container { padding: 12px; background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; margin-bottom: 12px; }\n.search-input { padding: 8px 12px; border: 1px solid #d1d5db; border-radius: 6px; width: 200px; }'
  };
}

function getGridBuilderUtils(): Record<string, string> {
  return {
    'consoleShim.js': '// Console shim\nif (!window.console) window.console = { log: function(){}, debug: function(){}, warn: function(){}, error: function(){} };',
    'roomCategory.js': '// Room category utilities\nconst RoomCategory = { parse: (s) => s || "Unknown", isGTY: (s) => /GTY/i.test(s || "") };',
    'utils_core.js': getUtilsCoreContent(),
    'utils_row.js': '// Row utilities\nconst RowUtils = { getRowId: (row) => row?.sailing?.sailDate + "_" + row?.sailing?.shipCode };',
    'domUtils.js': getDomUtilsContent(),
    'errorHandler.js': '// Error handler\nconst ErrorHandler = { showError: (msg) => { console.error(msg); alert(msg); } };',
    'sortUtils.js': getSortUtilsContent(),
    'b2bUtils.js': '// B2B utilities placeholder\nconst B2BUtils = { computeB2BDepth: () => new Map() };',
    'utils_filter.js': '// Filter utilities\nconst FilterUtils = { applyFilters: (offers, filters) => offers };',
    'apiClient.js': '// API client\nconst ApiClient = { fetch: async (url) => fetch(url).then(r => r.json()) };'
  };
}

function getGridBuilderFeatures(): Record<string, string> {
  return {
    'storageShim.js': getStorageShimContent(),
    'itinerary.js': '// Itinerary cache\nconst ItineraryCache = { all: () => ({}), hydrateIfNeeded: async () => {}, showModal: () => {} };',
    'advancedItinerarySearch.js': '// Advanced itinerary search\nconst AdvancedItinerarySearch = { init: () => {} };',
    'profileIdManager.js': getProfileIdManagerContent(),
    'buttonManager.js': getButtonManagerContent(),
    'spinner.js': '// Spinner\nconst Spinner = { showSpinner: () => {}, hideSpinner: () => {} };',
    'accordionBuilder.js': getAccordionBuilderContent(),
    'favorites.js': '// Favorites\nconst Favorites = { toggle: () => {}, isFavorite: () => false };',
    'offerCodeLookup.js': '// Offer code lookup\nconst OfferCodeLookup = { lookup: () => null };',
    'filtering.js': getFilteringContent(),
    'whatsNew.js': '// What\'s New\nconst WhatsNew = { start: () => {} };',
    'settings.js': '// Settings\nconst Settings = { get: () => ({}), set: () => {} };',
    'advancedSearch.js': '// Advanced search\nconst AdvancedSearch = { init: () => {}, apply: () => {} };',
    'advancedSearchAddField.js': '// Advanced search add field\nconst AdvancedSearchAddField = { init: () => {} };',
    'backToBackTool.js': '// Back to back tool\nconst BackToBackTool = { registerEnvironment: () => {}, attachToCell: () => {} };',
    'breadcrumbs.js': getBreadcrumbsContent()
  };
}

function getUtilsCoreContent(): string {
  return `// Core utilities
const Utils = {
  formatDate(dateStr) {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  },
  parseItinerary(itinerary) {
    const match = (itinerary || '').match(/(\\d+)[- ]?[Nn]ight\\s*(.*)/);
    return { nights: match ? match[1] : '', destination: match ? match[2] : itinerary || '' };
  },
  computePerks(offer, sailing) {
    const perks = [];
    if (sailing?.isGOBO) perks.push('GOBO');
    if (sailing?.isFREEPLAY) perks.push('FP');
    if (sailing?.isDOLLARSOFF) perks.push('$OFF');
    return perks.join(', ') || '-';
  },
  getShipClass(shipName) {
    const n = (shipName || '').toLowerCase();
    if (/(icon|star)/.test(n)) return 'Icon';
    if (/oasis|allure|harmony|symphony|wonder|utopia/.test(n)) return 'Oasis';
    if (/quantum|anthem|ovation|odyssey/.test(n)) return 'Quantum';
    if (/freedom|liberty|independence/.test(n)) return 'Freedom';
    if (/voyager|navigator|explorer|adventure|mariner/.test(n)) return 'Voyager';
    return 'Other';
  },
  computeOfferValue(offer, sailing) {
    let value = 0;
    const trade = offer?.campaignOffer?.tradeInValue;
    if (trade && typeof trade === 'number') value += trade;
    if (sailing?.isFREEPLAY && sailing?.FREEPLAY_AMT) value += sailing.FREEPLAY_AMT;
    if (sailing?.isDOLLARSOFF && sailing?.DOLLARSOFF_AMT) value += sailing.DOLLARSOFF_AMT;
    return value;
  },
  formatOfferValue(value) {
    if (value == null || isNaN(value)) return '-';
    return '$' + value.toLocaleString();
  },
  createOfferRow(pair, isNewest, isExpiringSoon, idx) {
    const { offer, sailing } = pair;
    const tr = document.createElement('tr');
    tr.dataset.b2bRowId = sailing?.__b2bRowId || (sailing?.sailDate + '_' + sailing?.shipCode);
    if (isNewest) tr.classList.add('newest-offer-row');
    if (isExpiringSoon) tr.classList.add('expiring-soon-row');
    const cells = [
      '<td class="fav-cell">★</td>',
      '<td class="b2b-depth-cell">1</td>',
      '<td>' + (offer?.campaignOffer?.offerCode || '-') + '</td>',
      '<td>' + this.formatDate(offer?.campaignOffer?.startDate) + '</td>',
      '<td>' + this.formatDate(offer?.campaignOffer?.reserveByDate) + '</td>',
      '<td>' + (offer?.campaignOffer?.tradeInValue ? '$' + offer.campaignOffer.tradeInValue : '-') + '</td>',
      '<td>' + this.formatOfferValue(this.computeOfferValue(offer, sailing)) + '</td>',
      '<td>' + (offer?.campaignOffer?.name || '-') + '</td>',
      '<td>' + this.getShipClass(sailing?.shipName) + '</td>',
      '<td>' + (sailing?.shipName || '-') + '</td>',
      '<td>' + this.formatDate(sailing?.sailDate) + '</td>',
      '<td>' + (sailing?.departurePort?.name || sailing?.departurePort || '-') + '</td>',
      '<td>' + (this.parseItinerary(sailing?.itineraryDescription).nights || '-') + '</td>',
      '<td id="SD_' + (sailing?.shipCode || '') + '_' + (sailing?.sailDate || '').slice(0,10) + '">' + (this.parseItinerary(sailing?.itineraryDescription).destination || '-') + '</td>',
      '<td>' + (sailing?.roomType || '-') + '</td>',
      '<td>' + (sailing?.isGOBO ? '1 Guest' : '2 Guests') + '</td>',
      '<td>' + this.computePerks(offer, sailing) + '</td>'
    ];
    tr.innerHTML = cells.join('');
    return tr;
  }
};
function preserveSelectedProfileKey(state, lastState) {
  if (!state.selectedProfileKey && lastState?.selectedProfileKey) {
    state.selectedProfileKey = lastState.selectedProfileKey;
  }
  return state;
}`;
}

function getDomUtilsContent(): string {
  return `// DOM utilities
const DOMUtils = {
  waitForDom() {
    const check = () => {
      const offers = document.querySelector('[data-testid="offers-container"], .offers-list, [class*="offer"]');
      if (offers || document.readyState === 'complete') {
        setTimeout(() => ButtonManager.init(), 500);
      } else {
        setTimeout(check, 300);
      }
    };
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', check);
    } else {
      check();
    }
  }
};`;
}

function getSortUtilsContent(): string {
  return `// Sort utilities
const SortUtils = {
  sortOffers(offers, column, order) {
    if (order === 'original') return [...offers];
    return [...offers].sort((a, b) => {
      let aVal, bVal;
      switch(column) {
        case 'sailDate':
          aVal = new Date(a.sailing?.sailDate || 0).getTime();
          bVal = new Date(b.sailing?.sailDate || 0).getTime();
          break;
        case 'offerDate':
          aVal = new Date(a.offer?.campaignOffer?.startDate || 0).getTime();
          bVal = new Date(b.offer?.campaignOffer?.startDate || 0).getTime();
          break;
        case 'expiration':
          aVal = new Date(a.offer?.campaignOffer?.reserveByDate || 0).getTime();
          bVal = new Date(b.offer?.campaignOffer?.reserveByDate || 0).getTime();
          break;
        case 'ship':
          aVal = a.sailing?.shipName || '';
          bVal = b.sailing?.shipName || '';
          break;
        case 'tradeInValue':
          aVal = a.offer?.campaignOffer?.tradeInValue || 0;
          bVal = b.offer?.campaignOffer?.tradeInValue || 0;
          break;
        case 'b2bDepth':
          aVal = a.sailing?.__b2bDepth || 1;
          bVal = b.sailing?.__b2bDepth || 1;
          break;
        default:
          aVal = a.offer?.campaignOffer?.[column] || '';
          bVal = b.offer?.campaignOffer?.[column] || '';
      }
      if (typeof aVal === 'string') {
        const cmp = aVal.localeCompare(bVal);
        return order === 'asc' ? cmp : -cmp;
      }
      return order === 'asc' ? aVal - bVal : bVal - aVal;
    });
  }
};`;
}

function getStorageShimContent(): string {
  return `// Storage shim for cross-browser compatibility
(function() {
  const PREFIX = 'gobo_';
  window.goboStorageGet = function(key) {
    try { return localStorage.getItem(PREFIX + key); } catch(e) { return null; }
  };
  window.goboStorageSet = function(key, value) {
    try { localStorage.setItem(PREFIX + key, value); } catch(e) {}
  };
  window.goboStorageRemove = function(key) {
    try { localStorage.removeItem(PREFIX + key); } catch(e) {}
  };
})();`;
}

function getProfileIdManagerContent(): string {
  return `// Profile ID Manager
const ProfileIdManager = {
  map: {},
  nextId: 1,
  getId(key) { return this.map[key]; },
  assignMissingIds(keys) {
    keys.forEach(k => {
      if (!this.map[k]) this.map[k] = this.nextId++;
    });
  },
  transferId(oldKey, newKey) {
    if (this.map[oldKey]) {
      this.map[newKey] = this.map[oldKey];
      delete this.map[oldKey];
    }
  }
};`;
}

function getButtonManagerContent(): string {
  return `// Button Manager - creates the "Show All Offers" button
const ButtonManager = {
  init() {
    if (document.getElementById('gobo-show-all-btn')) return;
    const btn = document.createElement('button');
    btn.id = 'gobo-show-all-btn';
    btn.className = 'gobo-show-all-btn';
    btn.textContent = 'Show All Offers';
    btn.addEventListener('click', () => this.handleShowAll());
    document.body.appendChild(btn);
    console.log('[GridBuilder] Show All Offers button added');
  },
  async handleShowAll() {
    try {
      Spinner.showSpinner();
      const sessionRaw = localStorage.getItem('persist:session');
      if (!sessionRaw) {
        ErrorHandler.showError('Please log in to view offers');
        return;
      }
      const session = JSON.parse(sessionRaw);
      const user = session.user ? JSON.parse(session.user) : null;
      const offers = session.offers ? JSON.parse(session.offers) : null;
      if (!offers || !offers.length) {
        ErrorHandler.showError('No offers found. Please refresh the page.');
        return;
      }
      const username = user?.username || user?.email || 'user';
      const key = 'gobo-' + username.replace(/[^a-zA-Z0-9]/g, '_');
      App.TableRenderer.displayTable({ offers }, key, []);
    } catch(e) {
      console.error('[GridBuilder] Error showing offers:', e);
      ErrorHandler.showError('Failed to load offers: ' + e.message);
    } finally {
      Spinner.hideSpinner();
    }
  }
};`;
}

function getAccordionBuilderContent(): string {
  return `// Accordion Builder
const AccordionBuilder = {
  createGroupedData(offers, groupColumn) {
    const groups = {};
    offers.forEach(row => {
      let key;
      switch(groupColumn) {
        case 'ship': key = row.sailing?.shipName || 'Unknown'; break;
        case 'offerCode': key = row.offer?.campaignOffer?.offerCode || 'Unknown'; break;
        case 'destination': key = Utils.parseItinerary(row.sailing?.itineraryDescription).destination || 'Unknown'; break;
        default: key = 'All';
      }
      if (!groups[key]) groups[key] = [];
      groups[key].push(row);
    });
    return groups;
  },
  renderAccordion(container, groupedData, sortStates, state, groupingStack, keysStack, maxOfferDate) {
    container.innerHTML = '';
    Object.entries(groupedData).forEach(([key, rows]) => {
      const header = document.createElement('div');
      header.className = 'accordion-header';
      header.innerHTML = '<span>' + key + ' (' + rows.length + ')</span><span class="accordion-arrow">▶</span>';
      const content = document.createElement('div');
      content.className = 'accordion-content';
      content.dataset.groupKey = key;
      const table = document.createElement('table');
      table.className = 'accordion-table gobo-offers-table';
      table.dataset.groupKey = key;
      const tbody = document.createElement('tbody');
      rows.forEach((row, idx) => {
        const tr = Utils.createOfferRow(row, false, false, idx);
        tbody.appendChild(tr);
      });
      table.appendChild(tbody);
      content.appendChild(table);
      header.addEventListener('click', () => content.classList.toggle('open'));
      container.appendChild(header);
      container.appendChild(content);
    });
  }
};`;
}

function getFilteringContent(): string {
  return `// Filtering
const Filtering = {
  filterOffers(state, offers) {
    let filtered = [...offers];
    if (state.hideTierSailings) {
      filtered = filtered.filter(row => {
        const code = row.offer?.campaignOffer?.offerCode || '';
        return !/TIER/i.test(code);
      });
    }
    return filtered;
  },
  wasRowHidden(row, state) {
    if (state.hideTierSailings) {
      const code = row.offer?.campaignOffer?.offerCode || '';
      if (/TIER/i.test(code)) return true;
    }
    return false;
  },
  isRowHidden(row, state) { return this.wasRowHidden(row, state); },
  loadHiddenGroups() { return []; }
};`;
}

function getBreadcrumbsContent(): string {
  return `// Breadcrumbs
const Breadcrumbs = {
  updateBreadcrumb(groupingStack, groupKeysStack) {
    const container = document.querySelector('.breadcrumb-container');
    if (!container) return;
    const arrow = container.querySelector('.breadcrumb-arrow');
    const title = container.querySelector('.group-title');
    if (groupKeysStack && groupKeysStack.length) {
      if (arrow) arrow.style.display = '';
      if (title) title.textContent = groupKeysStack.join(' > ');
    } else {
      if (arrow) arrow.style.display = 'none';
      if (title) title.textContent = '';
    }
  }
};`;
}

function getGridBuilderModalContent(): string {
  return `// Modal for Grid Builder
const Modal = {
  createModalContainer() {
    const container = document.createElement('div');
    container.id = 'gobo-offers-table';
    container.className = 'fixed inset-0 m-auto z-[2147483647]';
    container.style.cssText = 'background: white; max-width: 95vw; max-height: 90vh; border-radius: 12px; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.25); overflow: hidden; display: flex; flex-direction: column;';
    return container;
  },
  createBackdrop() {
    const backdrop = document.createElement('div');
    backdrop.id = 'gobo-backdrop';
    backdrop.className = 'fixed inset-0 bg-black bg-opacity-50 z-[2147483646]';
    backdrop.style.cssText = 'pointer-events: auto !important;';
    return backdrop;
  },
  setupModal(state, overlappingElements) {
    const { container, backdrop, table, tbody, accordionContainer, backButton } = state;
    const scrollContainer = document.createElement('div');
    scrollContainer.className = 'table-scroll-container';
    const footerContainer = document.createElement('div');
    footerContainer.className = 'table-footer-container';
    const closeButton = document.createElement('button');
    closeButton.className = 'close-button';
    closeButton.textContent = 'Close';
    closeButton.addEventListener('click', () => this.closeModal(container, backdrop, overlappingElements));
    const exportButton = document.createElement('button');
    exportButton.className = 'export-csv-button';
    exportButton.textContent = 'CSV Export';
    exportButton.addEventListener('click', () => this.exportToCSV(App.TableRenderer.lastState));
    const breadcrumbContainer = document.createElement('div');
    breadcrumbContainer.className = 'breadcrumb-container';
    breadcrumbContainer.style.cssText = 'padding: 8px 16px; display: flex; align-items: center; gap: 8px;';
    const allOffersLink = document.createElement('span');
    allOffersLink.className = 'breadcrumb-link';
    allOffersLink.textContent = 'All Offers';
    allOffersLink.style.cssText = 'cursor: pointer; color: #2563eb;';
    allOffersLink.addEventListener('click', backButton.onclick);
    const arrow = document.createElement('span');
    arrow.className = 'breadcrumb-arrow';
    arrow.textContent = '>';
    arrow.style.display = 'none';
    const groupTitle = document.createElement('span');
    groupTitle.id = 'group-title';
    groupTitle.className = 'group-title';
    breadcrumbContainer.appendChild(allOffersLink);
    breadcrumbContainer.appendChild(arrow);
    breadcrumbContainer.appendChild(groupTitle);
    backdrop.addEventListener('click', () => this.closeModal(container, backdrop, overlappingElements));
    this._container = container;
    this._backdrop = backdrop;
    this._overlappingElements = overlappingElements;
    this._escapeHandler = (e) => { if (e.key === 'Escape') this.closeModal(); };
    document.addEventListener('keydown', this._escapeHandler);
    table.appendChild(tbody);
    scrollContainer.appendChild(breadcrumbContainer);
    scrollContainer.appendChild(table);
    scrollContainer.appendChild(accordionContainer);
    footerContainer.appendChild(exportButton);
    footerContainer.appendChild(closeButton);
    container.appendChild(scrollContainer);
    container.appendChild(footerContainer);
    document.body.appendChild(backdrop);
    document.body.appendChild(container);
  },
  closeModal(container, backdrop, overlappingElements) {
    container = container || this._container;
    backdrop = backdrop || this._backdrop;
    overlappingElements = overlappingElements || this._overlappingElements || [];
    if (!container || !backdrop) return;
    container.remove();
    backdrop.remove();
    document.body.style.overflow = '';
    overlappingElements.forEach(el => { el.style.display = el.dataset.originalDisplay || ''; });
    if (this._escapeHandler) document.removeEventListener('keydown', this._escapeHandler);
    this._container = null;
    this._backdrop = null;
  },
  exportToCSV(state) {
    const headers = ['Code','Rcvd','Expires','Trade','Value','Name','Class','Ship','Sail Date','Departs','Nights','Destination','Category','Guests','Perks'];
    const rows = (state.sortedOffers || []).map(({offer, sailing}) => [
      offer?.campaignOffer?.offerCode || '',
      Utils.formatDate(offer?.campaignOffer?.startDate),
      Utils.formatDate(offer?.campaignOffer?.reserveByDate),
      offer?.campaignOffer?.tradeInValue || '',
      Utils.computeOfferValue(offer, sailing),
      offer?.campaignOffer?.name || '',
      Utils.getShipClass(sailing?.shipName),
      sailing?.shipName || '',
      Utils.formatDate(sailing?.sailDate),
      sailing?.departurePort?.name || '',
      Utils.parseItinerary(sailing?.itineraryDescription).nights,
      Utils.parseItinerary(sailing?.itineraryDescription).destination,
      sailing?.roomType || '',
      sailing?.isGOBO ? '1 Guest' : '2 Guests',
      Utils.computePerks(offer, sailing)
    ]);
    const csv = [headers, ...rows].map(r => r.map(c => '"' + String(c).replace(/"/g, '""') + '"').join(',')).join('\\r\\n');
    const blob = new Blob([csv], {type: 'text/csv'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'offers.csv';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }
};`;
}

function getGridBuilderTableBuilderContent(): string {
  return `// Table Builder
const TableBuilder = {
  createMainTable() {
    const table = document.createElement('table');
    table.className = 'gobo-offers-table w-full border-collapse table-auto';
    return table;
  },
  createTableHeader(state) {
    const { headers } = state;
    const thead = document.createElement('thead');
    thead.className = 'table-header';
    const tr = document.createElement('tr');
    headers.forEach(header => {
      const th = document.createElement('th');
      th.className = 'border p-2 text-left font-semibold';
      th.dataset.key = header.key;
      th.textContent = header.label;
      if (header.key !== 'favorite') {
        th.style.cursor = 'pointer';
        th.addEventListener('click', () => {
          let newOrder = 'asc';
          if (state.currentSortColumn === header.key) {
            newOrder = state.currentSortOrder === 'asc' ? 'desc' : 'original';
          }
          state.currentSortColumn = header.key;
          state.currentSortOrder = newOrder;
          state.viewMode = 'table';
          App.TableRenderer.updateView(state);
        });
      }
      tr.appendChild(th);
    });
    thead.appendChild(tr);
    return thead;
  },
  renderTable(tbody, state, globalMaxOfferDate) {
    tbody.innerHTML = '';
    const rows = state.sortedOffers || [];
    if (!rows.length) {
      const tr = document.createElement('tr');
      tr.innerHTML = '<td colspan="17" class="border p-2 text-center">No offers available</td>';
      tbody.appendChild(tr);
      return;
    }
    rows.forEach((pair, idx) => {
      const tr = Utils.createOfferRow(pair, false, false, idx);
      tbody.appendChild(tr);
    });
  }
};`;
}

function getGridBuilderTableRendererContent(): string {
  return `// Table Renderer
const TableRenderer = {
  lastState: null,
  currentSwitchToken: null,
  displayTable(data, selectedProfileKey, overlappingElements) {
    const existing = document.getElementById('gobo-offers-table');
    if (existing) { this.loadProfile(selectedProfileKey, { data }); return; }
    document.body.style.overflow = 'hidden';
    const state = {
      backdrop: App.Modal.createBackdrop(),
      container: App.Modal.createModalContainer(),
      table: App.TableBuilder.createMainTable(),
      tbody: document.createElement('tbody'),
      accordionContainer: document.createElement('div'),
      backButton: document.createElement('button'),
      headers: [
        { key: 'favorite', label: '★' },
        { key: 'b2bDepth', label: 'B2B' },
        { key: 'offerCode', label: 'Code' },
        { key: 'offerDate', label: 'Rcvd' },
        { key: 'expiration', label: 'Expires' },
        { key: 'tradeInValue', label: 'Trade' },
        { key: 'offerValue', label: 'Value' },
        { key: 'offerName', label: 'Name' },
        { key: 'shipClass', label: 'Class' },
        { key: 'ship', label: 'Ship' },
        { key: 'sailDate', label: 'Sail Date' },
        { key: 'departurePort', label: 'Departs' },
        { key: 'nights', label: 'Nights' },
        { key: 'destination', label: 'Destination' },
        { key: 'category', label: 'Category' },
        { key: 'guests', label: 'Guests' },
        { key: 'perks', label: 'Perks' }
      ],
      currentSortColumn: 'offerDate',
      currentSortOrder: 'desc',
      viewMode: 'table',
      groupingStack: [],
      groupKeysStack: [],
      selectedProfileKey,
      ...this.prepareOfferData(data)
    };
    state.fullOriginalOffers = [...state.originalOffers];
    state.accordionContainer.className = 'w-full';
    state.backButton.onclick = () => {
      state.viewMode = 'table';
      state.groupingStack = [];
      state.groupKeysStack = [];
      this.updateView(state);
    };
    state.thead = App.TableBuilder.createTableHeader(state);
    App.Modal.setupModal(state, overlappingElements || []);
    this.loadProfile(selectedProfileKey, { data });
  },
  loadProfile(key, payload) {
    const state = this.lastState || {};
    state.selectedProfileKey = key;
    const prepared = this.prepareOfferData(payload.data);
    state.originalOffers = prepared.originalOffers;
    state.sortedOffers = prepared.sortedOffers;
    state.fullOriginalOffers = [...state.originalOffers];
    this.lastState = state;
    this.updateView(state);
  },
  prepareOfferData(data) {
    const offers = data?.offers || [];
    const originalOffers = [];
    offers.forEach(offer => {
      const sailings = offer?.campaignOffer?.sailings || [];
      sailings.forEach(sailing => originalOffers.push({ offer, sailing }));
    });
    return { originalOffers, sortedOffers: [...originalOffers] };
  },
  updateView(state) {
    this.lastState = state;
    const filtered = Filtering.filterOffers(state, state.fullOriginalOffers || state.originalOffers);
    state.originalOffers = filtered;
    if (state.currentSortOrder !== 'original') {
      state.sortedOffers = SortUtils.sortOffers(filtered, state.currentSortColumn, state.currentSortOrder);
    } else {
      state.sortedOffers = [...filtered];
    }
    const { table, tbody, thead, accordionContainer, viewMode } = state;
    table.style.display = viewMode === 'table' ? 'table' : 'none';
    accordionContainer.style.display = viewMode === 'accordion' ? 'block' : 'none';
    if (viewMode === 'table') {
      App.TableBuilder.renderTable(tbody, state);
      if (!table.contains(thead)) table.appendChild(thead);
      if (!table.contains(tbody)) table.appendChild(tbody);
    } else {
      const grouped = AccordionBuilder.createGroupedData(state.sortedOffers, state.groupingStack[0] || 'ship');
      AccordionBuilder.renderAccordion(accordionContainer, grouped, {}, state, state.groupingStack, state.groupKeysStack);
    }
    Breadcrumbs.updateBreadcrumb(state.groupingStack, state.groupKeysStack);
  }
};`;
}

function getGridBuilderAppContent(): string {
  return `// Grid Builder App
(function() {
  console.debug('[GridBuilder] Extension loaded on:', window.location.href);
  window.App = {
    DOMUtils,
    Styles: {},
    ButtonManager,
    ErrorHandler,
    Spinner,
    ApiClient,
    Modal,
    TableBuilder,
    AccordionBuilder,
    SortUtils,
    TableRenderer,
    ItineraryCache,
    AdvancedItinerarySearch,
    Breadcrumbs,
    AdvancedSearch,
    AdvancedSearchAddField,
    Utils,
    OfferCodeLookup,
    Filtering,
    B2BUtils,
    BackToBackTool,
    Favorites,
    Settings,
    ProfileIdMap: {},
    ProfileCache: {},
    CurrentProfile: null,
    SettingsStore: {
      getSettings() { try { return JSON.parse(goboStorageGet('goboSettings') || '{}'); } catch(e) { return {}; } },
      setSettings(obj) { try { goboStorageSet('goboSettings', JSON.stringify(obj)); } catch(e) {} },
      getAutoRunB2B() { return true; },
      setAutoRunB2B() {},
      getIncludeSideBySide() { return true; },
      setIncludeSideBySide() {}
    },
    BackToBackAutoRun: true,
    init() { this.DOMUtils.waitForDom(); }
  };
  App.init();
})();`;
}
