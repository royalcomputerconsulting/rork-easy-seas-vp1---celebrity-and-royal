import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { buildAgentSeaDirectAnswer } from '../lib/agentSea/directAnswers';
import {
  buildAgentSeaSourceManifest,
  buildAgentSeaSourceRegistry,
  buildCertificateToolFilter,
  executeAgentSeaSourceManifestTool,
  executeCertificateSummaryTool,
  planAgentSeaQuestion,
} from '../lib/agentSea/sourceRegistry';
import { buildAskMyDataConversationalQuery } from '../lib/askMyData';

const root = path.resolve(__dirname, '..');
const provider = fs.readFileSync(path.join(root, 'state/AgentXProvider.tsx'), 'utf8');

const adt = buildAgentSeaDirectAnswer({
  question: 'What is my ADT?',
  now: new Date('2026-09-01T12:00:00Z'),
  bookedCruises: [{
    id: 'primary-completed', ownerProfileId: 'primary', shipName: 'Harmony of the Seas',
    sailDate: '2026-06-01', returnDate: '2026-06-08', nights: 7,
    status: 'completed', completionState: 'completed', casinoProgram: 'clubRoyale',
    theoreticalLoss: 900, ratedGamingDays: 3,
  } as any],
});
assert.ok(adt);
assert.match(adt.text, /^Your current Club Royale ADT is \$300\.00 per rated gaming day\./);
assert.match(adt.text, /\$900\.00 of theoretical loss divided by 3 rated casino days/);
assert.match(adt.evidence, /Harmony of the Seas 2026-06-01/);

const missingAdt = buildAgentSeaDirectAnswer({ question: 'What is my ADT?', bookedCruises: [], now: new Date('2026-09-01T12:00:00Z') });
assert.match(missingAdt?.text ?? '', /I can’t calculate a defensible/);
assert.match(missingAdt?.text ?? '', /will not substitute zero/);

const certificate = {
  id: 'cert-october', type: 'freeplay', label: '2610A03A', value: 0, status: 'available', certificateCode: '2610A03A',
  parsedSailings: [{
    certificateCode: '2610A03A', shipName: 'Icon of the Seas', sailingDate: '2026-10-10',
    departurePort: 'Barcelona, Spain', itinerary: 'Spain, France & Italy', shipClass: 'Icon',
    cabinCategory: 'Balcony', occupancy: '2 Guests', guestCount: 2, pointRequirement: 4000,
    sourcePage: 4, sourceGroup: 'october-europe', nights: 7,
  }],
} as any;
const certificateAnswer = executeCertificateSummaryTool(
  'What Europe cruises are available next month and at what points levels for 2 guests?',
  [certificate],
);
assert.deepEqual(certificateAnswer.filter.certificateMonths, ['2026-10']);
assert.deepEqual(certificateAnswer.filter.regions, ['Europe']);
assert.deepEqual(certificateAnswer.filter.guestCounts, [2]);
assert.match(certificateAnswer.text, /Icon of the Seas 2026-10-10/);
assert.match(certificateAnswer.text, /4,000 points/);
assert.match(certificateAnswer.text, /Balcony/);
assert.match(certificateAnswer.text, /2 guests/);
assert.equal(certificateAnswer.optionIds.length, 1);

assert.deepEqual(buildCertificateToolFilter('Icon suite cruises next month for one guest').shipNames, ['Icon']);
assert.deepEqual(buildCertificateToolFilter('Icon suite cruises next month for one guest').guestCounts, [1]);
assert.deepEqual(buildCertificateToolFilter('Icon suite cruises next month for one guest').cabinLabels, ['Suite']);

const domains: Array<[string, string]> = [
  ['offers available next month', 'offer'], ['my booked reservation', 'booked_cruise'],
  ['completed past cruises', 'completed_cruise'], ['casino ADT and theoretical', 'casino'],
  ['crew recognition', 'crew'], ['calendar agenda', 'calendar'], ['itinerary ports', 'itinerary'],
  ['weather waves', 'weather'], ['loyalty tier', 'loyalty'], ['financial payments', 'finance'],
  ['where did this formula come from', 'provenance'],
];
for (const [question, source] of domains) {
  assert.ok(planAgentSeaQuestion(question).sources.includes(source as any), `${question} must request ${source}`);
}

const manifestInput = {
  ownerId: 'primary', cruises: [{ id: 'shared-sailing' }], offers: [{ id: 'shared-offer' }], certificates: [certificate],
  bookedCruises: [
    { id: 'private-booked', ownerProfileId: 'primary', status: 'booked' },
    { id: 'private-completed', ownerProfileId: 'primary', status: 'completed' },
  ],
  calendarEvents: [{ id: 'private-calendar', ownerProfileId: 'primary' }],
  casinoRecords: [{ id: 'private-casino', ownerProfileId: 'primary' }],
  crewRecords: [{ id: 'private-crew', ownerProfileId: 'primary' }],
  weatherRecords: [{ id: 'private-weather', ownerProfileId: 'primary' }],
  loyaltyRecords: [{ id: 'private-loyalty', ownerProfileId: 'primary' }],
  financialRecords: [{ id: 'private-finance', ownerProfileId: 'primary' }],
  provenanceRecords: [{ id: 'private-provenance', ownerId: 'primary' }],
} as any;
const manifest = buildAgentSeaSourceManifest(manifestInput);
for (const source of ['available_cruise', 'offer', 'certificate', 'certificate_sailing', 'booked_cruise', 'completed_cruise', 'calendar', 'casino', 'crew', 'weather', 'loyalty', 'finance', 'provenance']) {
  assert.ok((manifest.counts as any)[source] > 0, `manifest must include ${source}`);
}
assert.match(executeAgentSeaSourceManifestTool('What data sources can you see?', manifest), /Shared inventory is limited to offers, available sailings, and downloaded certificate evidence/);
const registry = buildAgentSeaSourceRegistry(manifestInput);
assert.equal(registry.find((row) => row.recordType === 'offer')?.scope, 'shared');
assert.equal(registry.find((row) => row.recordType === 'casino')?.scope, 'private');
assert.equal(registry.find((row) => row.recordType === 'casino')?.ownerProfileId, 'primary');

const followUp = buildAskMyDataConversationalQuery('What about suites?', 'Which Europe cruises are available next month?');
assert.match(followUp, /Which Europe cruises are available next month\?/);
assert.match(followUp, /Follow-up clarification: What about suites\?/);

const directAnswerGate = provider.indexOf('if (directAnswer) {');
const catalogQuery = provider.indexOf('const catalogPage = await queryCruises', directAnswerGate);
assert.ok(directAnswerGate >= 0 && catalogQuery > directAnswerGate, 'exact ADT calculations must short-circuit before the cruise catalog query');
assert.match(provider.slice(directAnswerGate, catalogQuery), /return;/, 'the deterministic ADT response must complete without broad search or cloud AI');
const certificateGate = provider.indexOf('questionPlan.certificateOnly', directAnswerGate);
assert.ok(certificateGate >= 0 && certificateGate < catalogQuery, 'certificate-only questions must resolve before broad cruise search');
assert.match(provider.slice(certificateGate, catalogQuery), /executeCertificateSummaryTool[\s\S]*return;/, 'certificate-only questions must use the typed local certificate tool and return immediately');
assert.doesNotMatch(provider, /if \(!isVisible\) return;\s*void refreshWeatherReports\(\);/, 'opening Agent SEA must not start weather requests');
assert.doesNotMatch(provider, /scheduleAgentSeaSourceManifestRebuild/, 'opening Agent SEA must not schedule a full certificate source-manifest rebuild');
assert.match(provider, /if \(!toolResult\) \{\s*toolResult = executeToolCall/);
assert.match(provider, /cruises: \[\.\.\.queriedCatalogCruises, \.\.\.filteredBookedCruises\]/);
assert.match(provider, /loyaltyRecords:/);
assert.match(provider, /financialRecords:/);
assert.match(provider, /crewRecords:/);
assert.match(provider, /weatherRecords:/);
assert.match(provider, /provenanceRecords:/);
assert.match(provider, /buildAskMyDataSourceReferences\(localSearchResponse\)/);

console.log('PASS Build 445 Item 37 Agent SEA intelligence uses deterministic ADT, typed certificate/month/ship/region/cabin/guest tools, follow-up context, owner-scoped private sources, shared catalogs, and cited provenance.');
