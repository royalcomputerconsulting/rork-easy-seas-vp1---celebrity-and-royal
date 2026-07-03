# EasySeas v1070 — Casino Portfolio Dashboard Rebuild

## Scope
This build rebuilds only the first Casino section: **Casino Portfolio**.

The other three sections remain stable lightweight placeholders so the redesign can be tested one tab at a time.

## What changed
- Reworked `app/(tabs)/analytics.tsx` into a dashboard shell with four section buttons:
  - Casino Portfolio
  - Cruise Value
  - Casino Action Center
  - History & Simulator
- Fully rebuilt the Casino Portfolio tab to match the provided clean Royal-style dashboard theme.
- Kept the v1069 native crash mitigation approach:
  - no legacy heavy Casino analytics import
  - no `expo-linear-gradient`
  - no direct `.split()` calls in the Casino route
  - capped cruise and ship rows
  - simple React Native views only

## Casino Portfolio sections now displayed
1. Header / top of page
2. Club Royale KPI card
3. Signature retain progress
4. Masters progress
5. Crown & Anchor loyalty data
6. Historical casino points
7. Completed cruise sailings
8. Colorful charts and progression levels
9. Data coverage
10. Ship casino performance
11. Data integrity

## QA
- `node scripts/testV1070CasinoPortfolioDashboard.js`
- TypeScript single-file check was attempted; this container does not include node_modules, so module-resolution errors for React/Expo aliases are expected. No v1070-specific TypeScript errors remained after fixing local prop typing.
