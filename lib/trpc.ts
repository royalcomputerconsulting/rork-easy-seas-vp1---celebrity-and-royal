import { httpLink } from "@trpc/client";
import { createTRPCReact } from "@trpc/react-query";
import superjson from "superjson";

import type { AppRouter } from "@/backend/trpc/app-router";

export const trpc = createTRPCReact<AppRouter>();

const getBaseUrl = () => {
  try {
    const url = process.env.EXPO_PUBLIC_RORK_API_BASE_URL;

    if (!url) {
      console.log(
        "[tRPC] EXPO_PUBLIC_RORK_API_BASE_URL not set - backend features disabled",
      );
      return "https://fallback.local";
    }

    return url;
  } catch (e) {
    console.log('[tRPC] Error getting base URL:', e);
    return "https://fallback.local";
  }
};

let _backendDisabled = false;
let _lastErrorTime = 0;
const BACKEND_RETRY_DELAY = 60000;

export const isBackendAvailable = (): boolean => {
  const baseUrl = getBaseUrl();
  if (baseUrl === "https://fallback.local") return false;
  if (_backendDisabled && Date.now() - _lastErrorTime < BACKEND_RETRY_DELAY) {
    return false;
  }
  return true;
};

export const resetBackendState = () => {
  _backendDisabled = false;
  _lastErrorTime = 0;
};

let _trpcClient: ReturnType<typeof trpc.createClient> | null = null;

export const getTrpcClient = () => {
  if (!_trpcClient) {
    const baseUrl = getBaseUrl();
    _trpcClient = trpc.createClient({
      links: [
        httpLink({
          url: `${baseUrl}/api/trpc`,
          transformer: superjson,
          fetch: async (url, options) => {
            if (baseUrl === "https://fallback.local") {
              console.log("[tRPC] Backend not configured, skipping request");
              throw new Error("BACKEND_NOT_CONFIGURED");
            }
            
            if (_backendDisabled && Date.now() - _lastErrorTime < BACKEND_RETRY_DELAY) {
              console.log("[tRPC] Backend temporarily disabled due to previous errors");
              throw new Error("BACKEND_TEMPORARILY_DISABLED");
            }
            
            try {
              const controller = new AbortController();
              const timeoutId = setTimeout(() => controller.abort(), 30000);
              
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
              });
              
              clearTimeout(timeoutId);
              
              if (response.status === 429) {
                console.log('[tRPC] Rate limited (429), temporarily disabling backend');
                _backendDisabled = true;
                _lastErrorTime = Date.now();
                throw new Error("RATE_LIMITED");
              }
              
              if (response.status >= 500) {
                console.log('[tRPC] Server error', response.status);
                _backendDisabled = true;
                _lastErrorTime = Date.now();
                throw new Error("SERVER_ERROR");
              }
              
              _backendDisabled = false;
              return response;
            } catch (error) {
              if (error instanceof Error) {
                if (error.name === 'AbortError') {
                  console.log('[tRPC] Request aborted/timeout');
                  throw error;
                }
                if (['BACKEND_NOT_CONFIGURED', 'BACKEND_TEMPORARILY_DISABLED', 'RATE_LIMITED', 'SERVER_ERROR'].includes(error.message)) {
                  throw error;
                }
                if (error.message === 'Failed to fetch' || error.message.includes('NetworkError')) {
                  console.log('[tRPC] Network error, temporarily disabling backend');
                  _backendDisabled = true;
                  _lastErrorTime = Date.now();
                  throw new Error("NETWORK_ERROR");
                }
              }
              console.log('[tRPC] Fetch error:', error);
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
