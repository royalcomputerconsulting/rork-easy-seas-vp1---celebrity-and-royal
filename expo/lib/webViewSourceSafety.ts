/**
 * EasySeas sync WebViews load provider websites, so their source.uri must remain
 * a remote HTTP(S) URL. Hostless/local schemes are rejected before they reach
 * react-native-webview's iOS local-file loading branch.
 */
export function isSafeRemoteWebViewUrl(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const candidate = value.trim();
  if (!candidate) return false;

  try {
    const parsed = new URL(candidate);
    return (parsed.protocol === 'https:' || parsed.protocol === 'http:') && parsed.hostname.trim().length > 0;
  } catch {
    return false;
  }
}

export function getSafeRemoteWebViewUrl(value: unknown, fallback: string): string {
  if (isSafeRemoteWebViewUrl(value)) {
    return value.trim();
  }

  if (!isSafeRemoteWebViewUrl(fallback)) {
    throw new Error('A valid HTTP(S) WebView fallback URL is required.');
  }

  return fallback.trim();
}
