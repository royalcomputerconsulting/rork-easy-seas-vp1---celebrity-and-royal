# SeaPass Generator Snapshot

This folder is a rebuild pack for the current SeaPass Generator feature.

## What this feature does
- Provides an admin-only `/seapass-generator` screen.
- Renders a locked Royal Caribbean-style SeaPass shell with editable overlays.
- Lets admins edit 7 live fields: `time`, `date`, `deck`, `stateroom`, `muster`, `reservation`, `ship`.
- Shows a live preview with the exact web pass composition.
- Exports PNG and PDF on native and web.
- Uses a backend proxy route for the approved shell image when needed.

## Folder contents
- `code/` — source snapshots of the core feature files and direct supporting files.
- `snippets/` — integration snippets for routing, settings entry, backend proxy wiring, and extra feature notes.
- `CURRENT_SYSTEM_SNAPSHOT.md` — current dependencies, env usage, routes, and asset references.
- `REBUILD_GUIDE.md` — step-by-step rebuild notes.
- `DAY_AGENDA_DAILY_LUCK_SYSTEM.md` — how Day Agenda pages are generated and how the Daily Luck system works.
- `CHANGELOG_LAST_14_DAYS.md` — recent implementation/change log compiled from available project history.

## Core source of truth in the current app
- `expo/app/seapass-generator.tsx`
- `expo/components/seapass/SeaPassWebPass.tsx`
- `expo/lib/seaPassWebPass.ts`
- `expo/lib/seapassExport.ts`
- `expo/lib/seapassExport.web.ts`

## Important behavior
- The visual shell is image-based and comes from the approved screenshot source.
- Dynamic overlays only render when values differ from defaults, except `time` and `date`, which render together once either changes.
- The barcode caption is generated as `reservation-stateroom`.
- Native PNG export uses `react-native-view-shot`.
- Native PDF export uses `expo-print` and `expo-sharing`.
- Web PNG export converts SVG to canvas and downloads the PNG.
- Web PDF export opens a print dialog from generated HTML.

## Admin gating
The current screen checks `useAuth().isAdmin` before rendering the tool. The exact feature screen code is included, while auth dependency details are documented in the rebuild guide.

## Asset references
- Approved shell source image:
  - `https://pub-e001eb4506b145aa938b5d3badbff6a5.r2.dev/attachments/2odahwrylhqkr8gb1jwp4.png`
- Runtime proxy path:
  - `/api/seapass-approved-shell`
  - or `/seapass-approved-shell` if the configured API base already ends in `/api`

## Environment usage
The feature directly uses:
- `EXPO_PUBLIC_RORK_API_BASE_URL`

## Rebuild goal
If the SeaPass Generator ever needs to be recreated, everything in this folder gives the exact current implementation pattern, integration points, render/export logic, and operating notes needed to rebuild it quickly.

## Additional system coverage
This folder now also includes Day Agenda and Daily Luck implementation notes plus source snapshots for the luck pipeline, user persistence, and Day Agenda rendering flow so those systems can be reconstructed alongside SeaPass-related work.
