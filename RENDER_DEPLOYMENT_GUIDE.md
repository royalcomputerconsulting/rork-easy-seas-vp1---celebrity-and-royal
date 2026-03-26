# Render Deployment Guide - FIXED

## The Problem
Your build is failing because the build command references an `npmrc` file that doesn't exist.

## Solution: Update These Settings in Render

### 1. Build Command
```
npm install --legacy-peer-deps
```

### 2. Start Command
```
node server.js
```

### 3. Environment Variables (Add these in Render Dashboard)
- `EXPO_PUBLIC_RORK_DB_ENDPOINT` = (your value)
- `EXPO_PUBLIC_RORK_DB_NAMESPACE` = (your value)
- `EXPO_PUBLIC_RORK_DB_TOKEN` = (your value)
- `NODE_ENV` = `production`

## Files That Must Be in Your GitHub Repo

### 1. server.js (root directory)
```javascript
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
```

### 2. package.json - Add these scripts section:
```json
"scripts": {
  "start": "bunx rork start -p g131hcw7cxhvg2godfob0 --tunnel",
  "start-web": "bunx rork start -p g131hcw7cxhvg2godfob0 --web --tunnel",
  "lint": "expo lint",
  "backend": "node server.js"
}
```

### 3. package.json - Make sure @hono/node-server is in dependencies:
```json
"dependencies": {
  "@hono/node-server": "^1.13.7",
  "@hono/trpc-server": "^0.4.2",
  // ... rest of your dependencies
}
```

## Step-by-Step Instructions

1. **Push to GitHub:**
   - Make sure your GitHub repo has `server.js` in the root
   - Make sure package.json has the `backend` script
   - Make sure package.json has `@hono/node-server` dependency
   - Commit and push all changes

2. **Update Render Settings:**
   - Go to your Render dashboard
   - Click on your web service
   - Go to "Settings"
   - Find "Build Command" and change it to: `npm install --legacy-peer-deps`
   - Find "Start Command" and change it to: `node server.js`
   - Click "Save Changes"

3. **Deploy:**
   - Click "Manual Deploy" → "Deploy latest commit"
   - Wait for the build to complete

## How to Test
Once deployed, visit:
- `https://easy-seas.onrender.com/` - Should show "Easy Seas Backend API is running"
- `https://easy-seas.onrender.com/trpc/health` - Should respond with tRPC data

## Common Issues

**If you still get "cp: cannot stat 'npmrc'" error:**
- Your GitHub repo might have a custom build script. Check for:
  - `build.sh` file
  - Custom npm scripts in package.json
  - Remove any references to copying npmrc files

**If you get module not found errors:**
- Make sure all backend files are pushed to GitHub
- Check that the backend/ directory exists with all tRPC files
