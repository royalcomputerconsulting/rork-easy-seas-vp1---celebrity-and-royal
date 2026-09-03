const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const theme = read('constants/theme.ts');
const app = JSON.parse(read('app.json'));

for (const [name, hex] of Object.entries({
  brandNavy: '#1C2F7A', oceanTeal: '#0E7FA7', seafoam: '#DFF2EF', sand: '#F5F1E8', canvas: '#F3F6F7',
  surface: '#FFFDF9', textStrong: '#22313D', textMuted: '#65717A', border: '#D5DEDF', success: '#16755F',
  warning: '#A86B00', danger: '#B53A3A', info: '#2C64A0',
})) {
  assert.match(theme, new RegExp(`${name}: '${hex.replace('#', '\\#')}'`), `${name} token must match UX report`);
}
assert.match(theme, /radius: \{ card: 14, control: 10, pill: 999 \}/);
assert.match(theme, /minimumTarget: 44/);
assert.match(theme, /fontFamilyEditorial: 'SourceSerif4-Regular'/);
assert.match(theme, /fontFamilyEditorialSemibold: 'SourceSerif4-SemiBold'/);

const expectedFonts = [
  './assets/fonts/source-serif-4/SourceSerif4-Regular.ttf',
  './assets/fonts/source-serif-4/SourceSerif4-Semibold.ttf',
  './assets/fonts/source-serif-4/SourceSerif4-Bold.ttf',
];
const fontPlugin = app.expo.plugins.find((plugin) => Array.isArray(plugin) && plugin[0] === 'expo-font');
assert(fontPlugin, 'expo-font native embedding must be configured');
assert.deepEqual(fontPlugin[1].fonts, expectedFonts);
for (const font of expectedFonts) {
  const file = path.join(root, font);
  assert(fs.existsSync(file), `${font} missing`);
  assert(fs.statSync(file).size > 250_000, `${font} is not a complete TTF`);
}
assert(fs.existsSync(path.join(root, 'assets/fonts/source-serif-4/OFL.txt')), 'font license missing');
assert.match(read('components/ui/TabIdentityBand.tsx'), /fontFamilyEditorialSemibold/);

console.log('PASS build440_ux_tokens_fonts_regression');
