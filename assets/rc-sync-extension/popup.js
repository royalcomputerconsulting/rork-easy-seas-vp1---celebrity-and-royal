const syncButton = document.getElementById('sync-button');
const statusEl = document.getElementById('status');
const offerCountEl = document.getElementById('offer-count');
const logsEl = document.getElementById('logs');
const progressContainer = document.getElementById('progress-container');
const progressFill = document.getElementById('progress-fill');
const progressText = document.getElementById('progress-text');
const instructionsEl = document.getElementById('instructions');

let currentState = {
  status: 'idle',
  offers: [],
  logs: [],
  progress: { current: 0, total: 0, stepName: '' }
};

function updateUI(state) {
  currentState = state;
  
  const statusMap = {
    'idle': 'Ready',
    'syncing': '🔄 Syncing...',
    'complete': '✅ Complete!',
    'error': '❌ Error'
  };
  
  statusEl.textContent = statusMap[state.status] || state.status;
  offerCountEl.textContent = state.offers.length.toLocaleString();
  
  if (state.status === 'syncing' && state.progress.total > 0) {
    progressContainer.style.display = 'block';
    instructionsEl.style.display = 'none';
    const percent = Math.round((state.progress.current / state.progress.total) * 100);
    progressFill.style.width = percent + '%';
    progressText.textContent = state.progress.stepName || `${percent}%`;
  } else if (state.status === 'complete') {
    progressContainer.style.display = 'none';
  } else {
    progressContainer.style.display = 'none';
  }
  
  syncButton.disabled = state.status === 'syncing';
  
  if (state.logs.length > 0) {
    logsEl.innerHTML = state.logs.slice(-15).reverse().map(log => {
      const time = new Date(log.timestamp).toLocaleTimeString();
      const logClass = 'log-' + (log.logType || 'info');
      return `<div class="log-entry ${logClass}"><span class="log-time">[${time}]</span>${log.message}</div>`;
    }).join('');
  }
}

syncButton.addEventListener('click', async () => {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const currentTab = tabs[0];
    
    if (!currentTab.url.includes('royalcaribbean.com') && !currentTab.url.includes('celebritycruises.com')) {
      alert('Please navigate to Royal Caribbean Club Royale page first.\n\nGo to:\nhttps://www.royalcaribbean.com/club-royale');
      return;
    }
    
    if (!currentTab.url.includes('/club-royale') && !currentTab.url.includes('/blue-chip-club')) {
      const confirm = window.confirm('You should be on the Club Royale or Blue Chip Club page.\n\nNavigate there now?');
      if (confirm) {
        const targetUrl = currentTab.url.includes('celebritycruises.com') 
          ? 'https://www.celebritycruises.com/blue-chip-club/offers'
          : 'https://www.royalcaribbean.com/club-royale';
        chrome.tabs.update(currentTab.id, { url: targetUrl }, () => {
          alert('Please wait for the page to load, then click Sync Now again.');
        });
      }
      return;
    }
    
    chrome.runtime.sendMessage({ type: 'START_SYNC' }, (response) => {
      if (response && response.success) {
        console.log('Sync started');
      }
    });
  });
});

chrome.runtime.onMessage.addListener((message) => {
  if (message.type === 'STATE_UPDATE') {
    updateUI(message.state);
  }
});

chrome.runtime.sendMessage({ type: 'GET_STATE' }, (response) => {
  if (response && response.state) {
    updateUI(response.state);
  }
});
