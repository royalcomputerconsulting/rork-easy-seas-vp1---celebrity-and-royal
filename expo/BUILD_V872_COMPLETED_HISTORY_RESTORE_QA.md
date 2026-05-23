# BUILD v872 — Completed History Restore QA

## Purpose
Restore the old successful completed-cruise capture behavior from before the separate Sync Completed Cruises button.

## Changes
- Royal `/guestAccounts/loyalty/history/` payloads are now processed during normal Sync Now again, not ignored.
- The same loyalty-history payload is still cached so the Sync Completed Cruises button can replay it later.
- Sync Now now probes the Royal Loyalty Programs page even when ordinary loyalty data was already captured, so the full past-cruise history payload has a chance to fire.
- Completed-history rows are merged into extracted booked cruises as `Completed` rows.
- Completed-only sync remains additive/update-only and must not replace upcoming bookings.
- Offer-row dedupe no longer includes `sourcePage`, preventing duplicate counts when the same sailing arrives from API, payload sweep, and DOM batches.

## Expected successful completed history log
- `📍 Probing Loyalty Programs page for Royal past-cruise history payload...`
- `📦 Processing captured Royal Caribbean loyalty history sailings...`
- `✅ Captured 55 completed/past cruise(s) from loyalty history sailings`
- `📊 SUMMARY: ... completed`

## Guardrails
- Future cruises are still blocked from being marked completed.
- Existing booked/upcoming cruises are preserved when using completed-only sync.
- The offer sync is not capped at 201 rows and remains dynamic.
