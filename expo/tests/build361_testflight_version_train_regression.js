const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');
const app = JSON.parse(read('app.json')).expo;
const eas = JSON.parse(read('eas.json'));
const appConfigFactory = require(path.join(root, 'app.config.js'));

const compareVersions = (left, right) => {
  const a = String(left).split('.').map(Number);
  const b = String(right).split('.').map(Number);
  const length = Math.max(a.length, b.length);
  for (let index = 0; index < length; index += 1) {
    const delta = (a[index] || 0) - (b[index] || 0);
    if (delta !== 0) return Math.sign(delta);
  }
  return 0;
};

// TestFlight already distributed 13.0.0 (352), so a 12.3.9 binary cannot be
// presented as its upgrade even when its CFBundleVersion is numerically higher.
assert.ok(compareVersions(app.version, '13.0.0') > 0);
assert.ok(compareVersions(app.version, '12.3.9') > 0);
assert.equal(app.version, '13.0.44');
assert.equal(String(app.ios.buildNumber), '410');
assert.equal(app.android.versionCode, 130067);

assert.equal(eas.cli.appVersionSource, 'remote');
assert.equal(eas.build.production.autoIncrement, true);
assert.equal(app.extra.eas.projectId, 'ec1e9b5a-face-45ad-8dc2-b95c780654f7');
assert.equal(app.ios.infoPlist.ITSAppUsesNonExemptEncryption, false);
assert.equal(app.ios.infoPlist.CFBundleVersion, undefined);

const resolved = appConfigFactory({ config: {} });
assert.equal(resolved.version, '13.0.44');
assert.equal(resolved.ios.infoPlist.CFBundleShortVersionString, '13.0.44');
assert.equal(resolved.ios.infoPlist.CFBundleVersion, undefined);

console.log('PASS Build 366: TestFlight marketing version exceeds 13.0.0, local baseline increments, and EAS remote auto-increment remains enabled');
