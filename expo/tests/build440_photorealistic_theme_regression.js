const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const band = fs.readFileSync(path.join(root, 'components/ui/TabIdentityBand.tsx'), 'utf8');
const settings = fs.readFileSync(path.join(root, 'app/(tabs)/settings.tsx'), 'utf8');

const artwork = {
  offers: 'offers-certificates-v1.png',
  cruises: 'cruises-discovery-v1.png',
  booked: 'booked-voyages-v1.png',
  calendar: 'calendar-agenda-v1.png',
  casino: 'casino-intelligence-v1.png',
  slots: 'slots-machines-v1.png',
  settings: 'settings-trust-v1.png',
};

for (const [tab, file] of Object.entries(artwork)) {
  if (!band.includes(`${tab}: require(`) || !band.includes(file)) {
    throw new Error(`Missing ${tab} themed artwork mapping.`);
  }
  const fullPath = path.join(root, 'assets/images/section-themes', file);
  if (!fs.existsSync(fullPath) || fs.statSync(fullPath).size < 100_000) {
    throw new Error(`Missing or invalid themed artwork file: ${file}`);
  }
}

const tabConsumers = {
  offers: 'app/(tabs)/(overview)/index.tsx',
  cruises: 'app/(tabs)/scheduling.tsx',
  booked: 'app/(tabs)/booked.tsx',
  calendar: 'app/(tabs)/events.tsx',
  casino: 'components/casino/CasinoCommandCenter.tsx',
  slots: 'app/(tabs)/machines.tsx',
  settings: 'app/(tabs)/settings.tsx',
};

for (const [tab, relative] of Object.entries(tabConsumers)) {
  const source = fs.readFileSync(path.join(root, relative), 'utf8');
  if (!source.includes(`tab="${tab}"`)) throw new Error(`The ${tab} screen does not consume its themed card.`);
}

for (const id of [
  'settings-scott-astin-books',
  'settings-book-only-on-a-cruise-ship',
  'settings-book-smooth-sailing',
  'settings-view-all-scott-astin-books',
]) {
  if (!settings.includes(id)) throw new Error(`Missing Settings book control: ${id}`);
}

if (settings.includes("Check out Scott Astin's Other Books")) {
  throw new Error('Old duplicate Support book row is still present.');
}

console.log('Build 440 photorealistic themed-card regression passed.');
