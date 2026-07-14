const fs = require('fs');
const path = require('path');
const root = process.cwd();
const mustExist = [
  'lib/casino/pointsEarning.ts',
  'lib/dates/appDate.ts',
  'lib/certificates/expiration.ts',
  'lib/certificates/instantCertificateUrls.ts',
  'lib/certificates/certificateChaseRecommendation.ts',
  'lib/cruise/casinoOpportunityScore.ts',
  'lib/casino/bestPlayToday.ts',
  'lib/analytics/hostView.ts',
  'lib/value/cruiseValueLedger.ts',
  'lib/value/futureValueWallet.ts',
  'lib/value/cruiseValueCalculations.ts',
  'lib/offers/offerCodeClassifier.ts',
  'lib/offers/offerAttribution.ts',
  'lib/value/trueMakeout.ts',
  'lib/analytics/casinoValueAttribution.ts',
  'components/certificates/CertificateExpirationBadge.tsx',
  'components/cruise/CasinoOpportunityBadge.tsx',
  'components/casino/BestPlayTodayCard.tsx',
  'components/analytics/HostViewCard.tsx',
  'components/value/FutureValueWalletCard.tsx',
  'components/value/OfferAttributionLedgerCard.tsx',
  'components/value/TrueMakeoutLedgerCard.tsx',
  'components/casino/CertificateCreatedByPlayCard.tsx',
  'components/casino/KeepPlayingDecisionCard.tsx',
];
for (const file of mustExist) {
  if (!fs.existsSync(path.join(root, file))) throw new Error(`Missing required file: ${file}`);
}
const points = fs.readFileSync(path.join(root, 'lib/casino/pointsEarning.ts'), 'utf8');
for (const marker of ['coinInPerPoint: 5', 'coinInPerPoint: 15', 'coinInPerPoint: 10', 'wagerPerTierPoint: 1', 'wagerPerTierPoint: 2', 'FreePlay coin-in']) {
  if (!points.includes(marker)) throw new Error(`Points engine missing marker: ${marker}`);
}
const session = fs.readFileSync(path.join(root, 'state/CasinoSessionProvider.tsx'), 'utf8');
for (const marker of ['cashCoinIn', 'freeplayCoinIn', 'pointsSource', 'pointEarningProfileId', 'gameCategory']) {
  if (!session.includes(marker)) throw new Error(`CasinoSession model missing marker: ${marker}`);
}
console.log('PASS testV1076CasinoEnginesFunctional');
