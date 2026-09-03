import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { buildTripCostLedger, calculateValueEfficiency } from '../lib/intelligence/tripCostLedger';
import { rankNextBestActions } from '../lib/intelligence/nextBestAction';
import { buildOfferLineage } from '../lib/intelligence/offerLineage';
import { optimizeCertificateRedemption } from '../lib/intelligence/certificateRedemptionOptimizer';
import { evaluateResponsiblePlay } from '../lib/casino/responsiblePlay';
import { calculateTheoreticalLoss } from '../lib/casino/theoreticalLoss';
import { calculateAdtScenario } from '../lib/casino/adtScenario';
import { evaluateCabinQuality } from '../lib/voyage/cabinQuality';
import { findVoyageScheduleConflicts } from '../lib/voyage/scheduleConflicts';
import { buildTravelChecklist } from '../lib/voyage/travelChecklist';
import { buildPortDayCommand } from '../lib/voyage/portDayCommand';
import { buildPostCruiseScorecard } from '../lib/voyage/postCruiseScorecard';

const now = new Date('2026-08-22T12:00:00Z').toISOString();
const ledger = buildTripCostLedger('trip-1', [
  { id: 'fare', tripId: 'trip-1', category: 'cruise_fare', label: 'Fare', amount: 1000, currency: 'USD', evidenceStatus: 'verified', updatedAt: now },
  { id: 'tax', tripId: 'trip-1', category: 'taxes_fees', label: 'Taxes', amount: 200, currency: 'USD', evidenceStatus: 'imported', updatedAt: now },
  { id: 'air', tripId: 'trip-1', category: 'airfare', label: 'Air', amount: 500, currency: 'USD', evidenceStatus: 'user_entered', updatedAt: now },
  { id: 'hotel', tripId: 'trip-1', category: 'hotel', label: 'Hotel', amount: 300, currency: 'USD', evidenceStatus: 'estimated', updatedAt: now },
  { id: 'gambling', tripId: 'trip-1', category: 'gambling_budget', label: 'Gambling', amount: 1500, currency: 'USD', evidenceStatus: 'user_entered', updatedAt: now },
]);
assert.equal(ledger.expectedTotal, 3500);
assert.equal(ledger.gamblingBudget, 1500);
assert(ledger.missingCategories.includes('parking'));
const efficiency = calculateValueEfficiency({ totalVacationValue: 6000, ledger, vacationDays: 7, casinoHours: 10 });
assert.equal(efficiency.netVacationValue, 2500);
assert.equal(efficiency.valuePerCasinoHour, 250);

const actions = rankNextBestActions([
  { id: 'expiring', type: 'book_expiring_offer', title: 'Expiring', explanation: 'Due', route: '/x', daysUntilDue: 2, expectedBenefit: 2000, confidence: 'high' },
  { id: 'missing', type: 'verify_missing_data', title: 'Missing', explanation: 'Missing', route: '/y', missingData: ['a', 'b', 'c'], confidence: 'low' },
]);
assert.equal(actions[0].id, 'expiring');
assert.equal(actions[0].externalSideEffect, false);

const duplicateCodeEvents = [
  { id: 'one', type: 'promotion_received' as const, occurredAt: now, entityId: 'offer-1', entityType: 'offer' as const, label: 'Offer 1', offerCode: '2607TOR403', playerOfferId: 'player-1', evidenceStatus: 'verified' as const },
  { id: 'two', type: 'promotion_received' as const, occurredAt: now, entityId: 'offer-2', entityType: 'offer' as const, label: 'Offer 2', offerCode: '2607TOR403', playerOfferId: 'player-2', evidenceStatus: 'verified' as const },
  { id: 'booking', type: 'booking_created' as const, occurredAt: now, entityId: 'booking-1', entityType: 'booking' as const, parentEntityId: 'offer-1', label: 'Booking', playerOfferId: 'player-1', evidenceStatus: 'verified' as const },
];
const lineage = buildOfferLineage(duplicateCodeEvents, 'offer-1');
assert.deepEqual(lineage.events.map((event) => event.entityId).sort(), ['booking-1', 'offer-1']);
assert(!lineage.events.some((event) => event.entityId === 'offer-2'), 'same marketing code must not merge unique offers');

const certificateResults = optimizeCertificateRedemption([{ shipName: 'Icon of the Seas', sailDate: '2026-09-26', decisionGuide: [], levels: [{ certificateCode: '2607A02A', certificateType: 'A', level: '02A', points: 1200, departurePort: 'Miami', itinerary: 'Caribbean', shipClass: 'Icon', nights: 7, startDay: 'Saturday', endDay: 'Saturday', isWeekendDeparture: true, isFloridaDeparture: true, offerTypeLabel: '2 guests', guestCount: 2, cabinLabel: 'Interior', isGty: false, freePlay: 500, onBoardCredit: 100, tradeInValue: null, nextCruiseBonusLabel: null, benefitSummary: [], sourcePage: 1, sourceGroup: 'fixture', validationStatus: 'verified', pdfUrl: 'local', monthlyIndexUrl: 'local' }] }], { certificateCode: '2607A02A', taxesBySailing: { 'icon of the seas__2026-09-26': 200 }, airfareBySailing: { 'icon of the seas__2026-09-26': 300 }, upgradeBySailing: { 'icon of the seas__2026-09-26': 0 } }, new Date('2026-08-22'));
assert.equal(certificateResults.length, 1);
assert.equal(certificateResults[0].expectedOutOfPocket, 500);
assert.equal(certificateResults[0].confidence, 'high');

const play = evaluateResponsiblePlay({ limits: { tripId: 'trip', tripBankroll: 1000, dailyStopLoss: 500, dailyWinGoal: 700, sessionMinutes: 60, cooldownMinutes: 30, privateOnDevice: true, updatedAt: now }, tripNetResult: -600, todayNetResult: -500, sessionMinutes: 61 });
assert.equal(play.state, 'stop_and_cool_down');
const theo = calculateTheoreticalLoss({ coinIn: 10000, assumedHoldPercent: 10, actualNetResult: -700, earnedCompValue: 300 });
assert.equal(theo.theoreticalLoss, 1000);
assert.match(theo.evidenceWarning, /assumption/i);
const adt = calculateAdtScenario({ totalCoinIn: 10000, daysPlayed: 2, assumedHoldPercent: 10 });
assert.equal(adt.estimatedTheoPerDay, 500);
assert.match(adt.warnings.join(' '), /proprietary/i);

const cabin = evaluateCabinQuality({ distanceToElevator: 'near', casinoDeckDistance: 2, noiseRisk: 'low', obstruction: 'none', motionPosition: 'low_midship', smokingExposure: 'none', priorRating: 5 });
assert(cabin.score >= 90);
const conflicts = findVoyageScheduleConflicts([{ id: 'dinner', title: 'Dinner', start: '2026-09-28T18:00:00Z', end: '2026-09-28T19:30:00Z', kind: 'dining' }, { id: 'show', title: 'Show', start: '2026-09-28T19:00:00Z', end: '2026-09-28T20:00:00Z', kind: 'show' }]);
assert.equal(conflicts[0].severity, 'blocking');
const checklist = buildTravelChecklist({ international: true, destinations: ['Tangier'], departureDate: '2026-09-26', hasFlights: true, hasHotel: true, hasTransfers: true });
assert(checklist.some((item) => item.id === 'passport'));
assert(checklist.some((item) => item.id === 'visas'));
const port = buildPortDayCommand({ port: 'Tangier', allAboard: '17:00', safetyBufferMinutes: 60, tender: true });
assert.equal(port.returnBy, '16:00');
assert(port.tenderWarning);
const scorecard = buildPostCruiseScorecard({ totalCost: 2000, compValue: 2500, casinoNetResult: -300, cabinRating: 4, shipRating: 5 });
assert.equal(scorecard.netEconomicValue, 200);
assert.equal(scorecard.experienceScore, 90);

const root = path.resolve(import.meta.dirname, '..');
for (const route of ['app/intelligence-center.tsx', 'app/offer-lineage.tsx', 'app/voyage-command-center.tsx', 'app/casino/onboard-mode.tsx', 'app/casino/ship-observations.tsx', 'app/casino/value-scenarios.tsx']) assert(fs.existsSync(path.join(root, route)), `${route} missing`);
const analytics = fs.readFileSync(path.join(root, 'app/(tabs)/analytics.tsx'), 'utf8');
assert.match(analytics, /casino-ship-intelligence-tab/);
assert.match(analytics, /activeTab === 'ship'/);
const intelligenceCenter = fs.readFileSync(path.join(root, 'app/intelligence-center.tsx'), 'utf8');
for (const label of ['WHY?', 'MISSING?', 'COMPARE', 'DO THIS']) assert.match(intelligenceCenter, new RegExp(label.replace('?', '\\?')));
const offerDetails = fs.readFileSync(path.join(root, 'app/offer-details.tsx'), 'utf8');
assert.match(offerDetails, /Book now or wait\?/);
assert.match(offerDetails, /evaluateBookTiming/);
console.log('Build 398 intelligence, voyage, and casino regression tests passed.');
