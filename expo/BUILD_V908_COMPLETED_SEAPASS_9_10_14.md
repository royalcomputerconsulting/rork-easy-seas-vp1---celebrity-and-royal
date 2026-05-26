# Easy Seas v908 / 9.10.14

## Fixed

- Completed Cruises sync no longer accepts an early partially hydrated Royal history payload just because it has more than a threshold number of rows. It waits for the row count to stabilize across multiple polls and then processes every captured row.
- Removed the effective ship+date-only completed-cruise dedupe that could collapse legitimate Royal history rows and stop at 54 when 57 rows were present. Completed rows now preserve booking/reservation identity when present and otherwise include nights/itinerary/cabin/generated row identity to remove only exact duplicates.
- Patched the final Royal sync dedupe path with the same no-hard-max completed-history behavior.
- SeaPass PNG port overlay moved below the baked-in PORT label with a smaller mask so the exported PNG cannot overwrite the label.

## Not changed

- Sync Now offer engine from v907 remains in place.
- Completed-cruise sync still uses the live Royal loyalty-history/page capture flow first; stored seed rows remain only a fallback.
