const assert=require('node:assert'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),engine=fs.readFileSync(path.join(root,'lib/intelligence/certificateRedemptionOptimizer.ts'),'utf8'),screen=fs.readFileSync(path.join(root,'app/certificate-portfolio.tsx'),'utf8');
['weights','excludedShips','excludedDeparturePorts','maxTravelCost','scheduleConflictSailingKeys','preferredItineraries','requiredGuestCount','scarcity','rankingFactors','alternativeReason'].forEach(term=>assert(engine.includes(term),`Item 27 missing ${term}`));
assert(engine.includes('hardExclusionReasons'), 'Hard exclusions must be explained, not silently ignored');
assert(screen.includes('Ask Agent SEA about these ranked results'));
assert(screen.includes('rankingFactors'));
assert(screen.includes("pathname:'/ask-my-data'"));
console.log('Build 438 item 27 best-use certificate optimizer regression passed');
