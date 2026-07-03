import { addDays, daysBetweenDates, normalizeDateOnly } from '../lib/dates/appDate';
import {
  getCertificateExpirationResult,
  sortCertificatesByExpirationUrgency,
} from '../lib/certificates/expiration';
import { calculateCasinoOpportunityScore } from '../lib/cruise/casinoOpportunityScore';
import { buildBestPlayTodayPlan } from '../lib/casino/bestPlayToday';
import { buildHostViewProfile } from '../lib/analytics/hostView';

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
}

const today = '2026-07-05';

assert(normalizeDateOnly('2026-07-05') === '2026-07-05', 'YYYY-MM-DD normalize failed');
assert(normalizeDateOnly('2026-07-05T14:30:00Z') === '2026-07-05', 'ISO normalize failed');
assert(normalizeDateOnly('07/05/2026') === '2026-07-05', 'MM/DD/YYYY normalize failed');
assert(normalizeDateOnly('bad-date') === null, 'Invalid date should return null');
assert(daysBetweenDates('2026-07-05', '2026-07-05') === 0, 'Same date diff failed');
assert(addDays('2026-07-05', 7) === '2026-07-12', 'addDays failed');

const certs = [
  { id: 'unknown' },
  { id: 'expired', redeemByDate: '2026-07-04' },
  { id: 'today', redeemByDate: '2026-07-05' },
  { id: 'urgent', redeemByDate: '2026-07-12' },
  { id: 'soon', redeemByDate: '2026-07-13' },
  { id: 'valid', redeemByDate: '2026-08-05' },
  { id: 'priority', redeemByDate: '2026-07-06', sailByDate: '2027-01-01' },
];
assert(getCertificateExpirationResult(certs[0], today).status === 'unknown', 'Unknown cert failed');
assert(getCertificateExpirationResult(certs[1], today).status === 'expired', 'Expired cert failed');
assert(getCertificateExpirationResult(certs[2], today).status === 'expires-today', 'Expires today cert failed');
assert(getCertificateExpirationResult(certs[3], today).status === 'urgent', 'Urgent cert failed');
assert(getCertificateExpirationResult(certs[4], today).status === 'expiring-soon', 'Expiring soon cert failed');
assert(getCertificateExpirationResult(certs[5], today).status === 'valid', 'Valid cert failed');
assert(getCertificateExpirationResult(certs[6], today).sourceField === 'redeemByDate', 'Redeem-by priority failed');
assert((sortCertificatesByExpirationUrgency(certs, today)[0] as any).id === 'today', 'Certificate urgency sort failed');

const star = {
  id: 'star-july-2026',
  shipName: 'Star of the Seas',
  startDate: '2026-07-05',
  endDate: '2026-07-12',
  nights: 7,
  itinerary: 'Eastern Caribbean & Perfect Day',
};
const starScore = calculateCasinoOpportunityScore(star);
assert(starScore.label === 'strong' || starScore.label === 'excellent', 'Star score should be strong/excellent');
assert(starScore.dayBreakdown.some((day) => day.label?.includes('Basseterre')), 'Star itinerary must include Basseterre');
assert(starScore.privateIslandDayCount === 1, 'Star should have one private island day');

const shortRestricted = {
  shipName: 'Navigator of the Seas',
  startDate: '2026-01-01',
  nights: 3,
  itineraryDays: [
    { dayNumber: 1, label: 'Los Angeles' },
    { dayNumber: 2, label: 'Ensenada' },
    { dayNumber: 3, label: 'Los Angeles' },
    { dayNumber: 4, label: 'Los Angeles' },
  ],
};
assert(calculateCasinoOpportunityScore(shortRestricted).label !== 'excellent', 'Short restricted cruise should not be excellent');

const noActivePlan = buildBestPlayTodayPlan({ bookedCruises: [], today });
assert(noActivePlan.recommendedAction === 'unknown', 'No active cruise fallback failed');
const seaDayPlan = buildBestPlayTodayPlan({ bookedCruises: [star], today: '2026-07-07' });
assert(seaDayPlan.recommendedAction === 'play', 'Sea day play recommendation failed');
assert(seaDayPlan.estimatedCoinIn === seaDayPlan.targetPoints * 5, 'Coin-in estimate failed');
const debarkPlan = buildBestPlayTodayPlan({ bookedCruises: [star], today: '2026-07-12' });
assert(debarkPlan.recommendedAction === 'avoid', 'Debarkation avoid recommendation failed');

const host = buildHostViewProfile({
  userProfile: { name: 'Scott Merlis', clubRoyaleTier: 'Signature', clubRoyalePoints: 16116, crownAnchorLevel: 'Diamond Plus', crownAnchorPoints: 632 },
  bookedCruises: [star],
  completedCruises: [{ shipName: 'Wonder of the Seas', casinoPoints: 2030, winLoss: 1300 }],
  sessions: [{ shipName: 'Wonder of the Seas', machineName: 'Dragon Link', pointsEarned: 300, winLoss: 100, avgBet: 3.52 }],
  certificates: certs,
  offers: [{ code: '26TEST' }],
});
assert(host.userName === 'Scott Merlis', 'Host name failed');
assert(host.favoriteShips.length > 0, 'Favorite ships failed');
assert(host.favoriteMachines[0] === 'Dragon Link', 'Favorite machine failed');
assert(host.copySummary.includes('Scott Merlis'), 'Copy summary failed');

console.log('Phase 1 EasySeas Casino Intelligence engine harness passed.');
