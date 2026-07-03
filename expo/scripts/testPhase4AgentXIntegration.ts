import { buildBestPlayTodayPlan } from '../lib/casino/bestPlayToday';
import { getCertificateExpirationResult } from '../lib/certificates/expiration';
import { calculateCasinoOpportunityScore } from '../lib/cruise/casinoOpportunityScore';
import { buildHostViewProfile } from '../lib/analytics/hostView';

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
}

const today = '2026-07-07';
const star = {
  id: 'star-2026-07-05',
  shipName: 'Star of the Seas',
  startDate: '2026-07-05',
  endDate: '2026-07-12',
  nights: 7,
  itinerary: 'Eastern Caribbean & Perfect Day',
};
const certificates = [
  { offerCode: '26TEST1', redeemByDate: '2026-07-07' },
  { offerCode: '26TEST2', redeemByDate: '2026-07-13' },
  { offerCode: '26OLD', redeemByDate: '2026-07-01' },
];
const sessions = [
  { shipName: 'Star of the Seas', machineName: 'Dragon Link', pointsEarned: 300, winLoss: 100, coinIn: 1500, avgBet: 3.52 },
];
const bestPlayToday = buildBestPlayTodayPlan({ bookedCruises: [star], sessions, today });
const certificateResults = certificates.map((certificate) => getCertificateExpirationResult(certificate, today));
const opportunity = calculateCasinoOpportunityScore(star);
const hostView = buildHostViewProfile({
  userProfile: { name: 'Scott Merlis', clubRoyaleTier: 'Signature', clubRoyalePoints: 16116 },
  bookedCruises: [star],
  completedCruises: [{ shipName: 'Wonder of the Seas', casinoPoints: 2030, winLoss: 1300 }],
  sessions,
  certificates,
  offers: [{ offerCode: '26TEST' }],
});

assert(bestPlayToday.recommendedAction === 'play', 'AgentX Best Play Today context should be engine-derived for sea day.');
assert(certificateResults.some((result) => result.status === 'expires-today'), 'AgentX certificate context should include expires-today status.');
assert(opportunity.dayBreakdown.some((day) => day.label?.includes('Basseterre')), 'AgentX cruise opportunity context should preserve Star/Basseterre hard map.');
assert(hostView.hostTalkingPoints.length > 0, 'AgentX Host View context should include host talking points.');
assert(hostView.copySummary.includes('Scott Merlis'), 'AgentX Host View copy summary should be paste-ready.');

console.log('Phase 4 AgentX Casino Intelligence integration harness passed.');
