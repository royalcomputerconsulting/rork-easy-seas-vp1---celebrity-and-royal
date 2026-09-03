const assert = require('node:assert/strict');
const fs = require('node:fs');

const read = (relative) => fs.readFileSync(relative, 'utf8');

const motion = read('components/ui/PurposefulMotion.tsx');
assert.match(motion, /effectiveReducedMotion \? 0 : T\.motion\.progress/);
assert.match(motion, /return \(\) => animation\.stop\(\)/);
assert.match(motion, /accessibilityRole="progressbar"/);
assert.match(motion, /accessibilityLiveRegion="polite"/);

const operation = read('components/ui/OperationStatusCard.tsx');
for (const contract of ['AccessibleProgress', 'PurposefulSuccess', 'Completed and saved', 'Cancel safely', 'Retry', 'Undo', 'Final output or durable data commit verified']) {
  assert.ok(operation.includes(contract), `Operation feedback must retain ${contract}`);
}

const settings = read('app/(tabs)/settings.tsx');
assert.match(settings, /<OperationStatusCard/);
for (const operationId of ['save-all', 'load-all', 'certificate-export']) assert.ok(settings.includes(operationId), `Settings must report ${operationId}.`);

const weather = read('components/VoyageWeatherSection.tsx');
assert.match(weather, /<OperationStatusCard/);
assert.match(weather, /Syncing every voyage day/);
assert.match(weather, /Existing saved weather remains available/);

const certificates = read('components/certificates/CertificateDownloadLogPanel.tsx');
assert.match(certificates, /<AccessibleProgress/);
assert.match(certificates, /<PurposefulSuccess/);
assert.match(certificates, /snapshot\.completed \/ snapshot\.total/);

const machines = read('app/(tabs)/machines.tsx');
assert.match(machines, /<OperationStatusCard/);
assert.match(machines, /onUndo=.*undoLastFavoriteChange/);
assert.match(machines, /export-favorite-machines/);
assert.match(machines, /export-all-machines/);

const root = read('app/_layout.tsx');
assert.match(root, /animation: preferences\.reducedMotion \? 'none'/);
assert.match(root, /animationDuration: preferences\.reducedMotion \? 0 : 200/);

for (const [relative, contracts] of [
  ['components/CruiseCard.tsx', ['preferences.reducedMotion', 'scaleAnim.setValue(1)']],
  ['components/CasinoSessionTracker.tsx', ['preferences.reducedMotion', 'motionDuration(650)', 'animation.stop()']],
  ['components/PPHHistoryChart.tsx', ['preferences.reducedMotion', 'motionDuration(420)', 'animation.stop()']],
  ['components/GamificationCard.tsx', ['!preferences.reducedMotion', 'motionDuration(800)']],
  ['components/WeeklyGoalsCard.tsx', ['preferences.reducedMotion', 'motionDuration(650)', 'completionAnimation.stop()']],
]) {
  const source = read(relative);
  for (const contract of contracts) assert.ok(source.includes(contract), `${relative} must retain ${contract}`);
}

const celebration = read('components/ui/CelebrationOverlay.tsx');
assert.doesNotMatch(celebration, /<Modal/);
assert.match(celebration, /pointerEvents="none"/);
assert.match(celebration, /preferences\.reducedMotion/);
assert.match(celebration, /Math\.min\(autoHideDuration, 2200\)/);
assert.match(celebration, /accessibilityRole="alert"/);

console.log('PASS build445_item15_purposeful_motion_regression');
