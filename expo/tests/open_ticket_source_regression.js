const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

const royalBackend = read('backend/trpc/routes/royal-caribbean-sync.ts');
const carnivalSupport = read('lib/carnival/syncSupport.ts');
const carnivalBoundary = read('state/CarnivalSyncProvider.tsx');
const settings = read('app/(tabs)/settings.tsx');
const royalProvider = read('state/RoyalCaribbeanSyncProvider.tsx');
const integrity = read('lib/sync/syncRunIntegrity.ts');
const authDetection = read('lib/royalCaribbean/authDetection.ts');
const carnivalScreen = read('app/carnival-sync.tsx');

// #45: no backend procedure accepts cruise-line credentials or browser cookies.
assert.doesNotMatch(royalBackend, /cookieSync\s*:/);
assert.doesNotMatch(royalBackend, /webLogin\s*:/);
assert.doesNotMatch(royalBackend, /input\(\s*z\.object/);
assert.match(royalBackend, /device_webview_or_extension/);

// #48: persistence cannot cross into an unrelated EasySeas profile.
assert.match(integrity, /export function canPersistSyncToTarget/);
assert.match(royalProvider, /SYNC_TARGET_PROFILE_MISMATCH/);
assert.match(royalProvider, /canPersistSyncToTarget\(syncOwnershipRef\.current, targetProfile\?\.id, targetProfile\?\.email\)/);

// #49: the client distinguishes a visible credential form from authenticated page signals.
assert.match(authDetection, /hasVisibleSignInForm/);
assert.match(authDetection, /visible_sign_in_form/);
assert.match(authDetection, /window\.addEventListener\('popstate'/);
assert.match(authDetection, /window\.addEventListener\('hashchange'/);

// #50, #51, #54, #55, #57: the app no longer depends on a backend policy.
assert.match(carnivalSupport, /Carnival sync is an on-device workflow/);
assert.doesNotMatch(carnivalSupport, /CarnivalRemoteAccessPolicy/);
assert.doesNotMatch(settings, /trpc\.access\.getCarnivalSyncPolicy\.useQuery/);
assert.match(carnivalBoundary, /requireCarnivalAccess/);

// #59 and #60: web uses the supported extension/import handoff, while the app
// itself permits every signed-in EasySeas profile to start on-device sync.
assert.match(carnivalScreen, /carnival-web-workspace/);
assert.match(carnivalScreen, /carnival-download-extension-button/);
assert.match(carnivalScreen, /carnival-sync-access-notice/);

console.log('Open-ticket source regression checks passed');
