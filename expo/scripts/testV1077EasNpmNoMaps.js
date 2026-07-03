const fs = require('fs');
const path = require('path');

const root = process.cwd();
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const app = JSON.parse(fs.readFileSync(path.join(root, 'app.json'), 'utf8'));
const npmrc = fs.readFileSync(path.join(root, '.npmrc'), 'utf8');

function assert(condition, message) {
  if (!condition) {
    console.error('❌ ' + message);
    process.exit(1);
  }
  console.log('✅ ' + message);
}

console.log('V1077 EAS npm / no native maps preflight');

assert(app.expo.newArchEnabled === false, 'Expo New Architecture remains disabled to avoid TurboModule/Hermes exception path');
assert(pkg.packageManager && pkg.packageManager.startsWith('npm@'), 'packageManager forces EAS to use npm, not bun');
assert(/legacy-peer-deps\s*=\s*true/.test(npmrc), '.npmrc prevents automatic peer dependency installation');
assert(!pkg.dependencies['react-native-maps'], 'react-native-maps is not a direct dependency because the app does not import MapView');
assert(!pkg.devDependencies?.['react-native-maps'], 'react-native-maps is not a dev dependency');
assert(!pkg.dependencies['react-native-worklets'], 'react-native-worklets remains removed');

const scanDirs = ['app', 'components', 'lib', 'state', 'hooks', 'constants'];
const hits = [];
function walk(dir) {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir)) {
    const full = path.join(dir, entry);
    const st = fs.statSync(full);
    if (st.isDirectory()) walk(full);
    else if (/\.(js|jsx|ts|tsx)$/.test(entry)) {
      const text = fs.readFileSync(full, 'utf8');
      if (/from ['"]react-native-maps['"]|require\(['"]react-native-maps['"]\)|<MapView\b/.test(text)) {
        hits.push(full);
      }
    }
  }
}
scanDirs.forEach(d => walk(path.join(root, d)));
assert(hits.length === 0, 'application source has no react-native-maps imports/usages');

console.log('🎉 V1077 preflight passed: EAS should not install/compile RNMapsMarkerView via bun peer auto-install.');
