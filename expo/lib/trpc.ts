import { httpLink } from "@trpc/client";
import { createTRPCReact } from "@trpc/react-query";
import superjson from "superjson";

import type { AppRouter } from "@/backend/trpc/app-router";

export const trpc = createTRPCReact<AppRouter>();

const DEFAULT_RENDER_URL = "https://rork-easy-seas-vp1-2nep.onrender.com";

export const RENDER_BACKEND_URL =
  process.env.EXPO_PUBLIC_RENDER_BACKEND_URL?.trim() || DEFAULT_RENDER_URL;

export const isRenderBackendAvailable = () => true;

const getBackendUrl = (): string => {
  return RENDER_BACKEND_URL;
};

let _backendReachable: boolean | null = null;
let _lastHealthCheck = 0;
const HEALTH_CHECK_INTERVAL = 120_000;
const HEALTH_CHECK_TIMEOUT = 8_000;
let _healthCheckPromise: Promise<boolean> | null = null;

const checkBackendHealth = async (): Promise<boolean> => {
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
  if (_backendReachable === false && Date.now() - _lastHealthCheck < HEALTH_CHECK_INTERVAL) {
    return false;
  }
  return true;
};

export const isWebSyncAvailable = (): boolean => true;

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

const fetchWithRetry = async (
  url: string,
  options: RequestInit | undefined,
  maxRetries = 1
): Promise<Response> => {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);

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
    console.log("[tRPC] Initializing client - Render backend:", backendUrl);

    _trpcClient = trpc.createClient({
      links: [
        httpLink({
          url: `${backendUrl}/trpc`,
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
