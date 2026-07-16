# OPT-1 Rollback Notes

OPT-1 does not replace or enable any production recommendation. The optimizer, Live Advisor, and learning feature flags remain disabled, and `legacy-static` remains the recommendation authority.

To roll back OPT-1 while retaining OPT-0:

1. Remove `lib/optimization/history/`.
2. Remove the history export line from `lib/optimization/index.ts`.
3. Remove the two `testOPT1*.js` scripts and the review-required migration fixture.
4. Restore the Checkpoint 1 status section in the execution TODO to unchecked.
5. Remove OPT-1 checkpoint evidence files.

No existing user data is migrated automatically. The legacy migration fixture is review-required, has no owner assignment or email address, and is rejected by default. Removing OPT-1 therefore requires no data rollback.
