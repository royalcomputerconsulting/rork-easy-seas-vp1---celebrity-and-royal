import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { buildAgentSeaDirectAnswer } from '../lib/agentSea/directAnswers';
import { calculateSeaDayDensityScore } from '../lib/cruisePlanningIntelligence';
import type { BookedCruise } from '../types/models';

const cruises = [
  {
    id: 'adt-one', shipName: 'Harmony of the Seas', sailDate: '2026-04-10', returnDate: '2026-04-15', nights: 5,
    brand: 'royal', theoreticalLoss: 800, ratedGamingDays: 2, sourceAuthority: 'user_entered',
  },
  {
    id: 'adt-two', shipName: 'Quantum of the Seas', sailDate: '2026-04-15', returnDate: '2026-04-21', nights: 6,
    brand: 'royal', theoreticalLoss: 1200, ratedGamingDays: 3, sourceAuthority: 'user_entered',
  },
] as BookedCruise[];

const answer = buildAgentSeaDirectAnswer({ question: 'What is my ADT?', bookedCruises: cruises, now: new Date('2026-08-30T12:00:00Z') });
assert(answer, 'ADT intent must produce a direct answer');
assert.match(answer.text, /ADT is \$400\.00 per rated gaming day/);
assert.match(answer.text, /\$2,000\.00 of theoretical loss divided by 5 rated casino days/);
assert.equal(answer.cruiseIds.length, 2);
assert.doesNotMatch(answer.text, /I found \d+ relevant local records/i);

const bookedCount = buildAgentSeaDirectAnswer({ question: 'How many booked cruises do I have?', bookedCruises: cruises, now: new Date('2026-01-01T12:00:00Z') });
assert(bookedCount, 'Booked cruise count must produce a direct answer');
assert.equal(bookedCount.intent, 'booked_cruise_count');
assert.match(bookedCount.text, /You have 2 upcoming booked cruises/);
assert.doesNotMatch(bookedCount.text, /relevant local records|Evidence Agent SEA used/i);
assert.equal(bookedCount.route, '/(tabs)/booked');

const completedCount = buildAgentSeaDirectAnswer({ question: 'How many completed cruises do I have?', bookedCruises: cruises, now: new Date('2027-01-01T12:00:00Z') });
assert(completedCount, 'Completed cruise count must produce a direct answer');
assert.equal(completedCount.intent, 'completed_cruise_count');
assert.match(completedCount.text, /You have 2 completed cruises/);

const itineraryCruise = {
  id: 'itinerary-truth', shipName: 'Harmony of the Seas', sailDate: '2026-09-10', returnDate: '2026-09-15', nights: 5,
  itinerary: [
    { day: 1, port: 'Port Canaveral', isSeaDay: false, source: 'user_entered' },
    { day: 2, port: 'Nassau', isSeaDay: false, source: 'user_entered' },
    { day: 3, port: 'Perfect Day at CocoCay', isSeaDay: false, source: 'user_entered' },
    { day: 4, port: 'At Sea', isSeaDay: true, source: 'user_entered' },
    { day: 5, port: 'At Sea', isSeaDay: true, source: 'user_entered' },
    { day: 6, port: 'Port Canaveral', isSeaDay: false, source: 'user_entered' },
  ],
} as BookedCruise;
const density = calculateSeaDayDensityScore(itineraryCruise);
assert.equal(density.seaDays, 2);
assert.equal(density.portDays, 2, 'Port-call count excludes embarkation and disembarkation; embarkation casino opportunity is modeled separately');
assert(density.casinoOpportunityScore > 0);
assert.match(density.explanation, /saved cruise itinerary|operational itinerary/);

const root = path.resolve(import.meta.dirname, '..');
const read = (file: string) => fs.readFileSync(path.join(root, file), 'utf8');
const agenda = read('app/day-agenda.tsx');
assert.match(agenda, /day-agenda-previous-day/);
assert.match(agenda, /day-agenda-next-day/);
assert.match(agenda, /accessibilityLabel="Next day agenda"/);
const agentScreen = read('app/ask-my-data.tsx');
for (const marker of ['ask-my-data-close', 'ask-my-data-new-conversation', 'agent-sea-save-conversation', 'agent-sea-print-conversation', 'agent-sea-export-log']) assert.match(agentScreen, new RegExp(marker));
assert.doesNotMatch(agentScreen, /tap AI to connect/i);
const agentChat = read('components/AgentXChat.tsx');
assert.match(agentChat, /keyboardShouldPersistTaps="always"/);
assert.match(agentChat, /testID="agentx-unified-send"/);
assert.match(agentChat, /View evidence/);
const explore = read('app/(tabs)/scheduling.tsx');
assert.match(explore, /cruises-favorites-before-catalog/);
assert.doesNotMatch(explore.match(/const renderListFooter[\s\S]*?const renderEmpty/)?.[0] ?? '', /FavoriteStateroomsSection/);
for (const tab of ['offers', 'cruises', 'booked', 'calendar', 'casino', 'slots', 'settings']) assert.match(read('constants/theme.ts'), new RegExp(`${tab}:`));

console.log('PASS build440_agent_agenda_cruise_ux_regression');
