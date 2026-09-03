const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const client = read('lib/agentSeaAI.ts');
const screen = read('app/ask-my-data.tsx');
const backend = read('backend/hono.ts');
const conversationExport = read('lib/agentSea/conversationLogExport.ts');
const dataBundle = read('lib/dataBundle/bundleOperations.ts');

const forbiddenPublicOwnerKey = ['EXPO', 'PUBLIC', 'AGENT', 'SEA', 'OWNER', 'OPENAI', 'API', 'KEY'].join('_');
assert.ok(!client.includes(forbiddenPublicOwnerKey), 'Owner provider key must not use an EXPO_PUBLIC build-time path.');
assert.ok(!client.includes('AsyncStorage.setItem(apiKeyStorageKey'), 'A personal provider key must never be written to AsyncStorage.');
assert.match(client, /SecureStore\.setItemAsync\(apiKeyStorageKey, apiKey\)/, 'Personal keys must be written only to iOS SecureStore.');
assert.match(client, /source: 'device' \| 'proxy' \| 'none'/, 'Agent SEA must distinguish the server proxy from a device key and local-only mode.');
assert.match(client, /BACKEND_API_ROOT_URL.*agent-sea\/respond/s, 'Owner AI must call the Easy Seas backend proxy.');

assert.match(backend, /process\.env\.AGENT_SEA_OPENAI_API_KEY \|\| process\.env\.OPENAI_API_KEY/, 'The provider credential must be loaded only in the backend runtime.');
assert.match(backend, /getAgentSeaOwnerEmails\(\).*has\(authenticatedEmail\)/s, 'The proxy must enforce its owner allowlist.');
assert.match(backend, /consumeAgentSeaRateLimit/, 'The proxy must rate-limit requests.');
assert.match(backend, /contentLength > 80_000/, 'The proxy must reject unbounded request bodies.');
assert.match(backend, /input\.length > 55_000/, 'The proxy must enforce a bounded evidence manifest.');
assert.match(backend, /store: false/, 'Responses API state storage must be explicitly disabled for Agent SEA turns.');
assert.ok(!backend.includes('console.log(apiKey') && !backend.includes('console.warn(apiKey'), 'The proxy must never log its provider credential.');

assert.match(screen, /aiSource === 'proxy'/, 'The owner UI must show that built-in AI is ready without requesting a key.');
assert.match(screen, /Built-in AI is ready/, 'The owner connection must open as ready, with no activation button.');
assert.match(screen, /config\.isConfigured/, 'The chat readiness indicator must support proxy configuration without a client key.');
assert.ok(!conversationExport.includes('apiKey'), 'Conversation export must not serialize an API key.');
assert.ok(!dataBundle.includes('easyseas_agent_sea_openai_api_key'), 'Save All must not enumerate the SecureStore provider-key namespace.');

for (const file of ['lib/agentSeaAI.ts', 'app/ask-my-data.tsx', 'backend/hono.ts', 'lib/agentSea/conversationLogExport.ts']) {
  assert.ok(!/sk-(?:proj|svcacct|admin)-[A-Za-z0-9_-]{20,}/.test(read(file)), `${file} contains a key-shaped credential.`);
}

console.log('Build 444 Agent SEA secure-delivery regression passed.');
