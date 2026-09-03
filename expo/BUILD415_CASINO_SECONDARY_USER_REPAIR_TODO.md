# Build 415 Casino + Secondary User Repair Todo

This list is the controlled repair sequence for the 38 reported Casino deficiencies. No item is considered complete merely because a card renders; its inputs, scope, provenance, empty state, and drill-down must also be verified.

## 1. Canonical truth and ownership

- [x] Scope Casino cruise records to the currently selected primary or secondary profile.
- [x] Scope Casino sessions and certificates to that same profile.
- [x] Preserve legacy unowned records for the primary profile only.
- [x] Permit Royal/Celebrity sync to target either an explicitly selected primary or secondary local profile.
- [x] Stamp synced offers, cruises, loyalty, and bookings with profile ID and login email.
- [x] Verify Offers, Cruises, Booked, Calendar, Ask My Data, loyalty cards, backup, and restore all apply the same profile boundary.
- [x] Add a two-profile regression fixture proving no cross-profile totals or records leak.

## 2. Points, tier, reconciliation, and health

- [x] Separate provider/profile balance from cruise-attributed points.
- [x] Show unallocated and over-attributed points explicitly.
- [x] Calculate earned Club Royale tier/progress from current points, not retained status.
- [x] Display retained/grandfathered tier separately from points-earned tier.
- [x] Replace the false binary health badge with missing-provider, over-attributed, unallocated, or reconciled states.
- [x] Add provider capture timestamp and exact source wording to the Casino command center.
- [x] Make headline reconciliation totals drill into completed sailings, certificate wallet, or data health.

## 3. Hours, PPH, coin-in, theo, ADT, and cash results

- [x] Separate actual hours from estimated hours.
- [x] Block circular PPH calculations that divide points by hours estimated from those same points.
- [x] Require a slot/provider or user-confirmed basis before using Club Royale points × $5 as coin-in.
- [x] Keep actual coin-in, point-derived coin-in, and unknown coin-in separately visible.
- [x] Require explicitly rated gaming days for ADT.
- [x] Separate gaming win/loss from cruise fare, value captured, and net trip economics in the canonical Casino views.
- [x] Rename modeled theo fields and correct ahead/behind-theo wording.

## 4. Certificates and future value

- [x] Stop summing mutually exclusive certificate sailing choices.
- [x] Show option count and min/median/max value instead.
- [x] Add exact/probable certificate-to-cruise link confidence and flag probable links for review.
- [x] Ensure certificate issue/expiry dates and source PDF rows remain queryable by Ask My Data.

## 5. Charts, forecasts, and derived intelligence

- [x] Forecast tier pace only through the applicable Apr–Mar or Aug–Jul reset boundary.
- [x] Group future cruises by their actual calendar month.
- [x] Use elapsed-season pace, not a fixed 12/24-month divisor.
- [x] Replace arbitrary Economic Health scoring with measurable evidence composition and label ship verified-field coverage literally.
- [x] Correct the season chart title/series mismatch and preserve signed cash-result bars.
- [x] Withhold sustainability when the required outcome sample is missing.
- [x] Rename Offer Safety to Historical Play-Data Stability unless a real offer-response model exists.
- [x] Remove Press Efficiency until its required inputs are implemented.

## 6. Sessions, tools, and evidence UX

- [x] Implement real Today/Week/Month/All filters for sessions.
- [x] Add owner-scoped session program correction controls when a program is unassigned/inferred.
- [x] Align value/hour, value/session, and risk/hour to current-season actual-hour/session scopes.
- [x] Remove the nonfunctional Weekly Goal/XP placeholder.
- [x] Standardize Actual, User-entered, Provider-reported, Estimated, Reconciled, Missing, and Needs review badges.
- [x] Add evidence drill-downs from every headline calculation.

## 7. Persistence and regression release gate

- [x] Flush queued writes before Save All.
- [x] Preserve manual cruise closeout points/win-loss fields during provider sync.
- [x] Publish a verified sync transaction into live app state immediately.
- [x] Include manual cruise-detail closeouts in canonical Casino calculations and backup.
- [x] Verify secondary-profile Save All/Load All restores profile ownership without reassignment.
- [x] Run startup, all-tab navigation, import, Casino, sync, certificate, weather, Ask My Data, and offline regressions.
- [x] Produce the versioned 13.0.49 (415) source ZIP only after the release gate passes.
