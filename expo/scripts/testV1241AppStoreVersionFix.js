const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
const app = JSON.parse(fs.readFileSync(path.join(root, 'app.json'), 'utf8'));
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
function assert(ok, message) { if (!ok) throw new Error(message); }
assert(app.expo.version === '12.4.4', 'CFBundleShortVersionString / Expo version must be 12.4.4');
assert(app.expo.ios.buildNumber === '319', 'iOS CFBundleVersion must be 319');
assert(app.expo.android.versionCode === 120410, 'Android versionCode must be 120410');
assert(pkg.version === '12.4.4', 'package.json version must be 12.4.4');
assert(app.expo.ios.bundleIdentifier === 'app.rork.easy-seas-vp1-celebrity-and-royal', 'Bundle identifier must remain unchanged');
const carnival = fs.readFileSync(path.join(root, 'app', 'carnival-sync.tsx'), 'utf8');
assert(/admin/i.test(carnival), 'Carnival sync must retain its administrator access guard');
console.log('PASS testV1241AppStoreVersionFix');
