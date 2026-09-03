# Easy Seas Build 445 Performance Baseline

Measured September 1, 2026 on the local release workspace. These are application-computation timings measured inside the maintained runtime tests. Browser-control round-trip latency is intentionally excluded because it is not an application timing.

| Workload | Result | Release budget | Evidence |
| --- | ---: | ---: | --- |
| Back-to-back analysis, 2,500 cruise rows | 89 ms | < 1,500 ms | `tests/build374_tab_responsiveness_regression.js` |
| Canonical cruise inventory reconciliation, 250,000 raw rows / 62,500 physical sailings / 250,000 eligibility rows | 229 ms | maintained scale gate | `tests/build394_cruise_inventory_scale_regression.js` |
| Offers interaction scoring, 13 offers / 3,151 sailings | 24 ms | < 1,000 ms | `tests/build442_ios_offers_interaction_regression.js` |
| Slots filtering, 20,001 rows | 4.1 ms | < 500 ms | `tests/build444_casino_slots_acceptance_runtime.js` |
| Encrypted backup/restore, 4,234 records | 547 ms | < 60,000 ms with UI yields | `tests/build439_large_encrypted_backup_runtime_regression.js` |

## Screen responsiveness protections

- Cold-start data hydration is instrumented as `CoreDataProvider.startupHydration`.
- Cruise catalog initialization, count, facets, query, offer-sailing query, and offer summary query have independent performance spans.
- Offers, Cruises, Settings, and Agent SEA defer or paginate high-volume work rather than mounting full collections.
- Agent SEA renders the chat shell before building its data manifest.
- Settings obtains indexed database counts instead of loading all records into the screen.
- Certificate lists and cruise catalogs use bounded/virtualized presentation; more than 20 sailings are not mounted as an unbounded card stack.

## Interpretation

These results establish that the data work behind the reported slow routes is well below the interaction budgets. They do not substitute for the final physical-iPhone transition audit. A real-device audit must still record cold and warm navigation for Offers, Cruises, Booked, Calendar, Casino, Slots, Settings, offer detail, certificate examiner, cruise detail, and Agent SEA before TestFlight sign-off.
