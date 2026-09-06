/**
 * Installs a page-side size governor before any Carnival extraction script.
 * Large WebView messages can terminate the native browser process before the
 * React Native onMessage callback has a chance to reject them, so protection
 * must happen inside the page before the bridge call.
 */
export const CARNIVAL_SAFE_BRIDGE_SCRIPT = String.raw`
(function () {
  if (window.__easySeasCarnivalSafeBridgeInstalled) return true;
  window.__easySeasCarnivalSafeBridgeInstalled = true;

  var bridge = window.ReactNativeWebView;
  if (!bridge || typeof bridge.postMessage !== 'function') return true;

  var originalPostMessage = bridge.postMessage.bind(bridge);
  var MAX_MESSAGE_CHARS = 48000;
  var MAX_STRING_CHARS = 1800;
  var ARRAY_CHUNK_SIZE = 4;

  function compact(value, depth) {
    if (depth > 5) return '[depth-limited]';
    if (value === null || value === undefined) return value;
    if (typeof value === 'string') return value.length > MAX_STRING_CHARS ? value.slice(0, MAX_STRING_CHARS) + '…' : value;
    if (typeof value === 'number' || typeof value === 'boolean') return value;
    if (Array.isArray(value)) return value.slice(0, 30).map(function (entry) { return compact(entry, depth + 1); });
    if (typeof value === 'object') {
      var result = {};
      Object.keys(value).slice(0, 80).forEach(function (key) {
        if (/^(?:rawHtml|html|markup|sourcePayload|responseText|document|body)$/i.test(key)) return;
        try { result[key] = compact(value[key], depth + 1); } catch (e) {}
      });
      return result;
    }
    return String(value).slice(0, MAX_STRING_CHARS);
  }

  function sendObject(object) {
    var encoded;
    try { encoded = JSON.stringify(object); } catch (e) { return false; }
    if (encoded.length <= MAX_MESSAGE_CHARS) {
      originalPostMessage(encoded);
      return true;
    }
    return false;
  }

  function chunkArrayMessage(object, key, values) {
    var totalChunks = Math.max(1, Math.ceil(values.length / ARRAY_CHUNK_SIZE));
    for (var index = 0; index < totalChunks; index += 1) {
      var next = compact(object, 0);
      next[key] = values.slice(index * ARRAY_CHUNK_SIZE, (index + 1) * ARRAY_CHUNK_SIZE).map(function (entry) { return compact(entry, 0); });
      next.bridgeChunkIndex = index + 1;
      next.bridgeTotalChunks = totalChunks;
      if (Object.prototype.hasOwnProperty.call(next, 'isFinal')) next.isFinal = index === totalChunks - 1 && object.isFinal === true;
      if (!sendObject(next)) {
        next[key] = next[key].map(function (entry) { return compact(entry, 3); });
        if (!sendObject(next)) return false;
      }
    }
    return true;
  }

  bridge.postMessage = function (message) {
    try {
      var text = typeof message === 'string' ? message : JSON.stringify(message);
      if (text.length <= MAX_MESSAGE_CHARS) {
        originalPostMessage(text);
        return;
      }

      var parsed = JSON.parse(text);
      if (parsed && Array.isArray(parsed.data) && chunkArrayMessage(parsed, 'data', parsed.data)) return;
      if (parsed && Array.isArray(parsed.rows) && chunkArrayMessage(parsed, 'rows', parsed.rows)) return;
      if (parsed && Array.isArray(parsed.sailings) && chunkArrayMessage(parsed, 'sailings', parsed.sailings)) return;
      if (parsed && parsed.data && Array.isArray(parsed.data.Items)) {
        var items = parsed.data.Items;
        var shell = compact(parsed, 0);
        shell.data = compact(parsed.data, 0);
        shell.data.Items = [];
        var chunks = Math.max(1, Math.ceil(items.length / ARRAY_CHUNK_SIZE));
        for (var itemIndex = 0; itemIndex < chunks; itemIndex += 1) {
          var chunk = compact(shell, 0);
          chunk.data.Items = items.slice(itemIndex * ARRAY_CHUNK_SIZE, (itemIndex + 1) * ARRAY_CHUNK_SIZE).map(function (entry) { return compact(entry, 0); });
          chunk.bridgeChunkIndex = itemIndex + 1;
          chunk.bridgeTotalChunks = chunks;
          if (!sendObject(chunk)) break;
        }
        return;
      }

      sendObject({
        type: 'bridge_payload_rejected',
        rejectedType: parsed && parsed.type ? String(parsed.type) : 'unknown',
        originalCharacters: text.length,
        message: 'Carnival browser payload exceeded the native bridge limit and was rejected safely.'
      });
    } catch (error) {
      try {
        sendObject({ type: 'bridge_payload_rejected', rejectedType: 'unreadable', message: 'Unreadable Carnival browser payload was rejected safely.' });
      } catch (ignored) {}
    }
  };

  return true;
})();
true;
`;
