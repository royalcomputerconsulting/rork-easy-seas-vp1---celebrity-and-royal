import { httpLink } from "@trpc/client";
import { createTRPCReact } from "@trpc/react-query";
import superjson from "superjson";

import type { AppRouter } from "@/backend/trpc/app-router";

export const trpc = createTRPCReact<AppRouter>();

const getBaseUrl = () => {
  const url = process.env.EXPO_PUBLIC_RORK_API_BASE_URL;

  if (!url) {
    console.warn(
      "EXPO_PUBLIC_RORK_API_BASE_URL not set - backend features disabled (static deployment)",
    );
    return "https://fallback.local";
  }

  return url;
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
              console.warn("Backend not available in static deployment");
              throw new Error("Backend is not available. Please use the mobile app or browser extension for this feature.");
            }
            try {
              const controller = new AbortController();
              const timeoutId = setTimeout(() => controller.abort(), 30000);
              
              const response = await fetch(url, {
                ...options,
                signal: controller.signal,
              });
              
              clearTimeout(timeoutId);
              return response;
            } catch (error) {
              console.error('[tRPC] Fetch error:', error);
              if (error instanceof Error) {
                if (error.name === 'AbortError') {
                  throw new Error('Request timed out. The server may be unavailable.');
                }
                if (error.message === 'Failed to fetch' || error.message.includes('NetworkError')) {
                  throw new Error('Unable to connect to server. Please check your internet connection or try again later.');
                }
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
