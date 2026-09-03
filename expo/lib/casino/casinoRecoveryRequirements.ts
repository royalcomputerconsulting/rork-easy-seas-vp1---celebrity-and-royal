export const OPERATOR_SOURCE_REQUIRED = 'Unavailable — authoritative source required' as const;

export type CasinoRequirementStatus = 'active' | 'guarded' | 'operator_source_required' | 'test_required';

export interface CasinoMetricDictionaryEntry {
  key: string;
  label: string;
  definition: string;
  personalSource: string;
  operatorSource?: string;
}

export interface CasinoRecoveryRequirement {
  id: number;
  title: string;
  status: CasinoRequirementStatus;
  summary: string;
  safeguards: string[];
}

export const CASINO_METRIC_DICTIONARY: CasinoMetricDictionaryEntry[] = [
  { key: 'coin_in', label: 'Coin-in', definition: 'Total wagering volume cycled through eligible games; never treated as spend, loss, or economic value.', personalSource: 'Actual session coin-in, cruise closeout coin-in, or Club Royale slot points × $5 when explicitly labeled.', operatorSource: 'Slot/table CMS meters and rating records.' },
  { key: 'turnover', label: 'Turnover', definition: 'Operator-facing gaming volume across slots, tables, and rated games.', personalSource: OPERATOR_SOURCE_REQUIRED, operatorSource: 'CMS/table rating/cage integration.' },
  { key: 'theo', label: 'Theo', definition: 'Expected loss from rated play using explicit theo or valid coin-in × configured hold.', personalSource: 'Recorded theo first; otherwise sourced house-edge assumption with confidence.' },
  { key: 'actual', label: 'Actual', definition: 'Cash result from play, calculated as cash-out plus separately paid jackpots minus cash-in.', personalSource: 'Owner-entered sessions and cruise closeouts.' },
  { key: 'gaming_day', label: 'Gaming day', definition: 'A casino accounting day that may differ from calendar date because of ship-local cutoff rules.', personalSource: 'Ship-local estimate until an operator cutoff source exists.', operatorSource: 'Casino rating ledger/cutoff configuration.' },
  { key: 'rated_day', label: 'Rated day', definition: 'A day with qualifying rated casino activity used for ADT/ADW.', personalSource: 'Owner-supplied rated day count or actual session dates.', operatorSource: 'Casino ratings system.' },
  { key: 'adt', label: 'ADT', definition: 'Average daily theoretical loss: theo divided by rated gaming days.', personalSource: 'Owner-scoped theo and rated-day records.' },
  { key: 'adw', label: 'ADW', definition: 'Average daily worth: actual/theo/value model per rated day depending on program policy.', personalSource: 'Shown as guarded estimate unless source rules are configured.', operatorSource: 'Casino marketing model.' },
  { key: 'player_worth', label: 'Player worth', definition: 'Casino value estimate combining theo, frequency, recency, consistency, confidence, and reinvestment assumptions.', personalSource: 'Personal planning estimate only, labeled as projection.' },
  { key: 'traveler_value', label: 'Traveler value', definition: 'Owner-facing value captured from fares, certificates, OBC, FreePlay, benefits, and cash result.', personalSource: 'Receipts, cruise ledger, certificate wallet, and sessions.' },
  { key: 'operator_cost', label: 'Operator cost', definition: 'Cruise line cost to provide cabin, offers, freeplay, amenities, and service recovery.', personalSource: OPERATOR_SOURCE_REQUIRED, operatorSource: 'Revenue management, hotel ops, campaign, and finance feeds.' },
  { key: 'reinvestment', label: 'Reinvestment', definition: 'Offer or comp investment as a share of expected casino/traveler worth.', personalSource: 'Scenario estimate only; operator view requires approved feeds.', operatorSource: 'CMS/campaign/finance integration.' },
  { key: 'response', label: 'Response', definition: 'Whether an offer exposure produced engagement or booking.', personalSource: 'Local offer/booked-cruise linkage.', operatorSource: 'Campaign exposure and channel engagement feeds.' },
  { key: 'redemption', label: 'Redemption', definition: 'Whether a certificate, annual reward, FreePlay, OBC, or benefit was used on a booking.', personalSource: 'Receipt importer, certificate wallet, benefits ledger.' },
  { key: 'lift', label: 'Lift', definition: 'Incremental difference between treated and control groups.', personalSource: OPERATOR_SOURCE_REQUIRED, operatorSource: 'Campaign lab treatment/control data.' },
  { key: 'contribution', label: 'Contribution', definition: 'Net operator margin after expected costs and reinvestment.', personalSource: OPERATOR_SOURCE_REQUIRED, operatorSource: 'Finance/revenue/campaign integrations.' },
];

export const CASINO_RECOVERY_REQUIREMENTS: CasinoRecoveryRequirement[] = [
  { id: 41, title: 'Sustainability score and ADT smoothing', status: 'active', summary: 'Sustainability and ADT display inspectable formulas, minimum evidence warnings, and sparse-data labels.', safeguards: ['minimum evidence rules', 'sparse data warnings', 'owner-scoped inputs only'] },
  { id: 42, title: 'Variance and streak analysis', status: 'active', summary: 'Standard deviation, median, best/worst, win/loss/break-even, streaks, and game-type results use real sessions only.', safeguards: ['generated rows excluded', 'estimated-only rankings blocked'] },
  { id: 43, title: 'Predictive score factors', status: 'guarded', summary: 'Predictions expose points efficiency, value/time, cash result, consistency, and confidence separately from historical facts.', safeguards: ['projection labels', 'reason-code display', 'no tier masquerading'] },
  { id: 44, title: 'Formula reference and settings', status: 'active', summary: 'Formula Reference and Casino Settings remain linked for point conversions, hold, targets, bankroll, and program assumptions.', safeguards: ['per-program settings', 'assumption review'] },
  { id: 45, title: 'Receipt importer', status: 'active', summary: 'Royal/Celebrity receipts can attach reservation, ship, date, cabin, offer, fare, comp, taxes, paid, balance, and promotions to a booking.', safeguards: ['confirmation screen', 'receipt confidence', 'no silent overwrite'] },
  { id: 46, title: 'Certificate-to-earning-cruise linkage', status: 'active', summary: 'Certificates link by exact IDs first, then issue date within completed cruise windows, preserving expiration, class, points, value, redemption, and confidence.', safeguards: ['date-window fallback', 'confidence labels'] },
  { id: 47, title: 'Certificate-to-booking redemption', status: 'active', summary: 'Receipt offer/promotion lines can identify the certificate or annual tier reward used, including the TIER annual-cruise case.', safeguards: ['promotion parsing', 'annual reward linkage'] },
  { id: 48, title: 'Booked-page Casino cards', status: 'active', summary: 'External Casino cards consume the same owner-scoped ledger and formulas instead of stale hardcoded tier or point data.', safeguards: ['ledger authority', 'single formula source'] },
  { id: 49, title: 'Ask My Data Casino coverage', status: 'active', summary: 'Ask My Data indexes cruise ledger, sessions, receipts, certificates, tiers, ships, points, theo, hours, confidence, crew, calendar, and weather context.', safeguards: ['evidence-backed answers', 'local fallback when assistant service fails'] },
  { id: 50, title: 'Exports', status: 'active', summary: 'Portfolio, host, session, formula-input, and complete owner-scoped Casino export data are included in admin/overall export logs.', safeguards: ['owner scope', 'formula inputs included'] },
  { id: 51, title: 'Complete backup coverage', status: 'active', summary: 'Backup domains include casino ledger, sessions, settings, receipts, certificate links, derived-cache metadata, crew, recognition history, and existing app datasets.', safeguards: ['domain manifest', 'owner validation'] },
  { id: 52, title: 'Chunked transactional restore', status: 'active', summary: 'Restore validates off-render-path, writes bounded chunks, yields between chunks, commits atomically, and keeps live data until validation succeeds.', safeguards: ['transactional staging', 'yield between chunks'] },
  { id: 53, title: 'One restore notification per domain', status: 'active', summary: 'Hydration suppresses row-by-row context updates and publishes compact completion snapshots by domain.', safeguards: ['batched notifications', 'completion snapshots'] },
  { id: 54, title: 'Crew registry scaling', status: 'active', summary: 'Large crew registries use indexed/paged storage, visible/search-result page loading, virtualized lists, and history outside global in-memory contexts.', safeguards: ['paged registry', 'virtualized UI'] },
  { id: 55, title: 'Restore progress, cancel, and recovery', status: 'active', summary: 'Restore exposes current domain progress, safe cancellation, exportable failure logs, and clean termination recovery.', safeguards: ['cancel token', 'recovery log'] },
  { id: 56, title: 'Background derived summaries', status: 'active', summary: 'Casino, Ask My Data, calendar, certificate, and crew summaries rebuild after core data becomes usable and invalidate only affected summaries.', safeguards: ['background queue', 'targeted invalidation'] },
  { id: 57, title: 'Startup fast path', status: 'active', summary: 'Startup prioritizes profile/navigation/compact indexes and defers large cruise, offer, certificate, weather, crew, and Casino histories until requested.', safeguards: ['fast path first', 'deferred domains'] },
  { id: 58, title: 'Memory bounds', status: 'active', summary: 'Paging, bounded queues, cancellation, listener cleanup, and instrumentation cover record counts, hydration time, UI stalls, and peak-memory proxies.', safeguards: ['bounded queues', 'instrumentation'] },
  { id: 59, title: 'Casino calculation fixtures', status: 'test_required', summary: 'Regression fixtures cover empty users, Scott history, current Royal season, Celebrity August reset, discrepancies, receipts, sessions, jackpots, sparse data, and multiple profiles.', safeguards: ['fixture matrix', 'owner scoped'] },
  { id: 60, title: 'Casino UI regression', status: 'test_required', summary: 'Regression verifies restored sections render, scroll, edit, filter, export, persist, and return after restart without Retry.', safeguards: ['no Retry screen', 'navigation coverage'] },
  { id: 61, title: 'Restore/load scale tests', status: 'test_required', summary: 'Scale tests exercise empty, normal, 4,500+ cruise, 30,000+ sailing, 925+ crew, large certificate, and full-backup fixtures.', safeguards: ['responsiveness measurement', 'memory bounds'] },
  { id: 62, title: 'Whole-app navigation regression', status: 'test_required', summary: 'Regression switches across all tabs during and after restore, opens cruise details, and uses Back without hangs.', safeguards: ['tab liveness', 'back liveness'] },
  { id: 63, title: 'Protected feature regression', status: 'test_required', summary: 'Regression protects Royal/Celebrity sync, Carnival full sync, certificates, weather, Ask My Data, calendar, loyalty, cloud sync, admin logs, and offline startup.', safeguards: ['protected feature matrix'] },
  { id: 64, title: 'Release gate', status: 'guarded', summary: 'Release requires typecheck, lint, tests, Expo/Metro validation, device smoke, version/build increment, clean ZIP, and EAS/TestFlight evidence.', safeguards: ['no version bump before gates', 'clean artifact'] },
  { id: 65, title: 'Versioned metric dictionary', status: 'active', summary: 'Metric dictionary is versioned and defines coin-in, turnover, theo, actual, gaming day, rated day, ADT, ADW, player worth, traveler value, operator cost, reinvestment, response, redemption, lift, and contribution.', safeguards: ['versioned definitions'] },
  { id: 66, title: 'Gaming-day and rating ledger', status: 'guarded', summary: 'Ledger schema stores ship-local and operator gaming-day fields with exceptions; operator cutoff remains unavailable until sourced.', safeguards: ['timezone fields', 'exception log'] },
  { id: 67, title: 'Effective-dated game configuration', status: 'guarded', summary: 'Game configuration supports sourced paytable/RTP/hold rules, effective dates, confidence, and unknown state.', safeguards: ['effective dates', 'unknown state'] },
  { id: 68, title: 'Expanded play analytics', status: 'guarded', summary: 'Analytics include ADW, A/T ratio, theo/hour, concentration, game mix, rolling RFV, trends, consistency, and confidence bands with small-sample warnings.', safeguards: ['small sample warnings'] },
  { id: 69, title: 'Player 360', status: 'guarded', summary: 'Identity, accounts, household, preferences, consent, restrictions, trips, ratings, offers, contacts, cases, benefits, and next actions are modeled with owner scope and audit history.', safeguards: ['owner scope', 'audit history'] },
  { id: 70, title: 'Host Today and workflow', status: 'guarded', summary: 'Host workflow models arrivals, opportunities, ratings, tasks, contacts, promises, service recovery, handoffs, discretionary comps, approvals, and attribution.', safeguards: ['approval state', 'outcome attribution'] },
  { id: 71, title: 'Offer Economics Workbench', status: 'guarded', summary: 'Traveler Economics remains separate from Operator Economics; operator contribution fields require approved authoritative integrations.', safeguards: ['traveler/operator separation', OPERATOR_SOURCE_REQUIRED] },
  { id: 72, title: 'Eligibility and suppression gate', status: 'guarded', summary: 'Recommendations check market, channel, capacity, blackout, combinability, household, jurisdiction, consent, DNC, self-exclusion, disputes, fraud, duplicates, and recent bookings.', safeguards: ['responsible-gaming suppression', 'eligibility reasons'] },
  { id: 73, title: 'Campaign Lab and attribution', status: 'operator_source_required', summary: 'Treatment/control, exposure, channel engagement, contribution, lift, and attribution require casino campaign sources.', safeguards: [OPERATOR_SOURCE_REQUIRED] },
  { id: 74, title: 'Player lifecycle models', status: 'guarded', summary: 'RFM, lifecycle, next-trip theo, LTV, wallet share, churn, reactivation, cross-sell, preferences, channel affinity, household value, and reason codes are modeled as transparent projections.', safeguards: ['reason codes', 'projection labels'] },
  { id: 75, title: 'Responsible-gaming controls', status: 'active', summary: 'Optional budgets, cooldowns, reality checks, help resources, hard suppressions, auditability, and non-wager-rewarding design are first-class guardrails.', safeguards: ['not a wagering target', 'hard suppression'] },
  { id: 76, title: 'Machine/AP journal upgrade', status: 'guarded', summary: 'Machine journal supports observation freshness, RTP confidence, meters, conditional EV, cycle cost, bankroll, risk of ruin, stops, occupancy risk, and calibration.', safeguards: ['confidence labels', 'stop conditions'] },
  { id: 77, title: 'Operator-only slot asset module', status: 'operator_source_required', summary: 'Asset/configuration, paytables, meters, faults, work orders, approvals, reconciliation, and compliance history require separate operator deployment.', safeguards: [OPERATOR_SOURCE_REQUIRED] },
  { id: 78, title: 'Cruise Total Cost ledger', status: 'active', summary: 'Cruise cost ledger normalizes fare, NCF, taxes, gratuities, insurance, air, hotel, transfers, parking, packages, excursions, onboard/casino charges, credits, FCC, deposits, and FX.', safeguards: ['planned/actual/refunded states'] },
  { id: 79, title: 'Cabin and pricing intelligence', status: 'guarded', summary: 'Cabin intelligence tracks category/code, size, balcony, obstruction, adjacency, accessibility, bid status, inventory snapshots, pricing, cancellation, and alternatives.', safeguards: ['source freshness', 'repricing eligibility'] },
  { id: 80, title: 'Travel Readiness', status: 'active', summary: 'Travel readiness structures passengers, loyalty IDs, check-in, terminal, documents, passports, sourced visa guidance, accessibility, flights, hotels, transfers, parking, insurance, and deadlines.', safeguards: ['redacted sharing', 'deadline alerts'] },
  { id: 81, title: 'Voyage Live / Incident Center', status: 'guarded', summary: 'Voyage incident center models berth, tender, all-aboard, local-zone, change history, marine/weather/tide, disruptions, acknowledgments, and recovery actions.', safeguards: ['authoritative source labeling'] },
  { id: 82, title: 'Onboard Day', status: 'guarded', summary: 'Onboard day combines local dining, entertainment, excursions, casino/cage hours, events, drawings, host events, table minimums, tier benefits, FreePlay expiry, connectivity, reminders, and offline docs.', safeguards: ['offline documents', 'ship-local time'] },
  { id: 83, title: 'Folio/OBC and post-trip closeout', status: 'guarded', summary: 'Folio closeout models charge-level folio, package coverage, OBC ordering, casino flags, disputes, refunds/FCC, benefits, loyalty posting, W-2G links, ratings, and next-offer attribution.', safeguards: ['folio source labels', 'post-trip attribution'] },
  { id: 84, title: 'Domain-specific data health', status: 'active', summary: 'Data health scores rated-day coverage, offer terms, itinerary authority, total-cost reconciliation, freshness, conflicts, corrections, duplicates, and quarantine totals.', safeguards: ['quarantine totals', 'conflict labels'] },
  { id: 85, title: 'Alert framework', status: 'active', summary: 'Alerts store rule/version, entity, detected/source time, severity, confidence, explanation, action, owner, due, acknowledgment, resolution, snooze, and audit history.', safeguards: ['audit history', 'snooze/resolution'] },
  { id: 86, title: 'Privacy and governance', status: 'guarded', summary: 'Privacy model documents encryption, least privilege, redaction, immutable audit, retention, export/delete, device-compromise response, and personal/operator separation.', safeguards: ['field redaction', 'personal/operator separation'] },
  { id: 87, title: 'Versioned integration contracts', status: 'operator_source_required', summary: 'Approved CMS, slots, tables, cage, reservations, folio, campaign, inventory, loyalty, port, airline, and weather integrations must publish versioned schemas.', safeguards: [OPERATOR_SOURCE_REQUIRED] },
  { id: 88, title: 'Model governance', status: 'guarded', summary: 'Predictions expose named features, outcome, training/as-of date, validation, confidence, reason codes, drift, and rules fallback.', safeguards: ['reason codes', 'drift labels'] },
  { id: 89, title: 'Casino-marketing readiness scenarios', status: 'test_required', summary: 'Readiness scenarios cover cancellations, corrections, duplicates, late ratings, timezone boundaries, rule changes, offers, capacity, suppression, and treatment/control attribution.', safeguards: ['scenario matrix', 'no readiness claim without tests'] },
];

export function getCasinoRecoveryRequirementsByStatus(status: CasinoRequirementStatus): CasinoRecoveryRequirement[] {
  return CASINO_RECOVERY_REQUIREMENTS.filter((requirement) => requirement.status === status);
}

export function buildCasinoRecoveryStatusSummary() {
  const counts = CASINO_RECOVERY_REQUIREMENTS.reduce<Record<CasinoRequirementStatus, number>>((acc, requirement) => {
    acc[requirement.status] += 1;
    return acc;
  }, { active: 0, guarded: 0, operator_source_required: 0, test_required: 0 });
  return {
    version: '2026-08-24-build410-recovery',
    total: CASINO_RECOVERY_REQUIREMENTS.length,
    counts,
    operatorOnlyLabel: OPERATOR_SOURCE_REQUIRED,
    metricCount: CASINO_METRIC_DICTIONARY.length,
  };
}
