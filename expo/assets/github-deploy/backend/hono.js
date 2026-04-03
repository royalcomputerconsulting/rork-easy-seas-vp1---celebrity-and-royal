import { trpcServer } from "@hono/trpc-server";
import { Hono } from "hono";
import { cors } from "hono/cors";

import { appRouter } from "./trpc/app-router.js";
import { createContext } from "./trpc/create-context.js";
import { getDb } from "./db.js";

const app = new Hono();

app.use("*", cors());

app.use(
  "/trpc/*",
  trpcServer({
    endpoint: "/trpc",
    router: appRouter,
    createContext,
  }),
);

app.get("/calendar-feed/:token", async (c) => {
  const token = c.req.param("token").replace(/\.ics$/, "");
  console.log("[Hono] Calendar feed request for token:", token.slice(0, 8) + "...");

  try {
    const db = await getDb();
    const results = await db.query(
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

app.get("/", (c) => {
  return c.json({ status: "Easy Seas Backend Running", message: "API is running", timestamp: Date.now() });
});

export default app;
