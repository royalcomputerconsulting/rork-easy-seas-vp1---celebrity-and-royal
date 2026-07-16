# Club Royale Value Population — Native Live Test Protocol

1. Install or run the final build without copying any previous intermediate source changes into it.
2. Open Settings and record the pre-sync Club Royale and C&A values.
3. Start Royal Caribbean / Club Royale Sync.
4. Log into the same Royal account in the embedded WebView.
5. Allow the sync to finish through Apply Sync; do not cancel during the C&A fallback window.
6. Export the final completed log.
7. Confirm the log contains:
   - authoritative Club Royale tier and points;
   - a dedicated C&A attempt using captured header names or `cookie session only`;
   - either authoritative C&A tier and points, or an explicit C&A-preservation message;
   - storage/profile readback success.
8. Return to Settings without restarting the app.
9. Confirm Club Royale immediately shows the captured tier and points.
10. Confirm C&A shows the newly captured C&A tier/points when authoritative data was returned; otherwise confirm the prior C&A values were preserved.
11. Restart the app and confirm the same values remain.
12. Verify upcoming/completed cruise and offer/sailing counts remain unchanged from the successful sync result.

Do not interpret Club Royale casino points as Crown & Anchor points. They are intentionally persisted in separate fields.
