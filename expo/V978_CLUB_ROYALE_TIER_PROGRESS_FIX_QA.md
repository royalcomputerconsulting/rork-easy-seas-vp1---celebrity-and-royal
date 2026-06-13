# V978 Club Royale Tier Progress Fix QA

Version: 9.10.78
Engine marker: v9.7.8-club-royale-tier-progress-fix

## Issue fixed
The Settings > User Profile Royal Caribbean card could display synced Club Royale casino points from the API, but calculate "Casino Points to Next" from stale locally stored points. This produced wrong values such as 18,341 away when the visible synced points were 14,078.

## Implementation notes
- Club Royale progress now uses the same authoritative point value shown in the Casino Points card: synced API points when available, otherwise local profile points.
- Club Royale thresholds were normalized to exact tier thresholds:
  - Prime: 2,500
  - Signature: 25,000
  - Masters: 100,000
- Next Club Royale Tier color now comes from the target tier, not the current tier.
- Related helper constants in agent/anomaly/type layers were updated to the same threshold values.

## Expected result for screenshot scenario
- Casino Points: 14,078
- Next Club Royale Tier: Signature
- Casino Points to Next: 10,922

## QA performed
- TypeScript/JS syntax pass across 394 TS/TSX/JS/JSX files.
- Syntax diagnostics: 0.
