# V993 List-Click Offer Continuation QA

Purpose: Fix Club Royale sync runs where the first offer scrapes correctly, but subsequent current visible offers return 0 rows when opened by direct saved detail URL.

Changes:
- Every offer after the first returns to My Offers and is opened by pressing the live View Sailings button.
- Direct detail URL is no longer the primary continuation path.
- Empty known-target offers retry through the live My Offers button instead of repeatedly reloading the same shell URL.
- If an offer still returns 0 rows after live-button retries, Step 1 fails safe and preserves the existing Easy Seas offer database.
- Preserves v992 itinerary trust guard, v991 backup restore, v990 first-run retry, v989 friendly logs, and profile isolation fixes.

Expected behavior:
- Found offer cards should be opened one-by-one from My Offers.
- 26AUG104, 2606C08, and other current visible offers should no longer be scraped as 0 simply because direct URL continuation loaded a shell page.
- Review should not show 0 offers when Royal actually produced a complete current catalog.
