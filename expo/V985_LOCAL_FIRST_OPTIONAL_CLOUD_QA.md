# Easy Seas v985 — Local-First Optional Cloud QA

Build: 9.10.85 / engine v9.8.5-local-first-optional-cloud

## Purpose
Make Easy Seas self-contained by default. The Render/onrender backend is now optional and is no longer used during normal startup, normal local data loading, Royal/Celebrity Sync Now, slot tab loading, or post-apply local persistence.

## Completed changes

- Local-first mode is the default.
- Render backend health checks return disabled/offline unless `EXPO_PUBLIC_EASYSEAS_CLOUD_BACKUP_ENABLED=true` is explicitly set.
- UserDataSyncProvider no longer performs automatic cloud restore or automatic cloud backup in default mode.
- CoreDataProvider no longer loads from backend on startup in default mode.
- CoreDataProvider no longer flushes merged cruise data to backend in default mode.
- AuthProvider no longer calls the remote whitelist endpoint in default mode; it uses the local whitelist cache and admin defaults.
- Slot machine shared-library cloud fetch/save is skipped in default mode; bundled and local machines remain available.
- Settings diagnostic now reports `dataMode: local-first-self-contained` when cloud backup is off.
- Optional cloud backup can still be re-enabled by environment configuration with `EXPO_PUBLIC_EASYSEAS_CLOUD_BACKUP_ENABLED=true`.

## Expected behavior

1. App starts without waiting on Render/onrender.
2. No cloud restore screen should block startup in normal use.
3. Royal/Celebrity Sync Now still works because it uses the in-app WebView and Royal/Celebrity payload capture.
4. Apply Selected Sync writes local storage as source of truth.
5. Existing import/export/backup files still work.
6. Slots tab loads without backend calls.
7. Settings diagnostic shows version 9.10.85 and `dataMode: local-first-self-contained`.

## Syntax QA

- TypeScript parser checked 396 TS/TSX/JS/JSX files.
- Syntax diagnostics: 0.
