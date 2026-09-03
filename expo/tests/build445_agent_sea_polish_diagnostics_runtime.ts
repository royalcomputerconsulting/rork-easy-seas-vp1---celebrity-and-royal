import fs from 'node:fs';
import assert from 'node:assert/strict';
import { splitConciseFirstAgentSeaAnswer } from '../lib/agentSea/conciseAnswer';

const screen = fs.readFileSync('app/ask-my-data.tsx', 'utf8');
const chat = fs.readFileSync('components/AgentXChat.tsx', 'utf8');
const logSource = fs.readFileSync('lib/agentSea/conversationLogExport.ts', 'utf8');
for (const contract of ['agent-sea-share-conversation', 'useWindowDimensions', 'keyboardShouldPersistTaps="always"', 'keyboardDismissMode']) assert.ok(screen.includes(contract), `Agent SEA screen is missing ${contract}`);
for (const contract of ['isNearBottomRef', 'distanceFromBottom <= 88', 'shouldFollowNextMessageRef', 'supportingDetails']) assert.ok(chat.includes(contract), `Agent SEA chat is missing ${contract}`);

const longAnswer = ['The direct answer is 14 sessions and $1,250 ADT.', ...Array.from({ length: 30 }, (_, index) => `Evidence row ${index + 1}: saved record ${index + 1}.`)].join('\n');
const concise = splitConciseFirstAgentSeaAnswer(longAnswer, 260);
assert.ok(concise.content.startsWith('The direct answer'));
assert.ok(concise.content.length < longAnswer.length);
assert.ok(concise.supportingDetails?.includes('Evidence row 30'));

for (const diagnosticField of ['schemaVersion: 2', 'diagnosticTurns', 'question:', 'interpretedIntent:', 'toolCalls:', 'recordIds:', 'recordCount:', 'timingMs:', 'formulas:', 'sources,', 'errors:', 'finalAnswer:']) assert.ok(logSource.includes(diagnosticField), `Diagnostic log is missing ${diagnosticField}`);
console.log('PASS Build 445 Agent SEA keyboard, scroll, controls, concise-first disclosure, and complete diagnostics');
