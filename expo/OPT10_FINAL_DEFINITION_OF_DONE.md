# OPT-10 Final Definition of Done

## Automated implementation and QA

- [x] OPT-0 through OPT-9 checkpoint code is present.
- [x] Complete executable regression suite passes.
- [x] 1,500, 2,000, 4,000, 6,500, 9,000, 15,000, and 25,000-point evidence is covered.
- [x] Negative marginal-EV, positive protected-profit, hard-stop, fatigue, missing-data, deterministic, and profile-mismatch scenarios pass.
- [x] TypeScript/TSX syntax scan passes.
- [x] Accessibility/source-boundary static audit passes.
- [x] Profile-scoped backend persistence boundary exists.
- [x] Release-gated recommendation authority exists.
- [x] Feature flags remain disabled when release prerequisites are blocked.
- [x] Protected-file hashes match the prior checkpoint.
- [x] App Store version guard passes.
- [x] Privacy, rollback, release, and native-validation documentation exists.
- [x] Release archive independently extracts and retests.

## External production gates

- [ ] Authenticated Royal native validation passes.
- [ ] Authenticated Carnival native validation passes.
- [ ] Durable/versioned/page-attributed Certificate Library is validated as authoritative.
- [ ] iOS real-device protocol passes.
- [ ] Android real-device protocol passes.
- [ ] Production storage transaction/readback protocol passes.
- [ ] Safety/parity sign-off is recorded.
- [ ] Main optimizer flag is enabled.
- [ ] Live Advisor flag is enabled.
- [ ] Learning flag is enabled only after sufficient real recommendation outcomes and backtests.

## Decision

The code is an **automated release candidate**, not a production-enabled optimizer. It is complete through the available static and executable build environment. Production enablement remains correctly blocked by the unperformed external gates above.
