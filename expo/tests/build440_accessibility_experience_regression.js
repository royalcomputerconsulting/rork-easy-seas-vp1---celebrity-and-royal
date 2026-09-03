const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const provider = fs.readFileSync(path.join(root, 'state/ExperienceProvider.tsx'), 'utf8');
const settings = fs.readFileSync(path.join(root, 'app/experience-settings.tsx'), 'utf8');
const primitives = fs.readFileSync(path.join(root, 'components/ui/EasySeasPrimitives.tsx'), 'utf8');
const tabs = fs.readFileSync(path.join(root, 'app/(tabs)/_layout.tsx'), 'utf8');
const theme = fs.readFileSync(path.join(root, 'constants/theme.ts'), 'utf8');

for (const requirement of ['reducedMotion', 'largeControls', 'textScale', 'color-blind-safe', 'highContrast', 'minimumControlSize']) {
  if (!provider.includes(requirement) && !settings.includes(requirement)) throw new Error(`Missing adaptive experience behavior: ${requirement}`);
}
for (const requirement of ['minimumTarget: 44', 'accessibilityRole="button"', 'accessibilityRole="header"', 'accessibilityState']) {
  if (!primitives.includes(requirement) && !tabs.includes(requirement) && !theme.includes(requirement)) throw new Error(`Missing shared accessibility requirement: ${requirement}`);
}
if (!tabs.includes("preferences.reducedMotion ? 'none' : 'fade'")) throw new Error('Bottom navigation does not respect reduced motion.');

console.log('Build 440 accessibility and adaptive-experience regression passed.');
