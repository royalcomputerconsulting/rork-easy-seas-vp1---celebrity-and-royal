let currentStatus = {
  isLoggedIn: false,
  hasOffers: false,
  hasBookings: false,
  offerCount: 0,
  bookingCount: 0,
  cruiseLine: 'royal',
  lastUpdate: null
};

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'status_update') {
    currentStatus = request.data;
    chrome.storage.local.set({ status: currentStatus });
    
    chrome.action.setBadgeText({
      text: currentStatus.hasOffers || currentStatus.hasBookings ? '✓' : ''
    });
    chrome.action.setBadgeBackgroundColor({ color: '#10b981' });
  }
  
  if (request.type === 'data_captured') {
    console.log(`[Easy Seas] Data captured: ${request.endpoint}, count: ${request.count}`);
  }
});

chrome.storage.local.get(['status'], (result) => {
  if (result.status) {
    currentStatus = result.status;
  }
});
