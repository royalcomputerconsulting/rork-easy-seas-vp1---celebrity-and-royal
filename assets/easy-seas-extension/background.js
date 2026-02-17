console.log('[Easy Seas BG] Service worker v2 initialized');

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
});

chrome.runtime.onInstalled.addListener(function() {
  console.log('[Easy Seas BG] Extension installed/updated');
});
