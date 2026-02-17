let currentStatus = {
  isLoggedIn: false,
  hasOffers: false,
  hasBookings: false,
  offerCount: 0,
  bookingCount: 0,
  cruiseLine: 'royal',
  lastUpdate: null
};

let capturedData = null;

function showAlert(message, type = 'error') {
  const alert = document.getElementById('alert');
  alert.textContent = message;
  alert.className = 'alert show';
  if (type === 'success') {
    alert.style.background = '#10b98110';
    alert.style.borderColor = '#10b981';
    alert.style.color = '#6ee7b7';
  } else {
    alert.style.background = '#ef444410';
    alert.style.borderColor = '#ef4444';
    alert.style.color = '#fca5a5';
  }
  
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
  exportBtn.disabled = !hasData;
  
  if (hasData && currentStatus.lastUpdate) {
    const lastUpdateDate = new Date(currentStatus.lastUpdate);
    const timeAgo = formatTimeAgo(lastUpdateDate);
    exportBtn.innerHTML = `
      <svg class="icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path>
      </svg>
      Export to CSV (Updated ${timeAgo})
    `;
  }
}

function formatTimeAgo(date) {
  const seconds = Math.floor((new Date() - date) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

async function loadStatus() {
  const result = await chrome.storage.local.get(['status']);
  if (result.status) {
    currentStatus = result.status;
    updateUI();
  }
}

async function refreshData() {
  const refreshBtn = document.getElementById('refreshBtn');
  const originalContent = refreshBtn.innerHTML;
  refreshBtn.disabled = true;
  refreshBtn.innerHTML = '<div class="spinner"></div> Refreshing...';
  
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    if (!tab || !tab.url || (!tab.url.includes('royalcaribbean.com') && !tab.url.includes('celebritycruises.com'))) {
      showAlert('Please open Royal Caribbean or Celebrity Cruises website first');
      return;
    }
    
    const response = await chrome.tabs.sendMessage(tab.id, { type: 'get_captured_data' });
    
    if (response && response.success) {
      capturedData = response.data;
      
      currentStatus = {
        isLoggedIn: capturedData.isLoggedIn,
        hasOffers: !!capturedData.offers,
        hasBookings: !!capturedData.upcomingCruises || !!capturedData.courtesyHolds,
        offerCount: capturedData.offers?.offers?.length || 0,
        bookingCount: (capturedData.upcomingCruises?.profileBookings?.length || 0) + 
                      (capturedData.courtesyHolds?.payload?.sailingInfo?.length || 0),
        cruiseLine: capturedData.cruiseLine,
        lastUpdate: capturedData.lastUpdate
      };
      
      await chrome.storage.local.set({ status: currentStatus });
      updateUI();
      
      if (currentStatus.offerCount > 0 || currentStatus.bookingCount > 0) {
        showAlert(`Data refreshed! ${currentStatus.offerCount} offers, ${currentStatus.bookingCount} bookings`, 'success');
      } else {
        showAlert('No data found. Visit the Club Royale Offers page to capture data.', 'error');
      }
    }
  } catch (error) {
    console.error('Refresh error:', error);
    showAlert('Unable to refresh data. Make sure you are on the Royal Caribbean website.');
  } finally {
    refreshBtn.disabled = false;
    refreshBtn.innerHTML = originalContent;
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
      isLoggedIn: false,
      hasOffers: false,
      hasBookings: false,
      offerCount: 0,
      bookingCount: 0,
      cruiseLine: 'royal',
      lastUpdate: null
    };
    
    await chrome.storage.local.set({ status: currentStatus });
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
  if (!capturedData) {
    await refreshData();
    if (!capturedData) {
      showAlert('No data to export. Please refresh first.');
      return;
    }
  }
  
  const exportBtn = document.getElementById('exportBtn');
  const originalContent = exportBtn.innerHTML;
  exportBtn.disabled = true;
  exportBtn.innerHTML = '<div class="spinner"></div> Exporting...';
  
  try {
    const includeOffers = document.getElementById('includeOffers').checked;
    const includeBookings = document.getElementById('includeBookings').checked;
    
    if (!includeOffers && !includeBookings) {
      showAlert('Please select at least one data type to export');
      exportBtn.disabled = false;
      exportBtn.innerHTML = originalContent;
      return;
    }
    
    const result = exportToCSV(capturedData, includeOffers, includeBookings);
    
    if (result.success) {
      showAlert(`CSV file "${result.filename}" is being downloaded!`, 'success');
    } else {
      showAlert(result.error || 'Export failed');
    }
  } catch (error) {
    console.error('Export error:', error);
    showAlert('Error exporting data: ' + error.message);
  } finally {
    exportBtn.disabled = false;
    exportBtn.innerHTML = originalContent;
  }
}

document.addEventListener('DOMContentLoaded', () => {
  loadStatus();
  
  document.getElementById('exportBtn').addEventListener('click', exportData);
  document.getElementById('refreshBtn').addEventListener('click', refreshData);
  document.getElementById('clearBtn').addEventListener('click', clearData);
  
  chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === 'local' && changes.status) {
      currentStatus = changes.status.newValue;
      updateUI();
    }
  });
  
  setInterval(() => {
    if (currentStatus.lastUpdate) {
      updateUI();
    }
  }, 30000);
});
