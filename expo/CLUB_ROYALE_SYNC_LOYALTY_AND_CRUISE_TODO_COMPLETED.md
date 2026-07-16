# Club Royale Loyalty and Cruise Completeness TODO — Completed

- [x] Map current Club Royale casino API fields, including `individualPoints = 20,941`.
- [x] Keep Club Royale and Crown & Anchor values in separate authority lanes.
- [x] Attempt the dedicated Crown & Anchor endpoint even after casino/history data is captured.
- [x] Prevent navigation from killing the direct loyalty retry timer.
- [x] Persist and verify Club Royale ID, tier, points, relationship points, and evaluation dates.
- [x] Persist and verify C&A ID, tier, points, and relationship points only when individually authoritative.
- [x] Refresh Settings/Profile immediately from verified scoped storage.
- [x] Preserve all same-date bookings that have different reservations, cabins, guests, or payload identities.
- [x] Prevent generated placeholder IDs from masquerading as reservation numbers.
- [x] Make the confirmed cruise manifest a non-destructive overlay.
- [x] Preserve the 12-upcoming/60-completed regression fixture through preview, apply, storage, and restart hydration.
- [x] Preserve all 1,467 offer-to-sailing relationships in the supplied-log regression fixture.
- [x] Remove account-specific mock cruise and hard-coded loyalty injection from production hydration/display.
- [x] Add transactional Apply Sync readback and rollback protection.
- [x] Keep all existing package/config files unchanged.
- [x] Pass all legacy Royal, Celebrity, certificate, app-version, and Carnival regression tests.
- [x] Pass full-project TypeScript/TSX syntax validation.
- [x] Produce native authenticated live-test instructions.
