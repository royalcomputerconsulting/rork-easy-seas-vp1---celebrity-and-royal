# Easy Seas v969 / 9.10.69 — Brand Logo + Celebrity Blue Chip Isolation Fix

Base: v968 authoritative apply/dedupe build.

Preserved from recent builds:
- RN-orchestrated Royal offer queue that captured 5 offers / 1,073 rows.
- Authoritative replace-not-append apply behavior for full offer catalogs.
- Large catalog backend-sync suppression and price/lifecycle guards.
- Cruise detail fallback routing and diagnostics.
- Section-by-section review/apply flow.
- Completed-cruise parser and source breakdown.

Branding carried forward:
- Added `assets/images/easyseas-scott-astin-logo.jpeg` from the supplied Scott Astin / Easy Seas artwork.
- Landing page, splash, and compact hero now reference the supplied artwork.

Celebrity / Blue Chip fixes:
- Celebrity sync status text now says Blue Chip Club offers instead of Club Royale offers.
- Cross-brand Royal loyalty payloads are ignored during Celebrity sync.
- Celebrity sync filters extended loyalty to Captain’s Club / Blue Chip / Venetian Society fields and prevents Club Royale / Crown & Anchor overwrites.
- Royal loyalty sections are hidden from the Celebrity sync review/success UI.
- Celebrity loyalty sections are hidden from Royal sync review/success UI.
- Celebrity completed-history payloads are given a wait window before building review/apply, so completed cruises can be included rather than arriving after apply.
- Celebrity offer/available-cruise apply is brand-scoped and authoritative for Celebrity-owned rows, not appended into Royal/global rows.
- Added Celebrity ship-code fallback map, including BY → Celebrity Beyond, to prevent “BY of the Seas.”
