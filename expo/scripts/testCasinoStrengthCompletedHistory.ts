import { calculatePointsFromCoinIn, estimateCoinInForPoints } from '../lib/casino/pointsEarning';
import { calculateCasinoStrengthRating } from '../lib/casino/casinoStrengthRating';
import { buildCompletedCruiseCasinoValueRecords, findCompletedCruiseDataGaps } from '../lib/cruise/completedCruiseHistory';
import { buildShipCasinoHistory } from '../lib/analytics/shipCasinoHistory';
import { buildCertificateMonthCode, buildCertificateDetailUrl, getThisMonthCertificateTargets } from '../lib/certificates/instantCertificateUrls';
import { buildCertificateChaseRecommendation } from '../lib/certificates/certificateChaseRecommendation';
import { buildDefaultInstantCertificateLevels, summarizeInstantCertificateLevel } from '../lib/certificates/instantCertificateSummaries';
import { buildHostViewProfile } from '../lib/analytics/hostView';

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
}

function runPointsEngineTests() {
  assert(calculatePointsFromCoinIn({ coinIn: 500, brand: 'royal', gameCategory: 'reel-slot' }).points === 100, 'Royal slot points should be coin-in / 5');
  assert(calculatePointsFromCoinIn({ coinIn: 1500, brand: 'royal', gameCategory: 'video-poker' }).points === 100, 'Royal VP points should be coin-in / 15');
  assert(calculatePointsFromCoinIn({ coinIn: 5000, brand: 'royal', gameCategory: 'table-game' }).source === 'manual-required', 'Royal table games should require manual/theoretical points');
  const freeplay = calculatePointsFromCoinIn({ cashCoinIn: 500, freeplayCoinIn: 1000, brand: 'royal', gameCategory: 'reel-slot' });
  assert(freeplay.points === 100, 'FreePlay should not add to point-eligible coin-in by default');
  assert(freeplay.warnings.some((warning) => warning.includes('FreePlay')), 'FreePlay warning should be present');
  assert(estimateCoinInForPoints({ targetPoints: 400, brand: 'royal', gameCategory: 'reel-slot' }).coinIn === 2000, 'Slot coin-in estimate failed');
  assert(estimateCoinInForPoints({ targetPoints: 400, brand: 'royal', gameCategory: 'video-poker' }).coinIn === 6000, 'VP coin-in estimate failed');
}

function runCompletedHistoryTests() {
  const completedCruises = [
    { id: 'star-2025-08-27', shipName: 'Star of the Seas', sailDate: '2025-08-27', returnDate: '2025-08-31', nights: 4, status: 'completed', casinoPoints: 4581, casinoWinLoss: 700, offerCode: '25TEST', freePlay: 500, tradeInValue: 500, casinoCompValue: 3242 },
    { id: 'wonder-2025-03-09', shipName: 'Wonder of the Seas', sailDate: '2025-03-09', returnDate: '2025-03-16', nights: 7, status: 'completed', casinoPoints: 2030, winLoss: 1300, casinoCompValue: 2952 },
    { id: 'missing-2025-01-01', shipName: 'Navigator of the Seas', sailDate: '2025-01-01', returnDate: '2025-01-05', nights: 4, status: 'completed' },
  ];
  const sessions = [
    { id: 'manual-1', cruiseId: 'star-2025-08-27', date: '2025-08-28', pointsEarned: 300, winLoss: 100, coinIn: 1500, machineType: 'penny-slots', sessionSource: 'individual' },
    { id: 'derived-1', cruiseId: 'star-2025-08-27', date: '2025-08-29', pointsEarned: 280, winLoss: 50, notes: 'Auto-calculated from cruise totals', sessionSource: 'extrapolated' },
    { id: 'unlinked', date: '2025-09-10', shipName: 'Allure of the Seas', pointsEarned: 100, winLoss: -20, sessionSource: 'individual' },
  ];
  const records = buildCompletedCruiseCasinoValueRecords({ completedCruises, sessions });
  const star = records.find((record) => record.shipName === 'Star of the Seas');
  assert(star?.pointsEarned === 4581, 'Cruise closeout points should be preserved');
  assert(star?.individualSessionCount === 1, 'Individual session should be linked and counted');
  assert(star?.extrapolatedSessionCount === 1, 'Extrapolated session should be linked and counted');
  assert(star?.warnings.some((warning) => warning.includes('Extrapolated')), 'Extrapolated session warning should be present');
  assert(records.some((record) => record.shipName === 'Allure of the Seas'), 'Unlinked individual session should still become a casino history record');
  const gaps = findCompletedCruiseDataGaps(records);
  assert(gaps.missingPoints.some((record) => record.shipName === 'Navigator of the Seas'), 'Missing points should be flagged');
  assert(gaps.missingWinLoss.some((record) => record.shipName === 'Navigator of the Seas'), 'Missing win/loss should be flagged');
  assert(gaps.missingValue.some((record) => record.shipName === 'Navigator of the Seas'), 'Missing value should be flagged');
  const ships = buildShipCasinoHistory(records);
  assert(ships[0].totalCasinoPointsEarned >= 2030, 'Ship history should aggregate points');
}

function runCasinoStrengthTests() {
  const rating = calculateCasinoStrengthRating({
    userProfile: { clubRoyaleTier: 'Signature', clubRoyalePoints: 26331 },
    completedCruises: [
      { id: 'star', shipName: 'Star of the Seas', sailDate: '2025-08-27', status: 'completed', casinoPoints: 4581, winLoss: 700, casinoCompValue: 3242, cabinCategory: 'Balcony' },
      { id: 'wonder', shipName: 'Wonder of the Seas', sailDate: '2025-03-09', status: 'completed', casinoPoints: 2030, winLoss: 1300, casinoCompValue: 2952, cabinCategory: 'Balcony' },
    ],
    certificates: [{ offerCode: '2606C05' }, { offerCode: '2607C04' }],
    offers: [{ freePlay: 500, tradeInValue: 500, roomType: 'Balcony' }],
  });
  assert(rating.strengthScore > 0, 'Casino Strength score should calculate');
  assert(rating.internalClassification !== 'unknown', 'Casino Strength classification should calculate');
  assert(rating.certificateSignalScore >= 65, 'Certificate signal should include level 04/05 history');
  assert(rating.warnings.some((warning) => warning.includes('internal estimate')), 'Unofficial classification warning is required');
}

function runCertificateTests() {
  assert(buildCertificateMonthCode('2026-07-05') === '2607', 'Month code should be YYMM');
  assert(buildCertificateDetailUrl('2607', 'C', '05').endsWith('/2607C05.pdf'), 'Detail URL formula failed');
  assert(getThisMonthCertificateTargets('2026-07-05').length === 42, 'This month targets should include 3 bank indexes + 39 details');
  const levels = buildDefaultInstantCertificateLevels('2607', 'C');
  assert(levels.length === 13, 'Default certificate ladder should include 13 levels');
  const level05 = levels.find((level) => level.levelCode === '05');
  assert(level05?.pointsRequired === 2000, 'Level 05 should require 2,000 points');
  if (!level05) throw new Error('Missing level 05');
  level05.sailings = [{ offerCode: '2607C05', shipName: 'Allure of the Seas', departurePort: 'Miami', sailDate: '2026-09-01', itinerary: 'Caribbean', nights: 7, stateroomType: 'Balcony GTY', stateroomCategory: 'balcony', isGuarantee: true, offerType: 'Cruise Fare For 2 Guests', guestCoverage: 'cruise-fare-for-2', nextCruiseBonusFreeplay: 500, nextCruiseObc: 75, rawText: 'Balcony GTY Cruise Fare For 2 Guests FreePlay' }];
  const summary = summarizeInstantCertificateLevel(level05);
  assert(summary.estimatedSlotCoinIn === 10000, 'Level summary slot coin-in should use $5 per point');
  assert(summary.estimatedRoyalVideoPokerCoinIn === 30000, 'Level summary VP coin-in should use $15 per point');
  assert(summary.hasCruiseFareFor2, 'Guest coverage should summarize fare for 2');
  const recommendation = buildCertificateChaseRecommendation({ currentPoints: 1900, levels, summaries: { [level05.code]: summary } });
  assert(recommendation.pointsNeeded === 100, 'Chase recommendation should calculate points needed');
  assert(recommendation.estimatedSlotCoinInNeeded === 500, 'Chase slot coin-in should calculate');
  assert(recommendation.warnings.some((warning) => warning.includes('not expected loss')), 'Chase warning should prevent coin-in/expected-loss confusion');
}

function runHostViewSessionIntegrationTests() {
  const profile = buildHostViewProfile({
    userProfile: { name: 'Scott Merlis', clubRoyaleTier: 'Signature', clubRoyalePoints: 26331 },
    completedCruises: [{ id: 'star', shipName: 'Star of the Seas', sailDate: '2025-08-27', status: 'completed', casinoPoints: 4581, winLoss: 700, casinoCompValue: 3242 }],
    sessions: [
      { id: 'manual', cruiseId: 'star', shipName: 'Star of the Seas', pointsEarned: 300, winLoss: 100, coinIn: 1500, sessionSource: 'individual' },
      { id: 'derived', cruiseId: 'star', shipName: 'Star of the Seas', pointsEarned: 300, winLoss: 100, notes: 'Auto-calculated from cruise totals', sessionSource: 'extrapolated' },
      { id: 'unlinked', shipName: 'Allure of the Seas', pointsEarned: 100, winLoss: -20, coinIn: 500, sessionSource: 'individual' },
    ],
  });
  assert(profile.totalCasinoSessions === 3, 'Host View should count all individual and extrapolated sessions');
  assert(profile.individualSessionsTracked === 2, 'Host View should track individual sessions');
  assert(profile.extrapolatedSessionsTracked === 1, 'Host View should track extrapolated sessions');
  assert(profile.totalPointsEarned === 4681, 'Host View should use cruise closeout plus unlinked sessions without double-counting linked derived sessions');
  assert(profile.casinoStrengthRating?.strengthScore, 'Host View should include Casino Strength Rating');
}

runPointsEngineTests();
runCompletedHistoryTests();
runCasinoStrengthTests();
runCertificateTests();
runHostViewSessionIntegrationTests();
console.log('Casino Strength / completed history / points / certificate engine tests passed.');
