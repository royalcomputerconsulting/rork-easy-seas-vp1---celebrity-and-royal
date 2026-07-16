import { httpLink } from "@trpc/client";
import { createTRPCReact } from "@trpc/react-query";
import superjson from "superjson";

import type { AppRouter } from "@/backend/trpc/app-router";
import { isCloudBackupEnabledByEnv } from "@/lib/localFirstMode";

export const trpc = createTRPCReact<AppRouter>();

const DEFAULT_RENDER_URL = "https://easy-seas-backend-v2.onrender.com";

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, '');
}

// The legacy standalone Render service (easy-seas-backend-v2) is no longer
// deployed and now returns a bare 404 for every route, including "/". This
// broke certificate downloads, Carnival sync, and anything else that talks to
// trpcClient. This project's own backend/hono.ts is auto-hosted by Rork at
// EXPO_PUBLIC_RORK_API_BASE_URL and is always live, so prefer it whenever it
// is present; only fall back to the legacy Render URL if Rork hasn't set one
// (e.g. an older/offline build) or the app explicitly overrides it.
const RORK_HOSTED_API_BASE_URL = trimTrailingSlash(
  process.env.EXPO_PUBLIC_RORK_API_BASE_URL?.trim() || ''
);

export const RENDER_BACKEND_URL = trimTrailingSlash(
  process.env.EXPO_PUBLIC_RENDER_BACKEND_URL?.trim() || DEFAULT_RENDER_URL
);

const USE_RORK_HOSTED_BACKEND = RORK_HOSTED_API_BASE_URL.length > 0
  && !process.env.EXPO_PUBLIC_RENDER_BACKEND_URL?.trim();

// Base URL used for non-tRPC helper endpoints (calendar feed, SeaPass shell
// proxy) that expect an "/api" prefixed root rather than the tRPC path.
export const BACKEND_API_ROOT_URL = USE_RORK_HOSTED_BACKEND
  ? (RORK_HOSTED_API_BASE_URL.endsWith('/api') ? RORK_HOSTED_API_BASE_URL : `${RORK_HOSTED_API_BASE_URL}/api`)
  : RENDER_BACKEND_URL;

export const isCloudBackupEnabled = (): boolean => isCloudBackupEnabledByEnv();

export const isRenderBackendAvailable = () => isCloudBackupEnabled();

const getBackendUrl = (): string => (USE_RORK_HOSTED_BACKEND ? BACKEND_API_ROOT_URL : RENDER_BACKEND_URL);

let _backendReachable: boolean | null = null;
let _lastHealthCheck = 0;
const HEALTH_CHECK_INTERVAL = 120_000;
const HEALTH_CHECK_TIMEOUT = 8_000;
let _healthCheckPromise: Promise<boolean> | null = null;

const checkBackendHealth = async (): Promise<boolean> => {
  if (!isCloudBackupEnabled()) {
    _backendReachable = false;
    _lastHealthCheck = Date.now();
    return false;
  }

  const baseUrl = getBackendUrl();

  const now = Date.now();
  if (_backendReachable !== null && now - _lastHealthCheck < HEALTH_CHECK_INTERVAL) {
    return _backendReachable;
  }

  if (_healthCheckPromise) return _healthCheckPromise;

  _healthCheckPromise = (async () => {
    try {
      const controller = new AbortController();
      const tid = setTimeout(() => controller.abort(), HEALTH_CHECK_TIMEOUT);
      const res = await fetch(`${baseUrl}/`, {
        method: "GET",
        signal: controller.signal,
        headers: { Accept: "application/json" },
      });
      clearTimeout(tid);
      _backendReachable = res.ok;
      _lastHealthCheck = Date.now();
      if (_backendReachable) {
        console.log("[tRPC] Backend health check passed:", baseUrl);
      } else {
        console.log("[tRPC] Backend returned non-ok status:", res.status, baseUrl);
      }
      return _backendReachable;
    } catch {
      _backendReachable = false;
      _lastHealthCheck = Date.now();
      console.log("[tRPC] Backend unreachable - operating in offline mode:", baseUrl);
      return false;
    } finally {
      _healthCheckPromise = null;
    }
  })();

  return _healthCheckPromise;
};

export const isBackendAvailable = (): boolean => {
  if (!isCloudBackupEnabled()) {
    return false;
  }
  if (_backendReachable === false && Date.now() - _lastHealthCheck < HEALTH_CHECK_INTERVAL) {
    return false;
  }
  return true;
};

export const isWebSyncAvailable = (): boolean => isCloudBackupEnabled();

export const isBackendReachable = async (): Promise<boolean> => {
  return checkBackendHealth();
};

export const resetBackendHealthCache = () => {
  _backendReachable = null;
  _lastHealthCheck = 0;
  _healthCheckPromise = null;
};

let _trpcClient: ReturnType<typeof trpc.createClient> | null = null;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

let _lastErrorLogTime = 0;
const ERROR_LOG_THROTTLE = 30_000;

const getRequestTimeoutMs = (url: string, options?: RequestInit): number => {
  const bodyText = typeof options?.body === "string" ? options.body : "";
  const lowerUrl = url.toLowerCase();
  const lowerBody = bodyText.toLowerCase();
  const isCertificateRequest = lowerUrl.includes("certificateexplorer") || lowerBody.includes("certificateexplorer");
  // The backend enforces its own 45s hard wall-clock budget on certificate scans
  // and always returns valid JSON before that budget expires. A 180s client
  // timeout let a single stuck request hang for 3 minutes with no feedback,
  // which is what made the download screen look permanently "stuck" on one
  // code. 60s gives ample buffer over the backend's 45s budget for network
  // latency without leaving the user staring at a frozen screen for minutes.
  return isCertificateRequest ? 60_000 : 15_000;
};

const fetchWithRetry = async (
  url: string,
  options: RequestInit | undefined,
  maxRetries = 1
): Promise<Response> => {
  let lastError: Error | null = null;

  const bodyTextForRetry = typeof options?.body === "string" ? options.body.toLowerCase() : "";
  const isCertificateRetryRequest = String(url).toLowerCase().includes("certificateexplorer") || bodyTextForRetry.includes("certificateexplorer");
  // Certificate requests already get their own group->single-code retry pass
  // in certificateBatchDownload.ts. Stacking another 2 extra transport-level
  // retries on top of that (at a 60s timeout each) could turn one failed code
  // into several minutes of silent waiting. One extra retry is enough to
  // absorb a transient network blip; anything more should fall through fast
  // so the batch downloader can move on and retry that code individually.
  const effectiveMaxRetries = isCertificateRetryRequest ? Math.max(maxRetries, 1) : maxRetries;

  for (let attempt = 0; attempt <= effectiveMaxRetries; attempt++) {
    try {
      const controller = new AbortController();
      const requestTimeoutMs = getRequestTimeoutMs(url, options);
      const timeoutId = setTimeout(() => controller.abort(), requestTimeoutMs);

      const existingSignal = options?.signal;
      if (existingSignal?.aborted) {
        clearTimeout(timeoutId);
        throw new DOMException("Request was cancelled", "AbortError");
      }

      existingSignal?.addEventListener("abort", () => {
        controller.abort();
        clearTimeout(timeoutId);
      });

      const mergedHeaders = new Headers(options?.headers as HeadersInit | undefined);
      mergedHeaders.set("Accept", "application/json");

      const response = await fetch(url, {
        method: options?.method,
        body: options?.body,
        signal: controller.signal,
        headers: mergedHeaders,
      });

      clearTimeout(timeoutId);

      if (response.status === 429) {
        const retryAfter = response.headers.get("retry-after");
        const waitTime = retryAfter
          ? parseInt(retryAfter) * 1000
          : Math.min(1000 * Math.pow(2, attempt), 30000);

        if (attempt < effectiveMaxRetries) {
          await sleep(waitTime);
          continue;
        }
      }

      const contentType = response.headers.get("content-type") ?? "";
      const isTrpcJson = String(url).includes("/trpc") || contentType.includes("application/json");
      const isCertificateRequest = String(url).toLowerCase().includes("certificateexplorer") ||
        (typeof options?.body === "string" && options.body.toLowerCase().includes("certificateexplorer"));

      // Defensive guard for intermittent mobile/CDN truncation. If a tRPC
      // response (ok or not) has a body that is not valid JSON, retry here
      // instead of letting the app show a raw JSON.parse crash (e.g.
      // "Unexpected character: N" from a proxy/hosting error page).
      if (isTrpcJson && isCertificateRequest) {
        const responseText = await response.clone().text();
        const trimmed = responseText.trim();
        const looksLikeJson = trimmed.startsWith("{") || trimmed.startsWith("[");
        if (!trimmed || trimmed === "undefined" || !looksLikeJson) {
          throw new Error("Certificate download returned an empty or non-JSON response; retrying");
        }
        if (response.ok) {
          _backendReachable = true;
          _lastHealthCheck = Date.now();
        }
        return new Response(responseText, {
          status: response.status,
          statusText: response.statusText,
          headers: response.headers,
        });
      }

      if (response.ok) {
        _backendReachable = true;
        _lastHealthCheck = Date.now();
      }

      return response;
    } catch (error) {
      lastError = error as Error;

      if (attempt < effectiveMaxRetries) {
        const waitTime = Math.min(1000 * Math.pow(2, attempt), 5000);
        await sleep(waitTime);
      }
    }
  }

  if (lastError) {
    const msg = lastError.message || "";
    if (
      msg.includes("Failed to fetch") ||
      msg.includes("Network request failed") ||
      lastError.name === "AbortError"
    ) {
      _backendReachable = false;
      _lastHealthCheck = Date.now();
    }
  }

  throw lastError || new Error("Fetch failed after retries");
};

export const getTrpcClient = () => {
  if (!_trpcClient) {
    const backendUrl = getBackendUrl();
    const trpcUrl = `${backendUrl}/trpc`;
    console.log("[tRPC] Initializing client -", USE_RORK_HOSTED_BACKEND ? "Rork-hosted backend:" : "Render backend:", backendUrl);

    _trpcClient = trpc.createClient({
      links: [
        httpLink({
          url: trpcUrl,
          transformer: superjson,
          fetch: async (url, options) => {
            try {
              const rawUrl = url as string | URL | Request;
              const urlString = typeof rawUrl === "string" ? rawUrl : rawUrl instanceof URL ? rawUrl.href : (rawUrl as Request).url;
              const response = await fetchWithRetry(urlString, options);
              return response;
            } catch (error) {
              const now = Date.now();
              if (now - _lastErrorLogTime > ERROR_LOG_THROTTLE) {
                _lastErrorLogTime = now;
                const errorMsg = error instanceof Error ? error.message : String(error);
                console.log("[tRPC] Request failed:", errorMsg, "- operating in offline mode");
              }
              throw error;
            }
          },
        }),
      ],
    });
  }
  return _trpcClient;
};

export const trpcClient = new Proxy({} as ReturnType<typeof trpc.createClient>, {
  get(target, prop) {
    return getTrpcClient()[prop as keyof ReturnType<typeof trpc.createClient>];
  },
});
