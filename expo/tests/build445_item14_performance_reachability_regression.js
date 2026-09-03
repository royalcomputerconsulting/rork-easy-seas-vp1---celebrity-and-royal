const assert = require('node:assert/strict');
const fs = require('node:fs');

const read = (relative) => fs.readFileSync(relative, 'utf8');

const offers = read('app/(tabs)/(overview)/index.tsx');
for (const contract of ['<FlatList', 'ListHeaderComponent={renderHeader}', 'ListFooterComponent={renderFooter}', 'initialNumToRender={5}', 'maxToRenderPerBatch={5}', 'windowSize={7}', 'useDeferredValue']) {
  assert.ok(offers.includes(contract), `Offers must retain ${contract}`);
}

const offerDetails = read('app/offer-details.tsx');
assert.match(offerDetails, /const OFFER_VISIBLE_PAGE_SIZE = 20/);
assert.match(offerDetails, /return displayedOfferCruises\.slice\(start, start \+ OFFER_VISIBLE_PAGE_SIZE\)/);
assert.match(offerDetails, /data=\{pagedOfferCruises\}/);
assert.match(offerDetails, /maxToRenderPerBatch=\{20\}/);
assert.match(offerDetails, /Page \{\(offerVisiblePage \+ 1\).*up to 20 cruises/);

const cruises = read('app/(tabs)/scheduling.tsx');
for (const contract of ['useDeferredValue', 'queryCruises', 'loadMoreCatalogRows', 'cruises-catalog-load-more', 'ListFooterComponent={renderListFooter}', 'initialNumToRender={6}', 'maxToRenderPerBatch={6}', 'windowSize={9}']) {
  assert.ok(cruises.includes(contract), `Cruises must retain ${contract}`);
}

const booked = read('app/(tabs)/booked.tsx');
for (const contract of ['<FlatList', 'ListHeaderComponent={renderHeader}', 'initialNumToRender={6}', 'maxToRenderPerBatch={5}', 'windowSize={7}']) {
  assert.ok(booked.includes(contract), `Booked must retain ${contract}`);
}

const machines = read('app/(tabs)/machines.tsx');
for (const contract of ['<FlatList', 'ListHeaderComponent={(', '{listHeader}', 'initialNumToRender={12}', 'maxToRenderPerBatch={16}', 'windowSize={10}', 'removeClippedSubviews']) {
  assert.ok(machines.includes(contract), `Slots must retain ${contract}`);
}
assert.match(machines, /showAlphabetRail/);
assert.match(machines, /listHeaderHeight - 120/);
const machineProvider = read('state/SlotMachineLibraryProvider.tsx');
assert.match(machineProvider, /deferring index load/);
assert.match(machineProvider, /hydrated on demand/);

const crewProvider = read('state/CrewRecognitionProvider.tsx');
assert.match(crewProvider, /const \[pageSize\] = useState\(50\)/);
assert.match(crewProvider, /filteredLocalEntries\.slice\(start, start \+ pageSize\)/);
const crew = read('components/crew-recognition/CrewRecognitionSection.tsx');
assert.match(crew, /ensureLocalDataLoaded/);
assert.match(crew, /showing at most \{pageSize\}/);
assert.match(crew, /crew-recognition\.pagination/);

const events = read('app/(tabs)/events.tsx');
assert.match(events, /const PASSENGER_TIMELINE_PAGE_SIZE = 20/);
assert.match(events, /passengerDayItems\.slice\(start, start \+ PASSENGER_TIMELINE_PAGE_SIZE\)/);
assert.match(events, /calendar-passenger-pagination/);
assert.doesNotMatch(events, /<CrewRecognitionSection/);
assert.match(events, /router\.push\('\/crew-recognition'/);
assert.match(events, /\.slice\(0, 5\)/);

const certificateCodes = read('app/certificate-codes.tsx');
for (const contract of ['<FlatList', 'initialNumToRender={8}', 'maxToRenderPerBatch={8}', 'windowSize={7}']) {
  assert.ok(certificateCodes.includes(contract), `Certificate catalog must retain ${contract}`);
}
const certificateResults = read('app/certificate-summary-results.tsx');
assert.match(certificateResults, /const PAGE_SIZE = 20/);
assert.match(certificateResults, /matching\.slice\(start, start \+ PAGE_SIZE\)/);
assert.match(certificateResults, /certificate-summary-results\.pagination/);

const casino = read('components/casino/CasinoCommandCenter.tsx');
for (const tab of ['intelligence', 'charts', 'session', 'calcs']) assert.ok(casino.includes(`activeTab === '${tab}'`), `Casino must mount ${tab} only when active.`);
assert.match(casino, /setTimeout\(\(\) => setChartsReady\(true\), 0\)/);
assert.match(casino, /CASINO_TRUTH_BATCH_SIZE = 125/);

const relationshipMap = read('components/ui/InteractiveRelationshipMap.tsx');
assert.match(relationshipMap, /slice\(0, 30\)/);
assert.match(relationshipMap, /slice\(0, listLimit\)/);

const agent = read('state/AgentXProvider.tsx');
assert.match(agent, /isVisible \? filterRecordsByIntelligence/);
assert.match(agent, /useDeferredValue/);

console.log('PASS build445_item14_performance_reachability_regression');
