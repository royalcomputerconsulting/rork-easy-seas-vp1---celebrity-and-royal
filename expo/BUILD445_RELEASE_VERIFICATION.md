# Easy Seas 13.0.74 (445) release verification

Verified on September 1, 2026 from `EASYSEAS_EXPO_V13.0.74_BUILD445_WORKSPACE`.

## Release identity

- Marketing version: 13.0.74
- Local iOS build baseline: 445
- Android version code: 130107
- EAS production build-number source: remote with automatic increment enabled
- Preserved rollback baseline: Build 444, unchanged outside this workspace

## Gates passed

- Every focused Build 445 Item 1–45 regression plus the combined sync/import/offer-detail blocker gate passed.
- Agent SEA typed intelligence runtime passed separately.
- TypeScript passed with `npx tsc --noEmit`.
- The release source verifier scanned 711 TypeScript/TSX files successfully.
- Maintained suite: 219 passed, 47 intentionally skipped historical-version or unavailable private-fixture checks, 0 failed, 266 total.
- Supplied files: 2,690 current offer-sailing rows across 4 offer codes, 776 crew rows, 33 completed-cruise rows plus three total rows, and two large backups parsed successfully.
- The retained 13-offer/3,151-sailing acceptance fixture passed without collapsing option rows.
- Expo Doctor: 18/18 checks passed.
- App Store identity/version check passed for Easy Seas 13.0.74 (445).
- Fresh production-mode iOS Metro bundle passed: 3,825 modules and 33 copied assets; generated output was 42 MB under `/tmp/easyseas-build445-ios-bundle-final`.
- The seven-tab and critical nested-workflow rendered audit is recorded in `BUILD445_RENDERED_INTERACTION_AUDIT.md`.

## Deliberate acceptance boundary

The user explicitly directed that the restored full iOS simulator/device verification requirement not be performed. No simulator, physical-device, authenticated Royal/Celebrity/Carnival session, TestFlight upload, or App Store submission is claimed here. The iOS production JavaScript/assets bundle is verified; a signed IPA still requires the user’s Apple/EAS credentials and remote build service.

## Package verification

The final source ZIP excludes `node_modules`, Expo caches, logs, prior archives, and generated build output. It includes source, assets, package manifests, tests, release evidence, and build configuration. The archive is tested with `unzip -t`, extracted into a new temporary directory, and the extracted copy must pass App Store identity plus focused Build 445 regressions before delivery. The published SHA-256 sidecar is the authority for the final byte-for-byte package.
