import { trpcServer } from "@hono/trpc-server";
import { Hono } from "hono";
import { cors } from "hono/cors";

import { appRouter } from "./trpc/app-router";
import { createContext } from "./trpc/create-context";
import { getDb } from "./db";

// app will be mounted at /api
const app = new Hono();

// Enable CORS for all routes
app.use("*", cors());

// Mount tRPC router at /trpc
app.use(
  "/trpc/*",
  trpcServer({
    endpoint: "/api/trpc",
    router: appRouter,
    createContext,
  }),
);

// Public calendar feed endpoint - serves ICS file by token
app.get("/calendar-feed/:token", async (c) => {
  const token = c.req.param("token").replace(/\.ics$/, "");
  console.log("[Hono] Calendar feed request for token:", token.slice(0, 8) + "...");

  try {
    const db = await getDb();
    const results = await db.query<[{ icsContent: string; updatedAt: string }[]]>(
      `SELECT icsContent, updatedAt FROM calendar_feeds WHERE token = $token LIMIT 1`,
      { token }
    );

    if (!results?.[0]?.length) {
      console.log("[Hono] Calendar feed not found for token");
      return c.text("Calendar feed not found", 404);
    }

    const feed = results[0][0];
    console.log("[Hono] Serving calendar feed, length:", feed.icsContent?.length);

    return new Response(feed.icsContent, {
      status: 200,
      headers: {
        "Content-Type": "text/calendar; charset=utf-8",
        "Content-Disposition": 'inline; filename="easyseas.ics"',
        "Cache-Control": "no-cache, no-store, must-revalidate",
        "Last-Modified": new Date(feed.updatedAt).toUTCString(),
      },
    });
  } catch (error) {
    console.error("[Hono] Calendar feed error:", error);
    return c.text("Internal server error", 500);
  }
});

// Simple health check endpoint
app.get("/", (c) => {
  return c.json({ status: "ok", message: "API is running", timestamp: Date.now() });
});

export default app;
