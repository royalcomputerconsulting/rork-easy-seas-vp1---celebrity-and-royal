# EasySeas Casino Intelligence Specification Gap Map

Source reviewed: `EasySeas_AI_Build_Improvement_Spec.md` (2,516 lines).

## Existing systems to preserve

- Canonical cruise/session reconciliation and data-health scoring
- Personal threshold statistics, robust loss estimates, success probabilities, and dynamic labels
- Certificate replacement value and Bayesian redemption adjustment
- Optimal-stopping recommendations, hard bankroll limits, fatigue and profit/loss safety modes
- Live advisor snapshots, end-of-cruise projection, and one-more-session evaluation
- Recommendation journals, outcome finalization, chronological backtests, calibration, and model promotion gates
- Cruise cost ledger, certificate inventory optimizer, offer lineage, future-value wallet, ship/machine history, alerts, AgentX/Ask My Data integration
- Local profile-scoped persistence and source/confidence metadata

## Material gaps being closed

1. One named `CasinoIntelligenceEngine` facade does not yet own the complete calculation boundary.
2. Candidate marginal EV includes redemption-adjusted certificate value but does not yet include future-offer, tier, ancillary, travel, cruise-cost, and unredeemed-value terms.
3. Redemption-adjusted value is multiplied by target success a second time in the candidate EV path.
4. Bankroll output exposes probability of exceeding bankroll but not an explicit survival probability and percentile requirements.
5. Natural-progress, wait-until-tomorrow, lower-volatility, and save-for-next-cruise decisions are not first-class engine actions.
6. Candidate explanations do not expose every decomposed expected-net-vacation-value term.
7. What-if calculations are screen-oriented rather than a stable shared-engine method.
8. Coin-in/loss statistics need explicit rolling/context hierarchy and confidence intervals in the shared output.
9. Future-offer and tier values exist in adjacent systems but are not inputs to the stopping recommendation.
10. AgentX can read saved optimization results but needs to consume the same facade result used by the UI.

## Implementation rule

The existing optimization modules remain the verified low-level implementation. The new facade composes them, extends missing terms, and becomes the only supported UI/Agent boundary. Existing records and legacy calculations remain readable until the replacement path passes acceptance and full regression gates.

## Addendum: ecosystem enhancements reviewed August 23, 2026

The 525-line enhancement brief was evaluated against both the current codebase plan and its own stated approval rule. The following requirements are added because they are either material reliability gaps or necessary inputs to trustworthy intelligence:

11. Add a guarded system-awareness layer that unifies player, cruise, offer, certificate, loyalty, casino, and financial context while retaining source and confidence provenance.
12. Add anomaly detection for points/coin-in drift, ROI outliers, mismatched offers or cabins, low-confidence document extraction, and contradictory records. Alerts must be explainable and dismissible.
13. Add a self-healing data workflow with scan, preview, confidence gating, transactional apply, audit history, and rollback. No silent low-confidence correction is permitted.
14. Repair current web-pricing retrieval and expose verified/error/stale states instead of treating missing pricing as zero or verified.
15. Add a resumable, bounded-concurrency **Get All Current Pricing** workflow in Settings. Its order is booked/completed, Smart, available, then remaining cruises; it must show progress, support cancellation/resume, and only mark a record verified after required pricing/itinerary/route fields pass validation.
16. Repair booked-cruise XLSX export so it includes all booked and completed cruises, their financial/receipt fields, provenance, and validation status.
17. Repair the Scheduling/Events data path and event rendering; validate date boundaries so cruise events appear only on actual sailing days.
18. Harmonize Scheduling controls and compact hero styling with the established app theme without changing navigation or the provider tree.
19. Move cruise-pricing edit controls into the Pricing section and add scoped edit controls for Cruise Details and Financials. Remove redundant points/winnings buttons only after equivalent actions are verified.
20. Populate cruise-detail Financials from matched receipt records and clearly identify missing, unmatched, or low-confidence receipt data.
21. Prototype system-awareness, predictive what-if, anomaly alerts, and premium UI only through the shared local-first architecture. Conversational intelligence must extend the existing unified Ask My Data agent rather than create a competing Agent X interface.

### Explicitly not added as immediate build requirements

- Smart storyboards: previously assessed as low incremental decision value.
- Public intelligence API endpoints: deferred until there are at least two real consumers.
- Broad backend/tRPC rewrite: conflicts with the local-first/no-backend architecture and stable-build constraints.
- Automatic data correction without preview or rollback: unacceptable corruption risk.
- A second analytics/chat architecture: duplicates existing Casino and Ask My Data surfaces.
