# Easy Seas v1074 — Casino Mobile Light Finish

Version: 9.11.64 / build 91164

## Purpose

v1074 keeps the v1073 native-crash bypass as the protected baseline and finishes the Casino tab with a phone-first, light, Royal-inspired visual layer.

## What changed

- Preserved the v1073 native diagnostic bypass:
  - no `diagnosticLogger` import in `app/(tabs)/analytics.tsx`
  - no route-level `recordDiagnosticEvent` calls
  - no route-level `recordDiagnosticError` calls
  - no native gradient import
  - no legacy full analytics screen import
  - no direct `.split(` calls in the Casino route while the Hermes split crash is being avoided
- Bumped app/package version to `9.11.64` and Android version code to `91164`.
- Converted the Casino tab shell to a phone-first layout using `useWindowDimensions` with a 720px breakpoint.
- On phone widths, the fixed left rail becomes a wrapped top tab control.
- Removed the anchor-style nav mark and replaced it with a plain `Casino` label.
- Converted the Portfolio tab from dark dashboard styling to a light Royal-inspired theme:
  - navy typography
  - blue actions
  - aqua highlights
  - gold accents
  - white cards on soft blue/white surfaces
- Protected the dense Completed Cruise Sailings table with a horizontal scroll area and fixed safe width.
- Preserved all four Casino tabs:
  - Casino Portfolio
  - Cruise Value
  - Action Center
  - History & Simulator
- Preserved v1072/v1073 drill-down modals and capped-row safety.

## QA

Run:

```bash
node scripts/testV1074CasinoMobileLightFinish.js
```

Expected result:

```text
✅ v1074 Casino mobile light finish QA checks passed
```
