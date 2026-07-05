import { httpLink, splitLink } from "@trpc/client";
import { createTRPCReact } from "@trpc/react-query";
import superjson from "superjson";

import type { AppRouter } from "@/backend/trpc/app-router";
import { isCloudBackupEnabledByEnv } from "@/lib/localFirstMode";

export const trpc = createTRPCReact<AppRouter>();

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, '');
}

// The project's backend (expo/backend/hono.ts) is automatically hosted by Rork
// at EXPO_PUBLIC_RORK_API_BASE_URL - no external deployment (e.g. Render) is needed
// or should be relied upon, since Rork manages deploying this code directly.
export const RENDER_BACKEND_URL = trimTrailingSlash(
  process.env.EXPO_PUBLIC_RORK_API_BASE_URL?.trim() || ""
);

export const isCloudBackupEnabled = (): boolean => isCloudBackupEnabledByEnv();

export const isRenderBackendAvailable = () => isCloudBackupEnabled();

const getBackendUrl = (): string => RENDER_BACKEND_URL;

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
  if (!baseUrl) {
    _backendReachable = false;
    _lastHealthCheck = Date.now();
    return false;
  }

  const now = Date.now();
  if (_backendReachable !== null && now - _lastHealthCheck < HEALTH_CHECK_INTERVAL) {
    return _backendReachable;
  }

  if (_healthCheckPromise) return _healthCheckPromise;

  _healthCheckPromise = (async () => {
    try {
      const controller = new AbortController();
      const tid = setTimeout(() => controller.abort(), HEALTH_CHECK_TIMEOUT);
      const res = await fetch(`${baseUrl}/api/`, {
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

// Certificate PDF scans hit the live royalcaribbean.com PDF server directly
// and can legitimately take much longer than a normal API call (each code is
// a real PDF download + parse, sometimes with server-side retries baked in).
// The website itself is always reachable, so we never want our own client
// timeout to be the reason a scan looks "failed" - give these calls a long
// runway and let the backend's own retry loop do the heavy lifting instead
// of racing it with a fresh request every 15s.
const CERTIFICATE_PROCEDURE_PREFIX = "certificateExplorer.";
const CERTIFICATE_FETCH_TIMEOUT_MS = 170_000;
const DEFAULT_FETCH_TIMEOUT_MS = 15000;

const fetchWithRetry = async (
  url: string,
  options: RequestInit | undefined,
  maxRetries = 2,
  timeoutMs = DEFAULT_FETCH_TIMEOUT_MS
): Promise<Response> => {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

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

        if (attempt < maxRetries) {
          await sleep(waitTime);
          continue;
        }
      }

      // 502/503/504 are almost always a transient "server at capacity" or
      // "still deploying" blip on the hosted backend, not a real client error.
      // Retry with backoff instead of surfacing a scary failure immediately.
      if (response.status === 502 || response.status === 503 || response.status === 504) {
        if (attempt < maxRetries) {
          const waitTime = Math.min(1200 * Math.pow(2, attempt), 8000);
          await sleep(waitTime);
          continue;
        }
      }

      if (response.ok) {
        _backendReachable = true;
        _lastHealthCheck = Date.now();
      }

      return response;
    } catch (error) {
      lastError = error as Error;

      if (attempt < maxRetries) {
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
    console.log("[tRPC] Initializing client - Rork-hosted backend:", backendUrl || "(unset)");

    const makeFetch = (timeoutMs: number, maxRetries: number) =>
      async (url: unknown, options: RequestInit | undefined) => {
        try {
          const rawUrl = url as string | URL | Request;
          const urlString = typeof rawUrl === "string" ? rawUrl : rawUrl instanceof URL ? rawUrl.href : (rawUrl as Request).url;
          const response = await fetchWithRetry(urlString, options, maxRetries, timeoutMs);
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
      };

    const standardLink = httpLink({
      url: `${backendUrl}/api/trpc`,
      transformer: superjson,
      fetch: makeFetch(DEFAULT_FETCH_TIMEOUT_MS, 2),
    });

    // Certificate scans get one long-lived attempt (no client-side retry -
    // restarting a slow scan from scratch just wastes time) so the backend's
    // own internal PDF retry loop has room to finish and come back with real
    // data instead of the app giving up early.
    const certificateLink = httpLink({
      url: `${backendUrl}/api/trpc`,
      transformer: superjson,
      fetch: makeFetch(CERTIFICATE_FETCH_TIMEOUT_MS, 0),
    });

    _trpcClient = trpc.createClient({
      links: [
        splitLink({
          condition: (op) => op.path.startsWith(CERTIFICATE_PROCEDURE_PREFIX),
          true: certificateLink,
          false: standardLink,
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
