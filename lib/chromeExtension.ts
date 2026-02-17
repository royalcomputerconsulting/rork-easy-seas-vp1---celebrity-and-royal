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
  return `let currentStatus = {
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
#easy-seas-overlay{position:fixed!important;top:20px!important;right:20px!important;width:400px!important;max-height:600px!important;background:linear-gradient(135deg,#1e3a8a 0%,#0f172a 100%)!important;border-radius:16px!important;box-shadow:0 20px 60px rgba(0,0,0,0.5),0 0 0 1px rgba(255,255,255,0.1)!important;z-index:2147483647!important;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif!important;color:#fff!important;display:flex!important;flex-direction:column!important;overflow:hidden!important;backdrop-filter:blur(20px)!important}#easy-seas-overlay *{box-sizing:border-box!important;margin:0!important;padding:0!important}#easy-seas-header{padding:20px!important;border-bottom:1px solid rgba(255,255,255,0.1)!important;display:flex!important;align-items:center!important;gap:12px!important}#easy-seas-icon{width:32px!important;height:32px!important;font-size:24px!important}#easy-seas-title{flex:1!important;font-size:18px!important;font-weight:600!important;color:#fff!important}#easy-seas-subtitle{font-size:12px!important;color:rgba(255,255,255,0.6)!important;margin-top:4px!important}#easy-seas-content{padding:20px!important;overflow-y:auto!important;max-height:450px!important}#easy-seas-content::-webkit-scrollbar{width:6px!important}#easy-seas-content::-webkit-scrollbar-track{background:rgba(255,255,255,0.05)!important;border-radius:3px!important}#easy-seas-content::-webkit-scrollbar-thumb{background:rgba(255,255,255,0.2)!important;border-radius:3px!important}.es-status-row{display:flex!important;justify-content:space-between!important;align-items:center!important;padding:12px 0!important;border-bottom:1px solid rgba(255,255,255,0.05)!important}.es-status-label{font-size:13px!important;color:rgba(255,255,255,0.7)!important}.es-status-value{font-size:14px!important;font-weight:600!important;color:#fff!important}.es-badge{padding:4px 10px!important;border-radius:12px!important;font-size:12px!important;font-weight:600!important}.es-badge-success{background:rgba(16,185,129,0.2)!important;color:#10b981!important}.es-badge-warning{background:rgba(245,158,11,0.2)!important;color:#f59e0b!important}.es-button{padding:10px 16px!important;border:none!important;border-radius:8px!important;font-size:14px!important;font-weight:600!important;cursor:pointer!important;transition:all 0.2s!important;width:100%!important;margin-top:8px!important}.es-button-primary{background:#10b981!important;color:#fff!important}.es-button-primary:hover{background:#059669!important}.es-button-secondary{background:rgba(255,255,255,0.1)!important;color:#fff!important}.es-button-secondary:hover{background:rgba(255,255,255,0.15)!important}`;
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

function getCSVExporterJS(): string {
  return `function escapeCSVField(value) {
  if (value === null || value === undefined) return '';
  const stringValue = String(value);
  if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\\n') || stringValue.includes('\\r')) {
    return '"' + stringValue.replace(/"/g, '""') + '"';
  }
  return stringValue;
}

function parseDate(dateStr) {
  if (!dateStr) return '';
  const trimmed = dateStr.trim();
  
  try {
    const isoMatch = trimmed.match(/^(\\d{4})-(\\d{2})-(\\d{2})/);
    if (isoMatch) {
      const year = isoMatch[1];
      const month = isoMatch[2];
      const day = isoMatch[3];
      return month + '-' + day + '-' + year;
    }
    
    const mmddyyyyDash = trimmed.match(/^(\\d{1,2})-(\\d{1,2})-(\\d{4})$/);
    if (mmddyyyyDash) {
      const month = mmddyyyyDash[1].padStart(2, '0');
      const day = mmddyyyyDash[2].padStart(2, '0');
      const year = mmddyyyyDash[3];
      return month + '-' + day + '-' + year;
    }
    
    const mmddyyyySlash = trimmed.match(/^(\\d{1,2})\\/(\\d{1,2})\\/(\\d{2,4})$/);
    if (mmddyyyySlash) {
      const month = mmddyyyySlash[1].padStart(2, '0');
      const day = mmddyyyySlash[2].padStart(2, '0');
      const year = mmddyyyySlash[3].length === 2 ? '20' + mmddyyyySlash[3] : mmddyyyySlash[3];
      return month + '-' + day + '-' + year;
    }
    
    const date = new Date(trimmed);
    if (!isNaN(date.getTime())) {
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const year = String(date.getFullYear());
      return month + '-' + day + '-' + year;
    }
  } catch (e) {
    console.warn('[CSV Export] Failed to parse date:', dateStr);
  }
  
  return dateStr;
}

function extractNightsFromText(text) {
  if (!text) return null;
  const nightsMatch = text.match(/(\\d+)\\s*[-]?\\s*night/i);
  if (nightsMatch) {
    const nights = parseInt(nightsMatch[1], 10);
    if (nights > 0 && nights <= 365) return nights;
  }
  return null;
}

function generateOffersCSV(offersData, loyaltyData) {
  if (!offersData || !offersData.offers || offersData.offers.length === 0) {
    console.log('[CSV Export] No offers to export');
    return null;
  }

  const offers = offersData.offers;
  const headers = [
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

  const rows = [headers.join(',')];
  let totalSailings = 0;

  for (const offer of offers) {
    const campaignOffer = offer.campaignOffer || offer;
    const sailings = campaignOffer.sailings || [];
    
    const offerCode = campaignOffer.offerCode || '';
    const offerName = campaignOffer.name || campaignOffer.offerName || '';
    const offerExpiryDate = parseDate(campaignOffer.reserveByDate || campaignOffer.expiryDate || '');
    const offerType = campaignOffer.offerType || campaignOffer.type || 'Free Play';
    
    for (const sailing of sailings) {
      const itinerary = sailing.itineraryDescription || sailing.itinerary || '';
      const nights = extractNightsFromText(itinerary) || sailing.numberOfNights || 7;
      
      const shipName = sailing.shipName || '';
      const sailingDate = parseDate(sailing.sailDate || sailing.sailingDate || '');
      const cabinType = sailing.roomType || sailing.cabinType || 'Balcony';
      const numberOfGuests = sailing.numberOfGuests || (sailing.isGOBO ? '1' : '2');
      const departurePort = sailing.departurePort && sailing.departurePort.name ? sailing.departurePort.name : (sailing.departurePort || '');
      
      const portList = Array.isArray(sailing.portList) ? sailing.portList.join(', ') : '';
      const perks = '-';
      
      const loyaltyLevel = loyaltyData && loyaltyData.crownAndAnchorLevel ? loyaltyData.crownAndAnchorLevel : '';
      const loyaltyPoints = loyaltyData && loyaltyData.crownAndAnchorPoints ? loyaltyData.crownAndAnchorPoints : '';

      const row = [
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
  const bookings = [];
  
  if (bookingsData.upcomingCruises && bookingsData.upcomingCruises.profileBookings) {
    bookings.push(...bookingsData.upcomingCruises.profileBookings.map(function(b) { return Object.assign({}, b, { source: 'Upcoming' }); }));
  }
  
  if (bookingsData.courtesyHolds && bookingsData.courtesyHolds.payload && bookingsData.courtesyHolds.payload.sailingInfo) {
    bookings.push(...bookingsData.courtesyHolds.payload.sailingInfo.map(function(b) { return Object.assign({}, b, { source: 'Courtesy Hold' }); }));
  } else if (bookingsData.courtesyHolds && bookingsData.courtesyHolds.sailingInfo) {
    bookings.push(...bookingsData.courtesyHolds.sailingInfo.map(function(b) { return Object.assign({}, b, { source: 'Courtesy Hold' }); }));
  }
  
  if (bookings.length === 0) {
    console.log('[CSV Export] No bookings to export');
    return null;
  }

  const headers = [
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

  const rows = [headers.join(',')];

  const SHIP_CODE_MAP = {
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

  const STATEROOM_TYPE_MAP = {
    'I': 'Interior', 'O': 'Ocean View', 'B': 'Balcony', 'S': 'Suite'
  };

  for (const booking of bookings) {
    const shipCode = booking.shipCode || '';
    const shipName = SHIP_CODE_MAP[shipCode] || booking.shipName || (shipCode ? shipCode + ' of the Seas' : '');
    
    const sailDate = parseDate(booking.sailDate || booking.sailingStartDate || '');
    const nights = booking.numberOfNights || 7;
    
    let returnDate = parseDate(booking.returnDate || booking.sailingEndDate || '');
    if (!returnDate && sailDate && nights) {
      const startParts = sailDate.match(/(\\d{1,2})-(\\d{1,2})-(\\d{4})/);
      if (startParts) {
        const month = startParts[1];
        const day = startParts[2];
        const year = startParts[3];
        const startDateObj = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
        startDateObj.setDate(startDateObj.getDate() + nights);
        returnDate = String(startDateObj.getMonth() + 1).padStart(2, '0') + '-' + String(startDateObj.getDate()).padStart(2, '0') + '-' + startDateObj.getFullYear();
      }
    }
    
    const sailingDates = booking.sailingDates || (sailDate + ' - ' + returnDate);
    const itinerary = booking.itinerary || booking.cruiseTitle || booking.itineraryDescription || (nights + ' Night Cruise');
    const departurePort = booking.departurePort && booking.departurePort.name ? booking.departurePort.name : (booking.departurePort || '');
    
    const stateroomType = booking.stateroomType || '';
    const cabinType = STATEROOM_TYPE_MAP[stateroomType] || booking.cabinType || stateroomType || '';
    
    const stateroomNumber = booking.stateroomNumber || '';
    const cabinNumberOrGTY = stateroomNumber === 'GTY' ? 'GTY' : stateroomNumber;
    
    const bookingId = booking.bookingId || booking.masterBookingId || '';
    
    let status = booking.source || 'Upcoming';
    if (booking.bookingStatus === 'OF') status = 'Courtesy Hold';
    else if (booking.status) status = booking.status;
    
    const loyaltyLevel = loyaltyData && loyaltyData.crownAndAnchorLevel ? loyaltyData.crownAndAnchorLevel : '';
    const loyaltyPoints = loyaltyData && loyaltyData.crownAndAnchorPoints ? loyaltyData.crownAndAnchorPoints : '';

    const row = [
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

  const loyaltyData = capturedData.loyalty && capturedData.loyalty.payload && capturedData.loyalty.payload.loyaltyInformation ? capturedData.loyalty.payload.loyaltyInformation : null;
  
  let csvContent = '';
  
  if (includeOffers && capturedData.offers) {
    const offersCSV = generateOffersCSV(capturedData.offers, loyaltyData);
    if (offersCSV) {
      csvContent += offersCSV;
    }
  }
  
  if (includeBookings) {
    const bookingsCSV = generateBookedCruisesCSV(capturedData, loyaltyData);
    if (bookingsCSV) {
      if (csvContent) csvContent += '\\n\\n';
      csvContent += bookingsCSV;
    }
  }
  
  if (!csvContent) {
    console.error('[CSV Export] No data to export');
    return { success: false, error: 'No data to export' };
  }
  
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
  const cruiseLine = capturedData.cruiseLine === 'celebrity' ? 'celebrity' : 'royal';
  const filename = 'easy-seas-' + cruiseLine + '-offers-' + timestamp + '.csv';
  
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
  return { success: false, error: 'Grid Builder extension download not implemented' };
}

export async function downloadChromeExtension(): Promise<{ success: boolean; error?: string; filesAdded?: number }> {
  return downloadScraperExtension();
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
