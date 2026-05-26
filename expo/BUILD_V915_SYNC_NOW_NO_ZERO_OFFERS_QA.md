# Easy Seas v915 / 9.10.21 Sync Now Validation Repair

This build keeps the completed-cruise sync code untouched.

## Fixed / changed

- `app.json` incremented to `9.10.21`; Android `versionCode` is `9121`.
- Sync Now Step 1 now treats any visible offer with 0 live/verified cruise rows as an **incomplete sync**, not a success.
- Zero-cruise visible offers are not synced as fake offer rows.
- The final summary/preview logs a hard error if a visible offer code has no rows, because every real offer must have at least one cruise.
- Step 2 Royal booking capture now reinstalls the network monitor before and after every Royal account-route navigation, matching the May 6 working behavior more closely.
- The Step 2 route surface remains the v914 restored set: legacy upcoming, my-trips, myaccount, courtesy holds, loyalty programs, and account home.

## Unchanged

- Completed-cruise sync path.
- SeaPass generator.
- Logo assets.
- The 1,145 verified Sync Now offer baseline.
