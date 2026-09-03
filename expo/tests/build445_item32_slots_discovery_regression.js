const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');
const slots = read('app/(tabs)/machines.tsx');
const card = read('components/AtlasCard.tsx');

assert.match(slots, /<TabIdentityBand tab="slots"/, 'Slots needs its premium tab identity');
assert.match(slots, /title="Machine library"/, 'machine library needs a labeled editorial section');
assert.match(slots, /testID="machines\.search\.input"/, 'machine search must remain directly usable');
assert.match(slots, /testID="machines\.filter\.open"/, 'advanced filters must remain directly usable');
assert.match(slots, /testID="machines\.filter\.favorites"/, 'favorites must remain directly usable');
assert.match(slots, /testID="machines\.filter\.summary"/, 'active filter criteria and result count must stay visible');
assert.match(slots, /activeFilterSummary/, 'filter summary must describe selected criteria');
assert.match(slots, /numColumns=\{1\}/, 'machine results must use readable one-column cards');
assert.match(slots, /filteredMachines\.length > 24/, 'alphabet navigation should be reserved for long result sets');
assert.match(slots, /testID="machines\.alphabetRail"/, 'long results need a usable alphabet index');
assert.match(slots, /styles\.machineRowWithAlphabet/, 'machine rows must reserve space for the alphabet index');
assert.match(slots, /machineRowWithAlphabet:\s*\{[\s\S]*?marginRight:\s*50/, 'alphabet gutter must keep the rail clear of card actions');

assert.match(card, /testID="atlas-card-machine-visual"/, 'each compact machine card needs a contextual visual');
assert.match(card, /machine\.images\?\.find/, 'saved machine imagery must be used when present');
assert.match(card, /<Gamepad2|<Zap/, 'machine cards need a meaningful fallback icon');
assert.match(card, /machine\.volatility/, 'compact rows must preserve useful machine facts');
assert.match(card, /shipCount/, 'compact rows must preserve ship availability density');
assert.match(card, /accessibilityLabel=\{`\$\{isFavorite/, 'favorite actions must retain an explicit accessible label');

console.log('PASS Build 445 Item 32 premium Slots discovery regression.');
