const { Hono } = require('hono');
const { serve } = require('@hono/node-server');
const { trpcServer } = require('@hono/trpc-server');
const { appRouter } = require('./backend/trpc/app-router');
const { createContext } = require('./backend/trpc/create-context');

const app = new Hono();

app.use(
  '/trpc/*',
  trpcServer({
    router: appRouter,
    createContext,
  })
);

app.get('/', (c) => c.text('Easy Seas Backend API is running'));

const port = process.env.PORT || 3000;

serve({
  fetch: app.fetch,
  port: parseInt(port),
});

console.log(`Server is running on port ${port}`);
