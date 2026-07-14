const fs = require('fs');
const path = require('path');
function read(p){ return fs.readFileSync(path.join(process.cwd(), p), 'utf8'); }
function assert(c,m){ if(!c) throw new Error(m); }
const app = JSON.parse(read('app.json'));
const pkg = JSON.parse(read('package.json'));
const ask = read('lib/askMyData.ts');
const agent = read('state/AgentXProvider.tsx');
assert(app.expo.version === '12.4.2', 'app version must be 12.4.2');
assert(app.expo.ios.buildNumber === '311', 'iOS build must be 311');
assert(app.expo.android.versionCode === 120402, 'Android versionCode must be 120402');
assert(pkg.version === '12.4.2', 'package version must be 12.4.2');
assert(ask.includes('wantsOfferInventoryOnly'), 'Ask My Data must have offer inventory intent lock');
assert(ask.includes('parseRequestedGuestCount'), 'Ask My Data must parse guest count such as for 2');
assert(ask.includes('isOfferInventoryQuery'), 'Ask My Data must detect from-my-offers queries');
assert(ask.includes('getOfferGuestCoverage'), 'Ask My Data must classify offer guest coverage');
assert(ask.includes('Free cruise fare for 2 guests'), 'Ask My Data must label free-for-two offers');
assert(ask.includes('1 guest plus discounted second guest'), 'Ask My Data must distinguish discounted-second offers');
assert(ask.includes('standalone offer catalog only'), 'Interpreted intent must show standalone catalog lock');
assert(ask.includes('Offer-source lock: searching standalone loaded offer sailings, not booked/completed cruises.'), 'filters must disclose offer source lock');
assert(ask.includes("!(intent.wantsOfferInventoryOnly && !intent.wantsBooked && params.offers.length > 0)"), 'cruise loop must be suppressed for from-my-offers queries when offers are loaded');
assert(agent.includes('getAgentOfferGuestCoverage'), 'AgentX context must include offer guest coverage helper');
assert(agent.includes('best cruises for 2 from offers'), 'AgentX prompt must include exact best-for-two offers rule');
assert(agent.includes('a true free cruise fare for 2 guests always outranks'), 'AgentX prompt must enforce ranking hierarchy');
console.log('PASS testV1236AskMyDataOfferIntent');
