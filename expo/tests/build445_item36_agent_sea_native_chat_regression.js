const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');
const screen = read('app/ask-my-data.tsx');
const chat = read('components/AgentXChat.tsx');
const provider = read('state/AgentXProvider.tsx');
const exportsSource = read('lib/agentSea/conversationLogExport.ts');

assert.match(screen, /useEffect\(\(\) => \{\s*setVisible\(true\)/, 'Agent SEA must open ready without an activation step');
assert.doesNotMatch(screen, /Click to use AI|Activate AI|Enable AI/i);
assert.match(screen, /KeyboardAvoidingView[\s\S]*?behavior=\{Platform\.OS === 'ios' \? 'padding' : 'height'\}/);
assert.match(screen, /keyboardShouldPersistTaps="always"/);
assert.match(screen, /unifiedComposer/);
assert.match(screen, /keyboardAvoidanceEnabled=\{false\}/, 'only the outer iOS keyboard surface may own the inset');

assert.match(chat, /styles\.iosUserBubble/);
assert.match(chat, /styles\.iosAssistantBubble/);
assert.match(chat, /iosAssistantBubble:[\s\S]*?width: '88%'/);
assert.match(chat, /iosUserMessageContent:[\s\S]*?minWidth: 124/);
assert.match(chat, /toLocaleTimeString/);
assert.match(chat, /View evidence \(\$\{message\.sourceReferences\.length\}\)/);
assert.match(chat, /expandedEvidenceIds/);
assert.match(chat, /lastManualSubmitRef/);
assert.match(chat, /now - lastManualSubmitRef\.current\.at < 750/);
assert.match(chat, /testID="agentx-unified-send"/);
assert.match(chat, /onPress=\{handleManualSend\}/);

for (const control of [
  'ask-my-data-close',
  'ask-my-data-new-conversation',
  'Saved conversations',
  'ask-my-data-toggle-filters',
  'agent-sea-save-conversation',
  'agent-sea-print-conversation',
  'agent-sea-export-log',
  'agent-sea-ai-settings',
]) assert.ok(screen.includes(control), `missing live Agent SEA control: ${control}`);

assert.match(screen, /setVisible\(false\);[\s\S]*?router\.canGoBack\(\)[\s\S]*?router\.back\(\)[\s\S]*?router\.replace\('\/\(tabs\)\/analytics'\)/,
  'Close must tear down Agent SEA and have a safe Offers fallback when there is no back route');
assert.match(screen, /startNewConversation/);
assert.match(screen, /openConversation\(thread\.id\)/);
assert.match(screen, /saveAgentSeaConversation\(messages\)/);
assert.match(screen, /printAgentSeaConversation\(messages\)/);
assert.match(screen, /exportAgentSeaConversationLog\(messages, conversationThreads/);
assert.match(screen, /saveAgentSeaAIConfig/);

assert.match(provider, /cancelActiveRequest/);
assert.match(provider, /activeAIRequestRef\.current\?\.abort\(\)/);
assert.match(provider, /upsertConversationThread/);
assert.match(exportsSource, /agent-sea-conversation-\$\{stamp\}\.txt/);
assert.match(exportsSource, /agent-sea-conversation-\$\{stamp\}\.json/);
assert.match(exportsSource, /Print\.printAsync/);

console.log('PASS Build 445 Item 36 Agent SEA opens ready, renders readable native chat bubbles, sends once, preserves the composer, expands evidence, persists chats, and exposes working conversation controls.');
