const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');

const root = path.resolve(__dirname, '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

function loadStandaloneTs(relativePath, stubs = {}) {
  const filename = path.join(root, relativePath);
  const compiled = ts.transpileModule(read(relativePath), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      moduleResolution: ts.ModuleResolutionKind.NodeJs,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
    },
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

const dateParser = require(path.join(root, 'lib/certificates/certificateSailingDate.js'));
assert.equal(dateParser.normalizeCertificateSailingDate('August 13, 2026'), '2026-08-13');
assert.equal(dateParser.normalizeCertificateSailingDate('Sept. 5, 2026'), '2026-09-05');
assert.equal(dateParser.normalizeCertificateSailingDate('02/29/2028'), '2028-02-29');
assert.equal(dateParser.normalizeCertificateSailingDate('February 29, 2027'), null);
assert.equal(dateParser.normalizeCertificateSailingDate('13/10/2026'), null);

const originalDate = global.Date;
class HermesStyleDate extends originalDate {
  constructor(...args) {
    if (args.length === 1 && typeof args[0] === 'string' && !/^\d{4}-\d{2}-\d{2}(?:T|$)/.test(args[0])) {
      super(Number.NaN);
      return;
    }
    super(...args);
  }
}

const originalLoad = Module._load;
Module._load = function patchedCertificateStore(request, parent, isMain) {
  if (String(request).includes('certificateDocumentStore')) {
    return {
      archiveCertificatePdfBytes: async () => ({}),
      archiveCertificatePdfBytesBatch: async () => new Map(),
    };
  }
  return originalLoad.call(this, request, parent, isMain);
};
try {
  global.Date = HermesStyleDate;
  const { loadTs } = require('../scripts/clubRoyaleTestBootstrap');
  const engine = loadTs('lib/certificates/clientCertificatePdfEngine.ts');
  const fixtureRoot = path.join(root, 'tests/fixtures/royal-august-2026-live');
  const manifest = JSON.parse(fs.readFileSync(path.join(fixtureRoot, 'manifest.json'), 'utf8'));
  let totalSailings = 0;
  for (const expected of manifest.certificates) {
    const fixture = new Uint8Array(fs.readFileSync(path.join(fixtureRoot, `${expected.code}.pdf`)));
    const parsed = engine.parseCertificatePdfBytesBestAvailableFixture({
      certificateCode: expected.code,
      pdfBytes: fixture,
    });
    assert.equal(parsed.sailingCount, expected.sailings, `${expected.code} must retain every row with Hermes-style dates.`);
    if (expected.code === '2608AVIP1') {
      assert.equal(`${parsed.firstSailing.shipName}|${parsed.firstSailing.sailDate}`, 'Freedom Of The Seas|2026-08-13');
      assert.equal(`${parsed.lastSailing.shipName}|${parsed.lastSailing.sailDate}`, 'Oasis Of The Seas|2027-08-01');
    }
    totalSailings += parsed.sailingCount;
  }
  assert.equal(totalSailings, 26430, 'All 28 live August certificates must retain all 26,430 sailing rows on Hermes.');
} finally {
  global.Date = originalDate;
  Module._load = originalLoad;
}

const stored = new Map();
let pendingReadResolve = null;
const asyncStorage = {
  getItem: async (key) => {
    if (key.includes('race-profile')) {
      return new Promise((resolve) => {
        pendingReadResolve = resolve;
      });
    }
    return stored.get(key) ?? null;
  },
  setItem: async (key, value) => {
    stored.set(key, value);
  },
};
const preferences = loadStandaloneTs('lib/loyalty/loyaltyCardBrandPreference.ts', {
  '@react-native-async-storage/async-storage': asyncStorage,
});

async function verifyLoyaltySelectionPersistence() {
  assert.equal(await preferences.loadLoyaltyCardBrandPreference('owner-1', 'celebrity'), 'celebrity');
  await preferences.saveLoyaltyCardBrandPreference('owner-1', 'royal');
  assert.equal(await preferences.loadLoyaltyCardBrandPreference('owner-1', 'celebrity'), 'royal');

  const pendingLoad = preferences.loadLoyaltyCardBrandPreference('race-profile', 'celebrity');
  await Promise.resolve();
  await preferences.saveLoyaltyCardBrandPreference('race-profile', 'silversea');
  pendingReadResolve('celebrity');
  assert.equal(await pendingLoad, 'silversea', 'a stale native read must never override the latest user tap');

  const headerSource = read('components/CompactDashboardHeader.tsx');
  assert.match(headerSource, /saveLoyaltyCardBrandPreference\(loyaltyPreferenceProfileId, brand\)/);
  assert.match(headerSource, /onToggle=\{handleBrandToggle\}/);
  assert.doesNotMatch(headerSource, /setActiveBrand\(currentUser\?\.preferredBrand \|\| 'royal'\)/);
}

verifyLoyaltySelectionPersistence()
  .then(() => console.log('PASS Build 394 persistent loyalty-card selection and Hermes-safe live certificate dates'))
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
