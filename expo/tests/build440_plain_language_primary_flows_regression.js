#!/usr/bin/env node

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');

const cruises = read('app/(tabs)/scheduling.tsx');
assert.match(cruises, /Favorite cruises and staterooms/);
assert.match(cruises, /Booked cruises/);
assert.match(cruises, /Back-to-back sets/);
assert.match(cruises, /Cruise discovery/);
assert.doesNotMatch(cruises, /FAVORITE CRUISES \+ STATEROOMS|BOOKED CRUISES|BACK-TO-BACK SETS|CRUISE DISCOVERY/);

const booked = read('app/(tabs)/booked.tsx');
assert.match(booked, /Next voyage/);
assert.match(booked, /Today on my cruise/);
assert.match(booked, /My cruises/);
assert.doesNotMatch(booked, />NEXT VOYAGE<|>TODAY ON MY CRUISE<|>MY CRUISES</);

const offers = read('components/CasinoOfferCard.tsx');
assert.match(offers, /Points level/);
assert.match(offers, /Estimated value/);
assert.match(offers, /View eligible sailings/);
assert.match(offers, /Source/);
assert.doesNotMatch(offers, />POINTS LEVEL<|>EST\. VALUE<|>SOURCE</);

const cruiseCard = read('components/CruiseCard.tsx');
assert.match(cruiseCard, /Round trip from/);
assert.match(cruiseCard, /Visiting/);
assert.doesNotMatch(cruiseCard, /ROUNDTRIP FROM|VISITING:/);

const casino = read('components/casino/CasinoCommandCenter.tsx');
assert.match(casino, /plainLabel\(normalizedEvidence\)/);
assert.match(casino, /Final annual casino summary/);
assert.match(casino, /Points reconciliation needed/);
assert.doesNotMatch(casino, />FINAL ANNUAL CASINO SUMMARY<|>POINTS RECONCILIATION NEEDED</);

const weather = read('components/SailingWeatherCard.tsx');
assert.match(weather, /Check live weather again/);
assert.match(weather, /The location resolved, but neither live forecast provider returned usable data/);
assert.doesNotMatch(weather, /Retry Weather Location & Day|>WIND:|>SEAS:/);

const settings = read('app/(tabs)/settings.tsx');
assert.match(settings, /function countLabel/);
assert.match(settings, /Existing app data was preserved/);
assert.match(settings, /Sync to cloud/);
assert.match(settings, /Get all current pricing/);
assert.doesNotMatch(settings, />SYNC TO CLOUD<|>GET ALL CURRENT PRICING<|>LEGAL DISCLAIMER</);

const machines = read('app/(tabs)/machines.tsx');
assert.match(machines, /Reload machine library/);
assert.doesNotMatch(machines, />Retry</);

console.log('PASS build440_plain_language_primary_flows_regression');
