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

// Build 339 startup, provider, and tab architecture remain immutable.
assert.equal(sha256('app/_layout.tsx'), '8feada8a189883c07b6180c090b4f021d750f50e50c7c88c1ab750869a45775d');
assert.equal(sha256('app/(tabs)/_layout.tsx'), '8370c9a38f5c0a81c6ed420c2291f25fa804d1889a3fcc9a3d21f00e6ffbec6d');

const booked = read('app/(tabs)/booked.tsx');
const card = read('components/CruiseCard.tsx');
const details = read('app/(tabs)/(overview)/cruise-details.tsx');
const planning = read('lib/cruisePlanningIntelligence.ts');
const casinoAvailability = read('lib/casinoAvailability.ts');

assert.ok(booked.includes("import { buildCruiseDetailsParams } from '@/lib/navigation/cruiseDetails'"));
assert.ok(booked.includes("pathname: '/cruise-details' as any"));
assert.ok(booked.includes("buildCruiseDetailsParams(cruise, { source: 'booked' })"));
assert.ok(!booked.includes('router.push(`/cruise-details?id=${cruise.id}&source=booked`'));
assert.ok(booked.includes('testID="booked-next-cruise-card"'));
assert.ok(booked.includes('onPress={() => handleCruisePress(nextCruise)}'));

assert.ok(card.includes('accessibilityLabel={`Open ${cruise.shipName} cruise details`}'));
assert.ok(card.includes('<View style={styles.miniImageOverlay} pointerEvents="none" />'));
assert.ok(card.includes('style={StyleSheet.absoluteFill}\n          pointerEvents="none"'));

assert.ok(details.includes('resolveCruiseDetailsRecord(allCruises, routeParams)'));
assert.ok(details.includes('InteractionManager.runAfterInteractions'));
assert.ok(details.includes('bookedHistoryRecords'));
assert.ok(details.includes('availableCruiseRecords'));
assert.ok(details.includes('testID="cruise-details-planning-loading"'));
assert.ok(details.includes('router.canGoBack()'));
assert.ok(!details.includes("router.push('/(tabs)/booked' as any)"));
assert.ok(!details.includes('router.push(`/cruise-details?id=${candidate.cruise.id}`'));

// Replacement matching is indexed and verbose per-sailing analysis is quiet in
// the bulk path, preventing thousands of repeated scans/log writes on entry.
assert.ok(planning.includes('const offersByCruiseId = new Map'));
assert.ok(planning.includes('const offersByCode = new Map'));
assert.ok(planning.includes('const offersBySailing = new Map'));
assert.ok(planning.includes('const shipFamiliarityCache = new Map'));
assert.ok(planning.includes("source: 'indexed-usable-offer-records'"));
assert.ok(planning.includes('calculateCasinoAvailabilityForCruise(cruise, undefined, { quiet: true })'));
assert.ok(casinoAvailability.includes('options?: { quiet?: boolean }'));

const { buildCruiseDetailsParams, resolveCruiseDetailsRecord } = loadTs('lib/navigation/cruiseDetails.ts');
const reservedIdCruise = {
  id: 'booking/123?guest=1&deck=8#suite',
  bookingId: 'BWO-12345',
  reservationNumber: 'RES-987',
  shipName: 'Icon of the Seas',
  sailDate: '2027-02-14',
  returnDate: '2027-02-21',
  brand: 'royal',
  status: 'booked',
};
const params = buildCruiseDetailsParams(reservedIdCruise, { source: 'booked' });
assert.equal(params.id, reservedIdCruise.id);
assert.equal(params.bookingId, 'BWO-12345');
assert.equal(params.source, 'booked');
assert.equal(resolveCruiseDetailsRecord([reservedIdCruise], params), reservedIdCruise);

// Imported merges may replace an opaque ID. Booking identity keeps the exact
// booked sailing navigable without selecting a different sailing by accident.
const mergedIdCruise = { ...reservedIdCruise, id: 'local-merged-id' };
assert.equal(resolveCruiseDetailsRecord([mergedIdCruise], params), mergedIdCruise);

const uniqueMaterialCruise = {
  id: 'material-only',
  shipName: 'Celebrity Beyond',
  sailDate: '2027-05-08',
  returnDate: '2027-05-15',
  cruiseSource: 'celebrity',
};
assert.equal(resolveCruiseDetailsRecord([uniqueMaterialCruise], {
  shipName: 'Celebrity Beyond',
  sailDate: '2027-05-08',
  returnDate: '2027-05-15',
  brand: 'celebrity',
}), uniqueMaterialCruise);
assert.equal(resolveCruiseDetailsRecord([
  uniqueMaterialCruise,
  { ...uniqueMaterialCruise, id: 'ambiguous-copy' },
], { shipName: 'Celebrity Beyond', sailDate: '2027-05-08' }), undefined);

// A portfolio-sized detail comparison must remain bounded. This catches the old
// repeated full-scan behavior that made a successful card tap appear frozen.
const { findCruiseReplacementCandidates } = loadTs('lib/cruisePlanningIntelligence.ts');
const currentCruise = {
  id: 'current-booking', shipName: 'Icon of the Seas', sailDate: '2027-01-01', returnDate: '2027-01-08',
  nights: 7, status: 'booked', ports: ['Miami', 'At Sea', 'Nassau', 'Miami'],
};
const alternatives = Array.from({ length: 2500 }, (_, index) => ({
  id: `cruise-${index}`,
  shipName: `Ship ${index % 40}`,
  sailDate: `2027-${String(1 + (index % 9)).padStart(2, '0')}-${String(1 + (index % 27)).padStart(2, '0')}`,
  returnDate: '2027-12-31',
  nights: 7,
  status: 'available',
  offerCode: `OFFER-${index}`,
  ports: ['Miami', 'At Sea', 'Nassau', 'Miami'],
}));
const offers = alternatives.map((cruise, index) => ({
  id: `offer-${index}`,
  cruiseId: cruise.id,
  offerCode: cruise.offerCode,
  shipName: cruise.shipName,
  sailingDate: cruise.sailDate,
  status: 'available',
  expiryDate: '2027-12-31',
}));
const benchmarkStartedAt = Date.now();
const candidates = findCruiseReplacementCandidates(currentCruise, alternatives, offers, [currentCruise]);
const benchmarkDuration = Date.now() - benchmarkStartedAt;
assert.ok(candidates.length <= 6);
assert.ok(benchmarkDuration < 5000, `2,500-cruise indexed detail planning took ${benchmarkDuration}ms`);

console.log(`PASS Build 358 My Cruises tap routing, resilient resolution, and indexed 2,500-cruise analytics (${benchmarkDuration}ms)`);
