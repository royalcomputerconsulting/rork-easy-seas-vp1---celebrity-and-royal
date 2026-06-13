# Easy Seas v984 Slots Tab Crash Require Fix QA

Build: 9.10.84 / engine v9.8.4-slots-logo-require-crash-fix

## Root Cause
The Slots/Machines tab used a static React Native `require('@/assets/images/easyseas-scott-astin-logo.jpeg')` for the new Easy Seas artwork. Metro/React Native can be unreliable with TS path aliases inside static `require()` calls. This can crash a screen module at load time even though TypeScript syntax checks pass.

## Fix
Replaced all static asset requires using `@/assets/...` with relative paths:

- app/(tabs)/machines.tsx
- app/(tabs)/(overview)/index.tsx
- app/offer-details.tsx
- components/EasySeasHero.tsx
- components/LandingPage.tsx
- components/WelcomeSplash.tsx
- components/LoginScreen.tsx

## Preserved
- v983 completed sync hardening
- v982 SHADOW import fix
- v981 resilient 4-offer/5-offer sync behavior
- v980 completed history 57 reconciliation
- v979 portfolio/Pinnacle/Harmony fixes

## QA Checklist
- Diagnostic version shows 9.10.84.
- Slots tab opens without crashing.
- Slots tab shows Easy Seas artwork at top.
- Machine cards render.
- Tapping machine card opens detail.
- Offers tab still opens and shows Easy Seas artwork.
- Royal sync still stages completed/past cruises as 57.

## Static QA
- Checked 395 TS/TSX/JS/JSX files with TypeScript parser.
- Syntax diagnostics: 0.
- Verified no `require('@/assets...')` calls remain.
