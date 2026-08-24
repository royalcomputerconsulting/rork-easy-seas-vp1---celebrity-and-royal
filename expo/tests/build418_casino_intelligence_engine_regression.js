const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');

function loadTs(relativeFile, dependencies = {}) {
  const filename = path.join(root, relativeFile);
  const source = fs.readFileSync(filename, 'utf8');
  const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const old = Module._load;
  Module._load = (request, parent, main) => request in dependencies ? dependencies[request] : request.startsWith('@/') ? {} : old(request, parent, main);
  try { const mod = new Module(filename, module); mod.filename = filename; mod.paths = Module._nodeModulePaths(path.dirname(filename)); mod._compile(output, filename); return mod.exports; }
  finally { Module._load = old; }
}

const statistics = loadTs('lib/optimization/models/statistics.ts');
const objective = loadTs('lib/optimization/engine/calculateExpectedNetVacationValue.ts', { '../models/statistics': statistics });
const bankroll = loadTs('lib/optimization/engine/calculateBankrollSurvival.ts', { '../models/statistics': statistics });

// Acceptance A: redemption-adjusted values are not probability-discounted twice.
const stopAt4000 = objective.calculateExpectedNetVacationValue({ realizedCertificateValue: 310, futureOfferValue: 94, expectedGamblingLoss: 614, riskPenalty: 40 });
assert.equal(stopAt4000.expectedNetVacationValue, -250);

// Acceptance B: a close, valuable target remains positive before safety gates.
const push6500 = objective.calculateExpectedNetVacationValue({ realizedCertificateValue: 425, expectedGamblingLoss: 75 });
assert.equal(push6500.expectedNetVacationValue, 350);

// Acceptance C: arithmetic EV and bankroll survival are independent outputs.
const unsafe = bankroll.calculateBankrollSurvival({ expectedLoss: 600, downsideLow: 300, downsideHigh: 1200, remainingBankroll: 250, sampleCount: 8 });
assert.ok(unsafe.survivalProbability < 0.5);
assert.ok(unsafe.riskOfRuinProbability > 0.5);
assert.ok(unsafe.requiredBankrollP90 > unsafe.requiredBankrollP75 && unsafe.requiredBankrollP75 > unsafe.requiredBankrollP50);

const facade = fs.readFileSync(path.join(root, 'lib/optimization/CasinoIntelligenceEngine.ts'), 'utf8');
assert.match(facade, /class CasinoIntelligenceEngine/);
assert.match(facade, /static whatIf/);
assert.match(facade, /Expected Net Vacation Value = realized certificate value/);
const candidate = fs.readFileSync(path.join(root, 'lib/optimization/engine/evaluateCandidateTargets.ts'), 'utf8');
assert.doesNotMatch(candidate, /success\.probability \* incrementalCertificateValue/);
for (const term of ['incrementalFutureOfferValue', 'incrementalTierValue', 'incrementalAncillaryValue', 'incrementalTravelCost', 'incrementalCruiseCost', 'expectedUnredeemedValueLoss', 'riskPenalty', 'bankrollSurvivalProbability']) assert.ok(candidate.includes(term), `missing objective term ${term}`);

console.log('PASS Build 418 shared CasinoIntelligenceEngine, decomposed vacation-value objective, no double discount, and bankroll survival percentiles');
