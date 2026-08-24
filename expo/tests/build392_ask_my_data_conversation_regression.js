const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');

const root = path.resolve(__dirname, '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

function loadAskMyData() {
  const filename = path.join(root, 'lib/askMyData.ts');
  const compiled = ts.transpileModule(read('lib/askMyData.ts'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    fileName: filename,
  }).outputText;
  const originalLoad = Module._load;
  Module._load = function patchedLoad(request, parent, isMain) {
    if (request === '@/lib/offerIntelligence') {
      return { calculateOfferIntelligenceScore: () => ({ score: 0 }) };
    }
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

const app = JSON.parse(read('app.json')).expo;
assert.equal(app.version, '13.0.44');
assert.equal(String(app.ios.buildNumber), '410');
assert.equal(app.android.versionCode, 130067);

const ask = loadAskMyData();
assert.equal(ask.isAnnualTierRewardQuestion('What cruise did I use my Signature tier status annual cruise rewards on?'), true);
assert.equal(ask.isAnnualTierRewardQuestion('How many points do I need to keep Signature?'), false);
const clarifiedQuestion = ask.buildAskMyDataConversationalQuery(
  'It was the one that had TIER as its code.',
  'What cruise did I use my Signature annual cruise reward on?',
);
assert.match(clarifiedQuestion, /Follow-up clarification/);
assert.equal(ask.isAnnualTierRewardQuestion(clarifiedQuestion), true, 'a short clarification must retain the prior cruise question');

const shared = {
  offers: [],
  certificates: [],
  calendarEvents: [],
};
const response = ask.askMyDataSearch({
  ...shared,
  query: 'What cruise did I use my Signature tier status annual cruise rewards on?',
  cruises: [
    {
      id: 'target-booking',
      shipName: 'Odyssey of the Seas',
      sailDate: '2026-11-08',
      returnDate: '2026-11-15',
      nights: 7,
      destination: 'Southern Caribbean',
      status: 'Confirmed',
      offerCode: 'TIER',
      reservationNumber: '7654321',
    },
    {
      id: 'targeted-offer-booking',
      shipName: 'Freedom of the Seas',
      sailDate: '2027-04-27',
      nights: 12,
      status: 'Confirmed',
      offerCode: '26TIER3',
      reservationNumber: '1234567',
    },
    {
      id: 'available-not-used',
      shipName: 'Harmony of the Seas',
      sailDate: '2027-01-10',
      nights: 7,
      status: 'Available',
      offerCode: 'TIER',
    },
  ],
});

assert.equal(response.interpretedIntent, 'Club Royale annual tier cruise reward usage');
assert.equal(response.results.length, 1, 'only a booked cruise with exact TIER code is verified as used');
assert.equal(response.results[0].title, 'Odyssey of the Seas');
assert.match(response.directAnswer, /Odyssey of the Seas/);
assert.match(response.directAnswer, /2026-11-08/);
assert.match(response.directAnswer, /reservation 7654321/);
assert.match(response.directAnswer, /exact saved offer code TIER/);
assert.doesNotMatch(response.directAnswer, /Freedom of the Seas/);
const citedResponse = ask.formatAskMyDataResponse(response);
assert.match(citedResponse, new RegExp(response.directAnswer.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
assert.match(citedResponse, /Sources: \[S1\]/, 'verified direct answers retain their original text and now cite the source record');

const noFalsePositive = ask.askMyDataSearch({
  ...shared,
  query: 'Which cruise used my annual Signature tier reward?',
  cruises: [{
    id: 'targeted-only', shipName: 'Freedom of the Seas', sailDate: '2027-04-27', nights: 12,
    status: 'Confirmed', offerCode: '26TIER3', reservationNumber: '1234567',
  }],
});
assert.equal(noFalsePositive.results.length, 0, 'a targeted code containing TIER is not the exact annual reward code');
assert.match(noFalsePositive.noResultsExplanation, /exact offer code TIER/);

const screen = read('app/ask-my-data.tsx');
const chat = read('components/AgentXChat.tsx');
const provider = read('state/AgentXProvider.tsx');
assert.match(screen, /testID="ask-my-data-keyboard-surface"/);
assert.match(screen, /keyboardAvoidanceEnabled=\{false\}/);
assert.match(screen, /placeholder="Message Easy Seas…"/);
assert.match(chat, /enabled=\{keyboardAvoidanceEnabled\}/);
assert.match(chat, /Keyboard\.addListener/);
assert.doesNotMatch(chat, /style=\{styles\.messageScrollView\}/, 'each response must expand inside the one conversation scroll surface');
assert.match(chat, /onFocus=\{\(\) => setTimeout\(\(\) => scrollViewRef\.current\?\.scrollToEnd/);
assert.ok(provider.indexOf('isAnnualTierRewardQuestion(message)') < provider.indexOf('const tierMatch = message.match'), 'annual reward evidence routing must precede tier progress');
assert.match(provider, /buildAskMyDataConversationalQuery\(content, previousUserMessage\)/);
assert.match(provider, /content: localAnswer/);

console.log('PASS Build 394 keyboard-safe conversation and exact TIER annual reward evidence regression');
