# EasySeas Personal Certificate Optimization Engine — Execution TODO

**Approval:** APPROVED July 15, 2026  
**Starting build:** `EasySeas_V1242_Build314_CLUB_ROYALE_VALUES_PROPERLY_POPULATE_FULL_CODEBASE(2).zip`  
**Execution method:** One checkpoint at a time. Do not begin the next checkpoint until the current checkpoint has tests, hash verification, QA notes, rollback notes, and a ZIP.

## Status legend

- `[x]` completed and packaged
- `[~]` partially complete or blocked by an explicit dependency
- `[ ]` not started

---

# Checkpoint 0 — Baseline Freeze and Regression Guards

**Output:** `OPT0_BASELINE_FREEZE_AND_REGRESSION_GUARDS.zip`

- [x] Extract Build 314 into a clean working tree.
- [x] Record SHA-256 hashes for protected package/config/build files.
- [x] Run all 29 pre-existing QA scripts.
- [x] Syntax-transpile every TypeScript and TSX file.
- [x] Document that a complete project typecheck requires the dependency tree that was not included in the archive.
- [x] Lock the existing certificate point ladder in executable tests.
- [x] Lock CasinoSession field compatibility in executable tests.
- [x] Lock cruise-value-ledger behavior in executable tests.
- [x] Lock current Analytics route/card wiring in executable tests.
- [x] Prove the current chase recommendation is generic and not personalized.
- [x] Prevent UI components from importing future low-level optimizer formulas directly.
- [x] Prevent hidden known-profile and mock records from entering future optimizer training inputs.
- [x] Add disabled-by-default optimizer, live-advisor, and learning feature flags.
- [x] Preserve `legacy-static` as the recommendation authority and rollback path.
- [x] Run the expanded regression suite and verify protected hashes remain unchanged.

**Result:** Complete. All 34 final checks pass.

---

# Required Existing-Plan Data Dependencies

These data-correctness items remain prerequisites before personal model output can be labeled authoritative or high confidence.

## Royal and profile authority

- [ ] Capture and persist authoritative Club Royale fields separately from Crown & Anchor fields.
- [ ] Preserve missing C&A data as missing/preserved rather than copying Club Royale points.
- [ ] Add field-level source, authority, profile, program, and freshness metadata.
- [ ] Keep all profiles isolated and verify transactional readback.

## Carnival and cross-brand isolation

- [ ] Complete the Carnival identity/runtime repair and verified offer/sailing/history capture.
- [ ] Keep Carnival, Royal, Celebrity, and Silversea histories isolated.
- [ ] Ensure incomplete or failed sync runs never train the optimizer.

## Certificate Library foundation

- [ ] Add durable certificate document/version/sailing persistence.
- [ ] Validate and store actual PDF bytes.
- [ ] Add SHA-256 versioning and page-aware parsing.
- [ ] Replace ship/date-only deduplication with evidence-preserving fingerprints.
- [ ] Provide certificate values and source-page evidence to the optimizer.

## Cruise deletion and record quality

- [ ] Apply persistent unbooking tombstones to all optimizer inputs.
- [ ] Exclude cancelled, upcoming, duplicate, incomplete, and tombstoned cruises.
- [ ] Preserve missing values as missing rather than zero.

---

# Checkpoint 1 — Canonical Personal Casino History

**Output:** `OPT1_CANONICAL_PERSONAL_CASINO_HISTORY.zip`

- [x] Create `CasinoCruiseOutcome`, `CasinoSessionObservation`, and data-authority schemas.
- [x] Build `canonicalizeCasinoCruiseOutcome()`.
- [x] Prefer cruise closeout totals over session sums when both exist.
- [x] Preserve source, authority, confidence, and freshness per field.
- [x] Reconcile sessions to exactly one profile/program/cruise where possible.
- [x] Detect duplicates, overlapping imports, and orphan sessions.
- [x] Reconstruct certificate thresholds crossed, reached, missed, or stopped near.
- [x] Link earned certificate codes to Certificate Library evidence.
- [x] Move hidden known-profile facts into an explicit one-time reviewed migration.
- [x] Remove live optimizer reliance on known email addresses, mocks, or fallback arrays.
- [x] Calculate per-cruise and overall data-health scores.
- [x] Exclude low-quality records from high-confidence modeling.
- [x] Add tests for missing-vs-zero, closeout-vs-session authority, profile isolation, and duplicates.


**Result:** Complete and packaged. Canonical history remains non-authoritative for production recommendations until the required data dependencies and OPT-4 safety gate pass.

---

# Checkpoint 2 — Personal Certificate Value Model

**Output:** `OPT2_PERSONAL_CERTIFICATE_VALUE_MODEL.zip`

- [x] Create versioned `CertificateThresholdDefinition` records.
- [x] Create `CertificateValueSnapshot` records with source evidence.
- [x] Calculate cruise fare, taxes, fees, FreePlay, OBC, internet, drinks, dining, spa, upgrades, and itinerary value.
- [x] Calculate expected room and sailing value from eligible certificate sailings.
- [x] Calculate personal redemption probability and redeemability.
- [x] Include future bookings, overlap, expiration, restrictions, and likely use.
- [x] Preserve gross replacement value separately from realized expected value.
- [x] Backfill historical certificate values without rewriting original evidence.
- [x] Add confidence and warning rules for incomplete Certificate Library data.


**Result:** Complete and packaged. Certificate values remain non-authoritative for production recommendations until OPT-3 probability/loss models and the OPT-4 safety engine pass.

---

# Checkpoint 3 — Probability, Loss, and Target Models

**Output:** `OPT3_PERSONAL_PROBABILITY_LOSS_AND_TARGET_MODELS.zip`

- [x] Create editable profile priors for bankroll and threshold labels.
- [x] Calculate attempts, successes, failures, rates, coin-in, results, bankroll, trip length, points/day, points/session, variance, and trends per threshold.
- [x] Select comparable personal history by brand, ship, cruise length, casino opportunity, and remaining time.
- [x] Build smoothed threshold success probabilities.
- [x] Build blended actual/theoretical expected-loss estimates.
- [x] Calculate confidence based on sample size, completeness, recency, and similarity.
- [x] Automatically classify Comfortable, Primary, Stretch, Exceptional, Normally Avoid, and Unrealistic targets.
- [x] Promote or demote targets only after defined evidence thresholds are met.
- [x] Persist versioned `PersonalGamblingProfile` and `OptimizationModelSnapshot` records.


**Result:** Complete and packaged. Models remain advisory and non-authoritative until OPT-4 marginal-EV safety precedence and hard-stop gates pass.

---

# Checkpoint 4 — Marginal EV and Optimal Stopping Engine

**Output:** `OPT4_MARGINAL_EV_AND_OPTIMAL_STOPPING_ENGINE.zip`

- [x] Identify the current locked certificate and every reachable higher threshold.
- [x] Calculate additional points, coin-in, expected loss, value gain, incremental EV, ROI, downside risk, and probability of success.
- [x] Calculate risk-adjusted incremental EV.
- [x] Add hard bankroll and loss-limit gates.
- [x] Add Profit-Protected Mode without changing mathematical house edge.
- [x] Add conservative Loss Mode.
- [x] Add fatigue and deteriorating-performance protections.
- [x] Implement recommendation precedence and safety overrides.
- [x] Produce one explainable `CertificateRecommendationSnapshot` contract.
- [x] Preserve legacy API behavior behind rollback flags until parity tests pass.
- [x] Prohibit literal “risk-free” gambling claims.


**Result:** Complete and packaged. The core safety engine passes its release gate, but production UI authority remains on `legacy-static` until OPT-5 live-state persistence and later integration/parity checkpoints are complete.

---

# Checkpoint 5 — Live Casino Advisor

**Output:** `OPT5_LIVE_CASINO_ADVISOR.zip`

- [x] Create profile-scoped `LiveCasinoState` persistence.
- [x] Track current points, result, coin-in/out, time, sessions, fatigue, casino day, remaining hours, and bankroll.
- [x] Refresh recommendations on meaningful state changes.
- [x] Project end-of-cruise points and certificate probabilities.
- [x] Evaluate a controlled one-more-session scenario.
- [x] Display Stop Now, Play One More Session, Continue Until Target, Bank Your Win, Profit-Protected Push, and Do Not Chase recommendations.
- [x] Persist every recommendation and its exact inputs, formulas, model version, assumptions, and warnings.
- [x] Add stale-state and offline behavior.

---

**Result:** Complete and packaged. Live Advisor remains disabled by default until OPT-7 integration and OPT-10 release gates pass.

# Checkpoint 6 — Personal Dashboard, Analytics, and Drill-Down

**Output:** `OPT6_PERSONAL_DASHBOARD_ANALYTICS_AND_DRILLDOWN.zip`

- [x] Build the Personal Gambling Profile screen.
- [x] Show average/favorite/most-profitable/highest-EV certificates.
- [x] Show bankroll, average loss, average win, best/worst trip, current target, and accuracy.
- [x] Build threshold detail screens with complete evidence and formulas.
- [x] Add certificate history, points, probability, EV, loss, ROI, marginal value, distribution, and bankroll-efficiency graphs.
- [x] Add live recommendation drill-down.
- [x] Integrate the same saved snapshots into existing Analytics screens.
- [x] Link Certificate Library source document/version/page evidence.
- [x] Meet accessibility and large-text requirements.

---

**Result:** Complete and packaged. Saved dashboard and drill-down surfaces remain read-only until OPT-7 integration supplies unified current snapshots.

# Checkpoint 7 — Advisor, Ask My Data, and Offer Integration

**Output:** `OPT7_ADVISOR_ASK_MY_DATA_AND_OFFER_INTEGRATION.zip`

- [x] Add a structured optimization context adapter.
- [x] Support questions about targets, expected cost, success probability, why stop/continue, and historical evidence.
- [x] Require Advisor responses to distinguish facts, estimates, assumptions, and missing data.
- [x] Make Examine Offers use certificate expected realized value and future-booking fit.
- [x] Make all UI and chat surfaces consume the same recommendation snapshot.
- [x] Prevent chat prompts from overriding bankroll and safety gates.
- [x] Preserve source freshness and profile/brand isolation.

---

**Result:** Complete and packaged. All integrated surfaces consume the same saved profile-scoped bundle; production authority remains feature-flagged off.

# Checkpoint 8 — Personal Optimization Alerts

**Output:** `OPT8_PERSONAL_OPTIMIZATION_ALERTS.zip`

- [x] Alert when points exceed personal averages or a personal best becomes likely.
- [x] Alert when next-certificate incremental EV becomes positive or negative.
- [x] Alert when the current certificate becomes the optimal stopping point.
- [x] Alert when bankroll, downside, fatigue, or pace risk becomes excessive.
- [x] Deduplicate alerts by recommendation/input fingerprint.
- [x] Avoid repeated pressure to continue gambling.
- [x] Link every alert to a transparent calculation drill-down.

---

**Result:** Complete and packaged. Alerts are transition-based, deduplicated, profile-scoped, and do not repeatedly pressure continuation.

# Checkpoint 9 — Learning, Backtesting, and Accuracy

**Output:** `OPT9_LEARNING_BACKTEST_AND_ACCURACY.zip`

- [x] Finalize recommendation outcomes after each cruise.
- [x] Record actual target reached, actual cost/result, value realized, and whether the recommendation was followed.
- [x] Calculate calibration, target accuracy, stop/continue accuracy, EV error, and confidence reliability.
- [x] Backtest model versions on historical cruises without future-data leakage.
- [x] Promote more advanced models only when out-of-sample performance improves.
- [x] Retain transparent baseline models as fallback.
- [x] Prevent one jackpot, one loss, or one unusually long cruise from rapidly rewriting profile targets.
- [x] Provide reset, exclude-record, and rebuild controls.

---

**Result:** Complete and packaged. Learning remains disabled by default; candidate models require out-of-sample improvement with no safety regression.

# Checkpoint 10 — Complete QA, Native Validation, and Release

**Output:** `OPT10_COMPLETE_QA_NATIVE_VALIDATION_AND_RELEASE.zip`

- [x] Run all unit, integration, regression, UI, accessibility, and scenario tests.
- [x] Test 1,500 through 25,000-point scenarios.
- [x] Test ahead, behind, near-threshold, no-time-left, low-bankroll, incomplete-data, and fatigue cases.
- [x] Verify no component independently recalculates recommendation authority.
- [x] Verify all recommendations are profile-scoped, explainable, and reproducible.
- [x] Verify feature-flag rollback to legacy behavior.
- [x] Verify protected package/config/native/workflow hashes.
- [ ] Perform authenticated native Royal/Carnival and real-device validation.
- [x] Complete documentation, privacy review, release notes, and final archive integrity tests.
- [ ] Enable production optimizer only after all safety and parity gates pass.

**Result:** Automated release candidate complete. Production enablement remains blocked because authenticated native Royal/Carnival validation, authoritative durable Certificate Library validation, real-device validation, and production storage readback have not been performed. All optimizer flags remain false and `legacy-static` remains authoritative.

---

# Permanent Golden Rule

EasySeas must maximize **Expected Net Vacation Value**, not casino coin-in. It must never encourage additional play when the expected incremental gambling loss, downside risk, bankroll exposure, or remaining-opportunity constraints outweigh the personally realizable additional certificate value.
