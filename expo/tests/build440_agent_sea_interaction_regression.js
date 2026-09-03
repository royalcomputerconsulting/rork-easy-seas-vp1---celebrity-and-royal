const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const screen = fs.readFileSync(path.join(root, 'app/ask-my-data.tsx'), 'utf8');
const chat = fs.readFileSync(path.join(root, 'components/AgentXChat.tsx'), 'utf8');
const provider = fs.readFileSync(path.join(root, 'state/AgentXProvider.tsx'), 'utf8');
const history = fs.readFileSync(path.join(root, 'lib/askAllOffers/storage.ts'), 'utf8');

assert.match(screen, /setVisible\(true\)/, 'Agent SEA must become ready automatically');
assert.doesNotMatch(screen, /Click to use AI|Enable AI|Activate AI/i, 'Agent SEA must not require an activation button');
assert.match(screen, /KeyboardAvoidingView/);
assert.match(screen, /ask-my-data-keyboard-surface/);
assert.match(screen, /agent-sea-top-actions/);
assert.match(screen, /ask-my-data-close/);
assert.match(screen, /ask-my-data-new-conversation/);
assert.match(screen, /Saved conversations/);
assert.match(screen, /ask-my-data-toggle-filters/);
assert.match(screen, /agent-sea-save-conversation/);
assert.match(screen, /agent-sea-print-conversation/);
assert.match(screen, /agent-sea-export-log/);
assert.match(screen, /agent-sea-ai-settings/);
assert.match(screen, /unifiedComposer/);
assert.match(screen, /keyboardAvoidanceEnabled=\{false\}/);

assert.match(chat, /keyboardShouldPersistTaps="always"/);
assert.match(chat, /testID="agentx-unified-send"/);
assert.match(chat, /onPress=\{handleManualSend\}/);
assert.match(chat, /lastManualSubmitRef/);
assert.match(chat, /Replace current Agent SEA request/);
assert.match(chat, /isLoading \? 'Replace' : 'Send'/);

assert.match(provider, /const cancelActiveRequest = useCallback/);
assert.match(provider, /activeAIRequestRef\.current\?\.abort\(\)/);
assert.match(provider, /catalogSearchRequestRef\.current \+= 1/);
assert.match(provider, /const startNewConversation = useCallback\(\(\) => \{\s*cancelActiveRequest\(\)/s);
assert.match(provider, /const openConversation = useCallback[\s\S]*?cancelActiveRequest\(\)/);
assert.match(provider, /if \(activeRequest\.signal\.aborted \|\| !visibleRef\.current\)/);
assert.match(provider, /Ignoring cancelled or hidden Agent SEA request/);
assert.match(provider, /buildAskAllOffersOwnerKey\(conversationOwnerScope\)/);
assert.match(provider, /loadConversationThreads\(conversationOwnerKey\)/);
assert.match(provider, /upsertConversationThread\(conversationOwnerKey/);
assert.match(history, /ownerKey/);

console.log('PASS build440_agent_sea_interaction_regression');
