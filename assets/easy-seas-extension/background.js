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
  cruiseLine: 'royal',
  baseUrl: ''
};

const SYNC_STEPS = [
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
    console.log(`[Easy Seas BG] Data captured: ${request.dataKey}`);
    
    if (syncState.isRunning && request.data) {
      syncState.capturedData[request.dataKey] = request.data;
      
      broadcastProgress({
        step: syncState.step,
        totalSteps: syncState.totalSteps,
        message: `✅ ${SYNC_STEPS[syncState.step - 1]?.name || 'Step'} completed`,
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
  const fullUrl = `${syncState.baseUrl}${url}`;

  await broadcastProgress({
    step: syncState.step,
    totalSteps: syncState.totalSteps,
    message: `Loading ${step.name}...`,
    status: 'loading'
  });

  try {
    await chrome.tabs.update(syncState.tabId, { url: fullUrl });
    await chrome.storage.local.set({ syncState });

    await chrome.alarms.create(`timeout_step_${syncState.step}`, { delayInMinutes: 0.5 });
  } catch (error) {
    console.error(`[Easy Seas BG] Error at step ${step.name}:`, error);
    await broadcastProgress({
      step: syncState.step,
      totalSteps: syncState.totalSteps,
      message: `❌ Failed to load ${step.name}`,
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
    message: `🎉 Sync complete! ${totalCaptured.offers} offers, ${totalCaptured.bookings} bookings`,
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
        console.warn(`[Easy Seas BG] Timeout for ${step.name}`);
        await broadcastProgress({
          step: syncState.step,
          totalSteps: syncState.totalSteps,
          message: `⚠️ ${step.name} timed out, continuing...`,
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
});
