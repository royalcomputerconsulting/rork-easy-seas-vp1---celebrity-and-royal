import { httpLink } from "@trpc/client";
import { createTRPCReact } from "@trpc/react-query";
import superjson from "superjson";

import type { AppRouter } from "@/backend/trpc/app-router";

export const trpc = createTRPCReact<AppRouter>();

const getBaseUrl = () => {
  const url = process.env.EXPO_PUBLIC_RORK_API_BASE_URL;

  if (!url) {
    console.log(
      "[tRPC] EXPO_PUBLIC_RORK_API_BASE_URL not set - backend features disabled",
    );
    return "https://fallback.local";
  }

  return url;
};

export const isBackendAvailable = (): boolean => {
  const baseUrl = getBaseUrl();
  if (baseUrl === "https://fallback.local") return false;
  return true;
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
            
            try {
              console.log(`[tRPC] Making request to: ${url}`);
              const controller = new AbortController();
              const timeoutId = setTimeout(() => {
                console.log('[tRPC] Request timeout after 30s');
                controller.abort();
              }, 30000);
              
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
              console.log(`[tRPC] Response: ${response.status} ${response.statusText}`);
              
              if (!response.ok) {
                const text = await response.text().catch(() => 'Could not read response');
                console.error(`[tRPC] HTTP Error ${response.status}:`, text);
              }
              
              return response;
            } catch (error) {
              const errorMsg = error instanceof Error ? error.message : String(error);
              console.error('[tRPC] Fetch error:', errorMsg);
              
              if (error instanceof DOMException && error.name === 'AbortError') {
                console.error('[tRPC] Request timed out or was aborted');
              } else if (errorMsg.includes('Network request failed') || errorMsg.includes('Failed to fetch')) {
                console.error('[tRPC] Network error - check if backend is running at:', baseUrl);
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
