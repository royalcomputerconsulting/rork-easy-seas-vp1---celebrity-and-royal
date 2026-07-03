import { buildBestPlayTodayPlan } from '../lib/casino/bestPlayToday';
import { getCertificateExpirationResult } from '../lib/certificates/expiration';
import { calculateCasinoOpportunityScore } from '../lib/cruise/casinoOpportunityScore';
import { buildHostViewProfile } from '../lib/analytics/hostView';

const starCruise = {
  id: 'star-2026-07-05',
  shipName: 'Star of the Seas',
  sailDate: '2026-07-05',
  returnDate: '2026-07-12',
  nights: 7,
  itineraryName: 'Eastern Caribbean & Perfect Day',
  status: 'booked',
};

const certificate = {
  id: 'cert-expiring',
  label: 'Test Certificate',
  value: 500,
  status: 'available',
  expiryDate: '2026-07-10',
};

const opportunity = calculateCasinoOpportunityScore(starCruise);
if (opportunity.label === 'unknown' || opportunity.score === null) {
  throw new Error('Casino opportunity score did not calculate for Star hard-map fixture.');
}
if (!opportunity.dayBreakdown.some((day) => String(day.label || '').toLowerCase().includes('basseterre'))) {
  throw new Error('Star hard-map fixture did not include Basseterre.');
}

const certResult = getCertificateExpirationResult(certificate, '2026-07-05');
if (certResult.status !== 'urgent' || certResult.daysRemaining !== 5) {
  throw new Error(`Certificate expiration integration failed: ${certResult.status} ${certResult.daysRemaining}`);
}

const bestPlay = buildBestPlayTodayPlan({ bookedCruises: [starCruise], today: '2026-07-07' });
if (bestPlay.recommendedAction !== 'play' || bestPlay.estimatedCoinIn !== bestPlay.targetPoints * 5) {
  throw new Error('Best Play Today integration failed to use active sea-day and $5 coin-in per point.');
}

const host = buildHostViewProfile({
  userProfile: { name: 'Test Player', clubRoyaleTier: 'Signature', clubRoyalePoints: 25000, crownAnchorLevel: 'Diamond Plus', crownAnchorPoints: 632 },
  bookedCruises: [starCruise],
  completedCruises: [{ ...starCruise, id: 'completed', sailDate: '2026-01-01', returnDate: '2026-01-08', casinoPoints: 2000, coinIn: 10000, cashResult: 500 }],
  sessions: [],
  certificates: [certificate],
  offers: [{ id: 'offer-1' }],
});
if (!host.copySummary.includes('Test Player') || host.totalPointsEarned <= 0) {
  throw new Error('Host View integration failed to build a useful summary.');
}

console.log('[Phase3] Integration harness passed', {
  opportunity: opportunity.label,
  certStatus: certResult.status,
  bestPlay: bestPlay.recommendedAction,
  hostValue: host.estimatedPlayerValueLabel,
});
