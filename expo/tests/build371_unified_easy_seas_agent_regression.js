const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const screen = fs.readFileSync(path.join(root, 'app/ask-my-data.tsx'), 'utf8');
const chat = fs.readFileSync(path.join(root, 'components/AgentXChat.tsx'), 'utf8');
const provider = fs.readFileSync(path.join(root, 'state/AgentXProvider.tsx'), 'utf8');

assert.match(screen, /Easy Seas Agent/);
assert.match(screen, /showAgentModes=\{false\}/, 'Ask My Data must hide persona filters');
assert.match(screen, /unifiedComposer/, 'Ask My Data must use one voice/text composer');
assert.doesNotMatch(screen, /Travel Agent|Casino Host|Certificate Advisor/, 'Ask My Data screen must not expose persona filters');
assert.match(screen, /current offer records/);
assert.match(screen, /available cruises/);
assert.match(screen, /past cruises/);
assert.match(screen, /certificateSailings/);
assert.match(screen, /calendar records/);
assert.doesNotMatch(screen, /<ScrollView/, 'The screen must not nest the chat in another scrolling keyboard surface');

assert.match(chat, /KeyboardAvoidingView/);
assert.match(chat, /agentx-unified-input/);
assert.match(chat, /agentx-unified-mic/);
assert.match(chat, /agentx-unified-send/);
assert.match(chat, /unifiedInputContainer:[\s\S]*?marginBottom: 0/);

assert.match(provider, /case 'searchCertificateLevels':[\s\S]*?askMyDataSearch\(/, 'Certificate questions must use downloaded certificate sailings');
assert.doesNotMatch(provider, /latestWeatherReports\s*=\s*devAssistantRequest\s*\?\s*weatherReports\s*:\s*await refreshWeatherReports/, 'Chat must not block on a network weather refresh');
assert.match(provider, /void refreshWeatherReports/, 'Weather refresh may continue in the background');
assert.match(provider, /Easy Seas answers from the complete local index first/);
assert.doesNotMatch(provider, /messagesForAI/, 'The mobile app must not build a huge unused AI prompt');
assert.doesNotMatch(provider, /@ai-sdk\//, 'Server-only AI SDK packages must stay out of the mobile provider');

console.log('PASS Build 371 unified, keyboard-safe Easy Seas Agent voice/text interface regression');
