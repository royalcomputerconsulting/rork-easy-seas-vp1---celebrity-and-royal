const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');

const root = path.resolve(__dirname, '..');
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');

function compileTs(relativePath, stubs = {}) {
  const filename = path.join(root, relativePath);
  const compiled = ts.transpileModule(read(relativePath), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    fileName: filename,
  }).outputText;
  const originalLoad = Module._load;
  Module._load = function patchedLoad(request, parent, isMain) {
    if (Object.prototype.hasOwnProperty.call(stubs, request)) return stubs[request];
    return originalLoad.call(this, request, parent, isMain);
  };
  try {
    const mod = new Module(filename, module);
    mod.filename = filename;
    mod.paths = Module._nodeModulePaths(path.dirname(filename));
    mod._compile(compiled, filename);
    return mod.exports;
  } finally {
    Module._load = originalLoad;
  }
}

const dateStubs = {
  toCalendarDateOnly: (value) => /^\d{4}-\d{2}-\d{2}$/.test(String(value)) ? String(value) : undefined,
};

const identity = compileTs('lib/cruiseInventory/cruiseCanonicalIdentity.ts', {
  '@/lib/date': dateStubs,
});

const csvParserStubs = {
  parseCSVLine: (line) => line.split(',').map((value) => value.trim()),
  normalizeDateString: (value) => {
    const text = String(value || '').trim();
    const match = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/);
    if (!match) return text;
    const year = match[3].length === 2 ? `20${match[3]}` : match[3];
    return `${year}-${match[1].padStart(2, '0')}-${match[2].padStart(2, '0')}`;
  },
  calculateReturnDate: (sailDate, nights) => {
    const date = new Date(`${sailDate}T00:00:00Z`);
    date.setUTCDate(date.getUTCDate() + Number(nights || 0));
    return date.toISOString().slice(0, 10);
  },
  getPriceForRoomType: (_roomType, interior) => interior,
  detectDelimiter: () => 'comma',
  createHeaderMap: (headers) => {
    const map = new Map();
    headers.forEach((header, index) => {
      map.set(header, index);
      map.set(header.replace(/[^a-z0-9]/g, ''), index);
    });
    return map;
  },
  getColumnIndex: (headerMap, aliases) => {
    for (const alias of aliases) {
      const key = alias.toLowerCase();
      const compact = key.replace(/[^a-z0-9]/g, '');
      if (headerMap.has(key)) return headerMap.get(key);
      if (headerMap.has(compact)) return headerMap.get(compact);
    }
    return -1;
  },
};

const offersParser = compileTs('lib/csv/offersParser.ts', {
  '@/lib/valueCalculator': { getDoubleOccupancyRoomRetailValue: (value) => Number(value || 0) * 2 },
  './csvParser': csvParserStubs,
  '@/lib/cruiseRecordIntegrity': { knownNightCount: (value) => Number(value || 0) || 0 },
});

const royalCsv = [
  'Profile,B2B,Code,Rcvd,Expires,Trade,Value,Interior,OV,Balcony,Suite,Name,Class,Ship,Sail Date,Departs,Nights,Destination,Category,Guests,Perks',
  'scott.merlis1,0,26VAR503,08/19/26,09/12/26,$0,$1210,$211,$350,$500,$900,CR Targeted Offer,Oasis Class,Allure of the Seas,08/16/26,Port Canaveral,6,Western Caribbean,Oasis Class,1G,FreePlay',
  'scott.merlis1,4,26VAR503,08/19/26,09/12/26,$0,$729,$267,$350,$500,$900,CR Targeted Offer,Oasis Class,Allure of the Seas,08/16/26,Port Canaveral,6,Western Caribbean,Oasis Class,1G,FreePlay',
].join('\n');

const parsedRoyal = offersParser.parseOffersCSV(royalCsv);
assert.equal(parsedRoyal.cruises.length, 2, 'Royal CSV rows must be retained one-for-one');
assert.equal(parsedRoyal.offers.length, 1, 'same offer remains one offer record while cruise options stay distinct');
assert.equal(parsedRoyal.cruises[0].b2bSequence, '0');
assert.equal(parsedRoyal.cruises[1].b2bSequence, '4');
assert.equal(
  identity.getCanonicalCruiseInventoryKey(parsedRoyal.cruises[0]),
  identity.getCanonicalCruiseInventoryKey(parsedRoyal.cruises[1]),
  'physical sailing identity may still match',
);
assert.notEqual(
  identity.getCruiseInventoryOptionKey(parsedRoyal.cruises[0]),
  identity.getCruiseInventoryOptionKey(parsedRoyal.cruises[1]),
  'available option identity must include B2B/source row dimensions',
);

const crewImport = compileTs('lib/crewRecognitionImport.ts');
const crewCsv = [
  'Crew_ID,Crew_Name,Department,Role_Title,Ship_Name,Sailing_ID,Start_Date,End_Date',
  '1,Jane Doe,Dining,Server,Harmony of the Seas,HOS-2026-09-10,2026-09-10,2026-09-15',
].join('\n');
const parsedCrew = crewImport.parseCrewRecognitionImport(crewCsv, 'tester@example.com');
assert.equal(parsedCrew.format, 'csv', 'Ship_Name/Crew_Name master registries must be treated as CSV');
assert.equal(parsedCrew.entries.length, 1);
assert.equal(parsedCrew.entries[0].fullName, 'Jane Doe');

const repository = read('lib/cruiseInventory/CruiseInventoryRepository.ts');
assert.match(repository, /getCruiseInventoryOptionKey\(cruise\)/, 'SQLite inventory must store option-row identity, not collapsed physical identity');
assert.match(repository, /same-provider-exact-offer-option/, 'dedupe reason must be exact option duplicate only');
assert.match(repository, /SELECT relationships\.provider AS provider, COUNT\(\*\) AS count/, 'provider counts must count offer-sailing rows');

const royalSyncProvider = read('state/RoyalCaribbeanSyncProvider.tsx');
assert.match(royalSyncProvider, /offer-sailing option row/, 'sync readback log must describe option rows');
assert.match(royalSyncProvider, /availableCruiseRowsAfterReconciliation/, 'final sync state must preserve available option rows separately from booked/profile records');
assert.match(royalSyncProvider, /totalImportedCruises: availableCruiseRowsAfterReconciliation/, 'legacy imported-count field must not be populated from booked/profile records');

const dataBundle = read('lib/dataBundle/bundleOperations.ts');
assert.match(dataBundle, /quotaSafeGetItem\(storageKey\)/, 'profile-gated restore must read chunked quota-safe storage');
assert.match(dataBundle, /Skipped empty cruise restore/, 'empty backup cruise sections must not wipe existing inventory');
assert.match(dataBundle, /Skipped empty casino-offer restore/, 'empty backup offer sections must not wipe existing offers');
assert.match(dataBundle, /Skipped empty crew recognition entry restore/, 'empty crew sections must not wipe imported crew registry');

const askMyData = read('app/ask-my-data.tsx');
assert.match(askMyData, /totalSourceCruises \|\| totalCruises/, 'Ask My Data must see available option-row counts');

const warRoom = read('app/war-room.tsx');
assert.match(warRoom, /@\/hooks\/useCruiseInventory/, 'Command Center/War Room must import the real cruise inventory hook');
assert.doesNotMatch(warRoom, /@\/state\/CruiseInventoryProvider/, 'War Room must not import the removed CruiseInventoryProvider module');

const settings = read('app/(tabs)/settings.tsx');
assert.match(settings, /inventoryAvailableOptions \|\| inventoryAvailableCruises \|\| cruiseInventoryCount/, 'Settings must display lossless available option totals');
assert.match(settings, /getOfferInstanceStats\(casinoOffers, localData\.offers \|\| \[\], !coreData\.isLoading\)/, 'Settings must use legacy offers only while the authoritative CoreData snapshot is still hydrating');

const overview = read('app/(tabs)/(overview)/index.tsx');
assert.match(overview, /queryOfferSailings\(\{ \.\.\.query, limit: 1 \}\)/, 'Offers tab must use query-backed per-offer counts instead of relying on the preview page');
assert.match(overview, /fallbackPage = await queryOfferSailings\(\{ offerCode: offer\.offerCode \|\| card\.offerCode, limit: 1 \}\)/, 'Offers tab count must fall back to offer-code rows when instance-key count is too small');
assert.match(overview, /cruiseCountOverride=\{offerSailingCounts\[item\.id\]/, 'Offer cards must display query-backed cruise counts');
assert.match(overview, /buildOfferDetailsParams\([^\n]+\{ expectedCruiseCount/, 'Offer detail route must carry the count displayed on the card for detail-page validation');
assert.match(overview, /routeOfferId = offer\.representativeOffer\?\.id \|\| offer\.id/, 'Grouped offer cards must route by the representative persisted offer id');

const offerCard = read('components/CasinoOfferCard.tsx');
assert.match(offerCard, /cruiseCountOverride\?: number/, 'offer card must accept query-backed cruise counts');
assert.match(offerCard, /Loading cruises…/, 'offer card must not display false zero-cruise counts while query-backed counts load');

const offerDetails = read('app/offer-details.tsx');
const canonicalCruiseCard = read('components/CruiseCard.tsx');
assert.match(offerDetails, /expectedCruiseCount/, 'Offer detail page must receive the card count so it can reject partial query results');
assert.match(offerDetails, /inventoryOfferQuery\.offerInstanceKey && primaryPage\.total === 0/, 'Offer detail page may use offer-code fallback only when a provider instance has no indexed rows');
assert.match(offerDetails, /if \(fallbackPage\.total > 0\)/, 'Offer detail page must accept a non-empty legacy code fallback without combining populated instances');
assert.match(offerDetails, /openDecoded/, 'Offer detail page must support opening directly into decoded mode from offer action buttons');
assert.match(offerDetails, /getOfferSailingRowKey/, 'Offer detail page must preserve offer-sailing option identity');
assert.doesNotMatch(offerDetails, /self\.findIndex\(c => c\.id === cruise\.id\)/, 'Offer detail page must not collapse rows by physical cruise id');
assert.match(offerDetails, /offer-cruise-filter-input/, 'Offer detail page must provide a filterable cruise list');
assert.match(offerDetails, /while \(!cancelled && cursor && collectedRows\.length < targetRows\)/, 'Offer detail page must auto-load all inventory pages for the displayed offer count');
assert.match(offerDetails, /OFFER_DETAIL_MAX_ROWS/, 'Offer detail page must bound auto-loading so very large offers cannot freeze navigation');
assert.match(offerDetails, /Loading cruises for this offer/, 'Offer detail empty state must distinguish loading from a true no-cruises result');
assert.match(offerDetails, /function getOfferSailingCabinLabel/, 'Offer detail page must derive the eligible cabin bucket from each offer-sailing row');
assert.match(offerDetails, /<CruiseCard[\s\S]*?mini[\s\S]*?showRetailValue/, 'Offer detail must use the canonical complete cruise card');
assert.match(canonicalCruiseCard, /getCanonicalCruiseCabinLabel\(cruise\)/, 'The canonical cruise card must normalize the exact row-level cabin entitlement through the shared truth helper');
assert.match(canonicalCruiseCard, /<Text style=\{styles\.cabinType\}>\{canonicalCabinLabel\}<\/Text>/, 'The canonical cruise card must visibly show the normalized row-level cabin entitlement');
assert.match(canonicalCruiseCard, /Stateroom not stated/, 'The canonical cruise card must not invent a missing cabin');
assert.match(canonicalCruiseCard, /cruise\.oceanviewPrice/, 'The canonical offer-sailing pricing row must include Oceanview, not just Interior, Balcony, and Suite');
assert.match(offerDetails, /getOfferSailingCabinLabel\(cruise\)/, 'Offer detail search must use the cabin entitlement from each exact sailing row');

const commandCenter = read('app/war-room.tsx');
assert.match(commandCenter, /useCruiseInventory\(\)/, 'Command Center must use query-backed offer-sailing counts');
assert.match(commandCenter, /queryOfferSailings\(\{ offerCode: displayCode, limit: 1 \}\)/, 'Command Center must count offer-code sailings for shared-code offers');
assert.match(commandCenter, /expectedCruiseCount = offerSailingCounts/, 'Command Center View/Decode must pass the expected attached-cruise count');
assert.match(commandCenter, /openDecoded: true/, 'Command Center Decode must open the full offer detail list with decoded terms visible');

const repositoryDetail = read('lib/cruiseInventory/CruiseInventoryRepository.ts');
assert.match(repositoryDetail, /offerSailingKey: row\.canonical_key/, 'Offer sailing query rows must retain row-level identity for display');
assert.match(repositoryDetail, /id: row\.canonical_key \|\| row\.inventory_key \|\| parsed\.id/, 'Offer sailing query rows must not navigate/render under only the physical sailing id');

const carnivalSyncScreen = read('app/carnival-sync.tsx');
assert.match(carnivalSyncScreen, /Available Cruise Rows After Reconciliation/, 'Carnival export log must report saved option rows');
assert.match(carnivalSyncScreen, /Provider Booking\/History Records After Reconciliation/, 'Carnival export log must keep booked/profile records separate');
assert.doesNotMatch(carnivalSyncScreen, /Provider Records After Reconciliation: \$\{state\.syncCounts\.totalImportedCruises/, 'Carnival export log must not label booked/profile count as provider inventory records');

console.log('PASS Build 425 keeps Royal/Celebrity/Carnival offer-sailing rows as available cruises and protects import/save/load counts');
