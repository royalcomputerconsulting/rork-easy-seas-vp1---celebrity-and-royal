# Easy Seas v12.4.2 Build 313
## Carnival Sync Priority 0 — Stage 1 QA

**Stage status:** Complete  
**Scope:** Priority 0 only  
**Next stage:** Priorities 1–3 (request-specific API capture, zero-result/pagination proof, and per-rate-code personalization isolation)

## What was implemented

### 1. Account-bound checkpoint version 2

- Replaced the old code-list-only checkpoint with a version 2 checkpoint identity.
- The identity is tied to:
  - selected EasySeas profile ID;
  - hashed authenticated EasySeas email;
  - verified Carnival VIFP number;
  - Carnival personalization/TGO context;
  - resident, locality, and currency context;
  - the complete normalized rate-code catalog.
- A checkpoint without a verified VIFP number is retained only for diagnostics and cannot auto-resume.
- A checkpoint is rejected when the Carnival account, catalog, or code-specific context changes.
- Legacy version 1 checkpoints are removed.

### 2. Explicit status ledger for every Carnival rate code

Every visible rate code is written to the checkpoint before extraction starts. Supported states are:

- `success`
- `authoritative_empty`
- `incomplete`
- `blocked`
- `auth_lost`
- `cancelled`
- `failed`

Only `success` and `authoritative_empty` may be skipped during resume. Every other state remains resumable.

### 3. Exact offer context retained per code

Each checkpoint code record stores:

- normalized rate code;
- exact code-specific Shop Now URL;
- TGO hash;
- context fingerprint;
- offer name;
- offer expiration;
- extraction timestamp;
- total results seen;
- pages visited;
- current rows and error state.

### 4. Unverified zero-result protection

- A visible offer is marked `authoritative_empty` only when the parser receives authoritative empty-result proof.
- DOM-only or ambiguous zero-row outcomes remain `incomplete`.
- Incomplete rows are visibly marked `Fallback Extraction Incomplete` and cannot authorize removal of stored Carnival offers or sailings.
- A partially resolved catalog is reported as partial rather than complete.

### 5. Transactional Apply Sync with recovery journal

Before Carnival Apply Sync changes stored data, Build 313 creates a checksummed recovery journal containing:

- all existing offers;
- all existing available cruises;
- all existing booked/completed cruises;
- the selected profile snapshot;
- all intended replacement data and profile updates;
- selected sections and transaction ID.

The journal remains until every required local collection and selected-profile write succeeds. A failure before commit triggers rollback of all journaled collections and the selected profile. If rollback cannot finish, the journal remains in `rolling_back` state for automatic recovery on the next Apply Sync.

A pre-existing unfinished journal is validated and rolled back before a new Carnival Apply Sync can begin. A tampered or invalid journal blocks new data changes.

### 6. Carnival-only profile persistence

Carnival profile writes now use only Carnival-specific fields:

- `carnivalVifpNumber`
- `carnivalVifpTier`
- `carnivalVifpPoints`
- `carnivalCruiseDayPoints`
- `carnivalTotalCruises`
- `carnivalPlayersClubTier`
- `carnivalPlayersClubPoints`

Carnival transactional writes do not use Crown & Anchor or Club Royale fields.

### 7. Build identifiers

- Marketing version: **12.4.2**
- iOS build: **313**
- Android versionCode: **120404**

## QA performed

### Regression scripts

| Codebase | Test files | Passed | Failed |
|---|---:|---:|---:|
| Build 311 baseline | 17 | 17 | 0 |
| Build 312 baseline | 18 | 18 | 0 |
| Build 313 Stage 1 | 19 | 19 | 0 |

### TypeScript/TSX syntax transpilation

| Codebase | Files checked | Syntax errors |
|---|---:|---:|
| Build 311 baseline | 408 | 0 |
| Build 312 baseline | 409 | 0 |
| Build 313 Stage 1 | 410 | 0 |

### Build 313 behavioral tests added

The new executable Stage 1 test verifies:

- same-account/same-context checkpoint compatibility;
- rejection after VIFP account change;
- rejection after code-specific context change;
- rejection of automatic resume without verified VIFP identity;
- skip behavior for only successful or authoritatively empty codes;
- checksum validation and tamper detection;
- profile snapshot/target-profile consistency;
- simulated partial-write recovery from the journal snapshot;
- preservation of journal immutability during recovery;
- expected provider transaction and partial-catalog guardrails.

### Additional validation

- App Store version hardlock passed for 12.4.2 (313).
- Selected changed-file type diagnostics contained no relevant code errors; all reported diagnostics were missing-dependency/module-resolution diagnostics caused by the archive not containing installed dependencies.
- Source-diff review confirmed changes are limited to the Carnival checkpoint/transaction implementation, metadata propagation, build identifiers, and associated QA scripts.

## Release limitations

This environment cannot perform an authenticated live Carnival session, execute the native iOS WebView, or produce an App Store binary. Therefore Stage 1 proves source integrity, checkpoint behavior, recovery-journal behavior, syntax, and regression compatibility—but the live Carnival account flow must still be exercised on-device.

## Stage boundary

Priority 0 is complete in this build. Priorities 1–4 are not represented as complete here. They remain intentionally separated into the next two stages to reduce timeout and regression risk.
