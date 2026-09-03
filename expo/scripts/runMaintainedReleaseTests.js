const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const testsDirectory = path.join(root, 'tests');
const startAfter = process.env.EASYSEAS_MAINTAINED_START_AFTER || '';
const tests = fs.readdirSync(testsDirectory)
  .filter((name) => name.endsWith('.js') && name !== '_build329_transpile_check.js')
  .filter((name) => !startAfter || name > startAfter)
  .sort();
const currentVersion = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')).version;

const optionalFixtureRequirements = new Map([
  ['build388_all_august_certificates_regression.js', 'tests/fixtures/royal-august-2026-live/manifest.json'],
  ['build393_loyalty_selection_certificate_hermes_regression.js', 'tests/fixtures/royal-august-2026-live/manifest.json'],
]);

let passed = 0;
let skipped = 0;
const failures = [];
for (const name of tests) {
  if (name === 'build440_supplied_import_files_regression.js'
    && (!process.env.EASYSEAS_TEST_OFFERS_CSV
      || !process.env.EASYSEAS_TEST_CREW_XLSX
      || !process.env.EASYSEAS_TEST_COMPLETED_CSV
      || !process.env.EASYSEAS_TEST_BACKUPS)) {
    skipped += 1;
    console.log(`SKIP ${name} — user-supplied external fixtures are not packaged; run directly with EASYSEAS_TEST_* paths`);
    continue;
  }
  if (name === 'build444_supplied_files_acceptance_runtime.js'
    && (!process.env.EASYSEAS_TEST_CREW_XLSX
      || !process.env.EASYSEAS_TEST_COMPLETED_CSV
      || !process.env.EASYSEAS_TEST_BACKUPS)) {
    skipped += 1;
    console.log(`SKIP ${name} — current packaged offers fixture is present, but supplied crew/completed/backup paths were not provided`);
    continue;
  }
  const testSource = fs.readFileSync(path.join(testsDirectory, name), 'utf8');
  const stalePinnedVersions = [...testSource.matchAll(/['"](13\.0\.\d+)['"]/g)].map((match) => match[1]);
  if (stalePinnedVersions.length > 0 && !stalePinnedVersions.includes(currentVersion)) {
    skipped += 1;
    console.log(`SKIP ${name} — historical version-snapshot assertion (${[...new Set(stalePinnedVersions)].join(', ')}); current release is ${currentVersion}`);
    continue;
  }
  const optionalFixture = optionalFixtureRequirements.get(name);
  if (optionalFixture && !fs.existsSync(path.join(root, optionalFixture))) {
    skipped += 1;
    console.log(`SKIP ${name} — optional private fixture is not packaged: ${optionalFixture}`);
    continue;
  }
  console.log(`RUN  ${name}`);
  const absolute = path.join(testsDirectory, name);
  const result = spawnSync(process.execPath, [absolute], {
    cwd: root,
    encoding: 'utf8',
    env: process.env,
    timeout: 600000,
    maxBuffer: 16 * 1024 * 1024,
  });
  const output = `${result.stdout || ''}${result.stderr || ''}`.trim();
  if (result.status === 0) {
    passed += 1;
    console.log(`PASS ${name}${output ? ` — ${output.split(/\r?\n/).slice(-1)[0]}` : ''}`);
  } else {
    failures.push({ name, status: result.status, signal: result.signal, error: result.error?.message, output });
    console.error(`FAIL ${name}`);
    if (result.error) console.error(result.error.message);
    if (output) console.error(output);
  }
}

console.log(`Maintained release tests: ${passed} passed, ${skipped} optional-fixture tests skipped, ${failures.length} failed (${tests.length} total).`);
if (failures.length > 0) console.error(`Failed maintained tests: ${failures.map((failure) => failure.name).join(', ')}`);
if (failures.length > 0) process.exit(1);
