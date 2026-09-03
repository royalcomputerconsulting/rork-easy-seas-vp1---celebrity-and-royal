const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

function loadOfflinePack() {
  const filename = path.join(root, 'lib/offlineVoyagePack.ts');
  const output = ts.transpileModule(read('lib/offlineVoyagePack.ts'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    fileName: filename,
  }).outputText;
  const oldLoad = Module._load;
  Module._load = (request, parent, main) => request.startsWith('@/') ? {} : oldLoad(request, parent, main);
  try {
    const mod = new Module(filename, module);
    mod.filename = filename;
    mod.paths = Module._nodeModulePaths(path.dirname(filename));
    mod._compile(output, filename);
    return mod.exports;
  } finally {
    Module._load = oldLoad;
  }
}

const { buildOfflineVoyagePackStatus } = loadOfflinePack();
const cruise = { id: 'harmony', shipName: 'Harmony of the Seas', sailDate: '2026-09-10', returnDate: '2026-09-15', itinerary: [] };
const forecasts = Array.from({ length: 6 }, (_, index) => ({
  cruiseId: 'harmony',
  dateKey: `2026-09-${String(10 + index).padStart(2, '0')}`,
  latitude: 28 - index,
  longitude: -80 + index,
  isStale: false,
}));
const pack = buildOfflineVoyagePackStatus({ cruise, forecasts, certificateCount: 0, certificateDocumentCount: 0, deckMappingCount: 0, calendarEvents: [] });
const itinerary = pack.sections.find((section) => section.key === 'itinerary');
assert.equal(itinerary.count, 6);
assert.equal(itinerary.ready, true);
assert.match(itinerary.detail, /weather route resolution/);

const casino = read('components/casino/CasinoCommandCenter.tsx');
assert.match(casino, /finiteDisplay/);
assert.match(casino, /isSignatureRetention/);
assert.match(casino, /syncedPoints \/ 25_000/);
assert.doesNotMatch(casino, /syncedPoints\.toLocaleString\(/);
assert.doesNotMatch(casino, /dashboard\.totalPoints\.toLocaleString\(/);

const booked = read('app/(tabs)/booked.tsx');
assert.match(booked, /const currentYearPoints = clubRoyalePoints/);
assert.doesNotMatch(booked, /historicalCoinInFromPoints/);
assert.match(booked, /filterRecordsForProfile\(bookedCruises, currentUser, users\)/);
assert.match(booked, /Prior Season Confirmed/);
assert.match(booked, /Cruise rows attributed/);
assert.match(booked, /assigned to named cruises/);
assert.match(booked, /not yet assigned/);
assert.match(booked, /casinoEvidenceRows\.map/);
assert.match(read('lib/casinoPointTruth.ts'), /CONFIRMED_CLUB_ROYALE_2026_POINTS = 23446/);
assert.match(read('lib/casinoPointTruth.ts'), /Icon of the Seas[\s\S]*pointsEarned: 2000/);
assert.match(read('lib/casinoPointTruth.ts'), /Star of the Seas[\s\S]*certificateEvidenceCode: '2607C08'[\s\S]*certificatePointFloor: 800/);
assert.match(read('lib/casinoAnnualReportFacts.ts'), /pointsEarned: 2030, originalCasinoPoints: 2030, annualReconciliationPoints: 1150/);
assert.match(read('lib/casino/ownerScopedCasinoHistory.ts'), /Celebrity Equinox[\s\S]*pointsEarned: 667[\s\S]*winningsBroughtHome: 581/);
assert.match(read('state/UserProvider.tsx'), /isKnownScottProfile \? 1045/);
assert.match(read('state/UserProvider.tsx'), /isKnownScottProfile \? 667/);
assert.match(read('state/UserProvider.tsx'), /isKnownScottProfile \? 'Onyx'/);
assert.match(read('state/UserProvider.tsx'), /hasNewerCelebrityEvidence/);
assert.match(read('state/UserProvider.tsx'), /celebrityLastSyncAt:/);

const settings = read('app/(tabs)/settings.tsx');
assert.match(settings, /coinInHeaderIsModeled/);
assert.match(settings, /equivalent\|/);
assert.match(settings, /explicitCoinIn !== undefined && !coinInHeaderIsModeled/);
assert.match(settings, /colAssignedClubRoyalePoints/);
assert.match(settings, /assigned club royale points/);

const weather = read('components/SailingWeatherCard.tsx');
assert.match(weather, /forecast\.source === 'planning'/);
assert.match(weather, /Planning outlook · not a dated forecast/);
assert.match(weather, /Check live weather again/);

const crew = read('components/crew-recognition/ImportCrewTextModal.tsx');
assert.match(crew, /import \* as DocumentPicker from 'expo-document-picker'/, 'crew registry file picker must use the Expo module namespace');
assert.match(crew, /const pickDocument = DocumentPicker\.getDocumentAsync/, 'crew registry file picker must not read getDocumentAsync from an undefined default export');
assert.doesNotMatch(crew, /import\('expo-document-picker'\)\)\.default/, 'crew registry import must not dereference expo-document-picker.default');
assert.match(crew, /readPickedFileAsBytes\(asset\.uri\)/, 'crew registry workbook import must read selected workbook bytes');
assert.match(crew, /readPickedFileAsText\(asset\.uri\)/, 'crew registry CSV/text import must read the selected file URI');
assert.match(crew, /fetch\(uri\)/, 'crew registry file readers must retain a URI fetch fallback for document-provider assets');

const runtimeFiles = [
  'state/CoreDataProvider.tsx',
  'state/SlotMachineProvider.tsx',
  'state/SlotMachineLibraryProvider.tsx',
  'hooks/useDeferredRender.ts',
  'lib/usePriceTrackingSync.ts',
  'app/certificate-portfolio.tsx',
  'app/certificate-lookup.tsx',
  'app/certificate-stacking-ledger.tsx',
  'app/(tabs)/machines.tsx',
  'app/(tabs)/(overview)/cruise-details.tsx',
  'app/ask-my-data.tsx',
  'app/certificate-codes.tsx',
];
runtimeFiles.forEach((file) => {
  assert.doesNotMatch(read(file), /import\s*\{[^}]*InteractionManager[^}]*\}\s*from\s*['"]react-native['"]/s, `${file} imports missing RN InteractionManager`);
});

const certificateLinkReview = read('app/casino/certificate-link-review.tsx');
assert.match(certificateLinkReview, /Confirm|Reassign|Unlink/);
assert.match(certificateLinkReview, /Earned certificate ledger/);
assert.match(certificateLinkReview, /Certificate threshold/);
assert.match(certificateLinkReview, /Award \/ trade/);
assert.match(certificateLinkReview, /Earning cruise/);
assert.match(certificateLinkReview, /Certificate issued/);
assert.match(certificateLinkReview, /PDF sailings/);
assert.match(read('app/certificate-codes.tsx'), /View Earned Certificate Ledger/);
assert.match(read('app/casino/metric-evidence.tsx'), /Formula|Correction path|Contributing cruise records/);

console.log('PASS Build 416 remaining screenshot defects, Casino safety, crew file access, weather planning, and offline route regression');
