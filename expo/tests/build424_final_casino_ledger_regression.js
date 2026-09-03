const assert = require('node:assert/strict');
const { loadTs } = require('../scripts/clubRoyaleTestBootstrap');

const annual = loadTs('lib/casinoAnnualReportFacts.ts').ANNUAL_CASINO_REPORT_FACTS;
const pointTruth = loadTs('lib/casinoPointTruth.ts');
const history = loadTs('lib/casino/ownerScopedCasinoHistory.ts');
const truth = loadTs('lib/casino/casinoTruthEngine.ts');
const dashboard = loadTs('lib/casino/casinoDashboardMetrics.ts');
const askOverview = loadTs('lib/askMyDataOverview.ts');
const pipeline = loadTs('lib/certificates/certificatePdfPipeline.ts');
const valueLedger = loadTs('lib/value/cruiseValueLedger.ts');

assert.equal(annual.length, 21);
assert.equal(annual.reduce((sum, row) => sum + row.originalCasinoPoints, 0), 34_537);
assert.equal(annual.reduce((sum, row) => sum + (row.annualReconciliationPoints ?? 0), 0), 24_143);
assert.equal(annual.reduce((sum, row) => sum + (row.allocatedCasinoPoints ?? 0), 0), 0);
assert.equal(annual.reduce((sum, row) => sum + row.pointsEarned, 0), 34_537);
assert.equal(annual.reduce((sum, row) => sum + row.pointsEarned * 5, 0), 172_685);
assert.equal(annual.reduce((sum, row) => sum + row.winningsBroughtHome, 0), 19_457);

const current = pointTruth.KNOWN_CURRENT_CLUB_ROYALE_CRUISES;
assert.equal(current.length, 12);
assert.equal(current.reduce((sum, row) => sum + row.pointsEarned, 0), 21_460);
assert.equal(current.reduce((sum, row) => sum + row.pointsEarned * 5, 0), 107_300);
assert.equal(current.reduce((sum, row) => sum + (row.winningsBroughtHome ?? 0), 0), 6_715);
assert.equal(pointTruth.CONFIRMED_CLUB_ROYALE_2026_POINTS - current.reduce((sum, row) => sum + row.pointsEarned, 0), 1_986);
assert.equal(pointTruth.getCertificatePointRequirement('2607C08'), 800);
assert.equal(pointTruth.getCertificatePointRequirement('2607C05'), 2000);
assert.equal(pointTruth.getCertificatePointRequirement('2312C6'), 1500);
assert.equal(pointTruth.getCertificatePointRequirement('2509A09'), 600);
assert.equal(pointTruth.getCertificatePointRequirement('2607TOR403'), null, 'targeted marketing offers must not be treated as point certificates');
const starC08 = current.find((row) => row.shipName === 'Star of the Seas' && row.sailDate === '2026-07-05');
assert.equal(starC08?.pointsEarned, 800);
assert.equal(starC08?.certificateEvidenceCode, '2607C08');

const equinox = history.applyOwnerScopedCasinoHistory({
  id: 'equinox', shipName: 'Celebrity Equinox', sailDate: '2026-08-06', returnDate: '2026-08-15', nights: 9,
  status: 'completed', completionState: 'completed', cruiseSource: 'celebrity', brand: 'Celebrity', guestNames: ['Scott Merlis'],
});
assert.equal(equinox.casinoProgram, 'blueChip');
assert.equal(equinox.pointsEarned, 667);
assert.equal(equinox.winningsBroughtHome, 581);
assert.equal(equinox.coinIn, undefined, 'Blue Chip points must not use the Club Royale $5 conversion');

const allocatedTruth = truth.buildCasinoCruiseTruth({ cruise: {
  id: 'allocated', shipName: 'Icon of the Seas', sailDate: '2026-05-09', returnDate: '2026-05-16', nights: 7,
  status: 'completed', cruiseSource: 'royal', casinoProgram: 'clubRoyale', pointsEarned: 2099,
  calculationConfidence: 'estimated', notes: 'Final user-approved allocation of synced but previously unassigned points.',
  instantCertificateOfferCode: '2607C08',
} });
assert.equal(allocatedTruth.points.kind, 'estimated');
assert.equal(allocatedTruth.points.value, 800);
assert.equal(allocatedTruth.coinIn.value, 4000);
assert.match(allocatedTruth.points.formula ?? '', /800/);

const earnedFaceSameLine = pipeline.extractEarnedCertificateFaceFields(`
NAME: SCOTT MERLIS
CROWN & ANCHOR NUMBER: 305812247
OFFER CODE: 2509A09
AWARD TYPE: $200 USD OFF
EXPIRATION DATE: 10/12/2025
SHIP NAME: Navigator of the Seas
SAILING DATE: 9/8/2025
`);
assert.equal(earnedFaceSameLine?.certificateCode, '2509A09');
assert.equal(earnedFaceSameLine?.awardValue, 200);
assert.equal(earnedFaceSameLine?.expirationDate, '2025-10-12');
assert.equal(earnedFaceSameLine?.shipName, 'Navigator of the Seas');
assert.equal(earnedFaceSameLine?.sailingDate, '2025-09-08');
assert.equal(earnedFaceSameLine?.pointsRequired, 600);

const earnedFaceColumnar = pipeline.extractEarnedCertificateFaceFields(`
NAME:
CROWN & ANCHOR NUMBER:
OFFER CODE:
AWARD TYPE:
EXPIRATION DATE:
SHIP NAME:
SAILING DATE:
SCOTT MERLIS
305812247
2509A09
$200 USD OFF
10/12/2025
Navigator of the Seas
9/8/2025
`);
assert.equal(earnedFaceColumnar?.certificateCode, '2509A09');
assert.equal(earnedFaceColumnar?.sailingDate, '2025-09-08');

const linkedTruth = truth.buildCasinoCruiseTruth({
  cruise: {
    id: 'nav-2025-09-08', shipName: 'Navigator of the Seas', sailDate: '2025-09-08', returnDate: '2025-09-15', nights: 7,
    status: 'completed', completionState: 'completed', cruiseSource: 'royal', casinoProgram: 'clubRoyale',
  },
  certificates: [earnedFaceSameLine],
});
assert.equal(linkedTruth.points.value, 600);
assert.equal(linkedTruth.certificateLinks[0]?.confidence, 'exact');
assert.match(linkedTruth.certificateLinks[0]?.reason ?? '', /sailing date and ship/);

const tierRows = valueLedger.buildLedgerFromCruise({ id: 'tier-cruise', invoiceSpecialServices: 'CR TARGETED OFFER(26TIER3)' });
const annualTierValue = tierRows.find((row) => row.category === 'club-royale-annual-cruise')?.amount;
assert.equal(annualTierValue, 2400, 'annual/tier, Prime, Signature, and Pinnacle cruise rewards trade in at $2,400');

const currentOverview = askOverview.buildAskMyDataOverview({ bookedCruises: [], useKnownAnnualReportFacts: true });
assert.equal(currentOverview.currentSeason.points, 23_446);
assert.equal(currentOverview.currentSeason.attributedPoints, 21_460);
assert.equal(currentOverview.currentSeason.unallocatedPoints, 1_986);
assert.match(currentOverview.text, /1,986 still held as unallocated reconciliation evidence/);

const noSessionCruise = truth.buildCasinoCruiseTruth({
  cruise: {
    id: 'quantum-apr-7',
    shipName: 'Quantum of the Seas',
    sailDate: '2026-04-07',
    returnDate: '2026-04-10',
    nights: 3,
    status: 'completed',
    cruiseSource: 'royal',
    casinoProgram: 'clubRoyale',
    pointsEarned: 800,
    slotPointsConfirmed: true,
  },
  sessions: [],
  pointsPerHourFallback: 400,
  houseEdgeFallback: 0.08,
});
assert.equal(noSessionCruise.casinoAvailableDays, 3);
assert.equal(noSessionCruise.casinoAvailabilityHours, 26);
assert.equal(noSessionCruise.hours.value, 2);
assert.equal(noSessionCruise.hours.kind, 'estimated');
assert.equal(noSessionCruise.coinIn.value, 4000);
assert.equal(noSessionCruise.theoreticalLoss.value, 320);
assert.equal(noSessionCruise.ratedGamingDays, 3);
assert.equal(noSessionCruise.ratedGamingDaysSource, 'casino_availability_estimate');

const noSessionDashboard = dashboard.buildCasinoDashboardMetrics({
  truths: [noSessionCruise],
  sessions: [],
  sessionAnalytics: {
    totalSessions: 0,
    totalPlayTimeMinutes: 0,
    totalBuyIn: 0,
    totalCashOut: 0,
    netWinLoss: 0,
    totalPointsEarned: 0,
    totalCoinIn: 0,
    coinInSource: 'missing',
    actualSessionCount: 0,
    generatedSessionCount: 0,
    ratedGamingDays: 0,
    adt: null,
    avgSessionLength: 0,
    avgBuyIn: 0,
    avgWinLoss: 0,
    winRate: 0,
    lossRate: 0,
    breakEvenRate: 0,
    bestSession: null,
    worstSession: null,
    pointsPerHour: 0,
    machineTypeBreakdown: {},
    denominationBreakdown: {},
    varianceStats: { standardDeviation: 0, variance: 0, maxWin: 0, maxLoss: 0, medianWinLoss: 0 },
    machinePerformance: {},
    streakData: { currentStreak: 0, currentStreakType: 'none', longestWinStreak: 0, longestLossStreak: 0 },
    theoreticalVsActual: { theoreticalLoss: 0, actualLoss: 0, variance: 0, variancePercent: 0, isRunningHot: false, isRunningCold: false },
  },
});
assert.equal(noSessionDashboard.actualHours, null);
assert.equal(noSessionDashboard.estimatedHours, 2);
assert.equal(noSessionDashboard.totalCasinoAvailabilityHours, 26);
assert.equal(noSessionDashboard.casinoAvailableDays, 3);
assert.equal(noSessionDashboard.adt, 320 / 3);
assert.equal(noSessionDashboard.adtConfidence, 'estimated');
assert.equal(noSessionDashboard.coinInPerEstimatedHour, 2000);

console.log('PASS Build 424 final 2025/2026 Royal ledger and Celebrity Equinox truth regression');
