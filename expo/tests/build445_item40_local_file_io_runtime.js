#!/usr/bin/env node

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const XLSX = require('xlsx');
const { loadTs, root } = require('../scripts/clubRoyaleTestBootstrap');

const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');
const completedPath = '/Users/rcg/Library/Mobile Documents/com~apple~CloudDocs/completed_cruises_2025_2026.csv';
const crewPath = '/Users/rcg/Library/Mobile Documents/com~apple~CloudDocs/master_crew_registry.xlsx';
const backupPath = '/Users/rcg/Library/Mobile Documents/com~apple~CloudDocs/Easy Seas - Backup 08.19.26.json';
const offersPath = path.join(root, 'tests/fixtures/offers-current-2026-08-27.csv');

function compileWithMocks(relative, mocks) {
  const filename = path.join(root, relative);
  const output = ts.transpileModule(read(relative), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
    fileName: filename,
  }).outputText;
  const originalLoad = Module._load;
  Module._load = function patchedLoad(request, parent, isMain) {
    if (Object.prototype.hasOwnProperty.call(mocks, request)) return mocks[request];
    return originalLoad.call(this, request, parent, isMain);
  };
  try {
    const mod = new Module(filename, module);
    mod.filename = filename;
    mod.paths = Module._nodeModulePaths(path.dirname(filename));
    mod._compile(output, filename);
    return mod.exports;
  } finally {
    Module._load = originalLoad;
  }
}

(async () => {
  for (const file of [completedPath, crewPath, backupPath, offersPath]) {
    assert.ok(fs.existsSync(file), `required acceptance file is missing: ${file}`);
  }

  const virtualFiles = new Map([
    ['memory://calendar.ics', 'BEGIN:VCALENDAR\nBEGIN:VEVENT\nUID:item40\nSUMMARY:Icon cruise\nDTSTART;VALUE=DATE:20260915\nDTEND;VALUE=DATE:20260922\nEND:VEVENT\nEND:VCALENDAR'],
  ]);
  const pickerQueue = [
    { name: path.basename(completedPath), uri: completedPath, size: fs.statSync(completedPath).size, mimeType: 'text/csv' },
    { name: 'calendar.ics', uri: 'memory://calendar.ics', size: virtualFiles.get('memory://calendar.ics').length, mimeType: 'text/calendar' },
    { name: path.basename(backupPath), uri: backupPath, size: fs.statSync(backupPath).size, mimeType: 'application/json' },
  ];
  const pickerOptions = [];
  const writtenFiles = new Map();
  const sharedFiles = [];
  class MockExpoFile {
    constructor(uriOrBase, name) {
      this.uri = name ? `${uriOrBase}${name}` : uriOrBase;
    }
    async text() {
      return virtualFiles.has(this.uri) ? virtualFiles.get(this.uri) : fs.readFileSync(this.uri, 'utf8');
    }
    async write(value) { writtenFiles.set(this.uri, value); }
  }
  const fileOperations = compileWithMocks('lib/fileIO/fileOperations.ts', {
    'react-native': { Platform: { OS: 'ios' } },
    'expo-document-picker': {
      getDocumentAsync: async (options) => {
        pickerOptions.push(options);
        return { canceled: false, assets: [pickerQueue.shift()] };
      },
    },
    'expo-file-system': {
      File: MockExpoFile,
      Paths: { cache: 'memory://cache/' },
      downloadAsync: async () => ({ status: 200 }),
      readAsStringAsync: async (uri) => virtualFiles.get(uri),
      deleteAsync: async () => undefined,
    },
    'expo-sharing': {
      isAvailableAsync: async () => true,
      shareAsync: async (uri, options) => sharedFiles.push({ uri, options }),
    },
    '../importSchemas': {
      validateFileSize: (size) => ({ success: size > 0, errors: [], warnings: [] }),
      validateRowCount: (rows) => ({ success: rows > 0, errors: [], warnings: [] }),
      validateImportContent: (content) => ({ success: Boolean(content), data: content, errors: [], warnings: [] }),
    },
  });

  const completedPick = await fileOperations.pickAndReadFile('csv');
  const calendarPick = await fileOperations.pickAndReadFile('ics');
  const backupPick = await fileOperations.pickAndReadFile('json');
  assert.match(completedPick.content, /Club Royale Casino Points/);
  assert.match(calendarPick.content, /BEGIN:VEVENT/);
  assert.equal(JSON.parse(backupPick.content).metadata.totalCruises, 4151);
  assert.equal(pickerOptions.length, 3);
  assert.ok(pickerOptions.every((options) => options.copyToCacheDirectory === true), 'iOS security-scoped selections must be copied into the app cache before reading');

  await fileOperations.exportFile('a,b\n1,2', 'item40.csv');
  await fileOperations.exportFile('BEGIN:VCALENDAR\nEND:VCALENDAR', 'item40.ics');
  await fileOperations.exportFile('{"ok":true}', 'item40.json');
  assert.equal(sharedFiles.length, 3, 'native share sheet must receive each requested export');
  assert.deepEqual(sharedFiles.map((item) => item.options.mimeType), ['text/csv', 'text/calendar', 'application/json']);
  assert.equal(writtenFiles.size, 3);

  const missingPicker = compileWithMocks('lib/fileIO/fileOperations.ts', {
    'react-native': { Platform: { OS: 'ios' } },
    'expo-document-picker': {},
    'expo-file-system': { File: MockExpoFile, Paths: { cache: 'memory://cache/' } },
    'expo-sharing': {},
    '../importSchemas': {
      validateFileSize: () => ({ success: true, errors: [], warnings: [] }),
      validateRowCount: () => ({ success: true, errors: [], warnings: [] }),
      validateImportContent: () => ({ success: true, errors: [], warnings: [] }),
    },
  });
  await assert.rejects(() => missingPicker.pickAndReadFile('csv'), /iOS file picker is not available/i);

  const crewWorkbook = loadTs('lib/crewRecognitionWorkbook.ts');
  const crewImport = loadTs('lib/crewRecognitionImport.ts');
  const convertedCrew = crewWorkbook.crewWorkbookBytesToCsv(fs.readFileSync(crewPath));
  assert.equal(convertedCrew.sheetName, 'Master Registry');
  assert.equal(convertedCrew.rowCount, 776);
  const parsedCrew = crewImport.parseCrewRecognitionImport(convertedCrew.csv, 'item40-profile');
  assert.ok(parsedCrew.entries.length >= 776);
  assert.ok(parsedCrew.entries.every((row) => row.userId === 'item40-profile'));

  const offersParser = loadTs('lib/csv/offersParser.ts');
  const parsedOffers = offersParser.parseOffersCSV(fs.readFileSync(offersPath, 'utf8'));
  assert.equal(parsedOffers.cruises.length, 391);
  assert.equal(parsedOffers.offers.length, 5);
  assert.ok(parsedOffers.cruises.every((row) => row.shipName && row.sailDate && row.cabinType && row.guestsInfo));

  const completedWorkbook = XLSX.read(fs.readFileSync(completedPath, 'utf8'), { type: 'string', raw: true });
  const completedRows = XLSX.utils.sheet_to_json(completedWorkbook.Sheets[completedWorkbook.SheetNames[0]], { defval: '' });
  const completedCruises = completedRows.filter((row) => row.Ship && row['Sail Date'] && !/total/i.test(String(row['Sail Date'])));
  assert.equal(completedRows.length, 36);
  assert.equal(completedCruises.length, 33);
  assert.ok(completedCruises.every((row) => row.Reservation && row.Nights));
  assert.equal(completedCruises.filter((row) => row['Retail Value'] !== '' && row['Amount Paid'] !== '').length, 21, 'the 21 annual-scope rows retain complete economics while later completed sailings remain valid partial history');

  const ics = loadTs('lib/calendar/icsParser.ts');
  assert.equal(ics.parseICSFile(virtualFiles.get('memory://calendar.ics')).length, 1);

  const bookedParser = loadTs('lib/csv/bookedParser.ts');
  const bookedCsv = bookedParser.generateBookedCSV([{
    id: 'item40-booked', shipName: 'Icon of the Seas', sailDate: '2026-09-15', returnDate: '2026-09-22', nights: 7,
    destination: 'Eastern Caribbean', itineraryName: 'Eastern Caribbean', departurePort: 'Miami, Florida', reservationNumber: 'ITEM40',
    bookingId: 'ITEM40', cabinType: 'Balcony', guests: 2, status: 'booked', createdAt: '2026-09-01T00:00:00Z',
  }]);
  const parsedBooked = bookedParser.parseBookedCSV(bookedCsv, []);
  assert.equal(parsedBooked.length, 1);
  assert.equal(parsedBooked[0].reservationNumber, 'ITEM40');
  assert.equal(parsedBooked[0].sailDate, '09-15-2026', 'booked CSV round trips must not shift calendar dates by timezone');

  const backup = JSON.parse(fs.readFileSync(backupPath, 'utf8'));
  assert.equal(backup.cruises.length, 4151);
  assert.equal(backup.bookedCruises.length, 78);
  assert.equal(backup.casinoOffers.length, 16);
  assert.equal(backup.calendarEvents.length, 633);

  const settings = read('app/(tabs)/settings.tsx');
  for (const handler of ['handleImportOffersCSV', 'handleImportBookedCSV', 'handleImportCompletedCruisesXLSX', 'handleImportCalendarFromFile', 'handleExportCertificates', 'handleExportAllData', 'handleImportAllData']) {
    assert.match(settings, new RegExp(`const ${handler}`), `${handler} must be wired to Settings`);
  }
  for (const testId of ['settings-save-all', 'settings-load-all', 'settings-export-certificates-zip', 'settings-export-all-app-data', 'settings-restore-from-backup']) {
    assert.ok(settings.includes(testId), `${testId} must remain a real press target`);
  }
  const agentSea = read('app/ask-my-data.tsx');
  assert.match(agentSea, /testID="agent-sea-export-log"/);
  assert.match(agentSea, /onPress=\{\(\) => void handleExportLog\(\)\}/);

  console.log('PASS Build 445 Item 40 local file I/O: native cache-copy picker reads CSV/ICS/JSON, missing native modules fail clearly, real 776-row XLSX crew and 33-row completed-history files parse, offer/booked/calendar parsers retain required fields, native exports reach the share sheet, and Settings/Agent SEA actions remain wired.');
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
