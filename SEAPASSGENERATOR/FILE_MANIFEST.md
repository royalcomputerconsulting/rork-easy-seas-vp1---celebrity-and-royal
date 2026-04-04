# File Manifest

## Documentation
- `README.md` — overview of the feature pack
- `CURRENT_SYSTEM_SNAPSHOT.md` — current feature state, envs, routes, deps
- `REBUILD_GUIDE.md` — rebuild instructions
- `ARCHITECTURE.md` — runtime architecture and flow
- `NOTES.md` — extra implementation notes and snapshot details
- `DAY_AGENDA_DAILY_LUCK_SYSTEM.md` — day agenda generation + daily luck implementation details
- `CHANGELOG_LAST_14_DAYS.md` — recent implementation log compiled from available history
- `FILE_MANIFEST.md` — this manifest

## Core feature code snapshots
- `code/expo/app/seapass-generator.tsx`
- `code/expo/components/seapass/SeaPassWebPass.tsx`
- `code/expo/lib/seaPassWebPass.ts`
- `code/expo/lib/seapassExport.ts`
- `code/expo/lib/seapassExport.web.ts`

## Supporting code snapshots
- `code/expo/components/ErrorBoundary.tsx`
- `code/expo/constants/theme.ts`
- `code/expo/state/AuthProvider.tsx`
- `code/expo/lib/storage/storageKeys.ts`
- `code/expo/backend/hono.ts`
- `code/expo/app/day-agenda.tsx`
- `code/expo/lib/dailyLuck.ts`
- `code/expo/lib/date.ts`
- `code/expo/lib/dailyLuck/signs.ts`
- `code/expo/types/daily-luck.ts`
- `code/expo/state/UserProvider.tsx`
- `code/expo/components/DailyLuckReport.tsx`
- `code/expo/components/daily-luck/DailyLuckExpandedCard.tsx`
- `code/expo/constants/earthRoosterLuck2026.ts`
- `code/expo/report_export/render-backend-v2/src/trpc/app-router.ts`
- `code/expo/package.snapshot.json`
- `code/root-package.snapshot.json`
- `code/expo/tsconfig.json`
- `code/tsconfig.json`

## Integration snippets
- `snippets/route-integration.md`
- `snippets/backend-seapass-proxy.ts`
- `snippets/root-layout-seapass-screen.tsx`
- `snippets/settings-admin-entry.tsx`

## Intent
This folder captures the full SeaPass Generator implementation plus the direct support files and integration points needed to rebuild it in the current app architecture.
