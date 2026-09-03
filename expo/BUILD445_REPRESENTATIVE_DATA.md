# Build 445 representative data matrix

Recorded: 2026-09-01. This matrix identifies reproducible empty, small, and large states without copying private backup contents into source control.

| State | Reproduction | Verified coverage |
|---|---|---|
| Empty | Create/select a new owner profile with no imports | Zero-state Offers, Cruises, Booked, Calendar, Casino, Slots, Settings, and Agent SEA owner isolation |
| Small | Use the deterministic records embedded in the Build 445 runtime tests | Offers, certificate rows/documents, booked/completed cruises, sessions, loyalty, weather, machines, crew, two owners, provenance, filters, and calculations |
| Large | Load `/Users/rcg/Downloads/Easy Seas - Backup 08.02.26.json`, then the current certificate fixtures | 2,117 available cruises, 45 booked cruises, 51 offers, 354 calendar events, two users, loyalty/casino/settings domains, plus monthly certificate rows |

Additional supplied-file evidence:

- `tests/fixtures/offers-current-2026-08-27.csv`: 391 offer rows.
- `/Users/rcg/Library/Mobile Documents/com~apple~CloudDocs/completed_cruises_2025_2026.csv`: 36 completed-cruise rows.
- `/Users/rcg/Library/Mobile Documents/com~apple~CloudDocs/master_crew_registry.xlsx`: 776 crew rows.
- `assets/MACHINES_262.json`: 218 machine rows.
- `tests/fixtures/royal-monthly-index-production-fixtures.json`: current/next-month certificate source fixtures.

The maintained runtime gates parse these sources through the production import, merge, owner-scope, persistence, certificate, weather, and export functions; no UI-only mock path is accepted as proof.
