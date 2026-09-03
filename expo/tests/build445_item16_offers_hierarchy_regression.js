const assert = require('node:assert/strict');
const fs = require('node:fs');

const read = (relative) => fs.readFileSync(relative, 'utf8');
const offers = read('app/(tabs)/(overview)/index.tsx');

const headerSource = offers.slice(offers.indexOf('const renderHeader'), offers.indexOf('const renderCommandCenter'));
const orderedHeaderContracts = [
  'offers-hero-banner-image',
  'offers-loyalty-progress-section',
  'renderCommandCenter()',
  'offers-filter-section',
  'offers-active-offers-section',
];
const footerSource = offers.slice(offers.indexOf('const renderFooter'), offers.indexOf('const renderOfferCard'));
const orderedFooterContracts = [
  'title="Casino & Certificates"',
  'offers-recent-casino-activity-section',
  'offers-open-slots-tools',
  'dashboard-ask-my-data',
  'dashboard-learn-system',
];

for (const [source, contracts] of [[headerSource, orderedHeaderContracts], [footerSource, orderedFooterContracts]]) {
  let previousIndex = -1;
  for (const contract of contracts) {
    const index = source.indexOf(contract);
    assert.ok(index > previousIndex, `Offers hierarchy must place ${contract} after the preceding section.`);
    previousIndex = index;
  }
}

assert.match(offers, /testID="offer-expiration-command-center"/);

assert.doesNotMatch(offers, /<TabIdentityBand tab="offers"/);
assert.doesNotMatch(offers, /Mode-aware home/i);
assert.doesNotMatch(offers, /import \{ OfferCard \}/);
assert.doesNotMatch(offers, /const nonExpiredOffers/);
assert.match(offers, /if \(filteredGroupedOffers\.length === 0\) return filteredGroupedOffers/);
assert.match(offers, /showHeader=\{false\}/);

const loyaltyTheme = read('constants/loyaltyTheme.ts');
for (const neutral of ["gradientColors: ['#FFFFFF', '#F8FAFB', '#F3F3F2']", "surfaceColor: '#FFFFFF'", "surfaceColorMuted: '#F3F3F2'"]) {
  assert.ok(loyaltyTheme.includes(neutral), `Loyalty and command-center surfaces must retain ${neutral}`);
}

const certificates = read('components/CasinoCertificatesCard.tsx');
assert.match(certificates, /showHeader\?: boolean/);
assert.match(certificates, /showHeader = true/);
assert.match(certificates, /\{showHeader \? <View style=\{styles\.header\}>/);

console.log('PASS build445_item16_offers_hierarchy_regression');
