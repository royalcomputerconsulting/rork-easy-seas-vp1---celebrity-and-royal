const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const scheduling = fs.readFileSync(path.join(root, 'app/(tabs)/scheduling.tsx'), 'utf8');
const filterBar = fs.readFileSync(path.join(root, 'components/ui/MinimalistFilterBar.tsx'), 'utf8');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

assert(scheduling.includes('indexedMatches:'), 'Cruises must retain the indexed query total separately from loaded rows.');
assert(scheduling.includes('loaded: filteredCruises.length'), 'Cruises must label the client-visible page length as loaded rows.');
assert(scheduling.includes('stats.catalogCruises.toLocaleString()} in catalog'), 'The Cruises identity band must show the authoritative catalog total rather than only the currently loaded page.');
assert(scheduling.includes('countLabel="loaded / indexed matches"'), 'The filter summary must explain the two different counts.');
assert(scheduling.includes('View loaded results'), 'The filter button must not claim the current page is the complete result set.');
assert(!scheduling.includes('available: enrichedCruises.filter'), 'Loaded rows must not masquerade as the complete available-cruise count.');
assert(filterBar.includes('countLabel?: string;'), 'The shared filter bar must support an explicit count meaning.');

console.log('PASS build445 cruise catalog count truth regression');
