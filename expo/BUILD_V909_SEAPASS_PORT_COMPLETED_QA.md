# Easy Seas v909 / 9.10.15 — SeaPass Port Repair + Completed History QA

## Version
- expo.version: 9.10.15
- ios.buildNumber: 9.10.15
- android.versionCode: 9115

## SeaPass generator fix
- Port is now treated as a normal editable field, not a background/sample-copy special case.
- Removed `sampleX/sampleY` from the port erase mask. The previous sampled mask could copy the baked-in old port text into the legal paragraph, causing duplicated/stacked letters.
- The port mask now erases only the old port value line and redraws the current port value in the correct slot under the baked-in PORT label.
- Other SeaPass fields were not changed.

## Completed cruise sync check
- No hard-coded max of 54 or 57 completed cruises was added.
- The existing v9.0.8 completed-history path remains: no hard max, waits for stable Royal history hydration, and dedupes using booking/reservation-aware identity rather than ship+date only.

## Sync Now
- Sync Now offer engine was not changed in this rebuild.
