import { trpcServer } from "@hono/trpc-server";
import { Hono } from "hono";
import { cors } from "hono/cors";

import { appRouter } from "./trpc/app-router";
import { createContext } from "./trpc/create-context";
import { getDb } from "./db";

// app will be mounted at /api
const app = new Hono();

const AGENT_SEA_RESPONSES_URL = 'https://api.openai.com/v1/responses';
const AGENT_SEA_RATE_WINDOW_MS = 5 * 60 * 1000;
const AGENT_SEA_RATE_LIMIT = 20;
const agentSeaRateWindows = new Map<string, { startedAt: number; count: number }>();

function normalizeEmail(value: unknown): string {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

function getAgentSeaOwnerEmails(): Set<string> {
  const configured = (process.env.AGENT_SEA_OWNER_EMAILS || process.env.AGENT_SEA_OWNER_EMAIL || '')
    .split(',')
    .map((value) => normalizeEmail(value))
    .filter((value) => value.includes('@'));
  return new Set(configured.length > 0 ? configured : ['scott.merlis1@gmail.com']);
}

function readAgentSeaText(payload: unknown): string {
  if (!payload || typeof payload !== 'object') return '';
  const record = payload as Record<string, unknown>;
  if (typeof record.output_text === 'string') return record.output_text.trim();
  if (!Array.isArray(record.output)) return '';
  return record.output.flatMap((item) => {
    if (!item || typeof item !== 'object' || !Array.isArray((item as Record<string, unknown>).content)) return [];
    return ((item as Record<string, unknown>).content as unknown[]).flatMap((content) => {
      if (!content || typeof content !== 'object') return [];
      const text = (content as Record<string, unknown>).text;
      return typeof text === 'string' && text.trim() ? [text.trim()] : [];
    });
  }).join('\n\n');
}

function agentSeaRateLimitKey(request: Request, email: string): string {
  const forwarded = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  return `${forwarded || 'unknown'}:${email}`;
}

function consumeAgentSeaRateLimit(key: string): boolean {
  const now = Date.now();
  const current = agentSeaRateWindows.get(key);
  if (!current || now - current.startedAt >= AGENT_SEA_RATE_WINDOW_MS) {
    agentSeaRateWindows.set(key, { startedAt: now, count: 1 });
    return true;
  }
  if (current.count >= AGENT_SEA_RATE_LIMIT) return false;
  current.count += 1;
  return true;
}

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

// Owner-only Agent SEA proxy. The OpenAI credential is read exclusively from
// the server environment and is never returned to, logged by, or bundled with
// the mobile application. Deterministic calculations still run on-device; this
// endpoint receives only the bounded evidence manifest assembled for one turn.
app.post('/agent-sea/respond', async (c) => {
  const contentLength = Number(c.req.header('content-length') || 0);
  if (contentLength > 80_000) return c.json({ error: 'Agent SEA request is too large.' }, 413);

  const body = await c.req.json().catch(() => null) as {
    authenticatedEmail?: unknown;
    model?: unknown;
    instructions?: unknown;
    input?: unknown;
  } | null;
  const authenticatedEmail = normalizeEmail(body?.authenticatedEmail);
  if (!authenticatedEmail || !getAgentSeaOwnerEmails().has(authenticatedEmail)) {
    return c.json({ error: 'Built-in Agent SEA AI is not available for this account.' }, 403);
  }

  const instructions = typeof body?.instructions === 'string' ? body.instructions.trim() : '';
  const input = typeof body?.input === 'string' ? body.input.trim() : '';
  if (!instructions || !input || instructions.length > 12_500 || input.length > 55_000) {
    return c.json({ error: 'Agent SEA request is missing or exceeds its bounded evidence limit.' }, 400);
  }

  const rateKey = agentSeaRateLimitKey(c.req.raw, authenticatedEmail);
  if (!consumeAgentSeaRateLimit(rateKey)) {
    return c.json({ error: 'Agent SEA is receiving too many requests. Please wait a few minutes and try again.' }, 429);
  }

  const apiKey = (process.env.AGENT_SEA_OPENAI_API_KEY || process.env.OPENAI_API_KEY || '').trim();
  if (!apiKey) return c.json({ error: 'Built-in Agent SEA AI is not configured on the server.' }, 503);

  const defaultModel = (process.env.AGENT_SEA_MODEL || 'gpt-5.5').trim();
  const requestedModel = typeof body?.model === 'string' ? body.model.trim() : '';
  const allowedModels = new Set((process.env.AGENT_SEA_ALLOWED_MODELS || defaultModel)
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean));
  const model = allowedModels.has(requestedModel) ? requestedModel : defaultModel;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 42_000);
  try {
    const response = await fetch(AGENT_SEA_RESPONSES_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        instructions,
        input,
        reasoning: { effort: 'medium' },
        text: { verbosity: 'low' },
        max_output_tokens: 900,
        store: false,
      }),
      signal: controller.signal,
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      console.warn('[Agent SEA Proxy] Provider request failed', { status: response.status, requestId: response.headers.get('x-request-id') || undefined });
      return c.json({ error: 'The AI provider could not complete this request.', model }, 502);
    }
    const text = readAgentSeaText(payload);
    if (!text) return c.json({ error: 'The AI provider returned no answer text.', model }, 502);
    return c.json({ text, model });
  } catch (error) {
    console.warn('[Agent SEA Proxy] Request failed', { kind: error instanceof Error ? error.name : 'unknown' });
    return c.json({ error: error instanceof Error && error.name === 'AbortError' ? 'The AI request timed out.' : 'The AI request could not be completed.', model }, 502);
  } finally {
    clearTimeout(timeout);
  }
});

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
