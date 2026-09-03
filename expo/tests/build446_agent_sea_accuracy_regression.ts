import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { buildAgentSeaDirectAnswer } from '../lib/agentSea/directAnswers';
import { planAgentSeaQuestion } from '../lib/agentSea/sourceRegistry';
import { askMyDataSearch, formatAskMyDataResponse } from '../lib/askMyData';

const lastCruisePlan = planAgentSeaQuestion('How many points did I get on my last Star cruise?');
assert.equal(lastCruisePlan.certificateOnly, false, 'a personal cruise question must not be reduced to certificate inventory');
for (const source of ['completed_cruise', 'casino', 'certificate']) {
  assert.ok(lastCruisePlan.sources.includes(source as any), `last-cruise points must load ${source} evidence`);
}

const lastCruisePoints = buildAgentSeaDirectAnswer({
  question: 'How many points did I get on my last Star cruise?',
  now: new Date('2026-09-02T12:00:00Z'),
  bookedCruises: [
    { id: 'older-star', shipName: 'Star of the Seas', sailDate: '2026-05-01', returnDate: '2026-05-08', status: 'completed', completionState: 'completed', nights: 7, pointsEarned: 900 } as any,
    { id: 'latest-star', shipName: 'Star of the Seas', sailDate: '2026-08-10', returnDate: '2026-08-17', status: 'completed', completionState: 'completed', nights: 7, pointsEarned: 1_725, instantCertificateOfferCode: '2608A02' } as any,
    { id: 'other-ship', shipName: 'Icon of the Seas', sailDate: '2026-08-20', returnDate: '2026-08-27', status: 'completed', completionState: 'completed', nights: 7, pointsEarned: 9_999 } as any,
  ],
});
assert.equal(lastCruisePoints?.intent, 'last_cruise_points');
assert.match(lastCruisePoints?.text ?? '', /1,725 casino points/);
assert.match(lastCruisePoints?.text ?? '', /Star of the Seas sailing 2026-08-10/);
assert.match(lastCruisePoints?.text ?? '', /saved cruise-level points value/);
assert.doesNotMatch(lastCruisePoints?.text ?? '', /9,999|relevant records/i);

const overview = {
  generatedAt: '2026-09-02T12:00:00Z', dataFreshnessLabel: 'Fresh owner-scoped data.', pointBalanceSource: 'provider sync',
  currentSeason: { points: 23_446, cruises: 6, pointsNeededForSignature: 1_554 },
  annual: {
    totals: { cruises: 21, totalPoints: 58_680, totalCoinIn: 293_400, totalWinningsHome: 19_457, totalCashResult: 15_218.59, totalPaid: 4_238.41, totalCruiseValueCaptured: 43_535.59 },
    roiStyle: { netRoiOnPaid: 359.06 },
  },
} as any;
const casinoOverview = buildAgentSeaDirectAnswer({ question: 'Give me my casino overview', bookedCruises: [], overview });
assert.equal(casinoOverview?.intent, 'casino_overview');
assert.match(casinoOverview?.text ?? '', /23,446 points/);
assert.match(casinoOverview?.text ?? '', /58,680 points/);
assert.match(casinoOverview?.text ?? '', /Coin-in is gaming volume, not profit/);
assert.doesNotMatch(casinoOverview?.text ?? '', /relevant records/i);

const roi = buildAgentSeaDirectAnswer({ question: 'What is my casino ROI?', bookedCruises: [], overview });
assert.equal(roi?.intent, 'casino_roi');
assert.match(roi?.text ?? '', /359\.06%/);
assert.match(roi?.text ?? '', /\$4,238\.41/);

const loyalty = buildAgentSeaDirectAnswer({
  question: 'What is my loyalty status?', bookedCruises: [],
  loyalty: {
    clubRoyalePoints: 23_446, clubRoyaleTier: 'Signature', clubRoyalePointsSource: 'provider sync',
    crownAnchorPoints: 322_650, crownAnchorLevel: 'Pinnacle', blueChipPoints: 667, blueChipTier: 'Sapphire',
  },
});
assert.equal(loyalty?.intent, 'loyalty_status');
assert.match(loyalty?.text ?? '', /Club Royale Signature with 23,446/);
assert.match(loyalty?.text ?? '', /Crown & Anchor Pinnacle with 322,650/);
assert.match(loyalty?.text ?? '', /Blue Chip Club Sapphire with 667/);
assert.equal(buildAgentSeaDirectAnswer({ question: 'What is the status of certificate ABC?', bookedCruises: [], loyalty: loyalty as any }), null, 'bare status wording must not be hijacked by loyalty');

const manyCertificateRows = Array.from({ length: 31 }, (_, index) => ({
  certificateCode: '2610A03', shipName: index === 30 ? 'Icon of the Seas' : `Oasis Test Ship ${index + 1}`,
  sailingDate: `2026-10-${String((index % 27) + 1).padStart(2, '0')}`, departurePort: 'Miami, Florida',
  itinerary: 'Bahamas & Perfect Day', cabinCategory: 'Balcony', guestCount: 2, occupancy: '2 guests', pointRequirement: 6_500,
})) as any[];
const availability = askMyDataSearch({
  query: 'Is Icon a part of next month offers?', offers: [], cruises: [], calendarEvents: [], crewRecognitionEntries: [], slotMachines: [], weatherReports: [],
  certificates: [{ id: 'large-cert', label: '2610A03', certificateCode: '2610A03', status: 'available', type: 'freeplay', value: 0, parsedSailings: manyCertificateRows } as any],
});
assert.match(availability.directAnswer ?? '', /^Yes\./);
assert.match(availability.directAnswer ?? '', /Icon of the Seas/);

const crewResponse = askMyDataSearch({
  query: 'Who are the casino hosts in my crew history?', offers: [], cruises: [], certificates: [], calendarEvents: [],
  crewRecognitionEntries: [{ id: 'crew-1', fullName: 'Alex Host', department: 'Casino', roleTitle: 'Casino Host', shipName: 'Harmony of the Seas', sailStartDate: '2026-05-01', sailEndDate: '2026-05-08' } as any],
});
assert.match(formatAskMyDataResponse(crewResponse), /^I found 1 match in your saved crew-recognition history\./);
assert.doesNotMatch(formatAskMyDataResponse(crewResponse), /relevant local records/i);

const weatherResponse = askMyDataSearch({
  query: 'What is the weather for Harmony?', offers: [], cruises: [], certificates: [], calendarEvents: [],
  weatherReports: [{ cacheKey: 'harmony-2026-09-03', cruiseId: 'c1', shipName: 'Harmony of the Seas', dateKey: '2026-09-03', locationName: 'Nassau', zoneLabel: 'Bahamas', headline: 'Calm morning', summary: 'Mostly sunny with a light breeze.', advisories: [], metrics: { conditionLabel: 'Mostly sunny', maxWindMph: 12, maxWindGustMph: 18, maxWaveHeightFt: 3, precipitationChance: 10 } } as any],
});
assert.match(formatAskMyDataResponse(weatherResponse), /^The strongest saved weather forecast is Harmony of the Seas weather/);
assert.match(formatAskMyDataResponse(weatherResponse), /Mostly sunny with a light breeze/);

const offerResponse = askMyDataSearch({
  query: 'Show my offer ABC123', certificates: [], calendarEvents: [], cruises: [],
  offers: [{ id: 'offer-1', offerCode: 'ABC123', offerName: 'Balcony escape', status: 'active', roomType: 'Balcony', offerExpiryDate: '2026-10-01' } as any],
});
assert.match(formatAskMyDataResponse(offerResponse), /^I found 1 match in your saved offers\./);
assert.doesNotMatch(formatAskMyDataResponse(offerResponse), /relevant local record/i);

const root = path.resolve(import.meta.dirname, '..');
const provider = fs.readFileSync(path.join(root, 'state/AgentXProvider.tsx'), 'utf8');
assert.match(provider, /await loadSearchableCertificates\(\)/, 'certificate questions must wait for retained PDF hydration');
assert.match(provider, /certificates: requestCertificates/, 'the hydrated request snapshot must feed Agent SEA tools');
const askMyData = fs.readFileSync(path.join(root, 'lib/askMyData.ts'), 'utf8');
assert.match(askMyData, /const allRankedResults = results\.sort/);
assert.match(askMyData, /const catalogRows = allRankedResults\.filter/);

console.log('PASS Build 446 Agent SEA answers last-cruise points, casino overview, ROI, loyalty, and large-certificate ship/month availability from owner-scoped authoritative data.');
