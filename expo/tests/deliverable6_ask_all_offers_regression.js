const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

const alias = read('app/ask-all-offers.tsx');
const chatAlias = read('app/ask-all-offers-chat.tsx');
const askMyData = read('app/ask-my-data.tsx');
assert.match(alias, /pathname: '\/ask-my-data'/);
assert.match(chatAlias, /pathname: '\/ask-my-data'/);
assert.match(askMyData, /incomingQuery/);
assert.match(askMyData, /offers, cruises, certificates/);

const file = path.join(root, 'lib/askAllOffers.ts');
const compiled = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }, fileName: file }).outputText;
const originalLoad = Module._load;
Module._load = (request, parent, isMain) => {
  if (request === '@/lib/navigation/cruiseDetails') return { buildCruiseDetailsPath: ({ id }) => `/cruise-details?id=${id}` };
  if (request === '@/lib/offers/offerInstanceIdentity') return { buildOfferDetailsPath: ({ id }) => `/offer-details?id=${id}` };
  return originalLoad(request, parent, isMain);
};
const mod = new Module(file, module); mod.filename=file; mod.paths=Module._nodeModulePaths(path.dirname(file));
try { mod._compile(compiled,file); } finally { Module._load = originalLoad; }
const answer = mod.exports.buildAskAllOffersAnswer('show all active casino offers with FreePlay and OBC', {
  offers:[{id:'1',title:'Offer',offerCode:'TEST1',freePlay:100}], cruises:[], bookedCruises:[], certificates:[], calendarEvents:[], casinoSessions:[], weather:[], loyalty:{}
});
assert.match(answer.content,/active saved offer/);
assert.doesNotMatch(answer.content,/casino-session evidence/);
console.log('Deliverable 6 Ask My Data offer conversation regression passed.');
