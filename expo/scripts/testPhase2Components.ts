import fs from 'fs';
import path from 'path';

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
}

const root = process.cwd();
const files = [
  'components/certificates/CertificateExpirationBadge.tsx',
  'components/cruise/CasinoOpportunityBadge.tsx',
  'components/casino/BestPlayTodayCard.tsx',
  'components/analytics/HostViewCard.tsx',
];

for (const file of files) {
  const absolute = path.join(root, file);
  assert(fs.existsSync(absolute), `${file} does not exist`);
  const source = fs.readFileSync(absolute, 'utf8');
  assert(source.includes('testID='), `${file} should expose testID hooks`);
  assert(source.includes('export function') || source.includes('export default'), `${file} should export a component`);
}

const expirationBadge = fs.readFileSync(path.join(root, files[0]), 'utf8');
assert(expirationBadge.includes('@/lib/certificates/expiration'), 'CertificateExpirationBadge must consume engine result types');
assert(!expirationBadge.includes('getCertificateExpirationResult('), 'CertificateExpirationBadge should not calculate expiration itself');

const opportunityBadge = fs.readFileSync(path.join(root, files[1]), 'utf8');
assert(opportunityBadge.includes('@/lib/cruise/casinoOpportunityScore'), 'CasinoOpportunityBadge must consume engine result types');
assert(!opportunityBadge.includes('calculateCasinoOpportunityScore('), 'CasinoOpportunityBadge should not calculate score itself');

const bestPlayCard = fs.readFileSync(path.join(root, files[2]), 'utf8');
assert(bestPlayCard.includes('@/lib/casino/bestPlayToday'), 'BestPlayTodayCard must consume engine result types');
assert(!bestPlayCard.includes('buildBestPlayTodayPlan('), 'BestPlayTodayCard should not calculate plan itself');

const hostViewCard = fs.readFileSync(path.join(root, files[3]), 'utf8');
assert(hostViewCard.includes('@/lib/analytics/hostView'), 'HostViewCard must consume engine result types');
assert(!hostViewCard.includes('buildHostViewProfile('), 'HostViewCard should not calculate host view itself');
assert(hostViewCard.includes('onCopySummary'), 'HostViewCard should expose copy summary callback');

console.log('Phase 2 component harness passed');
