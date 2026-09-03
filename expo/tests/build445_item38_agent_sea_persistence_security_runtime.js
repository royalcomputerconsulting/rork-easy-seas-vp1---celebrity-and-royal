#!/usr/bin/env node

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');

const root = path.resolve(__dirname, '..');
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');

function loadTs(relative, mocks) {
  const filename = path.join(root, relative);
  const output = ts.transpileModule(read(relative), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
    fileName: filename,
  }).outputText;
  const originalLoad = Module._load;
  Module._load = function patchedLoad(request, parent, isMain) {
    if (Object.prototype.hasOwnProperty.call(mocks, request)) return mocks[request];
    return originalLoad.call(this, request, parent, isMain);
  };
  try {
    const mod = new Module(filename, module);
    mod.filename = filename;
    mod.paths = Module._nodeModulePaths(path.dirname(filename));
    mod._compile(output, filename);
    return mod.exports;
  } finally {
    Module._load = originalLoad;
  }
}

(async () => {
  const durable = new Map();
  const conversationStorage = loadTs('lib/askAllOffers/storage.ts', {
    '../storage/quotaSafeStorage': {
      quotaSafeGetJsonItem: async (key, fallback) => durable.has(key) ? structuredClone(durable.get(key)) : fallback,
      quotaSafeSetJsonItem: async (key, value) => durable.set(key, structuredClone(value)),
    },
  });
  const primaryScope = { authenticatedEmail: 'primary@example.test', profileId: 'primary', brand: 'all', program: 'all' };
  const secondaryScope = { authenticatedEmail: 'secondary@example.test', profileId: 'secondary', brand: 'all', program: 'all' };
  const primaryKey = conversationStorage.buildAskAllOffersOwnerKey(primaryScope);
  const secondaryKey = conversationStorage.buildAskAllOffersOwnerKey(secondaryScope);
  assert.notEqual(primaryKey, secondaryKey);
  const primaryThread = {
    id: 'thread-primary', title: 'Primary ADT', createdAt: '2026-09-01T12:00:00Z', updatedAt: '2026-09-01T12:01:00Z', archivedAt: null,
    scope: { ownerKey: primaryKey, profileId: 'primary', brand: 'all', program: 'all', generatedAt: '2026-09-01T12:00:00Z', activeOfferRows: 13, standaloneOffers: 13, bookedOfferRecords: 0, certificateRecords: 2, cruiseRecords: 3151, sourceFreshness: 'current' },
    messages: [{ id: 'u1', role: 'user', content: 'What is my ADT?', timestamp: '2026-09-01T12:00:00Z', sourceReferences: [] }],
    lastQuestion: 'What is my ADT?',
  };
  await conversationStorage.upsertConversationThread(primaryKey, primaryThread);
  assert.equal((await conversationStorage.loadConversationThreads(primaryKey))[0].messages[0].content, 'What is my ADT?');
  assert.deepEqual(await conversationStorage.loadConversationThreads(secondaryKey), [], 'secondary owner must not see primary chat');
  await assert.rejects(() => conversationStorage.upsertConversationThread(secondaryKey, primaryThread), /owner mismatch/i);
  await conversationStorage.renameConversationThread(primaryKey, primaryThread.id, 'Saved casino analysis');
  assert.equal((await conversationStorage.loadConversationThreads(primaryKey))[0].title, 'Saved casino analysis');
  await conversationStorage.archiveConversationThread(primaryKey, primaryThread.id, true);
  assert.ok((await conversationStorage.loadConversationThreads(primaryKey))[0].archivedAt);

  const plainStorage = new Map();
  const secureStorage = new Map();
  const ai = loadTs('lib/agentSeaAI.ts', {
    '@react-native-async-storage/async-storage': {
      getItem: async (key) => plainStorage.get(key) ?? null,
      setItem: async (key, value) => plainStorage.set(key, value),
      removeItem: async (key) => plainStorage.delete(key),
    },
    'expo-secure-store': {
      isAvailableAsync: async () => true,
      getItemAsync: async (key) => secureStorage.get(key) ?? null,
      setItemAsync: async (key, value) => secureStorage.set(key, value),
      deleteItemAsync: async (key) => secureStorage.delete(key),
    },
    '@/lib/trpc': { BACKEND_API_ROOT_URL: '' },
  });
  await ai.saveAgentSeaAIConfig({ apiKey: 'runtime-test-secret', model: 'gpt-5.5', authenticatedEmail: 'primary@example.test' });
  assert.equal((await ai.loadAgentSeaAIConfig('primary@example.test')).source, 'device');
  assert.equal((await ai.loadAgentSeaAIConfig('secondary@example.test')).source, 'none');
  assert.ok(Array.from(secureStorage.keys()).some((key) => key.includes('primary%40example.test')));
  assert.ok(!Array.from(plainStorage.values()).includes('runtime-test-secret'), 'provider credential must never reach ordinary app storage');

  const provider = read('state/AgentXProvider.tsx');
  assert.match(provider, /activeAIRequestRef\.current\?\.abort\(\)/);
  assert.match(provider, /catalogSearchRequestRef\.current \+= 1/);
  assert.match(provider, /startNewConversation[\s\S]*?cancelActiveRequest\(\)/);
  assert.match(provider, /openConversation[\s\S]*?cancelActiveRequest\(\)/);
  assert.match(provider, /buildAskAllOffersOwnerKey\(conversationOwnerScope\)/);
  assert.match(provider, /loadConversationThreads\(conversationOwnerKey\)/);
  assert.match(provider, /upsertConversationThread\(conversationOwnerKey/);
  assert.match(provider, /sharedIntelligenceFilterSnapshot/);
  assert.match(provider, /privateIntelligenceFilterSnapshot/);

  for (const file of ['lib/agentSeaAI.ts', 'state/AgentXProvider.tsx', 'backend/hono.ts', 'lib/agentSea/conversationLogExport.ts']) {
    const source = read(file);
    assert.ok(!/sk-(?:proj|svcacct|admin)-[A-Za-z0-9_-]{20,}/.test(source), `${file} contains a key-shaped credential`);
  }
  assert.doesNotMatch(read('lib/agentSea/conversationLogExport.ts'), /apiKey/);
  assert.match(read('backend/hono.ts'), /process\.env\.AGENT_SEA_OPENAI_API_KEY \|\| process\.env\.OPENAI_API_KEY/);

  console.log('PASS Build 445 Item 38 Agent SEA conversations survive durable reload per owner, reject cross-owner writes, replace requests safely, keep shared/private scopes distinct, and store provider keys only in account-scoped SecureStore.');
})().catch((error) => { console.error(error); process.exitCode = 1; });
