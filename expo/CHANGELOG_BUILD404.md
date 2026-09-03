# Easy Seas 13.0.38 — iOS Build 404

## Release blockers repaired

- Crew Recognition Save All/Load Backup now preserves the complete account-scoped registry and refreshes providers on native iOS as well as web.
- Large crew imports yield to navigation and mount only 50 result cards at once with local paging. The supplied master registry was verified at 776 source rows, 925 recognition entries, 753 unique crew identities, and 25 sailing records.
- Voyage weather now requests the documented 16-day provider horizon, retries best-match failures through NOAA GFS, accepts safe city-name geocoding matches, and explains every manual refresh result.
- Certificate Download All reports whole-library progress, visibly numbers each download, skips valid saved PDFs, retries missing files, and announces completion.
- Examine Offers now lists actual discovered/saved certificate PDFs after hydration, opens retained local files when present, and falls back to Royal's official PDF when a local archive is missing.

## Release identity

- App version: 13.0.38
- iOS local baseline: 404
- Android version code: 130061
- EAS remote version source and automatic build-number increment remain enabled.
