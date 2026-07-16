# OPT-10 Native Authenticated Validation Protocol

**Status:** REQUIRED BEFORE PRODUCTION ENABLEMENT  
**Automated release-candidate validation:** Complete  
**Native authenticated validation:** Not performed in the build container

The Personal Certificate Optimization Engine must remain disabled until this protocol is completed on real authenticated devices using the intended production storage and current Royal/Carnival accounts. Automated fixtures cannot prove authenticated website behavior, native WebView behavior, production persistence, or real certificate-library completeness.

## Preconditions

- Install the independently extracted OPT-10 release candidate.
- Keep all three optimizer flags disabled.
- Back up current EasySeas data.
- Confirm the active profile before each brand test.
- Confirm a rollback build is available.
- Never include tokens, cookies, authorization headers, or private account identifiers in shared logs.

## A. Royal / Club Royale / Crown & Anchor

- [ ] Sign in through the native Royal flow.
- [ ] Run Royal sync for the selected profile.
- [ ] Confirm Club Royale tier and points are authoritative and survive restart.
- [ ] Confirm Crown & Anchor tier/points are authoritative or visibly marked preserved/not returned.
- [ ] Confirm Club Royale values never populate Crown & Anchor fields.
- [ ] Confirm offers and their attached sailings are complete or explicitly partial.
- [ ] Confirm profile switch cannot expose another profile's loyalty, offers, cruises, sessions, or optimizer snapshots.
- [ ] Confirm the optimizer consumes the same final readback values shown by Profile, Settings, Advisor, and Ask My Data.

## B. Carnival

- [ ] Sign in through the native Carnival flow.
- [ ] Confirm no `identity` runtime exception occurs.
- [ ] Confirm the personalized rate-code catalog does not shrink during the run.
- [ ] Confirm all rate codes resolve to success, authoritative empty, incomplete, failed, or cancelled.
- [ ] Confirm offer-to-sailing relationships survive restart.
- [ ] Confirm booked and completed cruises are profile-scoped and deduplicated correctly.
- [ ] Confirm missing loyalty values remain missing, true zero remains zero, and booleans never become point totals.
- [ ] Confirm Carnival data cannot populate Royal optimizer history.

## C. Certificate Library authority

- [ ] Validate actual PDF bytes are durably stored.
- [ ] Validate HTTP response type, `%PDF-` signature, size limits, final URL, and SHA-256 hash.
- [ ] Validate changed PDFs preserve prior versions.
- [ ] Validate parser output includes certificate/version/page/raw-row evidence.
- [ ] Validate same ship/date rows with different cabin, guests, trade value, FreePlay, or perks remain separate.
- [ ] Validate A and C families are not treated as interchangeable.
- [ ] Validate certificate values shown by the optimizer can be drilled to the exact stored evidence.
- [ ] Validate incomplete/failed parsing cannot be described as confirmed absence.

## D. Live Advisor and safety scenarios

Test with controlled fixture inputs before using live play:

- [ ] 120 points from next certificate with positive marginal EV.
- [ ] 2,400 points away with negative marginal EV.
- [ ] 4,000 to 6,500 with additional certificate value below expected additional loss.
- [ ] Positive result with a locked-profit floor.
- [ ] Daily hard-loss limit reached.
- [ ] Trip hard-loss limit reached.
- [ ] No remaining casino time.
- [ ] Low bankroll.
- [ ] Stale data.
- [ ] Missing certificate value evidence.
- [ ] High fatigue and deteriorating points-per-hour pace.

For every case:

- [ ] Advisor, Ask My Data, alerts, dashboard, and drill-down show the same recommendation ID.
- [ ] Facts, estimates, assumptions, missing data, warnings, model version, and evidence are visible.
- [ ] No wording describes continued gambling as risk-free.
- [ ] Chat cannot override hard safety gates.

## E. Transaction and restart validation

- [ ] Save a live state and recommendation.
- [ ] Force-close and restart the app.
- [ ] Confirm exact owner/profile, recommendation ID, model version, source freshness, and warnings read back.
- [ ] Simulate a failed write and confirm prior state remains intact.
- [ ] Switch profiles and confirm no cross-profile state.
- [ ] Delete/reset learning records and confirm readback.
- [ ] Confirm tombstoned/unbooked cruises remain excluded.

## F. Platform validation

### iOS

- [ ] Native build installs and launches.
- [ ] Authentication, WebViews, storage, keyboard, scrolling, deep links, and screen restoration work.
- [ ] VoiceOver labels and large-text layouts are usable.
- [ ] Background/foreground transitions do not duplicate recommendations or alerts.

### Android

- [ ] Native build installs and launches.
- [ ] Authentication, WebViews, storage, keyboard, scrolling, deep links, and screen restoration work.
- [ ] TalkBack labels and large-text layouts are usable.
- [ ] Background/foreground transitions do not duplicate recommendations or alerts.

## G. Production enablement decision

Production may be enabled only when every required item above is checked, the production readback gate passes, and the release-gate snapshot reports `release-ready`.

- [ ] `personalCertificateOptimizerEnabled`
- [ ] `personalCertificateOptimizerLiveAdvisorEnabled`
- [ ] `personalCertificateOptimizerLearningEnabled` only after additional outcome/backtest evidence

Any failure returns authority to `legacy-static` and disables all optimizer flags.
