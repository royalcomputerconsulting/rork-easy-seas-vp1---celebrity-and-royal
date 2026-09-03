const assert = require('node:assert/strict');
const fs = require('node:fs');

const cruises = fs.readFileSync('app/(tabs)/scheduling.tsx', 'utf8');

// Favorites and every priority control precede the unbounded result catalog.
const favoritesIndex = cruises.indexOf('testID="cruises-favorites-before-catalog"');
const catalogIndex = cruises.indexOf('testID="cruises-catalog-section"');
assert.ok(favoritesIndex >= 0, 'Favorites must have a stable acceptance target.');
assert.ok(catalogIndex > favoritesIndex, 'Favorites must remain above the long cruise catalog.');
assert.match(cruises, /Favorite cruises and staterooms/);
assert.match(cruises, /Saved preferences stay reachable above the long sailing catalog/);

// The bottom may not recede automatically as more rows are mounted. Users
// choose when to fetch the next bounded page and receive a definite end state.
assert.match(cruises, /limit: activeTab === 'foryou' \? 200 : 75/);
assert.match(cruises, /limit: 75/);
assert.match(cruises, /testID="cruises-catalog-load-more"/);
assert.match(cruises, /testID="cruises-catalog-end"/);
assert.match(cruises, /End of cruise catalog/);
assert.match(cruises, /testID="cruises-return-to-discovery"/);
assert.match(cruises, /Back to discovery and favorites/);
assert.doesNotMatch(cruises, /onEndReached=/, 'Approaching the footer must not automatically move the bottom.');
assert.doesNotMatch(cruises, /getItemLayout=/, 'Variable-height complete cards cannot use a fabricated fixed row height.');

// Virtualization and generous footer/safe-area spacing stay intact.
for (const contract of [
  '<FlatList',
  'ListHeaderComponent={renderHeader}',
  'ListFooterComponent={renderListFooter}',
  'initialNumToRender={6}',
  'maxToRenderPerBatch={6}',
  'windowSize={9}',
  'paddingBottom: 120',
]) assert.ok(cruises.includes(contract), `Cruise reachability is missing ${contract}.`);

console.log('PASS Build 445 Item 22 favorites placement, explicit bounded paging, variable-height safety, and reachable catalog footer');
