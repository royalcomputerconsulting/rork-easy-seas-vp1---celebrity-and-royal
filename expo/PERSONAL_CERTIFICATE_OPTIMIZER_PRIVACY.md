# Personal Certificate Optimizer Privacy and Data Handling

The optimizer is designed to learn only from the active user's profile-scoped casino history and certificate evidence.

## Stored optimization information

- Canonical cruise casino outcomes and field authority.
- Reconciled casino sessions.
- Certificate value snapshots and source references.
- Personal model snapshots and deterministic fingerprints.
- Live advisor state and recommendation snapshots.
- Alerts, recommendation outcomes, backtests, and learning controls.
- Release-gate status.

## Data minimization

The optimizer must not store or export:

- authentication tokens;
- cookies or session headers;
- passwords;
- raw authorization material;
- unrelated email contents;
- another profile's records;
- hidden production mock profiles.

Certificate evidence should reference durable document/version/page/row identities. Raw PDF bytes belong in the Certificate Library storage layer, not inside recommendation snapshots.

## Profile isolation

Every optimizer record includes `ownerProfileId`. Backend persistence also requires a matching owner-scope header. Reads, writes, deletion, alerts, learning, and reset controls are profile-scoped. Profile mismatch is a terminal error rather than a warning.

## User control

The user can exclude historical outcomes, clear live state, dismiss alerts, reset learning records, and rebuild models. Resetting learning must not delete underlying cruise or certificate evidence unless the user separately requests deletion of that source data.

## Explainability

Recommendations retain facts, estimates, assumptions, missing data, confidence, warnings, comparable history, model version, engine version, and exact input fingerprints. This supports correction and audit without exposing private authentication material.

## Production status

OPT-10 is an automated release candidate. Production optimizer flags remain disabled until authoritative certificate evidence and native authenticated Royal/Carnival validation pass.
