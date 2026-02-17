let currentStatus = {
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
    console.log(`[Easy Seas] Data captured: ${request.endpoint}, count: ${request.count}`);
    
    if (syncState.isRunning && request.data) {
      syncState.capturedData[request.dataKey] = request.data;
      
      broadcastSyncProgress({
        step: syncState.step,
        stepName: SYNC_STEPS[syncState.step - 1]?.name || 'Unknown',
        status: 'completed',
        message: `Captured ${request.count} items`
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
    message: `Navigating to ${step.name}...`
  });
  
  try {
    const fullUrl = `${syncState.baseUrl}${step.url}`;
    
    await chrome.tabs.update(syncState.tabId, { url: fullUrl });
    
    await chrome.storage.local.set({ syncState });
    
    setTimeout(() => {
      if (syncState.isRunning && syncState.step === SYNC_STEPS.indexOf(step) + 1) {
        checkStepTimeout(step);
      }
    }, 30000);
    
  } catch (error) {
    console.error(`[Easy Seas] Error navigating to ${step.name}:`, error);
    syncState.errors.push(`${step.name}: ${error.message}`);
    
    broadcastSyncProgress({
      step: syncState.step,
      stepName: step.name,
      status: 'error',
      message: `Failed to load ${step.name}`
    });
    
    setTimeout(() => nextSyncStep(), 2000);
  }
}

function checkStepTimeout(step) {
  if (!syncState.capturedData[step.dataKey]) {
    console.warn(`[Easy Seas] Timeout waiting for ${step.name} data`);
    syncState.errors.push(`${step.name}: Timeout - no data captured`);
    
    broadcastSyncProgress({
      step: syncState.step,
      stepName: step.name,
      status: 'warning',
      message: `${step.name} timed out, continuing...`
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
    message: `Sync complete! ${totalCaptured.offers} offers, ${totalCaptured.bookings} bookings`,
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
});
