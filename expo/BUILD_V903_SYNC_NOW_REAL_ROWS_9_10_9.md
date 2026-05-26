# Easy Seas v903 / 9.10.9 Sync Now Real Rows Repair

Based on the v902 full codebase. This patch targets the exact v902 log failure:

- Step 1 clicked the real View Sailings buttons but captured one placeholder row per offer.
- Royal's modal/table text appears as concatenated strings like `View detailsShip nameJewel of the Seas - 06/12/2026`.
- The old parser required line-based ship/date windows, so real rows were missed and then excluded as empty.
- Offer codes were over-captured as `26BCP105E` / `26JUL104O` because Royal concatenated the code with `Exterior` / `Oceanview`.
- Step 2 still logged `window.capturedPayloads: MISSING`.

Fixes:

1. Added a direct concatenated ship/date parser for Royal View Sailings modal/table text.
2. Added month-name date parsing to normalize sail dates consistently.
3. Normalized concatenated offer codes so `26BCP105E` becomes `26BCP105` and `26JUL104O` becomes `26JUL104`, while preserving real trailing codes like `26WCR403B`.
4. Step 2 now initializes `window.capturedPayloads` before checks and attempts same-origin performance-entry refetch of Royal booking endpoints if the monitor missed early calls.
5. App version bumped to 9.10.9 / android versionCode 9109.

Untouched:

- Completed-cruise sync path.
- Logo/header changes.
- Existing data-preservation safeguards.
