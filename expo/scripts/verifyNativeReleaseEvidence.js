const fs = require('node:fs');
const path = require('node:path');

const evidencePath = process.argv[2] || path.join(process.cwd(), 'native-validation-evidence.json');
const required = [
  'ios.cleanInstallStartup',
  'ios.savedDataReadback',
  'ios.royalAuthenticatedSync',
  'ios.carnivalAuthenticatedSync',
  'ios.certificateDownloadAndParse',
  'ios.accountSwitchIsolation',
  'android.cleanInstallStartup',
  'android.savedDataReadback',
  'android.royalAuthenticatedSync',
  'android.carnivalAuthenticatedSync',
  'android.certificateDownloadAndParse',
  'android.accountSwitchIsolation',
];

function get(obj, dotted) {
  return dotted.split('.').reduce((value, key) => value && value[key], obj);
}

if (!fs.existsSync(evidencePath)) {
  console.error(`NATIVE RELEASE GATE FAILED: evidence file not found: ${evidencePath}`);
  process.exit(1);
}

const evidence = JSON.parse(fs.readFileSync(evidencePath, 'utf8'));
const failed = required.filter((key) => get(evidence, key) !== true);
if (failed.length) {
  console.error('NATIVE RELEASE GATE FAILED. Missing or failed checks:');
  failed.forEach((key) => console.error(`- ${key}`));
  process.exit(1);
}
console.log('PASS native release evidence: all authenticated/device gates are recorded as passed.');
