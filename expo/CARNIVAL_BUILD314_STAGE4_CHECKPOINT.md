# Carnival Build 314 Stage 4 Checkpoint

Completed full personalized-catalog and per-code resume repair:

- The authenticated run catalog is locked as a union; later partial discoveries cannot remove earlier codes.
- Same-account checkpoints can restore temporarily missing catalog codes after app/WebView restart.
- Checkpoint compatibility is account-bound by VIFP, EasySeas profile/email hash, residency/locality, currency, and overlapping code context—not by an exact transient catalog count.
- Completed and authoritative-empty codes remain skipped on resume.
- Incomplete codes resume from saved rows, total, next page number, and next URL.
- Every nonterminal completed page is checkpointed immediately.
- Each real personalized code retains an offer record even when its sailing lane remains incomplete.
- Final reconciliation logs discovered/completed/incomplete codes, offer count, unique sailing count, and sailing count by code.

Validation:
- Existing Build 314 Priority 1-3 test: PASS.
- Existing Build 315 Priority 4-8 test: PASS.
- TypeScript syntax transpilation for all modified TS/TSX files: PASS.
