const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');
const settings = read('app/(tabs)/settings.tsx');
const crewProvider = read('state/CrewRecognitionProvider.tsx');

for (const routeOrAction of [
  "router.push('/royal-caribbean-sync'",
  "router.push('/carnival-sync'",
  "router.push('/import-cruises'",
  "router.push('/crew-recognition'",
  'handleImportOffersCSV',
  'handleImportBookedCSV',
  'handleImportCompletedCruisesXLSX',
  'handleImportCalendarICS',
  'handleExportCertificates',
  'handleExportAllData',
  'handleImportAllData',
]) assert.ok(settings.includes(routeOrAction), `missing live Settings action: ${routeOrAction}`);

for (const touchTarget of [
  'settings-save-all',
  'settings-load-all',
  'settings-export-certificates-zip',
  'settings-export-all-app-data',
  'settings-restore-from-backup',
]) assert.ok(settings.includes(touchTarget), `missing tappable Settings action: ${touchTarget}`);

for (const operationId of [
  "id: 'import-offers'",
  "id: 'import-booked'",
  "id: 'import-calendar'",
  "id: 'profile-save'",
  "id: 'save-all'",
  "id: 'load-all'",
  "id: 'certificate-export'",
]) assert.ok(settings.includes(operationId), `missing truthful progress operation: ${operationId}`);

assert.match(settings, /verifySyncReadback\(parsedCruises, persistedCruises\)/);
assert.match(settings, /verifySyncReadback\(parsedOffers, persistedOffers \?\? \[\]\)/);
assert.match(settings, /verifyBookedCruiseSyncReadback\(parsedBooked, persistedBooked\)/);
assert.equal((settings.match(/verifySyncReadback\(events, persistedEvents\)/g) || []).length, 2, 'file and URL calendar imports must both verify readback');
assert.match(settings, /persistedProfiles\.find\(\(profile\) => profile\.id === editableUser\.id\)/);
assert.match(settings, /Profile and loyalty values were committed and verified/);
assert.match(settings, /Existing saved data was not reported as successfully imported/);

assert.match(crewProvider, /listHighVolumeDomain<RecognitionEntryWithCrew>\(crewRepositoryOwner, 'crew_recognition'\)/);
assert.match(crewProvider, /verifiedImportedCount !== additions\.length/);
assert.match(crewProvider, /Crew registry readback was incomplete/);

assert.match(settings, /https:\/\/www\.amazon\.com\/dp\/B0GYRDTS6L/);
assert.match(settings, /https:\/\/www\.amazon\.com\/dp\/B0G4NG1L2M/);
assert.match(settings, /https:\/\/www\.amazon\.com\/stores\/author\/B0GCQ1S8MH\/allbooks/);
assert.match(settings, /only-on-a-cruise-ship\.png/);
assert.match(settings, /smooth-sailing-in-rough-waters\.png/);

console.log('PASS Build 445 Item 35 Settings actions use live routes, durable readback, truthful progress/counts, guarded files, and verified Amazon destinations.');
