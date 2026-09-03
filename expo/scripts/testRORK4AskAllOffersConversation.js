const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'easyseas-rork4-'));

function compile(file, output, transforms = []) {
  let source = read(file);
  transforms.forEach(([from, to]) => { source = source.replace(from, to); });
  const result = ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, esModuleInterop: true, strict: true },
    fileName: file,
    reportDiagnostics: true,
  });
  const errors = (result.diagnostics || []).filter((item) => item.category === ts.DiagnosticCategory.Error);
  assert.strictEqual(errors.length, 0, `${file} must transpile`);
  fs.writeFileSync(path.join(temp, output), result.outputText);
}

fs.writeFileSync(path.join(temp, 'asyncStorageMock.js'), `const m=new Map();module.exports={__esModule:true,default:{async getItem(k){return m.has(k)?m.get(k):null},async setItem(k,v){m.set(k,v)},async removeItem(k){m.delete(k)},_map:m}};`);
compile('lib/askAllOffers/types.ts', 'types.js');
compile('lib/askAllOffers/storage.ts', 'storage.js', [
  ["@react-native-async-storage/async-storage", './asyncStorageMock'],
  ["@/lib/askAllOffers/types", './types'],
]);
compile('lib/askAllOffers/context.ts', 'context.js', [
  ["@/lib/askAllOffers/types", './types'],
  ["@/lib/askAllOffers/storage", './storage'],
]);
const storage = require(path.join(temp, 'storage.js'));
const context = require(path.join(temp, 'context.js'));

(async () => {
  const a = storage.buildAskAllOffersOwnerKey({ authenticatedEmail: 'one@example.com', profileId: 'p1', brand: 'royal', program: 'club-royale' });
  const b = storage.buildAskAllOffersOwnerKey({ authenticatedEmail: 'one@example.com', profileId: 'p2', brand: 'royal', program: 'club-royale' });
  assert.notStrictEqual(a, b, 'profile switch must create a different conversation owner key');
  const snapshot = context.buildAllOffersScopeSnapshot({
    ownerScope: { authenticatedEmail: 'one@example.com', profileId: 'p1', brand: 'royal', program: 'club-royale' },
    offers: [{ id: 'o1', offerCode: '26A', offerName: 'For Two', shipName: 'Icon Of The Seas', sailDate: '2027-01-01', guestsInfo: '2 Guests' }],
    bookedCruises: [{ id: 'b1', shipName: 'Harmony Of The Seas', offerCode: 'BOOK1' }],
    certificates: [{ certificateCode: '2607C06', status: 'parsed', sailingsFound: 20 }],
    cruises: [],
  });
  assert.strictEqual(snapshot.ownerKey, a);
  assert.strictEqual(snapshot.activeOfferRows, 2);
  const sources = context.buildAllOffersSourceReferences({
    question: 'best Icon offer for two',
    offers: [{ id: 'o1', offerCode: '26A', offerName: 'For Two', shipName: 'Icon Of The Seas', sailDate: '2027-01-01', guestsInfo: '2 Guests' }],
    bookedCruises: [], certificates: [], cruises: [],
  });
  assert.strictEqual(sources[0].sourceType, 'offer');
  assert(sources[0].label.includes('26A'));
  const thread = { id: 't1', title: 'Test', createdAt: '2026-01-01', updatedAt: '2026-01-01', archivedAt: null, scope: snapshot, messages: [], lastQuestion: null };
  await storage.upsertConversationThread(a, thread);
  assert.strictEqual((await storage.loadConversationThreads(a)).length, 1);
  assert.strictEqual((await storage.loadConversationThreads(b)).length, 0, 'another profile cannot read the first profile conversation');
  await assert.rejects(() => storage.upsertConversationThread(b, thread), /owner mismatch/i);
  await storage.renameConversationThread(a, 't1', 'Renamed');
  assert.strictEqual((await storage.loadConversationThreads(a))[0].title, 'Renamed');
  await storage.archiveConversationThread(a, 't1', true);
  assert((await storage.loadConversationThreads(a))[0].archivedAt);

  const home = read('app/ask-my-data.tsx');
  const chat = read('app/ask-all-offers-chat.tsx');
  const component = read('components/AgentXChat.tsx');
  const agent = read('state/AgentXProvider.tsx');
  const provider = read('state/AskAllOffersProvider.tsx');
  const layout = read('app/_layout.tsx');
  const models = read('types/models.ts');

  assert(home.includes('EasySeas InfoBot'), 'Ask All Offers home needs branded greeting');
  assert(home.includes('Hello, {firstName}'), 'personal greeting missing');
  assert(home.includes('New Chat'), 'new chat CTA missing');
  assert(home.includes('Chat history'), 'history section missing');
  assert(home.includes('Explore more'), 'prompt-card section missing');
  assert(home.includes('Popular Prompts'), 'topic chips missing');
  assert(home.includes('Best cruises for two'), 'offer-specific useful prompt missing');
  assert(home.includes('renameThread') && home.includes('archiveThread'), 'rename/archive controls missing');
  assert(home.includes('answerPersonalOptimizationQuestion') && home.includes('safetyGateOverrideDenied'), 'chat safety boundary missing');
  assert(!home.includes('AI Dev Assistant'), 'developer prompt cards must not appear on the production home');

  assert(chat.includes('<AgentXChat'), 'dedicated full-screen conversation must use AgentX');
  assert(chat.includes('Profile-scoped offer intelligence'), 'profile-scoped full-screen header missing');
  assert(chat.includes('showDevAssistant={false}'), 'developer cards must be disabled in production chat');
  assert(chat.includes('showAgentModeSelector={false}'), 'conversation must remain in first-class All Offers mode');
  assert(chat.includes('mode="allOffers"'), 'All Offers mode must be explicit');
  assert(chat.includes('onRetryMessage') && chat.includes('onCopyMessage') && chat.includes('onFeedback'), 'retry/copy/feedback controls missing');
  assert(chat.includes('buildAllOffersSourceReferences') && chat.includes('buildAllOffersPrompt'), 'answers must use grounded source cards and a scope snapshot');
  assert(chat.includes('sourceReferences: references') && chat.includes('displayContent: visibleQuestion'), 'hidden grounding must preserve the visible question');
  assert(chat.includes('renameThread') && chat.includes('archiveThread'), 'chat rename/archive behavior missing');

  assert(provider.includes('ask-all-offers:threads:v2'), 'persistent storage key missing');
  assert(provider.includes('buildAskAllOffersOwnerKey'), 'account/profile/brand/program scope hash missing');
  assert(provider.includes('askAllOffersMessagesEqual'), 'no-op persistence loop guard missing');
  assert(provider.includes('selectedProfileId') && provider.includes('selectedBrand') && provider.includes('selectedProgram'), 'profile/brand/program isolation missing');
  assert(provider.includes('AsyncStorage.setItem'), 'conversation persistence missing');

  assert(models.includes("'allOffers'"), 'AgentXMode must include allOffers');
  assert(agent.includes("mode === 'allOffers'"), 'All Offers must force deterministic Ask My Data routing');
  assert(agent.includes('displayContent?: string'), 'hidden grounding prompt support missing');
  assert(agent.includes('sources: options?.sourceReferences'), 'assistant messages must retain source references');
  assert(component.includes('Sources used from your saved data'), 'source cards must render in chat bubbles');
  assert(component.includes('evidenceKind'), 'source cards must label evidence quality');
  assert(component.includes('ThumbsUp') && component.includes('ThumbsDown'), 'feedback icons missing');
  assert(component.includes('RotateCcw') && component.includes('Copy'), 'retry/copy controls missing');
  assert(component.includes('agentx-copy-'), 'copy/share test target missing');
  assert(component.includes('handleMicPress'), 'voice input must remain supported');

  assert(layout.includes('AskAllOffersProvider'), 'Ask All Offers provider missing from app layout');
  assert(layout.includes('name="ask-all-offers-chat"'), 'dedicated chat route missing from app layout');
  console.log('PASS RORK-4 Ask All Offers conversational experience');
})().catch((error) => { console.error(error); process.exit(1); });
