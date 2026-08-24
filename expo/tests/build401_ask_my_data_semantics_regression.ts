import assert from 'node:assert/strict';
import { askMyDataSearch, isAnnualTierRewardQuestion } from '../lib/askMyData';

const annualCruise = {
  id: 'booked-tier-cruise',
  shipName: 'Harmony of the Seas',
  sailDate: '2026-09-10',
  returnDate: '2026-09-15',
  nights: 5,
  destination: 'Bahamas & Perfect Day',
  status: 'booked',
  reservationNumber: '3658443',
  offerCode: 'TIER',
};

assert.equal(isAnnualTierRewardQuestion('What cruise did I use my annual cruise for?'), true);
const annualAnswer = askMyDataSearch({
  query: 'What cruise did I use my annual cruise for?',
  offers: [],
  cruises: [annualCruise as any],
  certificates: [],
  calendarEvents: [],
});
assert.match(annualAnswer.directAnswer ?? '', /Harmony of the Seas/);
assert.match(annualAnswer.directAnswer ?? '', /3658443/);
assert.equal(annualAnswer.results.length, 1);

const augustAnswer = askMyDataSearch({
  query: 'Tell me my booked cruises for August 2026',
  offers: [],
  cruises: [
    { id: 'historic-august', shipName: 'Star of the Seas', sailDate: '2025-08-27', nights: 4, status: 'completed' },
    { id: 'completed-august', shipName: 'Navigator of the Seas', sailDate: '2026-08-01', nights: 7, status: 'completed' },
    { id: 'booked-september', shipName: 'Harmony of the Seas', sailDate: '2026-09-10', nights: 5, status: 'booked' },
  ] as any[],
  certificates: [],
  calendarEvents: [],
});
assert.equal(augustAnswer.results.length, 0);
assert.match(augustAnswer.interpretedIntent, /08\/2026/);

const bookedAugustAnswer = askMyDataSearch({
  query: 'Tell me my booked cruises for August 2026',
  offers: [],
  cruises: [
    { id: 'booked-august', shipName: 'Icon of the Seas', sailDate: '2026-08-15', nights: 7, status: 'confirmed' },
  ] as any[],
  certificates: [],
  calendarEvents: [],
});
assert.deepEqual(bookedAugustAnswer.results.map((result) => result.title), ['Icon of the Seas']);

console.log('Build 402 Ask My Data semantics regression passed');
