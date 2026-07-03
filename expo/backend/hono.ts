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

// SeaPass approved shell image proxy - avoids CORS issues on web
app.get("/seapass-approved-shell", async (c) => {
  const SOURCE_URL = 'https://r2-pub.rork.com/attachments/vvcelze4prvyhmkje7pah.png';
  console.log('[Hono] Proxying SeaPass approved shell image');

  try {
    const response = await fetch(SOURCE_URL);

    if (!response.ok) {
      console.error('[Hono] Failed to fetch SeaPass shell from source:', response.status);
      return c.text('Failed to load SeaPass shell image', 502);
    }

    const buffer = await response.arrayBuffer();
    const contentType = response.headers.get('content-type') ?? 'image/png';

    return new Response(buffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=86400',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (error) {
    console.error('[Hono] SeaPass shell proxy error:', error);
    return c.text('Internal server error', 500);
  }
});

app.get("/", (c) => {
  return c.json({ status: "ok", message: "API is running", timestamp: Date.now(), version: 2 });
});

export default app;
