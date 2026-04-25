# Easy Seas Backend v2 — Render Deployment

## What's Fixed

### `src/store.ts`
The `resolveDataDirectory()` function had a critical bug where `directory` was referenced but never defined. It is now fixed to use `configuredDir` correctly:

```ts
// BEFORE (broken)
await fs.mkdir(directory, { recursive: true });
return directory;

// AFTER (fixed)
await fs.mkdir(configuredDir, { recursive: true });
return configuredDir;
```

### `render.yaml`
The disk is now mounted at `/mnt/data` (not `/data` which requires root). The `EASY_SEAS_DATA_DIR` env var is set to match.

---

## How to Deploy to Render

### Option A — Using render.yaml (Recommended)

1. Copy all files from this folder into the **root** of your GitHub repo (replacing existing files).
2. Make sure your `src/trpc/app-router.ts` and `src/trpc/create-context.ts` are also present.
3. Push to GitHub.
4. In Render dashboard → **New** → **Blueprint** → connect your repo. Render will auto-read `render.yaml`.

### Option B — Manual Render Service Setup

1. Push these files to GitHub.
2. In Render → **New Web Service** → connect your repo.
3. Set:
   - **Build Command:** `bun install`
   - **Start Command:** `bun run start`
4. Under **Disks** → Add Disk:
   - Name: `easy-seas-data`
   - Mount Path: `/mnt/data`
   - Size: 1 GB
5. Under **Environment Variables** → Add:
   - `EASY_SEAS_DATA_DIR` = `/mnt/data`
   - `NODE_ENV` = `production`

---

## Files You Must Copy From Your Existing Repo

These files are NOT included here (they were not shared) — copy them from your existing GitHub repo:

```
src/trpc/app-router.ts
src/trpc/create-context.ts
src/trpc/       (any other trpc route files)
```

---

## Directory Structure

```
RENDERBACKEND/
├── render.yaml              ← Render deployment config (disk at /mnt/data)
├── package.json             ← Dependencies + start script
├── tsconfig.json            ← TypeScript config
├── README.md                ← This file
└── src/
    ├── server.ts            ← Hono server entry point
    ├── store.ts             ← FIXED: database read/write (bug resolved)
    └── trpc/
        ├── app-router.ts    ← Copy from your repo
        └── create-context.ts← Copy from your repo
```

---

## Environment Variables Reference

| Variable | Value | Notes |
|---|---|---|
| `EASY_SEAS_DATA_DIR` | `/mnt/data` | Must match disk mount path |
| `NODE_ENV` | `production` | |
| `PORT` | Set by Render automatically | Do not override |
