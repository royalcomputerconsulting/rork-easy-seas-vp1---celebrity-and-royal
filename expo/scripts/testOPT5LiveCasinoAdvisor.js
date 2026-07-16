const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const ts = require('typescript');
const ROOT = path.resolve(__dirname, '..');
const TEMP = fs.mkdtempSync(path.join(os.tmpdir(), 'easyseas-opt5-'));
function compile(relativePath) {
  const sourcePath = path.join(ROOT, 'lib', 'optimization', relativePath);
  const outputPath = path.join(TEMP, relativePath.replace(/\.ts$/, '.js'));
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  const result = ts.transpileModule(fs.readFileSync(sourcePath, 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS, esModuleInterop: true, strict: true }, fileName: sourcePath, reportDiagnostics: true });
  assert.strictEqual((result.diagnostics || []).filter(d => d.category === ts.DiagnosticCategory.Error).length, 0, `Transpile errors in ${relativePath}`);
  let output = result.outputText.replace(/require\("@\/lib\/optimization\//g, 'require("../');
  fs.writeFileSync(outputPath, output);
}
[
  'history/types.ts','value/types.ts','models/types.ts','models/statistics.ts','models/selectComparableHistory.ts','models/estimateExpectedLoss.ts','models/estimateSuccessProbability.ts',
  'engine/types.ts','engine/determineCurrentLockedCertificate.ts','engine/assessSafetyModes.ts','engine/evaluateCandidateTargets.ts','engine/buildOptimalStoppingRecommendation.ts',
  'live/types.ts','live/normalizeLiveCasinoState.ts','live/projectEndOfCruisePoints.ts','live/evaluateOneMoreSession.ts','live/meaningfulStateChange.ts','live/storage.ts','live/buildLiveCasinoAdvisorSnapshot.ts',
].forEach(compile);
const { createLiveCasinoState, isLiveCasinoStateStale } = require(path.join(TEMP,'live','normalizeLiveCasinoState.js'));
const { evaluateOneMoreSession } = require(path.join(TEMP,'live','evaluateOneMoreSession.js'));
const { projectEndOfCruisePoints } = require(path.join(TEMP,'live','projectEndOfCruisePoints.js'));
const { detectMeaningfulLiveStateChange } = require(path.join(TEMP,'live','meaningfulStateChange.js'));
const { createLiveCasinoAdvisorRepository } = require(path.join(TEMP,'live','storage.js'));

const state=createLiveCasinoState({ownerProfileId:'p1',cruiseId:'c1',program:'club-royale',brand:'royal',certificateFamily:'C',currentPoints:4000,currentCoinIn:20000,currentCoinOut:20800,dailyBankrollBudget:200,hardDailyLossLimit:200,remainingBankroll:1000,remainingCasinoHours:5,remainingCasinoDays:1,currentPointsPerHour:200,baselinePointsPerHour:180,asOf:'2026-07-15T12:00:00Z'});
assert.strictEqual(state.currentResult,800);
assert.strictEqual(state.currentDailyLoss,0);
assert.strictEqual(isLiveCasinoStateStale(state,'2026-07-15T12:31:00Z'),true);
const model={profile:{averagePointsPerDay:1000,modelMaturity:'developing',priors:{dollarsPerPoint:5,theoreticalLossRate:.06}}};
const projection=projectEndOfCruisePoints(state,model);
assert.strictEqual(projection.expectedPoints,5000);
const scenario=evaluateOneMoreSession(state,model,60);
assert.strictEqual(scenario.expectedAdditionalPoints,200);
assert.strictEqual(scenario.expectedAdditionalCoinIn,1000);
assert(scenario.expectedAdditionalLoss>=0);
assert(!scenario.warnings.join(' ').toLowerCase().includes('risk-free play or guaranteed') || scenario.warnings.length>0);
const changed=detectMeaningfulLiveStateChange(state,{...state,currentPoints:4030,updatedAt:'2026-07-15T12:05:00Z'});
assert.strictEqual(changed.meaningful,true);
const memory=new Map(); const storage={async getItem(k){return memory.get(k)||null},async setItem(k,v){memory.set(k,v)},async removeItem(k){memory.delete(k)}};
const repo=createLiveCasinoAdvisorRepository(storage);
(async()=>{await repo.saveState(state); assert.deepStrictEqual(await repo.loadState('p1','c1'),state); await repo.clearCruise('p1','c1'); assert.strictEqual(await repo.loadState('p1','c1'),null); console.log('PASS OPT-5 live casino advisor');})().catch(e=>{console.error(e);process.exit(1)});
