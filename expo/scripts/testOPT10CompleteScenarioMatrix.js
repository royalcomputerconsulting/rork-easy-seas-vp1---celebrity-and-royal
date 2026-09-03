const assert=require('assert'),fs=require('fs'),path=require('path'),cp=require('child_process');
const ROOT=path.resolve(__dirname,'..');
const requiredThresholds=[1500,2000,4000,6500,9000,15000,25000];
const attemptSource=fs.readFileSync(path.join(ROOT,'lib/optimization/history/reconstructThresholdAttempts.ts'),'utf8');
for(const points of requiredThresholds)assert(attemptSource.includes(String(points)),`missing ${points}-point threshold coverage`);
const modelTest=fs.readFileSync(path.join(ROOT,'scripts/testOPT3ProbabilityLossAndTargetModels.js'),'utf8');
for(const points of requiredThresholds)assert(modelTest.includes(String(points)),`OPT-3 scenario evidence missing ${points}`);
const engineTest=fs.readFileSync(path.join(ROOT,'scripts/testOPT4MarginalEVAndOptimalStoppingEngine.js'),'utf8');
for(const text of ['Golden-rule example','HARD_STOP','PROFIT_PROTECTED_PUSH','fatigue','DATA_UNAVAILABLE','deterministic','Profile mismatch'])assert(engineTest.includes(text),`scenario missing ${text}`);
for(const script of ['testOPT3ProbabilityLossAndTargetModels.js','testOPT4MarginalEVAndOptimalStoppingEngine.js','testOPT8PersonalOptimizationAlerts.js','testOPT9LearningBacktestAccuracy.js']){
 const result=cp.spawnSync(process.execPath,[path.join(ROOT,'scripts',script)],{cwd:ROOT,encoding:'utf8'});
 assert.strictEqual(result.status,0,`${script} failed: ${result.stdout}\n${result.stderr}`);
}
console.log('PASS OPT-10 complete optimizer scenario matrix');
