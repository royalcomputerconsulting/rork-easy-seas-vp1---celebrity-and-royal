const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { loadTs, root } = require('../scripts/clubRoyaleTestBootstrap');

const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');
const sha256 = (relative) => crypto.createHash('sha256').update(read(relative)).digest('hex');
const app = JSON.parse(read('app.json')).expo;

assert.equal(app.version, '13.0.44');
assert.equal(String(app.ios.buildNumber), '410');
assert.equal(app.android.versionCode, 130067);
assert.equal(sha256('app/_layout.tsx'), '8feada8a189883c07b6180c090b4f021d750f50e50c7c88c1ab750869a45775d');
assert.equal(sha256('app/(tabs)/_layout.tsx'), '8370c9a38f5c0a81c6ed420c2291f25fa804d1889a3fcc9a3d21f00e6ffbec6d');

// The provider instance is part of the final persistence/export identity, not
// merely the upstream scraper identity. Material variants also remain distinct.
const { dedupeCasinoOffers, dedupeCruises, getOfferIdentityKey, getCruiseIdentityKey } = loadTs('lib/dataIdentity.ts');
const baseOffer = {
  id: 'offer-1',
  offerCode: '2607TOR403',
  offerType: 'comped',
  title: 'Toronto Instant Reward',
  offerName: 'Toronto Instant Reward',
  offerSource: 'royal',
  shipName: 'Icon of the Seas',
  sailingDate: '2026-09-12',
  roomType: 'Interior',
  guests: 2,
  guestsInfo: '2 guests',
  category: 'A',
  itineraryName: 'Eastern Caribbean',
  ports: ['Miami', 'At Sea', 'St. Thomas'],
};
const providerInstances = ['PLAYER-ONE', 'PLAYER-TWO', 'PLAYER-THREE'].map((playerOfferId, index) => ({
  ...baseOffer,
  id: `offer-${index + 1}`,
  playerOfferId,
  offerInstanceId: playerOfferId,
}));
assert.equal(new Set(providerInstances.map(getOfferIdentityKey)).size, 3);
assert.equal(dedupeCasinoOffers(providerInstances).length, 3);
assert.equal(dedupeCasinoOffers([...providerInstances, { ...providerInstances[0], id: 'replayed-row' }]).length, 3);

const materialVariants = [
  providerInstances[0],
  { ...providerInstances[0], id: 'balcony', roomType: 'Balcony' },
  { ...providerInstances[0], id: 'solo', guests: 1, guestsInfo: '1 guest' },
  { ...providerInstances[0], id: 'western', itineraryName: 'Western Caribbean', ports: ['Miami', 'Cozumel'] },
  { ...providerInstances[0], id: 'category-c', category: 'C' },
];
assert.equal(dedupeCasinoOffers(materialVariants).length, materialVariants.length);

const baseCruise = {
  id: 'cruise-1',
  shipName: 'Icon of the Seas',
  sailDate: '2026-09-12',
  returnDate: '2026-09-19',
  departurePort: 'Miami',
  destination: 'Eastern Caribbean',
  nights: 7,
  cruiseSource: 'royal',
  offerCode: '2607TOR403',
  cabinType: 'Interior',
  guests: 2,
  category: 'A',
  itineraryName: 'Eastern Caribbean',
  ports: ['Miami', 'At Sea', 'St. Thomas'],
};
const cruiseInstances = providerInstances.map((offer, index) => ({
  ...baseCruise,
  id: `cruise-${index + 1}`,
  playerOfferId: offer.playerOfferId,
  offerInstanceId: offer.offerInstanceId,
}));
assert.equal(new Set(cruiseInstances.map(getCruiseIdentityKey)).size, 3);
assert.equal(dedupeCruises(cruiseInstances).length, 3);
assert.equal(dedupeCruises([...cruiseInstances, { ...cruiseInstances[0], id: 'replayed-cruise' }]).length, 3);

const coreData = read('state/CoreDataProvider.tsx');
const bundles = read('lib/dataBundle/bundleOperations.ts');
for (const marker of ['dedupeCasinoOffers', 'dedupeCruises']) {
  assert.ok(coreData.includes(marker), `Core storage must use ${marker}`);
}
assert.ok(bundles.includes('dedupeCasinoOffers'), 'Import/export bundles must dedupe offer records by offer instance');
assert.ok(bundles.includes('exportAllSourceRows'), 'Available-cruise backup must use the authoritative SQLite source rows');
assert.ok(bundles.includes('Available-cruise exports are deliberately lossless'), 'Backup must preserve duplicate-code offer/cabin/guest eligibility');

const royalStep = read('lib/royalCaribbean/step1_offers.ts');
for (const marker of [
  "detailsParams.append('playerOfferId', playerOfferId)",
  'Math.min(DETAIL_WORKER_LIMIT, initialOffers.length)',
  'Offer reconciliation — website:',
  'parsed instances:',
  'exported instances:',
]) assert.ok(royalStep.includes(marker), `Royal sync missing ${marker}`);

const carnival = read('app/carnival-sync.tsx');
assert.ok(carnival.includes('const [webViewVisible, setWebViewVisible] = useState(true)'));
assert.ok(carnival.includes('Logged In — Ready to Sync'));
assert.ok(carnival.includes('Press SYNC NOW once when you are ready'));
assert.ok(!carnival.includes('setInterval(attemptStart'));
assert.ok(!carnival.includes('continuing sync on this screen'));
assert.ok(!carnival.includes('Once logged in, press "I\'m Logged In" to confirm'));
assert.ok(carnival.includes('MAX_BRIDGE_QUEUE_LENGTH = 200'));
assert.ok(carnival.includes('router.canGoBack()'));

const certificateCodes = read('app/certificate-codes.tsx');
const certificateLookup = read('app/certificate-lookup.tsx');
const certificateBatch = read('lib/certificates/certificateBatchDownload.ts');
for (const marker of ['Download All A/C', 'Examine Offers', "pathname: '/certificate-lookup'", "backgroundColor: '#10223A'", "color: '#FFD86B'"]) {
  assert.ok(certificateCodes.includes(marker), `Certificate codes screen missing ${marker}`);
}
for (const marker of ['ship-input', 'start-date-filter', 'end-date-filter', 'A Certificates', 'C Certificates', 'These remain separate from Available Cruises']) {
  assert.ok(certificateLookup.includes(marker), `Certificate sailing lookup missing ${marker}`);
}
for (const status of ["'downloading'", "'parsing'", "'saving'", "'saved'"]) {
  assert.ok(certificateBatch.includes(status), `Certificate batch progress missing ${status}`);
}
assert.ok(!certificateBatch.includes('trpc'));

const agent = read('state/AgentXProvider.tsx');
for (const marker of ['askMyDataSearch({', 'certificates: filteredCertificates', 'casinoSessions: sessions', 'weatherReports: latestWeatherReports', 'allMachines']) {
  assert.ok(agent.includes(marker), `Ask My Data missing local source ${marker}`);
}
assert.ok(!agent.includes('@ai-sdk/'));
assert.ok(!read('package.json').includes('@ai-sdk/'));

const weather = read('state/SailingWeatherProvider.tsx');
for (const marker of [
  'quotaSafeGetJsonItem',
  "marine-api.open-meteo.com/v1/marine",
  'previousCoordinates.latitude + ((nextCoordinates.latitude - previousCoordinates.latitude) * progress)',
  'wave_height_max',
  "marineDataStatus: 'verified'",
]) assert.ok(weather.includes(marker), `Weather pipeline missing ${marker}`);
assert.ok(!weather.includes('void prefetchCruiseForecastWindow('), 'Weather must not auto-fetch and block startup');

const settings = read('app/(tabs)/settings.tsx');
const carnivalRow = settings.indexOf('Sync Carnival Cruises');
const cloudRow = settings.indexOf('SYNC TO CLOUD');
const pricingRow = settings.indexOf('Pricing Summary & History');
assert.ok(carnivalRow >= 0 && cloudRow > carnivalRow && pricingRow > cloudRow);
for (const marker of ['Export Machines (.json)', 'Export Current User Session Log (.json)', 'JSON.parse(content)', 'Export Overall App Log']) {
  assert.ok(settings.includes(marker), `Settings/Admin missing ${marker}`);
}
assert.ok(!settings.includes('await coreData.syncToBackend()'));
const cloud = read('state/UserDataSyncProvider.tsx');
assert.ok(cloud.includes('automatic backend restore is disabled'));
assert.ok(!cloud.includes('void initSync()'));

const loyalty = read('state/LoyaltyProvider.tsx');
assert.ok(settings.includes('await setManualCrownAnchorPoints(profileData.loyaltyPoints)'));
assert.ok(settings.includes('await setManualClubRoyalePoints(profileData.clubRoyalePoints)'));
assert.ok(loyalty.includes('const rawCrownAnchorPoints = manualCrownAnchorPoints'));
const celebrity = loadTs('constants/celebrityCaptainsClub.ts');
for (const [royal, matched] of [
  ['Gold', 'Classic'], ['Platinum', 'Select'], ['Emerald', 'Select'], ['Diamond', 'Elite'], ['Diamond Plus', 'Elite Plus'], ['Pinnacle', 'Zenith'],
]) assert.equal(celebrity.getCelebrityStatusMatchForCrownAnchor(royal), matched);
assert.deepEqual(celebrity.getCelebrityCaptainsClubStatus(1150, 'Pinnacle'), {
  earnedLevel: 'Elite Plus', statusMatchLevel: 'Zenith', reportedLevel: null, effectiveLevel: 'Zenith', isStatusMatched: true,
});

const royalScreen = read('app/royal-caribbean-sync.tsx');
const royalProvider = read('state/RoyalCaribbeanSyncProvider.tsx');
assert.ok(royalScreen.includes("setCruiseLine(value ? 'celebrity' : 'royal_caribbean')"));
assert.ok(royalScreen.includes('router.canGoBack()'));
assert.ok(royalProvider.includes("cruiseLine === 'celebrity' ? 'Blue Chip Club Offers' : 'Club Royale Offers'"));
assert.ok(royalProvider.includes("Captain's Club Status"));

const booked = read('app/(tabs)/booked.tsx');
const details = read('app/(tabs)/(overview)/cruise-details.tsx');
const card = read('components/CruiseCard.tsx');
assert.ok(booked.includes("pathname: '/cruise-details' as any"));
assert.ok(booked.includes('onPress={() => handleCruisePress(nextCruise)}'));
assert.ok(details.includes('resolveCruiseDetailsRecord(allCruises, routeParams)'));
assert.ok(details.includes('InteractionManager.runAfterInteractions'));
assert.ok(card.includes('pointerEvents="none"'));

const forbiddenRootNames = fs.readdirSync(root).filter((name) =>
  name === '.DS_Store' || name.startsWith('._') || /(?:QA|TEST_LOG|RELEASE_NOTES|CHANGED_FILES|TODO|PROTOCOL|REPORT)/i.test(name)
);
assert.deepEqual(forbiddenRootNames, []);

console.log('PASS Build 359 full-conversation audit: persistence identity, syncs, certificates, local-first data, weather, loyalty, admin exports, and navigation');
