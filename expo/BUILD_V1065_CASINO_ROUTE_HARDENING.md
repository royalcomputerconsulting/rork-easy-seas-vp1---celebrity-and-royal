# v1065 Casino Route Hardening

## Purpose

Fix the app-closing crash reported when opening the Casino/Analytics page after v1064.

## What changed

- Added a root-level Analytics error boundary that wraps the whole analytics screen content before any casino hooks/card trees render.
- Kept the section-level Casino tab boundary from v1064.
- Added try/catch fallbacks around high-risk casino analytics builders:
  - raw session analytics
  - Host View profile
  - cruise economics summary
  - casino tab data flow
  - derived analytics sessions
  - casino value attribution summary
  - session analytics display summary
- Kept the Colorful Charts & Progression Levels sections.
- Bumped version to 9.11.55 / 91155.

## Diagnostic note

The uploaded diagnostic logs did not include a JavaScript stack trace for the casino page. They showed RevenueCat StoreKit warnings and repeated loyalty calculations, plus casino economics calculations completing. The route was still hardened at the root and calculation layers so an uncaught render/calculation issue cannot close the app when entering the Casino page.
