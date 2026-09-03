const assert = require('assert');
const fs = require('fs');

const read = (path) => fs.readFileSync(path, 'utf8');

const provider = read('state/ExperienceProvider.tsx');
for (const behavior of ['reducedMotion', 'largeControls', 'textScale', 'color-blind-safe', 'highContrast', 'minimumControlSize']) {
  assert.ok(provider.includes(behavior), `ExperienceProvider must expose ${behavior}`);
}

for (const path of [
  'app/(tabs)/(overview)/index.tsx',
  'app/(tabs)/scheduling.tsx',
  'app/(tabs)/booked.tsx',
  'app/(tabs)/events.tsx',
  'app/(tabs)/settings.tsx',
]) {
  assert.match(read(path), /ResponsiveContainer/, `${path} must retain centered phone/tablet content bounds`);
}
assert.match(read('components/casino/CasinoCommandCenter.tsx'), /maxWidth:\s*1100/);
assert.match(read('app/(tabs)/machines.tsx'), /maxWidth:\s*1100/);

const progress = read('components/ui/ProgressBar.tsx');
assert.match(progress, /accessibilityRole="progressbar"/);
assert.match(progress, /flexWrap:\s*'wrap'/);
assert.match(progress, /textScale/);

const loyalty = read('components/ClubRoyalePoints.tsx');
assert.match(loyalty, /headerCopy/);
assert.match(loyalty, /minWidth:\s*220/);
assert.match(loyalty, /flexWrap:\s*'wrap'/);
assert.match(loyalty, /Open casino and cruise loyalty/);
const pill = read('components/ui/LoyaltyPill.tsx');
assert.doesNotMatch(pill, /numberOfLines=\{1\}/);
assert.match(pill, /flexShrink:\s*1/);

const ask = read('app/ask-my-data.tsx');
assert.match(ask, /KeyboardAvoidingView/);
assert.doesNotMatch(ask, /<ScrollView horizontal showsHorizontalScrollIndicator=\{false\} style=\{styles\.actionBar\}/, 'Agent SEA actions must remain fixed and fully visible instead of clipping in a horizontal rail.');
assert.match(ask, /useWindowDimensions/);
assert.match(ask, /styles\.bottomActions/);
assert.match(ask, /keyboardShouldPersistTaps="always"/);
assert.match(ask, /maxHeight:\s*'90%'/);
assert.match(ask, /minHeight:\s*44/);
assert.match(ask, /preferences\.theme === 'high-contrast'/);

const chat = read('components/AgentXChat.tsx');
assert.match(chat, /if \(!unifiedComposer\) Keyboard\.dismiss\(\)/);
assert.match(chat, /animated:\s*!preferences\.reducedMotion/);
assert.match(chat, /isRecording && !preferences\.reducedMotion/);
assert.match(chat, /return \(\) => animation\.stop\(\)/);
assert.match(chat, /minimumControlSize/);
assert.match(chat, /fontSize:\s*TYPOGRAPHY\.fontSizeMD \* textScale/);

const casino = read('components/casino/CasinoCommandCenter.tsx');
assert.match(casino, /accessibilityRole="image"/);
assert.match(casino, /chartPalette/);
for (const control of ['askButton', 'programButton', 'tab', 'periodButton']) {
  assert.match(casino, new RegExp(`${control}: \\{[^}]*minHeight: 44`), `${control} must preserve the 44-point target`);
}

console.log('Build 440 responsive accessibility consumer regression passed.');
