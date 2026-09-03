const assert=require('assert'),fs=require('fs'),path=require('path'); const ROOT=path.resolve(__dirname,'..'); const dir=path.join(ROOT,'lib','optimization','live');
for(const f of ['types.ts','normalizeLiveCasinoState.ts','projectEndOfCruisePoints.ts','evaluateOneMoreSession.ts','buildLiveCasinoAdvisorSnapshot.ts','meaningfulStateChange.ts','storage.ts','index.ts']) assert(fs.existsSync(path.join(dir,f)),`Missing ${f}`);
const types=fs.readFileSync(path.join(dir,'types.ts'),'utf8'); for(const token of ['LiveCasinoStateRecord','LiveCasinoAdvisorSnapshot','LiveCasinoAdvisorJournalEntry','OneMoreSessionScenario','EndOfCruisePointProjection']) assert(types.includes(token));
const build=fs.readFileSync(path.join(dir,'buildLiveCasinoAdvisorSnapshot.ts'),'utf8'); assert(build.includes('buildOptimalStoppingRecommendation')); assert(build.includes('exactInputs')); assert(build.includes('modelVersion')); assert(build.includes('formulas'));
const one=fs.readFileSync(path.join(dir,'evaluateOneMoreSession.ts'),'utf8'); assert(one.includes('hardDailyLossLimit')); assert(one.includes('hardTripLossLimit')); assert(one.includes('lockedProfitFloor')); assert(one.toLowerCase().includes('does not imply risk-free'));
assert(fs.existsSync(path.join(ROOT,'app','casino','live-certificate-advisor.tsx')));
const flags=fs.readFileSync(path.join(ROOT,'lib','optimization','featureFlags.ts'),'utf8'); assert(flags.includes('personalCertificateOptimizerLiveAdvisorEnabled: false'));
for(const f of fs.readdirSync(dir)){if(!f.endsWith('.ts'))continue; const s=fs.readFileSync(path.join(dir,f),'utf8'); assert(!/scott\.merlis|knownProfileFallback|KNOWN_CASINO_PROFILE_EMAILS/i.test(s));}
console.log('PASS OPT-5 live advisor architecture');
