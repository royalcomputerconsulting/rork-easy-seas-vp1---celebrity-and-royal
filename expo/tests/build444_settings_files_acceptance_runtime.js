const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const JSZip = require('jszip');
const XLSX = require('xlsx');
const { loadTs } = require('../scripts/clubRoyaleTestBootstrap');

const root = path.resolve(__dirname, '..');
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');

function withModuleStubs(stubs, callback) {
  const originalLoad = Module._load;
  Module._load = function patchedLoad(request, parent, isMain) {
    const direct = stubs[request];
    const matched = direct ?? Object.entries(stubs)
      .find(([key]) => key.startsWith('*') && request.includes(key.slice(1)))?.[1];
    return matched ?? originalLoad.call(this, request, parent, isMain);
  };
  try {
    return callback();
  } finally {
    Module._load = originalLoad;
  }
}

async function run() {
  // Install the portable TypeScript loader before adding per-module native stubs.
  loadTs('lib/date.ts');

  const certificateExporter = withModuleStubs({
    '@/lib/importExport': { exportBase64File: async () => true },
  }, () => loadTs('lib/certificates/certificateCsvZipExport.ts'));

  const progress = [];
  const built = await certificateExporter.buildCertificateResultsZip([
    {
      certificateCode: '2609A05',
      parsedSailings: [
        {
          certificateCode: '2609A05',
          shipName: 'Harmony of the Seas',
          sailingDate: '2026-09-10',
          nights: 5,
          departurePort: 'Port Canaveral, Florida',
          itinerary: 'Bahamas & Perfect Day',
          cabinCategory: 'Balcony',
          guestCount: 2,
          pointRequirement: 2000,
        },
        {
          certificateCode: '2609A05',
          shipName: 'Icon of the Seas',
          sailingDate: '2026-10-24',
          nights: 7,
          departurePort: 'Miami, Florida',
          itinerary: 'Western Caribbean & Perfect Day',
          cabinCategory: 'Interior',
          guestCount: 1,
          pointRequirement: 2000,
        },
      ],
    },
    {
      certificateCode: '2609C08',
      parsedSailings: [{
        certificateCode: '2609C08',
        shipName: 'Navigator of the Seas',
        sailingDate: '2026-09-18',
        nights: 4,
        departurePort: 'Los Angeles, California',
        itinerary: 'Catalina & Ensenada',
        cabinCategory: 'Oceanview',
        occupancy: '2 guests',
        pointRequirement: 800,
      }],
    },
  ], new Date('2026-08-31T12:00:00Z'), (event) => progress.push(event));

  assert.equal(built.certificateCount, 2);
  assert.equal(built.optionRowCount, 3);
  assert.equal(built.csvFileCount, 5);
  assert.ok(progress.some((event) => event.stage === 'indexing'));
  assert.ok(progress.some((event) => event.stage === 'building_csv'));
  assert.ok(progress.some((event) => event.stage === 'compressing'));

  const zip = await JSZip.loadAsync(Buffer.from(built.base64, 'base64'));
  for (const expected of [
    'certificate-summary.csv',
    'certificate-ship-class-summary.csv',
    'all-certificate-sailing-options.csv',
    'certificates/2609A05.csv',
    'certificates/2609C08.csv',
    'README.txt',
  ]) assert.ok(zip.file(expected), `${expected} is missing from certificate ZIP`);
  const masterCsv = await zip.file('all-certificate-sailing-options.csv').async('string');
  assert.match(masterCsv, /Harmony of the Seas/);
  assert.match(masterCsv, /Icon of the Seas/);
  assert.match(masterCsv, /Navigator of the Seas/);
  assert.match(masterCsv, /Balcony,2/);
  assert.match(masterCsv, /Interior,1/);

  const workbook = XLSX.utils.book_new();
  const sheet = XLSX.utils.aoa_to_sheet([
    ['Full Name', 'Department', 'Role Title', 'Ship'],
    ['Alex Example', 'Casino', 'Host', 'Harmony of the Seas'],
    ['Jordan Example', 'Dining', 'Server', 'Icon of the Seas'],
  ]);
  XLSX.utils.book_append_sheet(workbook, sheet, 'Master Registry');
  const workbookBytes = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
  const crewWorkbook = loadTs('lib/crewRecognitionWorkbook.ts');
  const converted = crewWorkbook.crewWorkbookBytesToCsv(workbookBytes);
  assert.equal(converted.sheetName, 'Master Registry');
  assert.equal(converted.rowCount, 2);
  assert.match(converted.csv, /Alex Example/);
  assert.match(converted.csv, /Jordan Example/);

  const settings = read('app/(tabs)/settings.tsx');
  const fileOperations = read('lib/fileIO/fileOperations.ts');
  const bundleFileIO = read('lib/dataBundle/bundleFileIO.ts');
  const crewModal = read('components/crew-recognition/ImportCrewTextModal.tsx');
  for (const source of [settings, fileOperations, bundleFileIO, crewModal]) {
    assert.match(source, /const pickDocument = DocumentPicker\.getDocumentAsync/);
    assert.match(source, /typeof pickDocument !== 'function'/);
  }
  for (const action of [
    'settings-save-all',
    'settings-load-all',
    'settings-export-certificates-zip',
    'settings-export-all-app-data',
    'settings-restore-from-backup',
  ]) assert.match(settings, new RegExp(`testID(?:=|:) [\"']?${action}`.replace('(?:=|:) ', '(?:=|:)\\s*')), `${action} is missing`);
  assert.match(settings, /OperationStatusCard/);
  assert.match(settings, /loadSearchableCertificates\(\)/);
  assert.match(settings, /https:\/\/www\.amazon\.com\/dp\/B0GYRDTS6L/);
  assert.match(settings, /https:\/\/www\.amazon\.com\/dp\/B0G4NG1L2M/);
  assert.match(settings, /https:\/\/www\.amazon\.com\/stores\/author\/B0GCQ1S8MH\/allbooks/);

  console.log('PASS Build 444 Settings/file acceptance: readable certificate ZIP, workbook conversion, guarded iOS pickers, progress, and Amazon actions');
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
