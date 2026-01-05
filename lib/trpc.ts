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
              return new Response(JSON.stringify({ error: "Backend not available" }), {
                status: 503,
                headers: { "Content-Type": "application/json" },
              });
            }
            return fetch(url, options);
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
