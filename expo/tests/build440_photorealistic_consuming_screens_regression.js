#!/usr/bin/env node
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

const art = ['offers-certificates-v1.png','cruises-discovery-v1.png','booked-voyages-v1.png','calendar-agenda-v1.png','casino-intelligence-v1.png','slots-machines-v1.png','settings-trust-v1.png'];
for (const file of art) {
  const absolute = path.join(root, 'assets/images/section-themes', file);
  assert(fs.existsSync(absolute), `missing bundled photorealistic artwork ${file}`);
  assert(fs.statSync(absolute).size > 500_000, `${file} must be a real high-resolution asset, not a placeholder`);
}

const band = read('components/ui/TabIdentityBand.tsx');
for (const marker of ['useWindowDimensions', 'useExperience', "preferences.theme === 'high-contrast'", 'onError={() => setArtworkFailed(true)}', 'TAB_ARTWORK']) assert(band.includes(marker), `identity band missing ${marker}`);
const premium = read('components/ui/PremiumVoyageArtwork.tsx');
for (const marker of ['LOCAL_ARTWORK', 'cachePolicy="memory-disk"', 'remoteFailed', 'localFailed', 'contentFit="cover"', 'preferences.reducedMotion', 'accessibilityIgnoresInvertColors']) assert(premium.includes(marker), `premium artwork missing ${marker}`);

const primary = [
  ['app/(tabs)/(overview)/index.tsx', 'tab="offers"'],
  ['app/(tabs)/scheduling.tsx', 'tab="cruises"'],
  ['app/(tabs)/booked.tsx', 'tab="booked"'],
  ['app/(tabs)/events.tsx', 'tab="calendar"'],
  ['components/casino/CasinoCommandCenter.tsx', 'tab="casino"'],
  ['app/(tabs)/machines.tsx', 'tab="slots"'],
  ['app/(tabs)/settings.tsx', 'tab="settings"'],
];
for (const [file, marker] of primary) assert(read(file).includes(marker), `${file} does not consume its preserved themed story band`);
for (const [file, marker] of [
  ['app/offer-details.tsx', 'PremiumVoyageArtwork'],
  ['app/(tabs)/(overview)/cruise-details.tsx', 'heroImageUri'],
  ['components/VoyageWeatherSection.tsx', 'kind="weather"'],
  ['app/action-inbox.tsx', 'action-inbox-story-card'],
  ['app/certificate-portfolio.tsx', 'certificate-portfolio-story-card'],
  ['app/relationship-explorer.tsx', 'relationship-explorer-story-card'],
  ['app/casino/relationship-intelligence.tsx', 'casino-relationship-story-card'],
]) assert(read(file).includes(marker), `${file} is missing its story-level themed treatment`);

for (const file of ['components/ui/PremiumVoyageArtwork.tsx','components/ui/TabIdentityBand.tsx']) {
  const out = ts.transpileModule(read(file), { compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 }, reportDiagnostics: true });
  assert.equal((out.diagnostics || []).filter((row) => row.category === ts.DiagnosticCategory.Error).length, 0, file);
}
console.log('Build 440 photorealistic consuming-screen design regression passed');
