#!/usr/bin/env node

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { PNG } = require('pngjs');

const root = path.join(__dirname, 'visual-baselines', 'build439');
const expected = {
  'appearance-dark.png': '8c52c50f3de59622ee0dc8d60786a5fed7e236fd4cf53a30a4213c152125283b',
  'appearance-high-contrast.png': 'beda6d901bf9082ab468da9960ca6ee9312421512097203cc3daf1e4c99c1b91',
  'appearance-light-accessibility.png': '8d4bb370185c83cc0f79d8b948ea4d36199e31bef5709370295abe66cbddfc3c',
  'relationship-dark.png': '3b8a6612fb8143c53b03d7d2af57df585606d67296e3591274101779fd45c217',
  'relationship-high-contrast-reduced-motion.png': '250f6832198135364f7a07bc27761220c57d29cf4d2795bd2498fe34ce238fe9',
  'relationship-light.png': 'a3116550a1af3ca510049f44965e523253d5c2fbec44e7c16f82a83bebb73d73',
  'tab-booked-dark.png': '65125103ee9d357bc6941cb1f3292fb896b5de386b6a8a83352b60ac69a0f48c',
  'tab-booked-high-contrast.png': '3261f43ca4499ac5f1fa250bb8d18c50f32ad993c64ba04adfaf4c4a2c8e69f5',
  'tab-booked-light.png': '76920b9a0064f3b13b1df2dc3f492748cb2a258faa5dc8398bbb3ba15e68cc54',
  'tab-calendar-dark.png': '6d796f5b52624e37b4811cb4c6ff7c18fd20a2a042d858504478417ee1eaeb68',
  'tab-calendar-high-contrast.png': '992e9e56f9cd9ff9ea1fe9668d94f05a1a00e509798f47e4600c2a342ddc7811',
  'tab-calendar-light.png': 'e0c84e5692626bb6d1df2ff961ff56b9cb63b307d090ed2d33b85d9b26dab9f1',
  'tab-casino-dark.png': '9bc81b93a202fd73b24ef466b571746bc95736d82bdbe672ad293b0c75e8e62a',
  'tab-casino-high-contrast.png': '2b1982ef23b2f0ab2bd5a6c3e09345f9a69781bc4dbe0f1878c3a57596fd10ac',
  'tab-casino-light.png': '34378fe0ecaf27495efa06cedbae0b5e9480aee5683eb621c4246868e6cec724',
  'tab-cruises-dark.png': 'e764454825c420d1b4cdf2f7e244770dad6267f966879bfd97c99615e8a08247',
  'tab-cruises-high-contrast.png': '1411f42556f801a73500d06d19fe5a348732609c5556ed9792fd869922f79562',
  'tab-cruises-light.png': '01a5d9a7ccb524530889a5c5126cc9d9944587b568e3c97c56bca5ed7829bdf0',
  'tab-offers-dark.png': '4e46eacc886c891718bc057d9da538def7e7829f15bf3cf7478be7f6ab15a5b8',
  'tab-offers-high-contrast.png': 'd1b125737d753e7501ff9f34a1e70dd39ddb93f6ef1892bc3b19192edda47d53',
  'tab-offers-light.png': 'a2c6509713c0474391b5df593d27b36608fc24d4e887df8f7347e940034c5155',
  'tab-settings-dark.png': '96cca3ed2ebb5d40bebe507fffc55ca064be94194c5fa76732a5889fd68bffc5',
  'tab-settings-high-contrast.png': '05c35febcea814a7fa5412cb1b920aa8fc85a29bc5d3e91396acd006225d88aa',
  'tab-settings-light.png': '3f6e1e01a1577227b67f6556a44fffab3726ca36fb459e332dad1d0b85a1b4fd',
  'tab-slots-dark.png': 'd6caaafd6037c090c745208b9735d7fa2477701ff32dd68a5c30abe770e07567',
  'tab-slots-high-contrast.png': '1aaf6ca0933dbfc2a7b0a427771add2c10d58a8fe1d95de9c68e4f02b1001cb9',
  'tab-slots-light.png': '0ec4b95a7d9f12be2294a9f56caa6f62937aa2110aa0af749175c132a17ba45c',
};

function read(name) {
  const bytes = fs.readFileSync(path.join(root, name));
  assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'), expected[name], `${name} changed; review and intentionally recapture its baseline`);
  const png = PNG.sync.read(bytes);
  const expectedFrame = name.startsWith('relationship-')
    ? { width: 1280, height: 720, label: 'audited browser workflow frame' }
    : { width: 430, height: 932, label: 'audited mobile frame' };
  assert.equal(png.width, expectedFrame.width, `${name} must retain its ${expectedFrame.label} width`);
  assert.equal(png.height, expectedFrame.height, `${name} must retain its ${expectedFrame.label} height`);
  const colors = new Set();
  for (let offset = 0; offset < png.data.length; offset += 32) {
    colors.add(`${png.data[offset]}:${png.data[offset + 1]}:${png.data[offset + 2]}:${png.data[offset + 3]}`);
  }
  assert(colors.size > 100, `${name} appears blank or failed to render`);
  return png;
}

function changedPixelRatio(left, right) {
  assert.equal(left.data.length, right.data.length);
  let changed = 0;
  const total = left.width * left.height;
  for (let pixel = 0; pixel < total; pixel += 1) {
    const offset = pixel * 4;
    if (
      Math.abs(left.data[offset] - right.data[offset]) > 8 ||
      Math.abs(left.data[offset + 1] - right.data[offset + 1]) > 8 ||
      Math.abs(left.data[offset + 2] - right.data[offset + 2]) > 8
    ) changed += 1;
  }
  return changed / total;
}

Object.keys(expected).forEach(read);
for (const tab of ['offers', 'cruises', 'booked', 'calendar', 'casino', 'slots', 'settings']) {
  const light = read(`tab-${tab}-light.png`);
  const dark = read(`tab-${tab}-dark.png`);
  const contrast = read(`tab-${tab}-high-contrast.png`);
  assert(changedPixelRatio(light, dark) > 0.005, `${tab} does not visibly respond to dark mode`);
  assert(changedPixelRatio(dark, contrast) > 0.001, `${tab} does not visibly respond to high-contrast mode`);
}

const relationshipLight = read('relationship-light.png');
const relationshipDark = read('relationship-dark.png');
const relationshipContrast = read('relationship-high-contrast-reduced-motion.png');
assert(changedPixelRatio(relationshipLight, relationshipDark) > 0.05, 'Relationship Explorer must visibly respond to dark mode');
assert(changedPixelRatio(relationshipDark, relationshipContrast) > 0.02, 'Relationship Explorer must visibly respond to high contrast');

console.log(`Build 439 visual baselines: ${Object.keys(expected).length} verified, 7 tab families and the relationship workflow respond to all themes.`);
