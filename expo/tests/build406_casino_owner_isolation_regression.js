const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const source = read('lib/knownProfileFallback.ts');
const output = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  fileName: 'knownProfileFallback.ts',
}).outputText;
const moduleObject = { exports: {} };
new Function('exports', 'require', 'module', '__filename', '__dirname', output)(
  moduleObject.exports,
  (request) => request === '@/lib/casinoAnnualReportFacts'
    ? { ANNUAL_CASINO_REPORT_FACTS: [] }
    : request === '@/lib/casinoPointTruth'
      ? { CONFIRMED_CLUB_ROYALE_2025_POINTS: 58680 }
      : request === '@/types/models'
        ? {}
        : require(request),
  moduleObject,
  '',
  '',
);
assert.equal(moduleObject.exports.isKnownCasinoProfile('scott.merlis4@gmail.com'), false, 'an email must not inject private casino history');
assert.deepEqual(moduleObject.exports.getKnownCasinoProfileCruises('scott.merlis4@gmail.com'), [], 'an empty account must begin with zero historical cruises');
assert.match(read('lib/casinoCruiseEconomics.ts'), /includeKnownAnnualFacts \? applyAnnualCruiseOverrides\(normalized\) : normalized/, 'normalization must not apply a private annual-report value by default');
assert.match(read('app/_layout.tsx'), /CasinoSettingsProvider/, 'Casino Command Center settings provider must be mounted');
assert.match(read('state/CrewRecognitionProvider.tsx'), /On-demand local data loaded/, 'crew registry must hydrate only on demand');
console.log('PASS build406_casino_owner_isolation_regression');
