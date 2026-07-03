# EasySeas v1045 — Deficiency Closure Pass

## Scope
This build continues from v1044 and addresses the highest-priority deficiencies identified against the uploaded `.md` build plans.

## Added

### Certificate parsing foundation
- `lib/certificates/instantCertificateIndexParser.ts`
- `lib/certificates/instantCertificateDetailParser.ts`
- exact next-month unavailable message: `IT LOOKS LIKE THE NEXT MONTH'S CERTIFICATES ARE NOT AVAILABLE YET.`
- cached-data preservation helpers for zero-row/failed parses
- detail-row anchor parsing for FreePlay, Cruise Fare For 1/2, cabin category, GTY, nights, dates, OBC, and taxes/fees text

### Future Value Wallet and value ledger
- `lib/value/cruiseValueLedger.ts`
- `lib/value/futureValueWallet.ts`
- `lib/value/valueCalculations.ts`
- `lib/value/cruiseValueCalculations.ts`
- `lib/value/index.ts`
- NextCruise certificate model
- Future Cruise Credit model with partial usage
- annual Club Royale cruise benefit model
- Crown & Anchor/Pinnacle certificate model
- Scott Signature OBC override through `2026-02-28`
- VOOM default calculator at `$30/device/day`
- double-counting warnings for OBC-paid add-ons and FCC application

### UI components added for later wiring
- `components/value/FutureValueWalletCard.tsx`
- `components/analytics/CompletedCruiseLedgerCard.tsx`
- `components/analytics/CasinoStrengthRatingCard.tsx`

### Daily Luck foundation upgrade
- `lib/dailyLuck/luckCalendarEngine.ts`
- configurable profile model
- Chinese New Year boundary handling for 2026/2027 reference years
- 1–9 and 0–100 scoring
- casino/travel/relationship context fields
- safety disclaimers
- CSV row export
- ICS event export

### Points-engine cleanup
- Replaced several remaining direct `$5-per-point` coin-in derivations with `estimateCoinInForPoints(...)`.
- Updated AgentX formula language to reference the centralized points engine instead of a universal `$5` rule.

## Tests
- Added `scripts/testV1045DeficiencyClosures.ts`
- Added package script `test:v1045-deficiencies`
- Focused TypeScript compile passed for new/changed engine files.
- Runtime deficiency-closure test passed.

## Still not fully complete
This build adds engines and starter UI components, but full screen wiring remains:
- Certificate buttons still need to be wired to fetch PDFs and parse live text.
- Future Value Wallet card needs to be inserted into Dashboard/Settings.
- Completed Cruise Ledger card needs to be inserted into Analytics.
- Casino Strength Rating card needs to be inserted into Dashboard/Profile.
- Daily Luck current route/UI should be refactored to use the new full engine and exports.
- Full Expo app runtime was not run because the uploaded zip did not include `node_modules`.
