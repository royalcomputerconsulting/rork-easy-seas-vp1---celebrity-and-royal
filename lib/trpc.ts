import { httpLink, splitLink } from "@trpc/client";
import { createTRPCReact } from "@trpc/react-query";
import superjson from "superjson";

import type { AppRouter } from "@/backend/trpc/app-router";

export const trpc = createTRPCReact<AppRouter>();

export const RENDER_BACKEND_URL = "https://rork-easy-seas-vp1-2nep.onrender.com";

export const isRenderBackendAvailable = () => {
  return true;
};

const RENDER_ROUTED_PREFIXES = [
  'cruiseDeals.',
  'calendar.',
  'royalCaribbeanSync.',
  'example.',
];

const isRenderRoutedProcedure = (path: string): boolean => {
  return RENDER_ROUTED_PREFIXES.some(prefix => path.startsWith(prefix));
};

const getBaseUrl = () => {
  const url = process.env.EXPO_PUBLIC_RORK_API_BASE_URL;

  if (!url) {
    return "https://fallback.local";
  }

  return url;
};

let _backendReachable: boolean | null = null;
let _lastHealthCheck = 0;
const HEALTH_CHECK_INTERVAL = 120_000;
const HEALTH_CHECK_TIMEOUT = 5_000;
let _healthCheckPromise: Promise<boolean> | null = null;

const checkBackendHealth = async (): Promise<boolean> => {
  const baseUrl = getBaseUrl();
  if (baseUrl === "https://fallback.local") return false;

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
        method: 'GET',
        signal: controller.signal,
        headers: { 'Accept': 'application/json' },
      });
      clearTimeout(tid);
      _backendReachable = res.ok;
      _lastHealthCheck = Date.now();
      if (_backendReachable) {
        console.log('[tRPC] Backend health check passed');
      } else {
        console.log('[tRPC] Backend returned non-ok status:', res.status);
      }
      return _backendReachable;
    } catch {
      _backendReachable = false;
      _lastHealthCheck = Date.now();
      console.log('[tRPC] Backend unreachable - operating in offline mode');
      return false;
    } finally {
      _healthCheckPromise = null;
    }
  })();

  return _healthCheckPromise;
};

export const isBackendAvailable = (): boolean => {
  const baseUrl = getBaseUrl();
  if (baseUrl === "https://fallback.local") return false;
  if (_backendReachable === false && Date.now() - _lastHealthCheck < HEALTH_CHECK_INTERVAL) return false;
  return true;
};

export const isWebSyncAvailable = (): boolean => {
  return true;
};

export const isBackendReachable = async (): Promise<boolean> => {
  return checkBackendHealth();
};

export const resetBackendHealthCache = () => {
  _backendReachable = null;
  _lastHealthCheck = 0;
  _healthCheckPromise = null;
};

let _trpcClient: ReturnType<typeof trpc.createClient> | null = null;

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

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
      const timeoutId = setTimeout(() => controller.abort(), 10000);
      
      const existingSignal = options?.signal;
      if (existingSignal?.aborted) {
        clearTimeout(timeoutId);
        throw new DOMException('Request was cancelled', 'AbortError');
      }
      
      existingSignal?.addEventListener('abort', () => {
        controller.abort();
        clearTimeout(timeoutId);
      });
      
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
        headers: {
          ...options?.headers,
          'Accept': 'application/json',
        },
      });
      
      clearTimeout(timeoutId);
      
      if (response.status === 429) {
        const retryAfter = response.headers.get('retry-after');
        const waitTime = retryAfter ? parseInt(retryAfter) * 1000 : Math.min(1000 * Math.pow(2, attempt), 30000);
        
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
    const msg = lastError.message || '';
    if (msg.includes('Failed to fetch') || msg.includes('Network request failed') || lastError.name === 'AbortError') {
      _backendReachable = false;
      _lastHealthCheck = Date.now();
    }
  }
  
  throw lastError || new Error('Fetch failed after retries');
};

export const getTrpcClient = () => {
  if (!_trpcClient) {
    const baseUrl = getBaseUrl();
    console.log('[tRPC] Initializing client - System backend:', baseUrl, '| Render backend:', RENDER_BACKEND_URL);
    _trpcClient = trpc.createClient({
      links: [
        splitLink({
          condition: (op) => isRenderRoutedProcedure(op.path),
          true: httpLink({
            url: `${RENDER_BACKEND_URL}/trpc`,
            transformer: superjson,
            fetch: async (url, options) => {
              try {
                const response = await fetchWithRetry(url.toString(), options);
                return response;
              } catch (error) {
                const errorMsg = error instanceof Error ? error.message : String(error);
                console.log('[tRPC:Render] Request failed:', errorMsg);
                throw error;
              }
            },
          }),
          false: httpLink({
            url: `${baseUrl}/trpc`,
            transformer: superjson,
            fetch: async (url, options) => {
              if (baseUrl === "https://fallback.local") {
                throw new Error("BACKEND_NOT_CONFIGURED");
              }

              if (_backendReachable === false && Date.now() - _lastHealthCheck < HEALTH_CHECK_INTERVAL) {
                throw new Error("BACKEND_OFFLINE");
              }
              
              try {
                const response = await fetchWithRetry(url.toString(), options);
                return response;
              } catch (error) {
                const now = Date.now();
                if (now - _lastErrorLogTime > ERROR_LOG_THROTTLE) {
                  _lastErrorLogTime = now;
                  const errorMsg = error instanceof Error ? error.message : String(error);
                  console.log('[tRPC:System] Request failed:', errorMsg, '- operating in offline mode');
                }
                throw error;
              }
            },
          }),
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
