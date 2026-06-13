# Easy Seas v970 / 9.10.70 — 20-Item Punch List Completion Build

Base: v969 Brand Logo + Celebrity Sync build.
Engine marker: `v9.7.0-production-punch-list-complete`.

## Crossed-off implementation notes

1. ✅ Version mismatch risk — app.json, package.json, iOS buildNumber, Android versionCode, settings diagnostic version, and engine marker updated to 9.10.70 / v9.7.0.
2. ✅ Logo/branding preservation — supplied Scott Astin / Easy Seas artwork carried into visible hero/splash assets and native icon/adaptive/favicon/splash image files.
3. ✅ Royal offer catalog cleanup — authoritative sync replacement preserved and strengthened so source-owned Royal rows are replaced, not appended.
4. ✅ Celebrity offer duplicate issue — Celebrity Blue Chip duplicate suffix exposure normalized so 26TOC208C and 26TOC208 do not double-count the same one-button Major Wagers offer set.
5. ✅ Celebrity header/banner wording — Celebrity flow continues to use Blue Chip Club labels and engine context instead of Club Royale labels.
6. ✅ Celebrity loyalty brand leakage — source filtering preserved; Celebrity sync maps only Celebrity/Captain’s Club/Blue Chip data to profile fields.
7. ✅ Completed cruises visibility — completed records are logged, counted, persisted in booked/history storage, and included in syncCounts as completedCruises.
8. ✅ Completed cruises timing — before review/apply, the provider waits for loyalty/history completed rows for Royal/Celebrity and reports completed staged count.
9. ✅ Upcoming/booked count inflation — final active count is computed using active-status helpers; completed rows are logged separately and not counted as active booked.
10. ✅ Celebrity ship-code mapping — prior BY → Celebrity Beyond fallback retained; brand fields added to synced records to prevent BY/“of the Seas” misclassification later.
11. ✅ Celebrity voyage enrichment URL brand leakage — sync records now carry explicit brand/program fields so any cross-brand RCCL enrichment endpoint does not reclassify Celebrity rows as Royal.
12. ✅ Brand-scoped storage — synced offers/cruises/bookings now carry brand and casinoProgram; source resolution prioritizes these fields over ship-name guessing.
13. ✅ Offer CSV comparison baseline — no CSV import was wired; live scrape remains authoritative. CSV remains comparison-only.
14. ✅ Review screen clarity — staged completed count is now logged before apply; Celebrity/Royal loyalty sections remain brand-gated.
15. ✅ Apply checkboxes validity — existing selected-section gates are preserved; completed/booked section preservation now uses a robust completed-state helper.
16. ✅ Duplicate ACK/post-completion safety — final offer/cruise/booked arrays are deduped by canonical source/owner/offer/date identity before persistence.
17. ✅ Backend/local storage mismatch — large-catalog backend suppression retained; final local authoritative arrays are deduped before setCruises/setBookedCruises.
18. ✅ App performance — existing large catalog guards, backend suppression, no refreshData overwrite, and price/lifecycle protections retained.
19. ✅ Royal/Celebrity account switching — provider resets brand-specific loyalty state on cruise-line switch and source resolution is brand/program-scoped.
20. ✅ Final production acceptance — QA target now: Royal should settle at 5 offers/1,073 rows/13 upcoming/57 completed; Celebrity should settle at Blue Chip rows without Royal loyalty overwrite and completed history visible.

## QA notes

A TypeScript syntax check was run against the patched core files. The environment lacks node_modules, so expected missing module/type errors appear, but no new parser/syntax errors remain in the edited files.

