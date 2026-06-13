# V988 Sync Catalog Dedupe + Profile-Safe Build QA

Version: 9.10.88 / 91088
Engine: v9.8.8-sync-catalog-dedupe-profile-safe

## Fixes
- Accepts large Royal live catalogs even when timeout guard fires after valid rows were captured.
- Stops throwing away 8-offer / 5,333-row staged captures as zero-offer review data.
- Normalizes Royal display-only trailing-E offer codes to base codes using detail URL/path identity.
- Adds latest verified offer-row caps from the uploaded offers CSV comparison: 2606C05=1038, 2605C03A=846, 2606C08=144, 26WCR403=55, 26AUG104=33, 26SIG0804=4.
- Reduces raw DOM text stored in WebView session staging to avoid sessionStorage overflow.
- Keeps Christie as an independent app user: no Scott/known-profile fallback unless authenticated email is a known Scott admin profile.
- First-time production users start empty/local-first instead of getting sample/demo booked cruises by default.
- Removes Bun unsupported nested overrides warning by flattening package overrides.

## QA Targets
1. Settings diagnostic shows 9.10.88.
2. `bun install` no longer reports nested overrides warning.
3. Royal sync with current page should show the current visible catalog on Apply Selected Sync, not 0 offers.
4. Apply Selected Sync should show 57 completed Royal cruises.
5. Christie or any non-Scott user should not inherit Scott C&A, Club Royale, booked, completed, or offer data.
6. Slots tab should still open without crashing.
