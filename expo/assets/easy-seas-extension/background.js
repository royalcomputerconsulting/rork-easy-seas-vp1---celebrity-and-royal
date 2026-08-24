console.log('[Easy Seas BG] Service worker v3 initialized');

chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  if (request.type === 'store_data') {
    chrome.storage.local.set(request.data).then(function() {
      sendResponse({ success: true });
    }).catch(function(err) {
      sendResponse({ success: false, error: err.message });
    });
    return true;
  }

  if (request.type === 'get_data') {
    chrome.storage.local.get(request.keys).then(function(result) {
      sendResponse({ success: true, data: result });
    }).catch(function(err) {
      sendResponse({ success: false, error: err.message });
    });
    return true;
  }

  if (request.type === 'navigate') {
    var tabId = sender && sender.tab ? sender.tab.id : null;
    if (tabId && request.url) {
      console.log('[Easy Seas BG] Navigating tab', tabId, 'to', request.url);
      chrome.tabs.update(tabId, { url: request.url }).then(function() {
        sendResponse({ success: true });
      }).catch(function(err) {
        console.error('[Easy Seas BG] Navigate error:', err);
        sendResponse({ success: false, error: err.message });
      });
    } else {
      sendResponse({ success: false, error: 'No tab or url' });
    }
    return true;
  }
});

chrome.runtime.onInstalled.addListener(function() {
  console.log('[Easy Seas BG] Extension installed/updated');
});
