let currentStatus = {
  isLoggedIn: false,
  hasOffers: false,
  hasBookings: false,
  offerCount: 0,
  bookingCount: 0,
  cruiseLine: 'royal',
  lastUpdate: null
};

let isSyncing = false;
let capturedData = null;

function showAlert(message, type = 'error') {
  const alert = document.getElementById('alert');
  alert.textContent = message;
  alert.className = `alert show ${type === 'success' ? 'success' : ''}`;
  
  setTimeout(() => {
    alert.classList.remove('show');
  }, 5000);
}

function updateUI() {
  const loginStatus = document.getElementById('loginStatus');
  const offerCount = document.getElementById('offerCount');
  const bookingCount = document.getElementById('bookingCount');
  const cruiseLine = document.getElementById('cruiseLine');
  const exportBtn = document.getElementById('exportBtn');
  const syncBtn = document.getElementById('syncBtn');
  
  if (currentStatus.isLoggedIn) {
    loginStatus.textContent = 'Logged In';
    loginStatus.className = 'status-badge badge-success';
  } else {
    loginStatus.textContent = 'Not Logged In';
    loginStatus.className = 'status-badge badge-warning';
  }
  
  offerCount.textContent = currentStatus.offerCount;
  bookingCount.textContent = currentStatus.bookingCount;
  cruiseLine.textContent = currentStatus.cruiseLine === 'celebrity' ? 'Celebrity Cruises' : 'Royal Caribbean';
  
  const hasData = currentStatus.hasOffers || currentStatus.hasBookings;
  exportBtn.disabled = !hasData || isSyncing;
  
  if (isSyncing) {
    syncBtn.className = 'button button-stop';
    syncBtn.innerHTML = `
      <svg class="icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
      </svg>
      STOP SYNC
    `;
  } else {
    syncBtn.className = 'button button-sync';
    syncBtn.innerHTML = `
      <svg class="icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>
      </svg>
      START SYNC
    `;
    syncBtn.disabled = false;
  }
}

function updateSyncProgress(progress) {
  const syncProgress = document.getElementById('syncProgress');
  const progressFill = document.getElementById('progressFill');
  const progressMessage = document.getElementById('progressMessage');
  const currentStep = document.getElementById('currentStep');
  const totalSteps = document.getElementById('totalSteps');
  
  if (!progress) {
    syncProgress.classList.remove('active');
    return;
  }
  
  syncProgress.classList.add('active');
  
  const percentage = (progress.step / progress.totalSteps) * 100;
  progressFill.style.width = `${percentage}%`;
  
  currentStep.textContent = progress.step;
  totalSteps.textContent = progress.totalSteps;
  progressMessage.textContent = progress.message || 'Processing...';
  
  document.querySelectorAll('.step-item').forEach((item, index) => {
    const stepNum = index + 1;
    item.classList.remove('active', 'completed');
    
    if (stepNum < progress.step) {
      item.classList.add('completed');
      item.querySelector('.step-icon').textContent = '✓';
    } else if (stepNum === progress.step) {
      item.classList.add('active');
    }
  });
  
  if (progress.status === 'completed' && progress.step === progress.totalSteps) {
    setTimeout(() => {
      syncProgress.classList.remove('active');
      showAlert(progress.message || 'Sync completed!', 'success');
    }, 2000);
  }
}

async function loadStatus() {
  const result = await chrome.storage.local.get(['status', 'syncProgress', 'lastCapturedData']);
  if (result.status) {
    currentStatus = result.status;
    updateUI();
  }
  
  if (result.syncProgress && result.syncProgress.timestamp > Date.now() - 60000) {
    updateSyncProgress(result.syncProgress);
  }
  
  if (result.lastCapturedData) {
    capturedData = result.lastCapturedData;
  }
}

async function toggleSync() {
  if (isSyncing) {
    chrome.runtime.sendMessage({ type: 'stop_sync' });
    isSyncing = false;
    updateUI();
    updateSyncProgress(null);
    return;
  }
  
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  
  if (!tab || !tab.url || (!tab.url.includes('royalcaribbean.com') && !tab.url.includes('celebritycruises.com'))) {
    showAlert('Please open Royal Caribbean or Celebrity Cruises website first');
    return;
  }
  
  if (!currentStatus.isLoggedIn) {
    showAlert('Please log in to Royal Caribbean website first');
    return;
  }
  
  isSyncing = true;
  updateUI();
  
  const response = await chrome.runtime.sendMessage({ 
    type: 'start_sync',
    tabId: tab.id
  });
  
  if (!response.success) {
    showAlert(response.error || 'Failed to start sync');
    isSyncing = false;
    updateUI();
  }
}

async function clearData() {
  const clearBtn = document.getElementById('clearBtn');
  const originalContent = clearBtn.innerHTML;
  clearBtn.disabled = true;
  clearBtn.innerHTML = '<div class="spinner"></div> Clearing...';
  
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    if (tab && (tab.url.includes('royalcaribbean.com') || tab.url.includes('celebritycruises.com'))) {
      await chrome.tabs.sendMessage(tab.id, { type: 'clear_data' });
    }
    
    capturedData = null;
    currentStatus = {
      isLoggedIn: currentStatus.isLoggedIn,
      hasOffers: false,
      hasBookings: false,
      offerCount: 0,
      bookingCount: 0,
      cruiseLine: currentStatus.cruiseLine,
      lastUpdate: null
    };
    
    await chrome.storage.local.set({ 
      status: currentStatus,
      lastCapturedData: null
    });
    updateUI();
    showAlert('Data cleared successfully', 'success');
  } catch (error) {
    console.error('Clear error:', error);
    showAlert('Error clearing data');
  } finally {
    clearBtn.disabled = false;
    clearBtn.innerHTML = originalContent;
  }
}

async function exportData() {
  const exportBtn = document.getElementById('exportBtn');
  const originalContent = exportBtn.innerHTML;
  exportBtn.disabled = true;
  exportBtn.innerHTML = '<div class="spinner"></div> Exporting...';
  
  try {
    if (!capturedData) {
      const result = await chrome.storage.local.get(['lastCapturedData']);
      capturedData = result.lastCapturedData;
    }
    
    if (!capturedData) {
      showAlert('No data to export. Please run sync first.');
      exportBtn.disabled = false;
      exportBtn.innerHTML = originalContent;
      return;
    }
    
    const result = exportToCSV(capturedData, true, true);
    
    if (result.success) {
      showAlert(`CSV file downloaded successfully!`, 'success');
    } else {
      showAlert(result.error || 'Export failed');
    }
  } catch (error) {
    console.error('Export error:', error);
    showAlert('Error exporting data: ' + error.message);
  } finally {
    setTimeout(() => {
      exportBtn.disabled = false;
      exportBtn.innerHTML = originalContent;
    }, 1000);
  }
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'sync_progress') {
    updateSyncProgress(request.progress);
    
    if (request.progress.status === 'completed' || request.progress.status === 'stopped') {
      isSyncing = false;
      updateUI();
      
      if (request.progress.capturedData) {
        capturedData = request.progress.capturedData;
        
        currentStatus.hasOffers = !!capturedData.offers;
        currentStatus.hasBookings = !!capturedData.upcomingCruises || !!capturedData.courtesyHolds;
        currentStatus.offerCount = capturedData.offers?.offers?.length || 0;
        currentStatus.bookingCount = (capturedData.upcomingCruises?.profileBookings?.length || 0) + 
                                      (capturedData.courtesyHolds?.payload?.sailingInfo?.length || 0);
        currentStatus.lastUpdate = new Date().toISOString();
        updateUI();
      }
    }
  }
});

document.addEventListener('DOMContentLoaded', () => {
  loadStatus();
  
  document.getElementById('syncBtn').addEventListener('click', toggleSync);
  document.getElementById('exportBtn').addEventListener('click', exportData);
  document.getElementById('clearBtn').addEventListener('click', clearData);
  
  chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === 'local') {
      if (changes.status) {
        currentStatus = changes.status.newValue;
        updateUI();
      }
      if (changes.syncProgress) {
        updateSyncProgress(changes.syncProgress.newValue);
      }
      if (changes.lastCapturedData) {
        capturedData = changes.lastCapturedData.newValue;
      }
    }
  });
  
  setInterval(() => {
    loadStatus();
  }, 5000);
});
