# V12.3.5 Booked + Completed Cruise Sync Rules QA

## Purpose

This build verifies that booked/upcoming and completed/past cruise sync is safe for Main User and Second User while preserving separate loyalty identities.

## Version

- App version: 12.3.5
- iOS buildNumber: 12.3.5
- Android versionCode: 120305
- Runtime marker: `v12.3.5-booked-completed-lane-authority`

## Rules enforced

1. Booked/upcoming cruises and completed/past cruises are independent sync lanes.
2. A good active-booked capture may replace active booked Royal rows, but must not wipe completed history.
3. A good completed/history capture may replace completed Royal rows, but must not wipe active booked cruises.
4. If active booked rows are not captured, existing active booked cruises are preserved.
5. If completed/history rows are not captured, existing completed cruises are preserved.
6. Zero-booking follow-up payloads do not clear a previously captured non-zero booking payload.
7. Booked API rows are staged synchronously into `extractedBookedCruisesRef.current` before React state timing can race Review/Apply.
8. Offers, available sailings, booked cruises, and completed cruises are shared household/travel inventory.
9. Main User and Second User keep separate loyalty IDs, levels, and points.
10. Final travel inventory dedupe ignores ownerProfileId so the same reservation/history sailing cannot duplicate once per profile.

## Manual log markers to verify

A good sync should log non-zero counts when Royal provides them:

```txt
Booked/completed lane authority: active=authoritative (...), completed=authoritative (...)
Preview: [non-zero] upcoming, 0 holds
Preview: [non-zero] completed/past cruise(s) staged
Setting [non-zero] active booked cruise(s) and [non-zero] completed cruise(s) in app
```

If one lane fails to capture, it should preserve that lane:

```txt
No authoritative active booked rows captured; preserved existing active booked row(s)
No authoritative completed/history rows captured; preserved existing completed row(s)
```
