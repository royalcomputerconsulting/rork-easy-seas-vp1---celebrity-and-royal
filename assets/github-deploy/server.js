import { serve } from '@hono/node-server';
import app from './backend/hono.js';

const port = parseInt(process.env.PORT || '3000', 10);

console.log(`[Server] Starting backend on port ${port}...`);
console.log(`[Server] Environment check:`);
console.log(`  - EXPO_PUBLIC_TOOLKIT_URL: ${process.env.EXPO_PUBLIC_TOOLKIT_URL ? 'Set' : 'Missing'}`);
console.log(`  - EXPO_PUBLIC_RORK_DB_ENDPOINT: ${process.env.EXPO_PUBLIC_RORK_DB_ENDPOINT ? 'Set' : 'Missing'}`);

serve({
  fetch: app.fetch,
  port,
}, (info) => {
  console.log(`[Server] Backend running at http://localhost:${info.port}`);
  console.log(`[Server] tRPC endpoint: http://localhost:${info.port}/api/trpc`);
  console.log(`[Server] Health check: http://localhost:${info.port}/api`);
});
