# Easy Seas 13.0.39 — iOS Build 405

## Cold-start correction

- Crew Recognition no longer hydrates the complete account registry while the splash screen and first tab are becoming interactive.
- Root-provider crew hydration waits for initial interactions and an additional bounded delay before reading the durable registry.
- Save All continues to read the complete crew registry directly from scoped storage, so deferred UI hydration does not omit backup data.
- Crew results remain paged to at most 50 mounted cards, including the supplied 925-entry registry.

## Release identity

- App version: 13.0.39
- iOS local baseline: 405
- Android version code: 130062
- EAS remote version source and automatic build-number increment remain enabled.
