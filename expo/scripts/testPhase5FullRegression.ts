import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { addDays, daysBetweenDates, normalizeDateOnly } from '../lib/dates/appDate';
import {
  getCertificateExpirationResult,
  sortCertificatesByExpirationUrgency,
} from '../lib/certificates/expiration';
import { calculateCasinoOpportunityScore } from '../lib/cruise/casinoOpportunityScore';
import { buildBestPlayTodayPlan } from '../lib/casino/bestPlayToday';
import { buildHostViewProfile } from '../lib/analytics/hostView';

type ProtectedManifest = {
  protectedFileCount: number;
  files: { path: string; sha256: string }[];
};

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
}

function fileText(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');
}

function sha256(relativePath: string): string {
  return crypto.createHash('sha256').update(fs.readFileSync(path.join(process.cwd(), relativePath))).digest('hex');
}

function runDateTests() {
  assert(normalizeDateOnly('2026-07-05') === '2026-07-05', 'normalizeDateOnly YYYY-MM-DD failed');
  assert(normalizeDateOnly('2026-07-05T14:30:00Z') === '2026-07-05', 'normalizeDateOnly ISO timestamp failed');
  assert(normalizeDateOnly('07/05/2026') === '2026-07-05', 'normalizeDateOnly MM/DD/YYYY failed');
  assert(normalizeDateOnly('Oct 15, 2026') === '2026-10-15', 'normalizeDateOnly month-name date failed');
  assert(normalizeDateOnly('Nov 03, 2026') === '2026-11-03', 'normalizeDateOnly November month-name date failed');
  assert(normalizeDateOnly('07-05-2026') === '2026-07-05', 'normalizeDateOnly MM-DD-YYYY failed');
  assert(normalizeDateOnly('not-a-date') === null, 'Invalid date should normalize to null');
  assert(daysBetweenDates('2026-07-05', '2026-07-05') === 0, 'Same-date difference failed');
  assert(daysBetweenDates('2026-07-05', '2026-07-06') === 1, 'Future date difference failed');
  assert(daysBetweenDates('2026-07-06', '2026-07-05') === -1, 'Past date difference failed');
  assert(addDays('2026-07-05', 7) === '2026-07-12', 'addDays failed');
}

function runCertificateTests() {
  const today = '2026-07-05';
  const fixtures = [
    { id: 'unknown' },
    { id: 'invalid', redeemByDate: 'bad-date' },
    { id: 'expired', redeemByDate: '2026-07-04' },
    { id: 'today', redeemByDate: '2026-07-05' },
    { id: 'urgent1', redeemByDate: '2026-07-06' },
    { id: 'urgent7', redeemByDate: '2026-07-12' },
    { id: 'soon8', redeemByDate: '2026-07-13' },
    { id: 'soon30', redeemByDate: '2026-08-04' },
    { id: 'valid31', redeemByDate: '2026-08-05' },
    { id: 'priority', redeemByDate: '2026-07-06', sailByDate: '2027-01-01' },
  ];
  const expected: Record<string, string> = {
    unknown: 'unknown',
    invalid: 'unknown',
    expired: 'expired',
    today: 'expires-today',
    urgent1: 'urgent',
    urgent7: 'urgent',
    soon8: 'expiring-soon',
    soon30: 'expiring-soon',
    valid31: 'valid',
    priority: 'urgent',
  };
  for (const fixture of fixtures) {
    const result = getCertificateExpirationResult(fixture, today);
    assert(result.status === expected[fixture.id], `Certificate ${fixture.id} expected ${expected[fixture.id]} got ${result.status}`);
    assert(result.badgeLabel.length > 0, `Certificate ${fixture.id} missing badge label`);
    assert(result.message.length > 0, `Certificate ${fixture.id} missing message`);
  }
  assert(getCertificateExpirationResult(fixtures[1], today).warnings.length > 0, 'Invalid certificate date should include warning');
  assert(getCertificateExpirationResult(fixtures[9], today).sourceField === 'redeemByDate', 'redeemByDate should take priority over sailByDate');
  assert((sortCertificatesByExpirationUrgency(fixtures, today)[0] as any).id === 'today', 'Urgency sorting should put expires-today first');
  const sortedCertificates = sortCertificatesByExpirationUrgency(fixtures, today);
  assert((sortedCertificates[sortedCertificates.length - 1] as any).id === 'expired', 'Expired certificates should remain visible and sort after usable/unknown records');
}

function runCasinoOpportunityTests() {
  const star = {
    id: 'star-july-2026',
    shipName: 'Star of the Seas',
    startDate: '2026-07-05',
    endDate: '2026-07-12',
    nights: 7,
    itinerary: 'Eastern Caribbean & Perfect Day',
  };
  const starScore = calculateCasinoOpportunityScore(star);
  assert(starScore.label === 'strong' || starScore.label === 'excellent', 'Star July 5 opportunity should be strong/excellent');
  assert(starScore.dayBreakdown.some((day) => String(day.label).includes('Basseterre')), 'Star July 5 hard-map must include Basseterre, St. Kitts & Nevis');
  assert(!starScore.dayBreakdown.some((day) => String(day.label).includes('Philipsburg')), 'Star July 5 hard-map must not fabricate Philipsburg');
  assert(starScore.privateIslandDayCount === 1, 'Star July 5 should count one private-island day');
  assert(starScore.seaDayCount >= 2, 'Star July 5 should count multiple marine/sea-style days');

  const shortRestricted = calculateCasinoOpportunityScore({
    shipName: 'Navigator of the Seas',
    startDate: '2026-01-01',
    nights: 3,
    itineraryDays: [
      { dayNumber: 1, label: 'Los Angeles' },
      { dayNumber: 2, label: 'Ensenada' },
      { dayNumber: 3, label: 'Los Angeles' },
      { dayNumber: 4, label: 'Los Angeles' },
    ],
  });
  assert(shortRestricted.score !== null && shortRestricted.score < 75, 'Short restricted cruise should score below strong');

  const privateIsland = calculateCasinoOpportunityScore({
    shipName: 'Wonder of the Seas',
    startDate: '2026-02-01',
    nights: 3,
    itineraryDays: [
      { dayNumber: 1, label: 'Port Canaveral' },
      { dayNumber: 2, label: 'Perfect Day at CocoCay' },
      { dayNumber: 3, label: 'Nassau' },
      { dayNumber: 4, label: 'Port Canaveral' },
    ],
  });
  assert(privateIsland.privateIslandDayCount === 1, 'Private island cruise should classify CocoCay');

  const incomplete = calculateCasinoOpportunityScore({
    shipName: 'Unknown of the Seas',
    startDate: '2026-05-01',
    nights: 5,
    itinerary: 'Caribbean',
  });
  assert(incomplete.warnings.some((warning) => warning.includes('Exact port-day data is incomplete')), 'Incomplete itinerary should produce trust warning');

  const transatlantic = calculateCasinoOpportunityScore({
    shipName: 'Harmony of the Seas',
    startDate: '2026-03-16',
    nights: 16,
    itinerary: 'Transatlantic Spain & Bahamas',
    itineraryDays: [
      { dayNumber: 1, label: 'Miami' },
      { dayNumber: 2, label: 'Cruising' },
      { dayNumber: 3, label: 'Cruising' },
      { dayNumber: 4, label: 'Cruising' },
      { dayNumber: 5, label: 'Cruising' },
      { dayNumber: 6, label: 'Cruising' },
      { dayNumber: 7, label: 'Cruising' },
      { dayNumber: 8, label: 'Cruising' },
      { dayNumber: 9, label: 'Cruising' },
      { dayNumber: 10, label: 'Cruising' },
      { dayNumber: 11, label: 'Cruising' },
      { dayNumber: 12, label: 'Cruising' },
      { dayNumber: 13, label: 'Cruising' },
      { dayNumber: 14, label: 'Cruising' },
      { dayNumber: 15, label: 'Spain' },
      { dayNumber: 16, label: 'Spain' },
      { dayNumber: 17, label: 'Spain' },
    ],
  });
  assert(transatlantic.score !== null && transatlantic.score >= 75, 'Repositioning/transatlantic cruise should score strong or better');
}

function runBestPlayTodayTests() {
  const star = { shipName: 'Star of the Seas', startDate: '2026-07-05', endDate: '2026-07-12', nights: 7, itinerary: 'Eastern Caribbean & Perfect Day' };
  const noActive = buildBestPlayTodayPlan({ bookedCruises: [], today: '2026-07-05' });
  assert(noActive.recommendedAction === 'unknown' && noActive.targetPoints === 0, 'No-active-cruise fallback failed');
  const embarkation = buildBestPlayTodayPlan({ bookedCruises: [star], today: '2026-07-05' });
  assert(embarkation.recommendedAction === 'freeplay-only', 'Embarkation should recommend freeplay-only/light behavior');
  assert(embarkation.suggestedBankrollCap === 200, 'Default bankroll cap should be $200');
  const privateIsland = buildBestPlayTodayPlan({ bookedCruises: [star], today: '2026-07-06' });
  assert(privateIsland.recommendedAction === 'freeplay-only', 'Private island should recommend freeplay-only/light behavior');
  const sea = buildBestPlayTodayPlan({ bookedCruises: [star], today: '2026-07-07' });
  assert(sea.recommendedAction === 'play' && sea.targetPoints === 300, 'Sea day should recommend play with 300-point default target');
  assert(sea.estimatedCoinIn === 1500, 'Sea day should use $5 coin-in per point');
  const port = buildBestPlayTodayPlan({ bookedCruises: [star], today: '2026-07-08' });
  assert(port.recommendedAction === 'light-play', 'Port day should recommend light-play');
  const debark = buildBestPlayTodayPlan({ bookedCruises: [star], today: '2026-07-12' });
  assert(debark.recommendedAction === 'avoid' && debark.targetPoints === 0, 'Debarkation should recommend avoid');
}

function runHostViewTests() {
  const empty = buildHostViewProfile({});
  assert(empty.estimatedPlayerValueLabel === 'unknown' || empty.estimatedPlayerValueLabel === 'low', 'Empty host view should be safe');
  assert(empty.copySummary.length > 0, 'Empty host view should still provide copy summary');

  const profile = buildHostViewProfile({
    userProfile: { name: 'Scott Merlis', clubRoyaleTier: 'Signature', clubRoyalePoints: 16116, crownAnchorLevel: 'Diamond Plus', crownAnchorPoints: 632 },
    bookedCruises: [{ shipName: 'Star of the Seas', startDate: '2026-07-05', endDate: '2026-07-12' }],
    completedCruises: [
      { shipName: 'Wonder of the Seas', casinoPoints: 2030, winLoss: 1300, coinIn: 10150 },
      { shipName: 'Harmony of the Seas', casinoPoints: 2030, winLoss: -500, coinIn: 10150 },
    ],
    sessions: [
      { shipName: 'Wonder of the Seas', machineName: 'Dragon Link', pointsEarned: 300, winLoss: 100, coinIn: 1500, avgBet: 3.52 },
      { shipName: 'Wonder of the Seas', machineName: 'Dragon Link', pointsEarned: 100, winLoss: -50, coinIn: 500, avgBet: 2.5 },
    ],
    certificates: [{ redeemByDate: '2026-07-06' }],
    offers: [{ offerCode: '26TEST' }],
  });
  assert(profile.userName === 'Scott Merlis', 'Host view should preserve profile name');
  assert(profile.favoriteShips.includes('Wonder of the Seas'), 'Host view should calculate favorite ships');
  assert(profile.favoriteMachines[0] === 'Dragon Link', 'Host view should calculate favorite machines');
  assert(profile.totalWinLoss !== 0, 'Host view should aggregate positive and negative win/loss');
  assert(profile.strengths.length > 0, 'Host view should generate strengths');
  assert(profile.risks.length > 0, 'Host view should generate risks');
  assert(profile.hostTalkingPoints.length > 0, 'Host view should generate talking points');
  assert(profile.copySummary.includes('Scott Merlis'), 'Host view copy summary should be paste-ready');
}

function runUiStaticSmokeTests() {
  const checks: [string, string][] = [
    ['app/(tabs)/(overview)/index.tsx', 'BestPlayTodayCard'],
    ['app/(tabs)/(overview)/index.tsx', 'CertificateExpirationBadge'],
    ['components/CertificateManagerModal.tsx', 'sortCertificatesByExpirationUrgency'],
    ['app/(tabs)/(overview)/cruise-details.tsx', 'CasinoOpportunityBadge'],
    ['app/offer-details.tsx', 'CasinoOpportunityBadge'],
    ['app/(tabs)/scheduling.tsx', 'CasinoOpportunityBadge'],
    ['app/(tabs)/analytics.tsx', 'HostViewCard'],
  ];
  for (const [file, needle] of checks) {
    assert(fileText(file).includes(needle), `${file} missing expected Phase 3 integration marker: ${needle}`);
  }

  const componentFiles = [
    'components/certificates/CertificateExpirationBadge.tsx',
    'components/cruise/CasinoOpportunityBadge.tsx',
    'components/casino/BestPlayTodayCard.tsx',
    'components/analytics/HostViewCard.tsx',
  ];
  for (const file of componentFiles) {
    const content = fileText(file);
    assert(content.includes('export function') || content.includes('export default'), `${file} should export a reusable component`);
    assert(!content.includes('buildBestPlayTodayPlan('), `${file} should not calculate Best Play Today directly`);
    assert(!content.includes('calculateCasinoOpportunityScore('), `${file} should not calculate Casino Opportunity directly`);
    assert(!content.includes('getCertificateExpirationResult('), `${file} should not calculate certificate expiration directly`);
    assert(!content.includes('buildHostViewProfile('), `${file} should not calculate Host View directly`);
  }
}

function runAgentXStaticTests() {
  const agent = fileText('state/AgentXProvider.tsx');
  assert(agent.includes('casino-intelligence-engine-outputs'), 'AgentX context missing casino-intelligence-engine-outputs block');
  assert(agent.includes('buildBestPlayTodayPlan'), 'AgentX context missing Best Play Today engine output');
  assert(agent.includes('getCertificateExpirationResult'), 'AgentX context missing certificate expiration engine output');
  assert(agent.includes('calculateCasinoOpportunityScore'), 'AgentX context missing casino opportunity engine output');
  assert(agent.includes('buildHostViewProfile'), 'AgentX context missing Host View engine output');
  assert(agent.includes('Should I play today') || agent.includes('play today'), 'AgentX guidance missing Best Play question support');
  assert(agent.includes('casino host') || agent.includes('host'), 'AgentX guidance missing host-view question support');
}

function runProtectedSystemRegressionTests() {
  const manifest: ProtectedManifest = JSON.parse(fileText('scripts/protectedSystemsManifest.json'));
  assert(manifest.files.length === manifest.protectedFileCount, 'Protected manifest file count mismatch');
  for (const file of manifest.files) {
    assert(fs.existsSync(path.join(process.cwd(), file.path)), `Protected file missing: ${file.path}`);
    const actual = sha256(file.path);
    assert(actual === file.sha256, `Protected file changed unexpectedly: ${file.path}`);
  }
}

runDateTests();
runCertificateTests();
runCasinoOpportunityTests();
runBestPlayTodayTests();
runHostViewTests();
runUiStaticSmokeTests();
runAgentXStaticTests();
runProtectedSystemRegressionTests();

console.log('Phase 5 full EasySeas Casino Intelligence regression harness passed.', {
  date: 'ok',
  certificates: 'ok',
  opportunity: 'ok',
  bestPlayToday: 'ok',
  hostView: 'ok',
  uiStaticSmoke: 'ok',
  agentX: 'ok',
  protectedSystems: 'ok',
});
