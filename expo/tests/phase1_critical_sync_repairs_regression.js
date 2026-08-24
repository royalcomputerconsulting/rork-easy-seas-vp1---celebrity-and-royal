#!/usr/bin/env node
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ts = require('typescript');

const root = path.resolve(__dirname, '..');

function loadTypeScriptModule(relativePath) {
  const filename = path.join(root, relativePath);
  const source = fs.readFileSync(filename, 'utf8');
  const output = ts.transpileModule(source, {
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.CommonJS,
      esModuleInterop: true,
      strict: true,
    },
    fileName: filename,
    reportDiagnostics: true,
  });
  const errors = (output.diagnostics || []).filter((diagnostic) => diagnostic.category === ts.DiagnosticCategory.Error);
  assert.strictEqual(errors.length, 0, `${relativePath} transpilation failed: ${errors.map((d) => ts.flattenDiagnosticMessageText(d.messageText, ' ')).join('; ')}`);

  const module = { exports: {} };
  const context = vm.createContext({
    module,
    exports: module.exports,
    require,
    console,
    URL,
    Date,
    Object,
    Number,
    String,
    Boolean,
    Array,
    Math,
    Set,
    Map,
  });
  const script = new vm.Script(output.outputText, { filename });
  script.runInContext(context);
  return module.exports;
}

const booking = loadTypeScriptModule('lib/royalCaribbean/bookingNormalization.ts');
const webview = loadTypeScriptModule('lib/webViewSourceSafety.ts');
const carnivalExtraction = loadTypeScriptModule('lib/carnival/carnivalOffersExtraction.ts');

assert.strictEqual(
  booking.resolveRoyalCruiseStatus({
    sailDate: '20260717',
    endDate: '20260724',
    bookingStatus: 'BK',
    today: '2026-07-20',
  }),
  'In Progress',
  'A cruise underway through July 24 must not be marked completed on July 20.',
);

assert.strictEqual(
  booking.resolveRoyalCruiseStatus({
    sailDate: '20260717',
    nights: 7,
    bookingStatus: 'BK',
    today: '2026-07-20',
  }),
  'In Progress',
  'Authoritative nights must derive the return date when Royal omits it.',
);

assert.strictEqual(
  booking.resolveRoyalCruiseStatus({
    sailDate: '20260712',
    endDate: '20260719',
    bookingStatus: 'BK',
    today: '2026-07-20',
  }),
  'Completed',
  'A cruise is completed only after its return date.',
);

assert.strictEqual(
  booking.resolveRoyalCruiseStatus({
    sailDate: '20260724',
    nights: 7,
    bookingStatus: 'BK',
    today: '2026-07-20',
  }),
  'Upcoming',
);

const historyPayload = {
  status: 200,
  errors: [],
  payload: {
    sailings: [
      {
        bookingId: '441826',
        passengerId: '246098519',
        cabinCategory: 'L',
        cabinClassCode: 'I',
        cabinClassDescription: 'Club Interior Staterooms',
        cabinNumber: '6523',
        cabinTypeCode: 'SI',
        destinationPortDescription: 'Los Angeles, California',
        itineraryCode: '07X007',
        itineraryNightsQuantity: '7',
        itineraryDescription: '7 Night Mexican Riviera Cruise',
        originPortDescription: 'Los Angeles, California',
        points: '2',
        sailingDate: '20100131',
        shipCode: 'MA',
      },
      {
        // Exact duplicate must not create another completed cruise.
        bookingId: '441826',
        passengerId: '246098519',
        cabinClassCode: 'I',
        cabinNumber: '6523',
        itineraryNightsQuantity: '7',
        sailingDate: '20100131',
        shipCode: 'MA',
      },
    ],
  },
};

const history = booking.parseRoyalLoyaltyHistorySailings(historyPayload);
assert.strictEqual(history.discovered, 2);
assert.strictEqual(history.rows.length, 1);
assert.strictEqual(history.duplicates, 1);
assert.strictEqual(history.rejected, 0);
assert.deepStrictEqual(
  {
    shipName: history.rows[0].shipName,
    start: history.rows[0].sailingStartDate,
    end: history.rows[0].sailingEndDate,
    nights: history.rows[0].numberOfNights,
    status: history.rows[0].status,
    bookingId: history.rows[0].bookingId,
    cabin: history.rows[0].cabinNumberOrGTY,
    points: history.rows[0].loyaltyPoints,
  },
  {
    shipName: 'Mariner of the Seas',
    start: '2010-01-31',
    end: '2010-02-07',
    nights: 7,
    status: 'Completed',
    bookingId: '441826',
    cabin: '6523',
    points: '2',
  },
);
assert.strictEqual(booking.isRoyalLoyaltyHistoryPayload(historyPayload), true);
const sixtyHistoryRows = booking.parseRoyalLoyaltyHistorySailings({
  payload: {
    sailings: Array.from({ length: 60 }, (_, index) => ({
      bookingId: `history-${index + 1}`,
      itineraryNightsQuantity: '7',
      itineraryDescription: '7 Night Cruise',
      sailingDate: `2025${String((index % 12) + 1).padStart(2, '0')}${String((index % 27) + 1).padStart(2, '0')}`,
      shipCode: index % 2 === 0 ? 'NV' : 'HM',
    })),
  },
});
assert.strictEqual(sixtyHistoryRows.rows.length, 60, 'All 60 complete loyalty-history sailings must survive normalization.');
assert.strictEqual(sixtyHistoryRows.rejected, 0);

assert.strictEqual(booking.hasMeaningfulExtendedLoyaltyData({}), false);
assert.strictEqual(booking.hasMeaningfulExtendedLoyaltyData({ clubRoyalePointsFromApi: 20941 }), true);

assert.strictEqual(webview.isSafeRemoteWebViewUrl('https://www.carnival.com/profilemanagement/profiles/cruises'), true);
assert.strictEqual(webview.isSafeRemoteWebViewUrl('http://localhost:8081'), true);
assert.strictEqual(webview.isSafeRemoteWebViewUrl('about:blank'), false);
assert.strictEqual(webview.isSafeRemoteWebViewUrl('file:///tmp/carnival.html'), false);
assert.strictEqual(webview.isSafeRemoteWebViewUrl('data:text/html,hello'), false);
assert.strictEqual(
  webview.getSafeRemoteWebViewUrl('about:blank', 'https://www.carnival.com/profilemanagement/profiles/cruises'),
  'https://www.carnival.com/profilemanagement/profiles/cruises',
);

const carnivalScript = carnivalExtraction.CARNIVAL_BOOKINGS_SCRAPE_SCRIPT;
const carnivalDateHelpersStart = carnivalScript.indexOf('  function parseCalendarDate');
const carnivalDateHelpersEnd = carnivalScript.indexOf('  function truncateField', carnivalDateHelpersStart);
assert.ok(carnivalDateHelpersStart >= 0 && carnivalDateHelpersEnd > carnivalDateHelpersStart, 'Carnival date helpers must be present in the injected script.');
class FixedDate extends Date {
  constructor(...args) {
    if (args.length === 0) super(2026, 6, 20, 12, 0, 0, 0);
    else super(...args);
  }
}
const carnivalDateContext = vm.createContext({
  Date: FixedDate,
  String,
  Number,
  parseInt,
  isNaN,
  isFinite,
  result: null,
});
new vm.Script(`${carnivalScript.slice(carnivalDateHelpersStart, carnivalDateHelpersEnd)}
result = {
  iso: parseCalendarDate('2026-07-17'),
  compact: parseCalendarDate('20260717'),
  active: determineCruiseStatus('2026-07-17', '2026-07-24', 7, 'BK'),
  derivedActive: determineCruiseStatus('20260717', '', 7, 'BK'),
  completed: determineCruiseStatus('2026-07-12', '2026-07-19', 7, 'BK'),
};`).runInContext(carnivalDateContext);
assert.deepStrictEqual(
  [carnivalDateContext.result.iso.getFullYear(), carnivalDateContext.result.iso.getMonth() + 1, carnivalDateContext.result.iso.getDate()],
  [2026, 7, 17],
  'Carnival ISO date-only values must remain July 17 in local calendar time.',
);
assert.deepStrictEqual(
  [carnivalDateContext.result.compact.getFullYear(), carnivalDateContext.result.compact.getMonth() + 1, carnivalDateContext.result.compact.getDate()],
  [2026, 7, 17],
  'Carnival compact provider dates must normalize without UTC day shifting.',
);
assert.strictEqual(carnivalDateContext.result.active, 'In Progress');
assert.strictEqual(carnivalDateContext.result.derivedActive, 'In Progress');
assert.strictEqual(carnivalDateContext.result.completed, 'Completed');

const providerSource = fs.readFileSync(path.join(root, 'state/RoyalCaribbeanSyncProvider.tsx'), 'utf8');
const carnivalScreenSource = fs.readFileSync(path.join(root, 'app/carnival-sync.tsx'), 'utf8');
const syncLogicSource = fs.readFileSync(path.join(root, 'lib/royalCaribbean/syncLogic.ts'), 'utf8');
const carnivalExtractionSource = fs.readFileSync(path.join(root, 'lib/carnival/carnivalOffersExtraction.ts'), 'utf8');

assert.strictEqual(providerSource.includes("navigateToPage('about:blank'"), false, 'Carnival sync must not assign about:blank to WebView source.uri.');
assert.strictEqual(providerSource.includes("const normalizedRows = normalizedOffers.length + normalizedBookedCruises.length;"), true, 'Sync commit must define normalizedRows before logging it.');
assert.strictEqual(providerSource.includes('if (!isSafeRemoteWebViewUrl(url))'), true, 'Provider navigation must reject hostless/local source URIs.');
assert.strictEqual(providerSource.includes('parseRoyalLoyaltyHistorySailings(data)'), true, 'Royal loyalty history sailings must feed completed-cruise staging.');
assert.strictEqual(providerSource.includes('hasLoyaltyForCruiseLine(convertedLoyalty, cruiseLine)'), true, 'History-only and wrong-brand payloads must not falsely complete the loyalty step.');
assert.strictEqual(/sailDate\s*<\s*now/.test(providerSource), false, 'Start date alone must never classify a cruise as completed.');
assert.strictEqual(/sd\s*<\s*new Date/.test(providerSource), false, 'Legacy start-date completion logic must be removed.');
assert.strictEqual(carnivalScreenSource.includes('source={{ uri: safeWebViewUrl }}'), true, 'Carnival WebView source must use the sanitized remote URL.');
assert.strictEqual(syncLogicSource.includes('isCompletedBookedCruise(c)'), true, 'Preview completed counts must use the canonical return-date-aware helper.');
assert.strictEqual(syncLogicSource.includes('const incomingBookedCruises = ['), true, 'Preview status totals must reflect current provider rows, not stale unmatched app rows.');
assert.strictEqual(/sailDate\.getTime\(\).*sailDate\s*<\s*new Date/.test(carnivalExtractionSource), false, 'Carnival current sailings must not be completed from embarkation date alone.');
assert.strictEqual(carnivalExtractionSource.includes("if (endDate < today) return 'Completed';"), true, 'Carnival completion must be based on return date.');
assert.strictEqual(carnivalExtractionSource.includes('function parseCalendarDate(value)'), true, 'Carnival date-only values must be parsed without UTC day shifts.');
assert.strictEqual(carnivalExtractionSource.includes('numberOfNights: parsedNights'), true, 'Carnival nights must never persist NaN or an unvalidated value.');

console.log('PASS phase1_critical_sync_repairs_regression');
