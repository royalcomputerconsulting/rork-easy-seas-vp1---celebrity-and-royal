# Build v920 / 9.10.26 — Adaptive Sync Now Timing + SeaPass Neutral Port Mask

## Version
- expo.version: 9.10.26
- ios.buildNumber: 9.10.26
- android.versionCode: 9126

## Sync Now timing changes
- Kept the live-only Sync Now architecture from v919.
- Tuned Step 2 to use adaptive waits instead of short fixed waits.
- Each Royal trigger route now has:
  - minimum hydration wait,
  - idle timeout if no payload progress arrives,
  - hard max per route.
- Step 2 logs the v9.2.0 marker:
  - `Sync Now Step 2 capture engine v9.2.0 active: adaptive live payload sweep; smart waits; no repeated DOM extractor loop; no CSV fallback`
- No verified CSV / provider baseline fallback was reintroduced.

## SeaPass fix
- Port mask now uses the same neutral off-white field background tone instead of a bright visible white patch.
- Port mask remains local-only and does not sample the source shell, preventing old baked-in port text from being copied into the legal paragraph.
- Completed cruises sync was not modified.

## QA performed
- app.json parsed successfully.
- Confirmed no `royalOffersQaBaseline` references in live Royal sync code.
- Confirmed adaptive wait markers are present and old `page.waitMs` route waits are removed.
- Extracted and syntax-checked STEP1_OFFERS_SCRIPT with `node --check`.
