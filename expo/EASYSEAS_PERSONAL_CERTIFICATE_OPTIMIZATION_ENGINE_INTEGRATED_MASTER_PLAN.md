# EasySeas Build 314 — Personal Certificate Optimization Engine
## Integrated Master Implementation Plan

**Status:** APPROVED — July 15, 2026  
**Starting codebase:** `EasySeas_V1242_Build314_CLUB_ROYALE_VALUES_PROPERLY_POPULATE_FULL_CODEBASE(2).zip`  
**Companion plans:**

- `EASYSEAS_THREE_PHASE_MASTER_PLAN_A_B_C_FOR_APPROVAL(1).md`
- `EASYSEAS_CERTIFICATE_LIBRARY_GAP_ANALYSIS_AND_TODO(2).md`

**Purpose:** Add a profile-scoped, explainable Personal Certificate Optimization Engine that learns from actual casino history and recommends the certificate target with the highest expected net vacation value—not merely the highest point threshold.

---

# 1. Executive Decision

The optimization engine should be built as a new authoritative casino-intelligence layer inside the existing EasySeas application. It should not be built as a separate app, a disconnected calculator, or a second set of duplicate formulas.

The uploaded Build 314 already contains useful foundations:

- a Royal instant-certificate point ladder;
- casino-session records with points, coin-in, coin-out, win/loss, duration, machine, RTP, volatility, theoretical loss, and expected loss fields;
- session analytics including averages, medians, variance, win rate, points per hour, and theoretical-versus-actual performance;
- cruise-level casino fields including points, coin-in, cash result, theoretical loss, bankroll-related values, certificate code, certificate value, FreePlay, OBC, internet, dining, spa, and beverage value;
- a cruise-value ledger that can separate fare value, certificate value, annual benefits, FreePlay, OBC, internet, dining, spa, taxes, cash paid, and net value;
- a basic `buildCertificateChaseRecommendation()` function;
- a `KeepPlayingDecisionCard` and `BestPlayToday` card;
- an existing Advisor screen, Ask My Data screen, Analytics screen, Certificate Wallet, and certificate lookup/code screens.

However, the existing recommendation logic is not yet a personal optimization engine. Its decision is primarily based on the number of points remaining and whether a generic parsed upgrade is present. It does not calculate personal success probability, expected gambling loss, certificate redemption value, marginal expected value, downside risk, remaining cruise opportunity, recommendation accuracy, or learning over time.

The Certificate Library work is a mandatory prerequisite. The optimizer cannot calculate trustworthy certificate value from transient PDF text and incomplete ship/date deduplication. It needs the durable, versioned, page-attributed certificate records required by the uploaded Certificate Library gap plan.

**Architectural conclusion:**

1. Finish the trustworthy casino and certificate data foundations.
2. Build a transparent statistical model before any black-box machine learning.
3. Make one optimization service the source of truth for every casino recommendation.
4. Make all UI cards, Advisor responses, Ask My Data responses, alerts, and graphs consume the same saved recommendation snapshot.
5. Optimize for expected net vacation value and downside protection, never for casino coin-in.

---

# 2. Relationship to the Existing Three-Phase Master Plan

This plan is an integrated optimization workstream, not a replacement for the uploaded three-phase plan.

## Existing Phase A dependencies

The following existing Phase A work remains release-blocking:

- Royal and Crown & Anchor field-level data authority;
- Carnival data correctness where Carnival history may appear in global analytics;
- brand/profile isolation;
- transactional storage and readback verification;
- persistent unbooking tombstones;
- Certificate Library domain models;
- validated PDF storage, hashing, and versioning;
- page-aware parsing and correct certificate-sailing deduplication.

The optimizer must not train on incomplete sync runs, preserved-but-stale values presented as current, mock records, duplicated sailings, or certificate rows collapsed by ship/date.

## Existing Phase B integration points

The following existing Phase B screens should consume optimizer output:

- Casino Advisor conversation UI;
- Ask My Data conversation UI and data adapters;
- Certificate Advisor conversation UI;
- View Offers and Examine Offers;
- Certificate Library dashboard and detail routes;
- Analytics and Casino dashboard screens.

These screens must not independently recalculate targets or copy recommendation rules into components.

## Existing Phase C integration points

The optimization engine adds requirements to:

- Admin/Data Management settings;
- alerts and notifications;
- accessibility and performance;
- automated QA;
- native authenticated validation;
- rollout, documentation, and final packaging.

---

# 3. Current Build 314 Findings

## 3.1 Reusable foundations

### Existing certificate threshold ladder

`lib/certificates/instantCertificateUrls.ts` currently includes thresholds for:

- 1,500 points;
- 2,000 points;
- 4,000 points;
- 6,500 points;
- 9,000 points;
- 15,000 points;
- 25,000 points;
- additional lower and higher certificate codes.

This ladder can seed threshold definitions, but it must become versioned, configurable, and linked to actual certificate documents. It must not remain the only authority forever.

### Existing casino session data

`state/CasinoSessionProvider.tsx` already supports many of the required fields:

- points earned;
- buy-in and cash-out;
- win/loss;
- cash coin-in and FreePlay coin-in;
- total coin-in and coin-out;
- jackpots and hand pays;
- taxes withheld;
- session duration;
- machine identity and type;
- game category;
- RTP;
- volatility;
- estimated theoretical loss;
- estimated expected loss;
- points source and earning profile.

The provider also calculates averages, medians, variance, standard deviation, streaks, points per hour, and theoretical-versus-actual results.

### Existing cruise-level economics

`BookedCruise` already contains many useful closeout fields, including:

- casino points and points earned;
- coin-in;
- buy-in and cash-out;
- winnings and cash result;
- theoretical and actual loss;
- hours and sessions played;
- instant certificate code and value;
- FreePlay, OBC, internet, dining, spa, and beverage value;
- retail value, amount paid, taxes, and net effective paid.

### Existing value ledger

The value modules already separate:

- casino-offer value;
- instant-certificate value;
- Club Royale annual cruise value;
- Crown & Anchor milestone cruise value;
- NextCruise OBC and savings;
- Signature and Masters OBC;
- FreePlay;
- VOOM internet;
- specialty dining;
- spa/salon/thermal/fitness value;
- taxes and fees;
- cash paid;
- onboard cash spend;
- total value and true net value.

This should become the underlying valuation service for certificate optimization.

## 3.2 Critical optimization deficiencies

### Current chase logic is generic

`lib/certificates/certificateChaseRecommendation.ts` currently uses point-distance rules such as:

- small points gap → light chase;
- moderate gap with parsed upgrade → worth chasing;
- large gap without upgrade → do not chase.

It does not use the player’s cruise history, bankroll, result, remaining time, threshold-specific success rate, actual loss distribution, or certificate redemption history.

### Generic casino strategies conflict with the requested philosophy

`state/CasinoStrategyProvider.tsx` contains hard-coded Conservative, Moderate, and Aggressive strategies with generic target points, bets, and play time. These cannot remain the authority for recommendations. They may remain only as optional display presets or must be retired after parity.

### Fixed Best Play Today targets are not personal

`lib/casino/bestPlayToday.ts` currently assigns default points targets based mainly on sea/port/day type. The day classification is useful, but target selection must come from the optimizer.

### No persistent optimization history

The build has no durable models for:

- threshold attempts;
- threshold successes and failures;
- recommendation snapshots;
- recommendation outcomes;
- model versions;
- calibration accuracy;
- certificate-value snapshots;
- live casino state;
- historical target labels;
- trend or confidence history.

### Certificate value evidence is not yet production-grade

The uploaded Certificate Library audit correctly identifies that current certificate fetching is transient, PDFs are not durably retained, versions are not preserved, and same ship/date rows can be destructively merged. The optimizer must not use this transient data as authoritative value evidence.

### Hard-coded personal fallback data must not train the model

The latest build contains known-profile fallback modules and hard-coded historical facts. These may be migrated once into explicit user-owned records with source labels, but they must not remain hidden production truth or silently override actual data. The optimizer may train only on profile-scoped persisted records with visible authority and confidence.

---

# 4. Non-Negotiable Optimization Rules

- [ ] Never optimize for coin-in, time played, casino theoretical, host value, or casino revenue.
- [ ] Optimize for **Expected Net Vacation Value**.
- [ ] Never describe coin-in as cost or loss.
- [ ] Never describe a winning historical streak as evidence that future gambling has positive expectation.
- [ ] Profit mode may expand the user’s chosen risk budget, but it may not alter machine RTP, expected loss rate, or mathematical house edge.
- [ ] A positive current trip result does not automatically make a negative-EV chase positive.
- [ ] Never call any gambling push literally risk-free.
- [ ] “Risk-Free Push” should be replaced in production copy by **Profit-Protected Push**, or display a warning that it is not literally risk-free.
- [ ] Never recommend exceeding the hard daily or trip bankroll limit.
- [ ] Never recommend borrowing, using bill money, increasing credit exposure, or chasing prior losses.
- [ ] Never use another user’s play history to train this profile.
- [ ] Never turn missing data into zero.
- [ ] Never merge actual, imported, calculated, inferred, preserved, and estimated values without retaining authority labels.
- [ ] Cruise-level casino closeout totals are authoritative over session sums when both exist and conflict.
- [ ] Session data is used for distribution, timing, machine, and pace analysis; it must not double-count a cruise closeout.
- [ ] Every recommendation must preserve the exact inputs, formulas, assumptions, evidence, warnings, and engine version that produced it.
- [ ] No component, chat screen, or alert may reimplement the engine’s formulas independently.
- [ ] No black-box model may replace the transparent baseline unless it demonstrably improves out-of-sample calibration and remains explainable.

---

# 5. Initial Personal Priors

The following should be saved as **editable user-provided priors**, not permanent hard-coded facts:

## Bankroll and play style

- Daily gambling risk budget: approximately **$200/day**.
- Primary objective: maximize Club Royale and vacation value.
- Primary game category: slots.
- Volatility tolerance: conservative to moderate.
- Typical behavior: stop after reaching a valuable certificate.
- Preferred outcome: certificate value rather than jackpot chasing.

## Initial threshold labels

| Threshold | Initial label | Initial interpretation |
|---:|---|---|
| 1,500 | Comfortable | Safe and usually achievable |
| 2,000 | Comfortable | Normal target |
| 4,000 | Primary Target | Current sweet spot |
| 6,500 | Stretch Goal | Recommend only with high probability and sufficient remaining opportunity |
| 9,000 | Exceptional Goal | Recommend only in unusually favorable, profit-protected conditions |
| 15,000 | Normally Avoid | Exceptional circumstance only |
| 25,000 | Unrealistic | Do not normally recommend |

## Prior handling rules

- [ ] Label each prior as `user_provided_prior`.
- [ ] Display the date it was entered.
- [ ] Do not present it as learned history.
- [ ] Reduce prior influence as complete historical samples accumulate.
- [ ] Permit manual editing without deleting learned model history.
- [ ] Keep a versioned audit trail of prior changes.
- [ ] Never silently promote or demote a target without showing the evidence.

---

# 6. Authoritative Mathematical Definitions

# 6.1 Canonical actual gambling result

Use this authority order:

1. explicit cruise closeout `netResult`, `cashResult`, or verified statement result;
2. explicit cruise winnings/loss value with clear sign convention;
3. sum of complete, nonduplicated session `winLoss` values;
4. calculated result from verified coin-out, jackpots, hand pays, cash coin-in, and taxes;
5. otherwise unknown.

Do not infer a loss from coin-in alone.

# 6.2 Canonical coin-in

Use this authority order:

1. explicit imported or statement-backed coin-in;
2. sum of complete session coin-in;
3. points multiplied by a verified point-earning rate for the correct brand/game;
4. otherwise unknown.

Calculated coin-in must retain `estimated` authority and the exact point-rate source.

# 6.3 Historical loss rate

For complete comparable records:

```text
Observed Loss Rate = max(0, Total Actual Loss / Total Coin-In)
```

A historical net win may reduce the observed loss estimate toward zero, but it must not create a negative expected loss rate.

# 6.4 Theoretical loss rate

```text
Theoretical Loss Rate = weighted median of (1 − verified RTP)
```

Fallback order:

1. verified machine/session RTP;
2. machine-family RTP estimate with confidence;
3. user-configured house-edge assumption;
4. unknown with low confidence.

# 6.5 Blended personal expected loss rate

```text
Personal Expected Loss Rate
= Data Weight × Observed Loss Rate
+ (1 − Data Weight) × Theoretical Loss Rate
```

`Data Weight` must depend on:

- number of complete comparable cruises;
- number of complete sessions;
- amount of verified coin-in;
- recency;
- same ship/game/day-type similarity;
- source authority;
- variance and outlier sensitivity.

Use robust statistics, trimmed means, medians, and confidence intervals so one jackpot or one catastrophic session does not dominate the model.

# 6.6 Expected additional gambling loss

```text
Expected Additional Loss
= Expected Additional Coin-In × Personal Expected Loss Rate
```

The engine should also calculate:

- median expected loss;
- 25th/75th percentiles;
- 10th/90th downside range;
- probability of exceeding remaining bankroll;
- expected loss conditional on success;
- expected loss conditional on stopping before success.

# 6.7 Certificate gross replacement value

Calculate from actual Certificate Library sailings and EasySeas valuation evidence:

```text
Gross Replacement Value
= Expected Cabin/Fare Replacement Value
+ Covered Taxes/Port Fees
+ FreePlay
+ Stackable OBC
+ Included Internet
+ Included Beverage Value
+ Included Dining Value
+ Included Spa/Thermal Value
+ Suite/Category Upgrade Value
+ Other Verified Included Benefits
```

# 6.8 Certificate redemption cost

```text
Expected Redemption Cost
= User-Paid Taxes/Port Fees
+ Required Upgrade Cost
+ Expected Incremental Travel Cost
+ Required Onboard Spend
+ Other Uncovered Mandatory Cost
```

Travel cost should be optional/configurable and must not be fabricated when unknown.

# 6.9 Expected realized certificate value

```text
Expected Realized Certificate Value
= Redemption Probability
× (Gross Replacement Value − Expected Redemption Cost)
+ Expected Trade-In/Alternative Value
```

The redemption probability should use:

- historical redemption rate by threshold/family;
- expiration behavior;
- future cruise plans;
- booked-cruise conflicts;
- realistic sailing availability;
- preferred departure ports and itinerary fit when the user has provided them;
- manual user intent.

Do not use the maximum sailing value as the default expected value.

# 6.10 Expected net value from cruise start

For each threshold:

```text
Expected Net Value at Threshold
= Probability of Reaching Threshold × Expected Realized Certificate Value
− Expected Gambling Loss to Attempt Threshold
```

# 6.11 Marginal value of chasing the next threshold

When a lower certificate is already locked:

```text
Incremental Certificate Value
= Expected Value of Next Certificate
− Expected Value of Current Locked Certificate

Probability-Adjusted Incremental Value
= Probability of Reaching Next Threshold
× Incremental Certificate Value

Raw Incremental EV
= Probability-Adjusted Incremental Value
− Expected Additional Gambling Loss
```

# 6.12 Risk-adjusted incremental EV

```text
Risk-Adjusted Incremental EV
= Raw Incremental EV
− Downside Risk Penalty
− Bankroll Violation Penalty
− Fatigue/Performance Penalty
− Data-Uncertainty Penalty
```

The screen must show both raw EV and risk-adjusted EV. Risk preference must not be hidden inside one unexplained number.

# 6.13 Optimal stopping rule

At each recommendation refresh:

```text
EV Stop Now = Value of Current Locked Certificate + Current Locked Cash Result

EV Continue to Target T
= EV Stop Now
+ Risk-Adjusted Incremental EV(T)
```

Select the eligible target with the highest value, subject to hard bankroll and safety constraints.

If every target has lower EV than stopping now, recommend stopping.

---

# 7. New Domain Models

Create shared Zod schemas and TypeScript types. Store structured records in SurrealDB or the closest existing structured persistence convention, with local cached snapshots for offline display.

## 7.1 `CasinoCruiseOutcome`

One canonical closeout per profile/program/cruise:

- id;
- owner/profile id;
- brand and casino program;
- cruise id/reservation id;
- ship;
- sail/return dates;
- nights;
- casino-open days/hours;
- sea/port/private-island day counts;
- total points;
- total coin-in;
- total actual result;
- theoretical loss;
- buy-in/cash-out;
- FreePlay used;
- time played;
- session count;
- machine mix;
- average points/day;
- average points/session;
- average points/hour;
- certificate earned;
- threshold reached;
- certificate value snapshot;
- source authority by field;
- completeness score;
- created/updated timestamps.

## 7.2 `CasinoSessionObservation`

Extend or normalize existing session records with:

- session sequence on cruise;
- points at session start/end;
- cumulative cruise points after session;
- cumulative trip result after session;
- remaining daily bankroll before/after;
- casino day and day type;
- remaining casino hours estimate;
- machine family and RTP authority;
- fatigue self-rating or performance proxy;
- stop reason;
- recommendation id active during session;
- source and confidence.

## 7.3 `CertificateThresholdDefinition`

- program;
- month/family/code;
- points required;
- source certificate document/version;
- effective dates;
- A/C or cruise-length scope;
- status;
- source authority;
- manually overridden flag;
- version history.

## 7.4 `CertificateValueSnapshot`

- threshold definition id;
- calculation date;
- eligible sailing population;
- cabin-value distribution;
- FreePlay/OBC/benefit distribution;
- user-paid cost distribution;
- trade-in value;
- redemption probability;
- expected realized value;
- median and range;
- source pages and certificate versions;
- valuation assumptions;
- confidence score;
- valuation-engine version.

## 7.5 `CertificateThresholdAttempt`

One attempt per cruise/threshold:

- cruise outcome id;
- threshold;
- points at opportunity start;
- points remaining;
- attempted yes/no;
- achieved yes/no;
- points at stop;
- incremental coin-in;
- incremental result;
- sessions used;
- time used;
- bankroll consumed;
- current result when attempt began;
- remaining cruise opportunity;
- recommendation active at attempt start;
- stop reason;
- complete/incomplete status.

## 7.6 `PersonalGamblingProfile`

- profile/program id;
- user-provided priors;
- learned daily bankroll distribution;
- learned trip bankroll distribution;
- volatility tolerance;
- preferred game mix;
- historical average/median points per day/session/hour;
- historical average/median loss and win;
- loss-rate distribution;
- bankroll efficiency;
- threshold metrics;
- current primary/stretch/exceptional labels;
- best/worst trip;
- most profitable/highest-EV/favorite certificate;
- last model rebuild;
- model maturity level;
- confidence.

## 7.7 `OptimizationModelSnapshot`

- engine version;
- feature version;
- training-data cutoff;
- included/excluded record ids;
- data-quality summary;
- threshold probability curves;
- loss models;
- value models;
- calibration metrics;
- priors and weights;
- warnings;
- created timestamp.

## 7.8 `LiveCasinoState`

- active cruise;
- current casino day;
- current points;
- current result;
- current locked certificate;
- remaining daily/trip bankroll;
- remaining casino hours;
- remaining sea/port days;
- current points/hour trend;
- session length and fatigue indicators;
- active machine/machine mix;
- last update time;
- source freshness.

## 7.9 `CertificateRecommendationSnapshot`

- live state id;
- model snapshot id;
- current certificate;
- recommended target;
- recommendation action;
- alternate targets;
- probability of success per threshold;
- expected additional coin-in;
- expected additional loss;
- incremental certificate value;
- raw incremental EV;
- risk-adjusted incremental EV;
- downside range;
- confidence;
- reasons;
- warnings;
- assumptions;
- evidence record ids;
- created/expiry timestamps.

## 7.10 `RecommendationOutcome`

- recommendation snapshot id;
- action followed/overridden/unknown;
- actual stop points;
- actual final points;
- actual final result;
- certificate earned;
- predicted vs actual loss;
- predicted vs actual success;
- recommendation net-value result;
- calibration bucket;
- user feedback;
- finalized timestamp.

---

# 8. Model Maturity Levels

The engine should evolve in visible stages.

## Level 0 — User priors only

Use when no complete historical cruise outcomes exist.

- User-provided $200/day risk budget.
- User-provided target labels.
- Current certificate values from the library.
- Low-confidence theoretical expected loss.
- Recommendations should be conservative and clearly labeled preliminary.

## Level 1 — Descriptive personal history

Use after at least one complete cruise and several sessions.

- Personal averages and medians.
- Threshold successes/failures.
- Personal points pace.
- Personal actual-versus-theoretical comparisons.
- Wide confidence ranges.

## Level 2 — Smoothed probability and simulation

Use when enough complete comparable samples exist.

- Bayesian-smoothed threshold success rates.
- Recency-weighted personal distributions.
- Bootstrapped or Monte Carlo simulation using the user’s own sessions and cruise outcomes.
- Conditional models for day type, time remaining, bankroll, and current result.

## Level 3 — Personalized predictive model

Use only when sample size and feature completeness support it.

- Interpretable logistic regression or similarly explainable probability model.
- Regularization and cross-validation.
- Coefficients and feature effects visible in drill-down.
- Out-of-sample calibration must outperform Level 2 before promotion.

## Level 4 — Advanced contextual model

Future only:

- ship-specific effects;
- machine-family effects;
- casino-hours effects;
- sea/port-day effects;
- itinerary and cruise-length effects;
- offer quality and future redemption fit;
- weather or luck-score context only if tested and shown to improve prediction, never assumed causal.

---

# 9. OPT-0 — Baseline Freeze, Audit, and Regression Guardrails

**Goal:** Protect the current build before changing calculation authority.

- [ ] Extract the uploaded Build 314 into a clean working tree.
- [ ] Record SHA-256 hashes of protected package/config/native/workflow files.
- [ ] Run every bundled QA script.
- [ ] Syntax-transpile all TypeScript/TSX files.
- [ ] Record that a complete project typecheck is unavailable unless dependencies are installed.
- [ ] Add executable tests that lock the current point ladder, session-field compatibility, value-ledger behavior, and current UI route wiring.
- [ ] Add a test proving the existing chase recommendation is generic and therefore expected to be replaced.
- [ ] Add a test preventing UI components from importing low-level optimization formulas directly.
- [ ] Add a test preventing hidden known-profile fallback data from entering optimizer training input.
- [ ] Add feature flags:
  - `personalCertificateOptimizerEnabled`;
  - `personalCertificateOptimizerLiveAdvisorEnabled`;
  - `personalCertificateOptimizerLearningEnabled`.
- [ ] Preserve rollback to the existing static card behavior until the new engine passes parity and safety gates.

**Checkpoint:** `OPT0_BASELINE_FREEZE_AND_REGRESSION_GUARDS.zip`

---

# 10. OPT-1 — Trustworthy Historical Casino Data Foundation

**Goal:** Build one canonical, profile-scoped historical dataset.

## OPT-1.1 Canonicalize cruise outcomes

- [ ] Create `canonicalizeCasinoCruiseOutcome()`.
- [ ] Prefer explicit cruise closeout values over session sums.
- [ ] Preserve every field’s source, authority, and freshness.
- [ ] Keep missing distinct from zero.
- [ ] Exclude upcoming, cancelled, tombstoned, duplicate, and incomplete cruise records.
- [ ] Keep Royal/Celebrity/Carnival/Silversea programs isolated.
- [ ] Do not use Crown & Anchor points as Club Royale points.
- [ ] Do not use annual tier points as one cruise’s certificate points.

## OPT-1.2 Reconcile sessions to cruises

- [ ] Link each session to exactly one profile/program/cruise where possible.
- [ ] Detect duplicates and overlapping imports.
- [ ] Mark orphan sessions for review.
- [ ] Do not add session totals to an already complete cruise closeout.
- [ ] Use sessions for pace/distribution even when closeout totals are authoritative.

## OPT-1.3 Historical threshold reconstruction

For every completed Royal casino cruise:

- [ ] Reconstruct the highest threshold reached.
- [ ] Reconstruct each threshold opportunity crossed or missed.
- [ ] Identify whether the cruise stopped near a threshold.
- [ ] Capture certificate code actually earned when known.
- [ ] Link certificate earned to the Certificate Library document/version.
- [ ] Create threshold attempts only when data is sufficient.
- [ ] Mark ambiguous attempts incomplete rather than guessing.

## OPT-1.4 Remove hidden fallback authority

- [ ] Move hard-coded known-profile cruise facts into a one-time migration/import fixture.
- [ ] Require explicit user acceptance or source review before persisting migrated facts.
- [ ] Remove known email addresses and mock cruise arrays from live optimizer inputs.
- [ ] Prevent `knownProfileFallback` from silently injecting history after migration.
- [ ] Keep source attribution such as `migrated_legacy_known_fact`.

## OPT-1.5 Data health score

Calculate per cruise and overall:

- points completeness;
- coin-in completeness;
- result completeness;
- session completeness;
- certificate linkage completeness;
- value completeness;
- machine/RTP completeness;
- timing completeness.

- [ ] Exclude low-quality records from high-confidence models.
- [ ] Allow them in descriptive totals with clear warnings.

**Checkpoint:** `OPT1_CANONICAL_PERSONAL_CASINO_HISTORY.zip`

**Release gate:** No optimization recommendation may be labeled high confidence until canonical cruise outcomes pass readback and duplicate checks.

---

# 11. OPT-2 — Certificate Value and Redemption Model

**Goal:** Calculate what each threshold is actually worth to this user.

This phase is blocked until the Certificate Library P0 foundation is complete: durable PDFs, hashes, versions, page-aware parsing, rich sailing identity, and correct deduplication.

## OPT-2.1 Versioned threshold authority

- [ ] Read thresholds from current certificate documents where possible.
- [ ] Retain the current static ladder only as a fallback.
- [ ] Store effective month, family, code, points, and scope.
- [ ] Detect threshold/code changes across months.
- [ ] Do not assume A and C values are equivalent.

## OPT-2.2 Sailing-value population

For each threshold/family/month:

- [ ] value every eligible sailing using the existing EasySeas value ledger;
- [ ] preserve cabin category and occupancy;
- [ ] include verified FreePlay, OBC, internet, drink, dining, spa, suite, and other benefits;
- [ ] include covered taxes/fees as replacement value only when actually covered;
- [ ] subtract user-paid taxes/fees and mandatory costs;
- [ ] prevent duplicate Signature, NextCruise, internet, or OBC counting;
- [ ] retain low/median/high value distributions;
- [ ] show source certificate/page and valuation confidence.

## OPT-2.3 Personal redeemability

- [ ] Calculate historical redemption rate by threshold and family.
- [ ] Track expired, traded, booked, redeemed, and unused certificates.
- [ ] Consider future booked cruises and likely use windows.
- [ ] Consider whether a sailing conflicts with existing bookings.
- [ ] Use user preferences only when explicitly recorded.
- [ ] Permit manual “I would actually use this” weighting.
- [ ] Calculate value both with and without redemption-probability adjustment.

## OPT-2.4 Expected value snapshots

Generate a saved `CertificateValueSnapshot` for every threshold with:

- expected realized value;
- median value;
- range;
- best realistic value;
- maximum raw value shown separately;
- redemption probability;
- trade-in/alternative value;
- expected user-paid cost;
- source count;
- completeness;
- confidence;
- assumptions.

## OPT-2.5 Historical value backfill

- [ ] Link historical certificates to the certificate versions that existed at the time where available.
- [ ] Never value an old certificate only from a later month without a warning.
- [ ] Use actual redeemed cruise value when known.
- [ ] Keep historical estimated and actual realized values separate.

**Checkpoint:** `OPT2_PERSONAL_CERTIFICATE_VALUE_MODEL.zip`

**Release gate:** The engine must show why a 4,000-point certificate is worth more or less than 6,500 using actual certificate evidence, not only cabin labels.

---

# 12. OPT-3 — Personal Probability, Loss, and Target Models

**Goal:** Learn the probability and cost of reaching each threshold.

## OPT-3.1 Threshold statistics

For every threshold calculate and persist:

- historical opportunities;
- attempts;
- successes;
- failures;
- raw success rate;
- smoothed success rate;
- average and median coin-in;
- average and median actual result;
- average loss on losing cruises;
- average win on winning cruises;
- average bankroll consumed;
- average trip length;
- average points/day;
- average points/session;
- average points/hour;
- variance and standard deviation;
- loss-rate distribution;
- recency-weighted trend;
- confidence interval;
- data quality.

## OPT-3.2 Comparable-history selection

Build a transparent similarity score using:

- same program and game category;
- cruise length;
- points already earned;
- points remaining;
- remaining casino days/hours;
- sea/port/private-island day mix;
- current result band;
- bankroll remaining;
- ship/casino when enough samples exist;
- machine-family mix;
- recency.

The drill-down must list which historical cruises were included and excluded.

## OPT-3.3 Success probability model

Initial implementation:

- [ ] Bayesian-smoothed historical success rate.
- [ ] Pace feasibility from points/hour and remaining hours.
- [ ] Bankroll feasibility from expected loss distribution and remaining bankroll.
- [ ] Bootstrap/Monte Carlo simulation using the user’s own comparable observations.
- [ ] Seeded/reproducible simulation for the same input snapshot.
- [ ] Separate success probability from recommendation confidence.

Future predictive model:

- [ ] Interpretable logistic regression only after minimum sample and feature gates.
- [ ] Cross-validation and calibration plots.
- [ ] No promotion unless it beats the transparent simulation on held-out data.

## OPT-3.4 Expected loss model

- [ ] Calculate empirical and theoretical loss rates separately.
- [ ] Blend with a visible data weight.
- [ ] Use robust outlier handling.
- [ ] Calculate incremental cost per point and per session.
- [ ] Condition on game/machine/day type when data supports it.
- [ ] Never make expected loss negative because of historical wins.
- [ ] Show uncertainty range.

## OPT-3.5 Target classification model

Initial automatic definitions:

- **Comfortable:** high success probability, within normal bankroll, positive expected net value.
- **Primary Target:** highest risk-adjusted expected net value among realistically attainable thresholds.
- **Stretch Goal:** positive or near-positive incremental EV but meaningful downside or lower success probability.
- **Exceptional Goal:** low ordinary probability; considered only in profit-protected conditions.
- **Normally Avoid:** negative incremental EV or excessive downside in most scenarios.
- **Unrealistic:** very low probability, insufficient remaining time, or required bankroll far beyond learned/declared limits.

Promotion/demotion should require:

- minimum sample count;
- stable success probability;
- positive expected value;
- acceptable downside;
- consistency across recent comparable cruises;
- no reliance on one jackpot outlier.

## OPT-3.6 Personal profile rebuild

After each completed cruise:

- [ ] rebuild threshold metrics;
- [ ] update bankroll and pace distributions;
- [ ] update certificate redemption behavior;
- [ ] update labels;
- [ ] update model maturity;
- [ ] save a versioned model snapshot;
- [ ] retain the prior snapshot for audit and comparison.

**Checkpoint:** `OPT3_PERSONAL_PROBABILITY_LOSS_AND_TARGET_MODELS.zip`

**Release gate:** Given the same historical data and live state, the engine must produce deterministic, fully explainable threshold probabilities and EV calculations.

---

# 13. OPT-4 — Marginal EV and Optimal Stopping Engine

**Goal:** Decide whether to stop or continue at the current moment.

## OPT-4.1 Current locked certificate

- [ ] Determine the highest threshold already earned.
- [ ] Determine whether a higher certificate replaces or supplements the lower certificate.
- [ ] Read the correct A/C or cruise-length family.
- [ ] Preserve uncertainty if the onboard certificate rules are incomplete.

## OPT-4.2 Candidate target evaluation

For every remaining threshold calculate:

- points required;
- expected additional coin-in;
- expected additional time/sessions;
- probability of success;
- expected additional loss;
- downside range;
- incremental certificate value;
- raw incremental EV;
- risk-adjusted incremental EV;
- probability of exceeding daily/trip bankroll;
- projected end-of-cruise points;
- confidence.

## OPT-4.3 Profit-protected mode

Profit mode should affect available risk budget and success feasibility, not the house edge.

- [ ] Let the user configure a locked-profit floor.
- [ ] Calculate how much of current winnings may be risked while preserving that floor.
- [ ] Recalculate bankroll feasibility and success probability.
- [ ] Require raw incremental EV to remain nonnegative or require an explicit manual override.
- [ ] Show the 90th-percentile downside.
- [ ] Never state that casino money is not real money.
- [ ] Use **Profit-Protected Push** rather than “risk-free” unless a warning is shown.

## OPT-4.4 Loss mode

- [ ] Tighten discretionary risk after daily/trip stop-loss thresholds.
- [ ] Recommend stopping when hard limits are reached.
- [ ] Do not increase target because the user is behind.
- [ ] Do not use “win it back” language.
- [ ] Show the current loss against the original budget and remaining cruise budget.

## OPT-4.5 Fatigue and performance mode

Use only transparent signals:

- session duration;
- total same-day play duration;
- late-hour pattern;
- declining points/hour;
- increasing loss/point;
- user-entered fatigue rating.

- [ ] Apply a visible fatigue/performance penalty.
- [ ] Never infer a medical condition.
- [ ] Permit the user to dismiss or correct the signal.

## OPT-4.6 Recommendation precedence

Apply this order:

1. **Data Unavailable / Refresh Needed**
2. **Hard Stop — Bankroll Limit Reached**
3. **STOP NOW — All remaining targets negative EV**
4. **Bank Your Win — Current certificate is optimal and profit is exposed**
5. **Do Not Chase — Next certificate’s marginal value does not justify expected loss**
6. **Play One More Session — Small, bounded experiment may resolve uncertainty**
7. **Continue Until [Target] — Positive risk-adjusted EV and acceptable downside**
8. **Profit-Protected Push — Stretch target is justified while preserving chosen profit floor**
9. **Excellent Opportunity — Strong positive EV, high success probability, high confidence**

## OPT-4.7 Recommendation output contract

Every output must include:

- action label;
- recommended target;
- current locked certificate;
- current points/result;
- expected end-of-cruise points;
- probability of success;
- expected additional coin-in;
- expected additional loss;
- downside range;
- incremental certificate value;
- raw and risk-adjusted EV;
- bankroll impact;
- confidence;
- top reasons;
- warnings;
- assumptions;
- historical evidence;
- source freshness;
- engine/model version;
- drill-down payload.

## OPT-4.8 Existing API compatibility

- [ ] Replace `buildCertificateChaseRecommendation()` internally with an adapter to the new engine.
- [ ] Preserve its public return shape temporarily for existing screens/tests.
- [ ] Deprecate generic point-gap rules after the new engine is feature-complete.
- [ ] Update `buildBestPlayTodayPlan()` so day type modifies opportunity, but the optimizer selects the target.

**Checkpoint:** `OPT4_MARGINAL_EV_AND_OPTIMAL_STOPPING_ENGINE.zip`

**Release gate:** A test case where 4,000→6,500 costs more expected loss than incremental certificate value must return STOP/DO NOT CHASE, even though a higher certificate exists.

---

# 14. OPT-5 — Live Casino Advisor

**Goal:** Continuously update the recommendation during an active cruise without encouraging excessive play.

## OPT-5.1 Live state capture

Support manual and imported updates for:

- current points;
- current win/loss;
- current daily and trip bankroll used;
- session start/stop;
- current machine;
- coin-in/out when available;
- time played;
- remaining cruise days;
- remaining casino-open hours;
- sea/port day context;
- FreePlay remaining;
- fatigue rating;
- current target preference.

## OPT-5.2 Refresh triggers

Recalculate when:

- points change;
- result changes materially;
- a session ends;
- a new casino day begins;
- bankroll limit changes;
- remaining casino hours change;
- a certificate threshold is crossed;
- certificate documents/values change;
- the user requests refresh.

Do not run a battery-draining high-frequency polling loop.

## OPT-5.3 Live projections

Display:

- current points;
- points pace;
- projected end-of-cruise points;
- current locked certificate;
- expected final certificate;
- primary recommended target;
- alternate targets;
- expected cost to each target;
- incremental value and EV;
- probability and confidence;
- remaining bankroll;
- locked-profit floor;
- recommended action.

## OPT-5.4 One-more-session experiment

“Play One More Session” should be tightly bounded:

- explicit maximum bankroll;
- explicit maximum duration;
- stop points;
- purpose of the experiment;
- what observation would change the recommendation;
- automatic refresh at the end;
- no automatic extension.

## OPT-5.5 Recommendation persistence

- [ ] Save each materially changed recommendation snapshot.
- [ ] Deduplicate insignificant refreshes.
- [ ] Preserve the recommendation active during each session.
- [ ] Permit user notes and override reasons.
- [ ] Never silently rewrite a historical recommendation after the model changes.

**Checkpoint:** `OPT5_LIVE_CASINO_ADVISOR.zip`

---

# 15. OPT-6 — Personal Dashboard, Analytics, and Drill-Down

**Goal:** Make the model understandable and useful outside the casino.

## OPT-6.1 Personal Gambling Profile screen

Create `app/casino/personal-gambling-profile.tsx`.

Display:

- current recommended target;
- average certificate earned;
- favorite certificate;
- most profitable certificate;
- highest-EV certificate;
- average and median bankroll;
- average loss on losing trips;
- average win on winning trips;
- average points/day/session/hour;
- best and worst trip;
- threshold success table;
- certificate history;
- redemption history;
- model maturity;
- confidence and data health;
- historical recommendation accuracy.

Every metric must drill down to source cruises/sessions.

## OPT-6.2 Certificate optimization screen

Create `app/casino/certificate-optimizer.tsx`.

For each threshold show:

- personal label;
- probability;
- expected loss;
- expected certificate value;
- expected net value;
- marginal EV from current level;
- bankroll requirement;
- confidence;
- trend;
- recommendation.

## OPT-6.3 Live Advisor screen

Create `app/casino/live-certificate-advisor.tsx` or integrate into the shared Casino Advisor conversation shell.

Required UI:

- large recommendation hero;
- current state summary;
- target comparison cards;
- live session controls;
- explanation drawer;
- editable bankroll/profit floor;
- source freshness;
- manual correction action;
- recommendation history.

## OPT-6.4 Graphs

Add separate, accessible graphs for:

- certificate points over time;
- threshold attainment history;
- success probability curve;
- certificate value curve;
- expected loss curve;
- expected net value curve;
- marginal EV curve;
- certificate ROI;
- bankroll efficiency;
- actual versus predicted result;
- recommendation calibration;
- target-label changes over time.

Graphs must not use unexplained color alone and must show exact values on selection.

## OPT-6.5 Existing Analytics integration

Replace the current generic `KeepPlayingDecisionCard` with a summarized optimizer card. The card should show:

- current target;
- action;
- expected additional loss;
- incremental value;
- incremental EV;
- probability;
- confidence;
- “Why?” drill-down.

## OPT-6.6 Certificate Library integration

On certificate detail and threshold screens show:

- personal success probability;
- expected cost to earn;
- expected realized value;
- personal net value;
- marginal value from adjacent thresholds;
- historical results at this threshold;
- current label;
- linked recommendation history.

**Checkpoint:** `OPT6_PERSONAL_DASHBOARD_ANALYTICS_AND_DRILLDOWN.zip`

---

# 16. OPT-7 — Advisor, Ask My Data, and Offer Intelligence Integration

**Goal:** Make the optimization engine the intelligence behind every casino recommendation.

## OPT-7.1 Structured optimization context

Add one source block to the AI/data layer:

```text
personal-certificate-optimization-engine
```

Include only saved engine outputs and source references. The language model must not recompute gambling EV independently.

## OPT-7.2 Supported questions

Examples:

- What certificate should I target?
- Should I stop now?
- Is 6,500 worth chasing?
- What would it cost me to reach 9,000?
- Why is 4,000 my primary target?
- What is my probability of reaching the next level?
- Which certificate has produced my highest net value?
- How accurate have your past recommendations been?
- How did profit mode change the recommendation?
- Which historical cruises are most similar to this one?
- What assumptions are uncertain?

## OPT-7.3 AI response rules

- [ ] Quote engine values exactly.
- [ ] Show source freshness and confidence.
- [ ] State whether inputs are actual, estimated, or missing.
- [ ] Never fabricate certificate values or casino hours.
- [ ] Never override a hard stop.
- [ ] Never call coin-in loss.
- [ ] Never turn a user’s current win into a claim that gambling is positive expectation.
- [ ] Link to the full drill-down.

## OPT-7.4 Examine Offers integration

When examining offers or future sailings:

- [ ] compare the value of redeeming certificates earned at different thresholds;
- [ ] identify whether the higher threshold actually unlocks better usable sailings;
- [ ] use booked-cruise conflicts and future plans;
- [ ] show when a lower threshold has higher expected realized value;
- [ ] avoid recommending play merely because a nominally higher cabin exists.

## OPT-7.5 Advisor screen integration

The main Advisor screen should combine:

- best offer value;
- best certificate target;
- certificate-earning cost;
- redemption fit;
- current and future bookings;
- trip-stack possibilities;
- true make-out;
- risk and data-confidence warnings.

**Checkpoint:** `OPT7_ADVISOR_ASK_MY_DATA_AND_OFFER_INTEGRATION.zip`

---

# 17. OPT-8 — Alerts and Notifications

**Goal:** Notify only when the decision meaningfully changes.

Notify when:

- current points exceed historical pace;
- probability of a personal best becomes meaningful;
- the next certificate becomes positive EV;
- the next certificate becomes negative EV;
- the current certificate becomes the optimal stop;
- bankroll risk exceeds configured limits;
- profit-protected push becomes available;
- confidence materially changes after new data;
- a certificate PDF/value change alters the target;
- the recommendation has not been refreshed after stale inputs.

Rules:

- [ ] Stable notification fingerprints.
- [ ] No duplicate alerts for small numeric changes.
- [ ] No shame, pressure, urgency, or loss-chasing language.
- [ ] Direct link to calculation detail.
- [ ] Configurable quiet hours.
- [ ] Full opt-out.
- [ ] Never notify merely to encourage more play.

**Checkpoint:** `OPT8_PERSONAL_OPTIMIZATION_ALERTS.zip`

---

# 18. OPT-9 — Learning, Backtesting, and Recommendation Accuracy

**Goal:** Prove the engine improves recommendations rather than merely becoming more complex.

## OPT-9.1 Outcome finalization

After each cruise:

- [ ] ask the user to confirm final points/result/certificate when data is incomplete;
- [ ] close all recommendation outcomes;
- [ ] compare predicted and actual success;
- [ ] compare predicted and actual incremental loss;
- [ ] compare recommended target and achieved target;
- [ ] measure whether stopping/continuing improved net vacation value;
- [ ] store override reasons.

## OPT-9.2 Accuracy metrics

Track:

- Brier score for threshold success probability;
- calibration by probability bucket;
- mean/median absolute loss prediction error;
- predicted versus actual points error;
- certificate-value prediction error;
- recommendation-followed net value;
- recommendation-overridden net value;
- false-continue rate;
- false-stop rate;
- bankroll-limit violation rate;
- data-completeness impact.

## OPT-9.3 Backtesting

For every historical cruise with enough data:

- reconstruct what was known at each decision point;
- run the model without future information leakage;
- compare stop/continue decisions with actual outcomes;
- calculate confidence calibration;
- identify where 4,000, 6,500, or 9,000 would have been optimal;
- preserve a reproducible test report.

## OPT-9.4 Model promotion rules

- [ ] Never promote a more complex model based only on in-sample fit.
- [ ] Require held-out improvement.
- [ ] Require calibration to remain acceptable.
- [ ] Require no increase in false-continue decisions beyond the configured safety limit.
- [ ] Preserve rollback to prior model snapshot.

## OPT-9.5 Learning safeguards

- [ ] Do not reward recommendations for producing more points or coin-in.
- [ ] Primary reward: realized net vacation value.
- [ ] Secondary rewards: avoided negative-EV chase, bankroll adherence, calibration.
- [ ] Penalize unnecessary gambling loss and bankroll violations.
- [ ] Keep user overrides as feedback, not unquestioned ground truth.

**Checkpoint:** `OPT9_LEARNING_BACKTEST_AND_ACCURACY.zip`

---

# 19. OPT-10 — Full QA and Native Validation

## OPT-10.1 Unit tests

Add tests for:

- canonical result authority;
- coin-in authority;
- missing versus zero;
- session/closeout double-count prevention;
- threshold reconstruction;
- certificate value composition;
- OBC/Signature/internet/dining/spa duplicate prevention;
- redemption probability;
- empirical/theoretical loss blend;
- success probability;
- deterministic simulation;
- confidence scoring;
- target classification;
- marginal EV;
- profit-protected mode;
- loss mode;
- fatigue penalty;
- optimal stopping;
- recommendation precedence;
- explanation output;
- model versioning;
- outcome calibration.

## OPT-10.2 Required scenario fixtures

At minimum:

1. **4,000 locked; 6,500 negative marginal EV** → STOP.
2. **120 points from next level; positive EV and within budget** → CONTINUE.
3. **2,400 points away; expected loss exceeds value** → DO NOT CHASE.
4. **Current win +$1,200; profit floor preserved; 6,500 positive EV** → PROFIT-PROTECTED PUSH.
5. **Current win +$1,200 but 6,500 still negative EV** → BANK YOUR WIN.
6. **Current win +$3,000; 9,000 feasible but low confidence** → exceptional goal with explicit uncertainty.
7. **Daily stop-loss reached** → HARD STOP regardless of threshold gap.
8. **Missing certificate library value** → UNKNOWN/REFRESH, not continue.
9. **Historical net-winning record** → expected loss remains nonnegative.
10. **One jackpot outlier** → does not automatically promote threshold.
11. **6500 achieved repeatedly with good EV** → label promotion after evidence gate.
12. **9000 repeatedly missed with high loss** → label demotion.
13. **Same ship/date certificate rows with different benefits** → values remain separate.
14. **Stale certificate version replaced** → recommendation refreshes from new value snapshot.
15. **Profile switch** → no history or recommendation contamination.

## OPT-10.3 Integration tests

- CasinoSessionProvider → canonical history;
- BookedCruise closeout → canonical history;
- Certificate Library → value snapshots;
- optimization service → saved recommendation;
- recommendation → Analytics card;
- recommendation → Advisor;
- recommendation → Ask My Data;
- recommendation → notifications;
- restart and hydration;
- rollback and transaction failure;
- profile and brand isolation.

## OPT-10.4 UI/accessibility tests

- long explanations do not clip;
- drill-down works;
- charts have accessible labels;
- status is not color-only;
- large text works;
- live controls are keyboard accessible;
- stale/unknown states are clear;
- hard-stop state cannot be visually mistaken for continue;
- recommendation history survives navigation and restart.

## OPT-10.5 Structural validation

- [ ] Transpile all TypeScript/TSX.
- [ ] Full typecheck after dependencies are installed.
- [ ] Existing lint.
- [ ] All prior regression scripts.
- [ ] Protected-file hash comparison.
- [ ] No package/lock/native/workflow changes unless separately approved.
- [ ] No production mock data.
- [ ] No hidden personal email/profile constants.
- [ ] No raw private logs in final ZIP.
- [ ] Independent extracted-package retest.

## OPT-10.6 Native real-world validation

Run on installed native build with real data:

- import/sync a completed Royal cruise;
- verify sessions and closeout reconcile;
- verify current/next certificate PDFs and values;
- enter live points/result changes;
- cross a threshold;
- verify recommendation refresh;
- close the cruise and finalize outcome;
- restart app and verify history/model/recommendation accuracy;
- switch profile and verify isolation.

**Checkpoint:** `OPT10_COMPLETE_QA_NATIVE_VALIDATION_AND_RELEASE.zip`

---

# 20. Recommended File Refactoring Map

## Existing files to modify or wrap

```text
lib/certificates/certificateChaseRecommendation.ts
components/casino/KeepPlayingDecisionCard.tsx
lib/casino/bestPlayToday.ts
components/casino/BestPlayTodayCard.tsx
state/CasinoSessionProvider.tsx
state/CasinoSettingsProvider.tsx
state/CasinoStrategyProvider.tsx
hooks/useCasinoEconomicsData.ts
lib/casinoPointTruth.ts
lib/knownProfileFallback.ts
lib/casinoCruiseEconomics.ts
lib/value/cruiseValueLedger.ts
lib/value/cruiseValueCalculations.ts
lib/value/onboardValue.ts
lib/agentXCasinoValueContext.ts
app/(tabs)/analytics.tsx
app/advisor.tsx
app/ask-my-data.tsx
app/casino/certificate-wallet.tsx
app/certificate-codes.tsx
app/certificate-lookup.tsx
backend/trpc/app-router.ts
```

## New shared optimization modules

```text
lib/casino-optimization/
  types.ts
  schemas.ts
  authority.ts
  canonicalizeCasinoHistory.ts
  thresholdAttempts.ts
  profileBuilder.ts
  comparableHistory.ts
  lossModel.ts
  probabilityModel.ts
  simulation.ts
  certificateValueModel.ts
  redemptionModel.ts
  marginalEv.ts
  riskAdjustment.ts
  targetClassifier.ts
  optimalStopping.ts
  liveAdvisor.ts
  explanationBuilder.ts
  confidence.ts
  calibration.ts
  backtest.ts
  index.ts
```

## New backend persistence/services

```text
backend/repositories/
  casinoOptimizationRepository.ts
  recommendationRepository.ts

backend/services/casino-optimization/
  optimizationProfileService.ts
  optimizationModelService.ts
  certificateValueSnapshotService.ts
  liveRecommendationService.ts
  outcomeFinalizationService.ts
  optimizationBacktestService.ts

backend/trpc/routes/
  certificate-optimization.ts
```

## New state/provider layer

```text
state/CertificateOptimizationProvider.tsx
hooks/useCertificateOptimization.ts
hooks/useLiveCasinoAdvisor.ts
```

## New UI routes

```text
app/casino/personal-gambling-profile.tsx
app/casino/certificate-optimizer.tsx
app/casino/live-certificate-advisor.tsx
app/casino/recommendation-history.tsx
```

## New components

```text
components/casino-optimization/
  OptimizationHeroCard.tsx
  CertificateTargetCard.tsx
  TargetComparisonTable.tsx
  LiveCasinoStateCard.tsx
  ProfitProtectionCard.tsx
  ExpectedLossCard.tsx
  MarginalEvCard.tsx
  ProbabilityCurve.tsx
  ExpectedValueCurve.tsx
  BankrollEfficiencyChart.tsx
  RecommendationExplanationDrawer.tsx
  HistoricalEvidenceList.tsx
  ModelConfidenceBadge.tsx
  RecommendationAccuracyCard.tsx
```

## New tests and fixtures

```text
scripts/fixtures/certificateOptimization/
  historical-cruises.json
  session-distributions.json
  certificate-values.json
  live-state-scenarios.json
  recommendation-outcomes.json

scripts/
  testPersonalCertificateOptimizationFoundation.js
  testPersonalCertificateLossModel.js
  testPersonalCertificateProbabilityModel.js
  testPersonalCertificateMarginalEv.js
  testPersonalCertificateOptimalStopping.js
  testPersonalCertificateLiveAdvisor.js
  testPersonalCertificateLearningCalibration.js
  testPersonalCertificateProfileIsolation.js
```

---

# 21. Implementation Sequence and Dependency Map

## Sequence 1 — Safe foundation

1. OPT-0 baseline and regression guards.
2. Complete existing master-plan data correctness work.
3. OPT-1 canonical historical casino data.
4. Complete Certificate Library P0 persistence/parser/storage work.

## Sequence 2 — Core intelligence

5. OPT-2 certificate value and redemption model.
6. OPT-3 probability, loss, and target models.
7. OPT-4 marginal EV and optimal stopping.

## Sequence 3 — Live use

8. OPT-5 live advisor.
9. OPT-6 personal dashboard and analytics.
10. OPT-7 Advisor, Ask My Data, and offer integration.
11. OPT-8 alerts.

## Sequence 4 — Learning and release

12. OPT-9 outcome learning, backtesting, and accuracy.
13. OPT-10 full QA and native validation.
14. Retire generic/static recommendation rules only after parity and rollback tests pass.

## Parallel work permitted

- Shared conversation UI can be built while the core model is under development.
- Certificate Library dashboard UI can be built after persistence contracts are stable.
- Graph shells may be built with fixture data only in tests/story fixtures, never as production fallback.
- No production recommendation should be enabled before OPT-4 passes.

---

# 22. Recommended Checkpoint Approval Order

Approve and execute one checkpoint at a time:

1. `OPT0_BASELINE_FREEZE_AND_REGRESSION_GUARDS.zip`
2. `OPT1_CANONICAL_PERSONAL_CASINO_HISTORY.zip`
3. `OPT2_PERSONAL_CERTIFICATE_VALUE_MODEL.zip`
4. `OPT3_PERSONAL_PROBABILITY_LOSS_AND_TARGET_MODELS.zip`
5. `OPT4_MARGINAL_EV_AND_OPTIMAL_STOPPING_ENGINE.zip`
6. `OPT5_LIVE_CASINO_ADVISOR.zip`
7. `OPT6_PERSONAL_DASHBOARD_ANALYTICS_AND_DRILLDOWN.zip`
8. `OPT7_ADVISOR_ASK_MY_DATA_AND_OFFER_INTEGRATION.zip`
9. `OPT8_PERSONAL_OPTIMIZATION_ALERTS.zip`
10. `OPT9_LEARNING_BACKTEST_AND_ACCURACY.zip`
11. `OPT10_COMPLETE_QA_NATIVE_VALIDATION_AND_RELEASE.zip`

Every checkpoint must include:

- focused tests;
- full prior regression suite;
- protected-file hash comparison;
- changed-file manifest;
- QA report;
- rollback notes;
- checkpoint ZIP;
- no transition until the current checkpoint passes.

---

# 23. Final Definition of Done

The Personal Certificate Optimization Engine is complete only when all of the following are demonstrated:

- [ ] The optimizer uses actual profile-scoped historical casino records, not generic strategies or hidden mock data.
- [ ] Every historical threshold shows attempts, successes, success rate, coin-in, result, bankroll, pace, variance, trend, and confidence.
- [ ] Every certificate threshold has a persisted, source-attributed value snapshot from the Certificate Library.
- [ ] Certificate value includes fare/cabin, verified covered costs and benefits, redemption probability, and user-paid costs without double counting.
- [ ] Expected additional loss is based on a transparent personal/theoretical blend and cannot become negative due to historical wins.
- [ ] Success probability uses personal comparable history, remaining time, pace, and bankroll feasibility.
- [ ] The engine compares every realistic target and selects the maximum expected net vacation value.
- [ ] Marginal EV can recommend a lower certificate even when a higher certificate exists.
- [ ] Profit mode preserves a configurable profit floor and never changes the house edge.
- [ ] Loss mode does not encourage chasing.
- [ ] Hard bankroll limits override all continue recommendations.
- [ ] The live advisor updates from current points/result/time and saves recommendation snapshots.
- [ ] Every recommendation shows calculations, historical evidence, assumptions, confidence, warnings, and model version.
- [ ] Target labels automatically evolve only after evidence gates are met.
- [ ] 6,500 can become Primary Target if personal history supports it.
- [ ] 9,000 can be promoted or demoted based on actual evidence.
- [ ] Recommendation accuracy and calibration are tracked after every cruise.
- [ ] Advisor, Ask My Data, Analytics, Certificate Library, and alerts all consume the same saved engine output.
- [ ] No duplicate formulas exist in UI components.
- [ ] Existing Royal, Celebrity, Carnival, loyalty, offers, booked cruises, calendar, casino, and certificate functionality passes regression tests.
- [ ] Native restart, profile isolation, transaction rollback, and offline readback are verified.
- [ ] Final package contains no production mock data, hidden profile constants, private raw logs, or unauthorized dependency/config changes.

---

# 24. Approval Phrase

To approve this integrated optimization plan, use:

`APPROVE EASYSEAS PERSONAL CERTIFICATE OPTIMIZATION ENGINE MASTER PLAN`
