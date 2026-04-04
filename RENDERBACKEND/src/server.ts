import { serve } from '@hono/node-server';
import { trpcServer } from '@hono/trpc-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';

import { readDatabase } from './store.js';
import { appRouter } from './trpc/app-router.js';
import { createContext } from './trpc/create-context.js';

const port = Number.parseInt(process.env.PORT ?? '3000', 10);
const app = new Hono();

app.use('*', cors({
  origin: '*',
  allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization', 'trpc-accept'],
}));

app.use('/trpc/*', trpcServer({
  endpoint: '/trpc',
  router: appRouter,
  createContext,
}));

app.use('/api/trpc/*', trpcServer({
  endpoint: '/api/trpc',
  router: appRouter,
  createContext,
}));

app.get('/', async (context) => {
  const database = await readDatabase();
  return context.json({
    status: 'ok',
    message: 'Easy Seas backend v2 is running',
    timestamp: Date.now(),
    databaseUpdatedAt: database.updatedAt,
  });
});

app.get('/health', async (context) => {
  const database = await readDatabase();
  return context.json({
    status: 'ok',
    message: 'Easy Seas backend v2 is healthy',
    timestamp: Date.now(),
    databaseUpdatedAt: database.updatedAt,
  });
});

app.get('/api', async (context) => {
  const database = await readDatabase();
  return context.json({
    status: 'ok',
    message: 'Easy Seas backend v2 is running',
    timestamp: Date.now(),
    databaseUpdatedAt: database.updatedAt,
  });
});

app.get('/api/health', async (context) => {
  const database = await readDatabase();
  return context.json({
    status: 'ok',
    message: 'Easy Seas backend v2 is healthy',
    timestamp: Date.now(),
    databaseUpdatedAt: database.updatedAt,
  });
});

const SEA_PASS_APPROVED_SHELL_URL = 'https://pub-e001eb4506b145aa938b5d3badbff6a5.r2.dev/attachments/vvcelze4prvyhmkje7pah.png';

async function proxySeaPassApprovedShell(context: Parameters<Parameters<typeof app.get>[1]>[0]) {
  console.log('[Server] SeaPass approved shell proxy request');

  try {
    const upstream = await fetch(SEA_PASS_APPROVED_SHELL_URL);

    if (!upstream.ok) {
      console.error('[Server] SeaPass upstream fetch failed:', upstream.status);
      return context.json({ code: 'upstream_error', message: 'Unable to fetch approved SeaPass shell' }, 502);
    }

    const buffer = await upstream.arrayBuffer();
    const contentType = upstream.headers.get('content-type') ?? 'image/png';

    return new Response(buffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=86400',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[Server] SeaPass proxy error:', message);
    return context.json({ code: 'proxy_error', message }, 500);
  }
}

app.get('/seapass-approved-shell', proxySeaPassApprovedShell);
app.get('/api/seapass-approved-shell', proxySeaPassApprovedShell);

app.get('/calendar-feed/:token', async (context) => {
  const token = context.req.param('token').replace(/\.ics$/i, '');
  const database = await readDatabase();
  const feed = Object.values(database.calendarFeeds).find((record) => record.token === token) ?? null;

  console.log('[Server] Calendar feed request:', { tokenPrefix: token.slice(0, 8), found: Boolean(feed) });

  if (!feed) {
    return context.text('Calendar feed not found', 404);
  }

  return new Response(feed.icsContent, {
    status: 200,
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': 'inline; filename="easyseas.ics"',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Last-Modified': new Date(feed.updatedAt).toUTCString(),
    },
  });
});

app.get('/api/calendar-feed/:token', async (context) => {
  const token = context.req.param('token').replace(/\.ics$/i, '');
  const database = await readDatabase();
  const feed = Object.values(database.calendarFeeds).find((record) => record.token === token) ?? null;

  console.log('[Server] API calendar feed request:', { tokenPrefix: token.slice(0, 8), found: Boolean(feed) });

  if (!feed) {
    return context.text('Calendar feed not found', 404);
  }

  return new Response(feed.icsContent, {
    status: 200,
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': 'inline; filename="easyseas.ics"',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Last-Modified': new Date(feed.updatedAt).toUTCString(),
    },
  });
});

app.notFound((context) => {
  return context.json({
    group: 'api',
    code: 'not_found',
    message: 'The requested resource was not found',
  }, 404);
});

app.onError((error, context) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error('[Server] Unhandled error:', message);
  return context.json({
    group: 'api',
    code: 'server_error',
    message: 'The backend could not complete the request',
    details: message,
  }, 500);
});

console.log('[Server] Starting Easy Seas backend v2:', {
  port,
  dataDir: process.env.EASY_SEAS_DATA_DIR?.trim() || process.env.DATA_DIR?.trim() || './data',
});

serve({
  fetch: app.fetch,
  port,
}, (info) => {
  console.log('[Server] Easy Seas backend v2 running:', {
    port: info.port,
    trpc: `http://localhost:${info.port}/trpc`,
    apiTrpc: `http://localhost:${info.port}/api/trpc`,
    health: `http://localhost:${info.port}/`,
  });
});
