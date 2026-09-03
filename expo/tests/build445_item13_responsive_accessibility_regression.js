const assert = require('node:assert/strict');
const fs = require('node:fs');

const read = (relative) => fs.readFileSync(relative, 'utf8');

const appJson = JSON.parse(read('app.json'));
assert.equal(appJson.expo.ios.supportsTablet, false, 'The native release remains intentionally iPhone-only; tablet-width checks are responsive web checks only.');

const provider = read('state/ExperienceProvider.tsx');
for (const contract of [
  'AccessibilityInfo.addEventListener',
  'reduceMotionChanged',
  'getTextScaleMultiplier',
  'minimumControlSize',
  'COLOR_BLIND_SAFE_CHART_PALETTE',
  'motionDuration',
  "preferences.theme === 'high-contrast'",
]) assert.ok(provider.includes(contract), `Missing adaptive experience contract: ${contract}`);

const tabs = read('app/(tabs)/_layout.tsx');
assert.match(tabs, /useSafeAreaInsets/);
assert.match(tabs, /minHeight: 62 \+ insets\.bottom/);
assert.match(tabs, /Math\.max\(6, insets\.bottom\)/);
assert.match(tabs, /preferences\.reducedMotion \? 'none' : 'fade'/);

const progress = read('components/ui/ProgressBar.tsx');
assert.match(progress, /accessibilityRole="progressbar"/);
assert.match(progress, /footer:[\s\S]*?flexWrap: 'wrap'/);
assert.match(progress, /fontSize: TYPOGRAPHY\.fontSizeSM \* textScale/);
assert.match(progress, /minWidth: 120/);

const tierProgress = read('components/ui/TierProgressBar.tsx');
assert.match(tierProgress, /accessibilityRole="progressbar"/);
assert.match(tierProgress, /footer:[\s\S]*?flexWrap: 'wrap'/);
assert.match(tierProgress, /minWidth: minimumControlSize/);
assert.match(tierProgress, /fontSize: TYPOGRAPHY\.fontSizeXS \* textScale/);

const compactHeader = read('components/CompactDashboardHeader.tsx');
assert.match(compactHeader, /tierRow:[\s\S]*?flexWrap: 'wrap'/);
assert.match(compactHeader, /progressHeader:[\s\S]*?flexWrap: 'wrap'/);
assert.match(compactHeader, /progressLabel:[\s\S]*?minWidth: 160/);
assert.match(compactHeader, /statsRow:[\s\S]*?flexWrap: 'wrap'/);
assert.match(compactHeader, /statItem:[\s\S]*?minWidth: 92/);

const loyalty = read('components/ClubRoyalePoints.tsx');
assert.match(loyalty, /const \{ textScale \} = useExperience\(\)/);
assert.match(loyalty, /adjustsFontSizeToFit/);
assert.match(loyalty, /minimumFontScale=\{0\.65\}/);
assert.match(loyalty, /width: '100%'/);

const chat = read('components/AgentXChat.tsx');
assert.match(chat, /KeyboardAvoidingView/);
assert.match(chat, /keyboardShouldPersistTaps="always"/);
assert.match(chat, /minWidth: minimumControlSize, minHeight: minimumControlSize/);
assert.match(chat, /motionDuration\(300\)/);

const casino = read('components/casino/CasinoCommandCenter.tsx');
assert.match(casino, /chartPalette/);
assert.match(casino, /adjustsFontSizeToFit/);
assert.match(casino, /minimumFontScale=\{0\.(?:6[5-9]|7\d)\}/);

console.log('PASS build445_item13_responsive_accessibility_regression');
