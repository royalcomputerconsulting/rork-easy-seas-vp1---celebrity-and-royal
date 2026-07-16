# OPT-10 Release Notes

## Release-candidate scope

OPT-10 completes the automated implementation sequence for the Personal Certificate Optimization Engine:

- canonical personal casino history;
- personal certificate value modeling;
- probability, expected-loss, and target models;
- marginal-EV optimal stopping;
- Live Casino Advisor;
- personal dashboard and drill-down analytics;
- Advisor, Ask My Data, and offer integration;
- transition-based alerts;
- learning, calibration, and chronological backtesting;
- release gating, profile-scoped persistence boundary, privacy documentation, and final automated QA.

## New OPT-10 safeguards

- Production enablement now has a typed, deterministic release gate.
- Requested optimizer flags are forced off unless every automated, data-authority, native, and readback check passes.
- A release-gated authority function retains `legacy-static` when any prerequisite is blocked.
- A profile-scoped backend repository/service/tRPC boundary was added for optimization snapshots.
- Backend snapshot writes require an exact owner-profile/owner-scope match and readback fingerprint verification.
- A complete scenario-matrix test composes the lower checkpoint model, engine, alert, and learning scenarios.

## Current enablement status

**Not enabled for production.**

Automated validation passes, but the following remain external release blockers:

- authenticated native Royal validation;
- authenticated native Carnival validation;
- authoritative durable Certificate Library validation;
- iOS and Android real-device validation;
- production storage transaction/readback validation.

All optimizer feature flags remain false and recommendation authority remains `legacy-static`.
