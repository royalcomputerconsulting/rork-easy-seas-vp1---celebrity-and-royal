const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

const screen = read('app/ask-my-data.tsx');
const chat = read('components/AgentXChat.tsx');
const provider = read('state/AgentXProvider.tsx');
const ask = read('lib/askMyData.ts');
const ai = read('lib/agentSeaAI.ts');

assert.match(screen, /Agent SEA/, 'Ask route must be recreated as Agent SEA');
assert.match(screen, /agent-sea-unified-agent/, 'Agent SEA screen must expose the new unified agent surface');
assert.match(screen, /showAgentModes=\{false\}/, 'Agent SEA must not show Travel Agent/Casino Host/Certificate Advisor persona filters');
assert.match(screen, /unifiedComposer/, 'Agent SEA must use one ChatGPT-style voice/text composer');
assert.match(screen, /agent-sea-ai-settings/, 'Agent SEA must expose its direct in-app AI configuration');
assert.match(screen, /offers, cruises, certificates, booked and completed cruises, casino points, crew recognition, calendar, or weather/i, 'Agent SEA welcome must advertise all major data streams');
assert.doesNotMatch(screen, /Travel Agent|Casino Host|Certificate Advisor/, 'Agent SEA screen must not expose old persona labels');

assert.match(chat, /Agent SEA is reasoning across your saved data/, 'Agent SEA must present itself as reasoning, not a raw lookup');
assert.match(chat, /View evidence/, 'Agent SEA must expose cited evidence and calculations in answers');
assert.match(chat, /agentx-unified-input/);
assert.match(chat, /agentx-unified-mic/);
assert.match(chat, /agentx-unified-send/);

assert.match(provider, /You are Agent SEA/, 'Provider prompt must define Agent SEA as the unified agent');
assert.match(provider, /not a narrow database lookup/, 'Provider prompt must reject field-only lookup behavior');
assert.match(provider, /hasAgentAccess = true/, 'Local Agent SEA must not fail behind the old cloud entitlement gate');
assert.match(provider, /cruises: \[\.\.\.queriedCatalogCruises, \.\.\.filteredBookedCruises\]/, 'Agent SEA must include available inventory plus booked cruises');
assert.match(provider, /certificates: filteredCertificates/);
assert.match(provider, /calendarEvents: filteredCalendarEvents/);
assert.match(provider, /crewRecognitionEntries/);
assert.match(provider, /weatherReports: latestWeatherReports/);
assert.match(provider, /buildAskMyDataSourceReferences\(localSearchResponse\)/, 'Agent SEA answers must include citations/source references');
assert.match(provider, /Agent SEA local fallback evidence/, 'Agent SEA must keep answering from local data when optional services fail');
assert.match(provider, /generateAgentSeaAIResponse/, 'Agent SEA must use a real language model after local evidence retrieval');
assert.match(provider, /AI reasoning \(\$\{aiResult\.model\}\) \+ local evidence/, 'Agent SEA must identify AI-enhanced answers');
assert.doesNotMatch(provider, /const fallbackCatalogPage = await queryCruises/, 'Local fallback must not retry a failed inventory query');
assert.doesNotMatch(provider, /assistant service failed before returning an error/, 'Agent SEA must not show the old assistant-service failure');

assert.match(ai, /https:\/\/api\.openai\.com\/v1\/responses/, 'Agent SEA must call the Responses API directly from the app');
assert.match(ai, /expo-secure-store/, 'A user-entered API key must persist on the device');
assert.match(ai, /accountStorageKey/, 'Every user must have isolated on-device Agent SEA settings');
assert.doesNotMatch(ai, /EXPO_PUBLIC_AGENT_SEA_OWNER_OPENAI_API_KEY/, 'A provider secret must never be embedded in the public application bundle');
assert.match(ai, /OWNER_PROXY_URL/, 'The built-in owner experience must use the authenticated server-side proxy');
assert.match(ai, /mayUseOwnerProxy\(authenticatedEmail\)/, 'The owner proxy must remain restricted to the configured account');
assert.match(read('backend/hono.ts'), /AGENT_SEA_OPENAI_API_KEY|OPENAI_API_KEY/, 'The provider key must be read only by the backend runtime');
assert.match(ai, /LOCAL EASY SEAS EVIDENCE/, 'The AI prompt must be grounded in locally retrieved evidence');
assert.match(ai, /Never invent a reservation/, 'The AI prompt must prohibit invented cruise facts');
assert.doesNotMatch(ai, /@ai-sdk\//, 'Mobile Agent SEA must not import Metro-unsafe AI SDK packages');

assert.match(ask, /Agent SEA did load your active scope/, 'No-result wording must confirm the local index loaded');
assert.match(ask, /buildAskMyDataSourceReferences|sourceReferences/, 'Formatted answers must be evidence-backed');

console.log('PASS build426 Agent SEA recreated as a unified, local-first, evidence-backed app agent');
