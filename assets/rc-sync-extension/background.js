let currentSyncState = {
  status: 'idle',
  offers: [],
  logs: [],
  progress: { current: 0, total: 0, stepName: '' }
};

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('[Background] Received message:', message.type);
  
  switch (message.type) {
    case 'START_SYNC':
      currentSyncState = {
        status: 'syncing',
        offers: [],
        logs: [],
        progress: { current: 0, total: 0, stepName: 'Starting...' }
      };
      
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]) {
          chrome.tabs.sendMessage(tabs[0].id, { type: 'BEGIN_EXTRACTION' });
        }
      });
      sendResponse({ success: true });
      break;
      
    case 'LOG':
      currentSyncState.logs.push({
        timestamp: new Date().toISOString(),
        message: message.message,
        logType: message.logType || 'info'
      });
      
      chrome.runtime.sendMessage({
        type: 'STATE_UPDATE',
        state: currentSyncState
      }).catch(() => {});
      break;
      
    case 'PROGRESS':
      currentSyncState.progress = {
        current: message.current,
        total: message.total,
        stepName: message.stepName || ''
      };
      
      chrome.runtime.sendMessage({
        type: 'STATE_UPDATE',
        state: currentSyncState
      }).catch(() => {});
      break;
      
    case 'OFFERS_BATCH':
      if (message.data && Array.isArray(message.data)) {
        currentSyncState.offers.push(...message.data);
      }
      
      chrome.runtime.sendMessage({
        type: 'STATE_UPDATE',
        state: currentSyncState
      }).catch(() => {});
      break;
      
    case 'EXTRACTION_COMPLETE':
      currentSyncState.status = 'complete';
      
      if (currentSyncState.offers.length > 0) {
        generateAndDownloadCSV(currentSyncState.offers);
      }
      
      chrome.runtime.sendMessage({
        type: 'STATE_UPDATE',
        state: currentSyncState
      }).catch(() => {});
      
      sendResponse({ success: true });
      break;
      
    case 'EXTRACTION_ERROR':
      currentSyncState.status = 'error';
      currentSyncState.logs.push({
        timestamp: new Date().toISOString(),
        message: 'Extraction failed: ' + message.error,
        logType: 'error'
      });
      
      chrome.runtime.sendMessage({
        type: 'STATE_UPDATE',
        state: currentSyncState
      }).catch(() => {});
      break;
      
    case 'GET_STATE':
      sendResponse({ state: currentSyncState });
      break;
  }
  
  return true;
});

function escapeCSVField(field) {
  if (!field) return '';
  
  const value = String(field);
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function generateAndDownloadCSV(offers) {
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

  const rows = offers.map(offer => [
    escapeCSVField(offer.sourcePage),
    escapeCSVField(offer.offerName),
    escapeCSVField(offer.offerCode),
    escapeCSVField(offer.offerExpirationDate),
    escapeCSVField(offer.offerType),
    escapeCSVField(offer.shipName),
    escapeCSVField(offer.sailingDate),
    escapeCSVField(offer.itinerary),
    escapeCSVField(offer.departurePort),
    escapeCSVField(offer.cabinType),
    escapeCSVField(offer.numberOfGuests),
    escapeCSVField(offer.perks),
    escapeCSVField(offer.loyaltyLevel || ''),
    escapeCSVField(offer.loyaltyPoints || ''),
    escapeCSVField(offer.interiorPrice || ''),
    escapeCSVField(offer.oceanviewPrice || ''),
    escapeCSVField(offer.balconyPrice || ''),
    escapeCSVField(offer.suitePrice || ''),
    escapeCSVField(offer.portList || '')
  ]);

  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.join(','))
  ].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
  
  chrome.downloads.download({
    url: url,
    filename: `royal-caribbean-offers-${timestamp}.csv`,
    saveAs: true
  }, (downloadId) => {
    console.log('[Background] CSV download started:', downloadId);
    
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  });
}

console.log('[Background] Royal Caribbean Sync Extension loaded');
