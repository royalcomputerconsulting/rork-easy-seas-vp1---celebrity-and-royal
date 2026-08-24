const fs = require('fs');
const path = require('path');
const { root, loadTs } = require('./clubRoyaleTestBootstrap');
const { getCarnivalSyncAccess } = loadTs('lib/carnival/carnivalAccess.ts');
const {
  buildCarnivalCheckpointIdentity,
  buildCarnivalCheckpointOfferContext,
  isCarnivalCheckpointCompatible,
} = loadTs('lib/carnival/carnivalSyncRuntime.ts');

function assert(condition, message) { if (!condition) throw new Error(message); }

const normalUser = {
  isAuthenticated: true,
  isWhitelisted: true,
  isAdmin: false,
  authenticatedEmail: 'traveler@example.com',
  platform: 'ios',
};
const fullRollout = { EXPO_PUBLIC_CARNIVAL_SYNC_ENABLED: 'true', EXPO_PUBLIC_CARNIVAL_SYNC_ROLLOUT_PERCENT: '100' };
assert(getCarnivalSyncAccess(normalUser, fullRollout).eligible, 'Authenticated non-admin users must be eligible at 100% rollout.');
assert(getCarnivalSyncAccess({ ...normalUser, isAdmin: true }, fullRollout).eligible, 'Admins must use the same eligible path.');
assert(!getCarnivalSyncAccess({ ...normalUser, isAuthenticated: false }, fullRollout).eligible, 'Logged-out users must not start Carnival sync.');
assert(!getCarnivalSyncAccess({ ...normalUser, isWhitelisted: false }, fullRollout).eligible, 'Unauthorized accounts must not start Carnival sync.');
assert(!getCarnivalSyncAccess(normalUser, { ...fullRollout, EXPO_PUBLIC_CARNIVAL_SYNC_ENABLED: 'false' }).eligible, 'Emergency kill switch must block all users.');
assert(!getCarnivalSyncAccess(normalUser, { ...fullRollout, EXPO_PUBLIC_CARNIVAL_SYNC_ROLLOUT_PERCENT: '0' }).eligible, 'Zero-percent staged rollout must block all users.');
const webAccess = getCarnivalSyncAccess({ ...normalUser, platform: 'web' }, fullRollout);
assert(webAccess.eligible && !webAccess.nativeSupported && webAccess.reason === 'unsupported_platform', 'Web must show guidance without starting native extraction.');

const catalog = {
  sourceUrl: 'https://www.carnival.com/cruise-deals',
  personalizedSearchUrl: 'https://www.carnival.com/cruise-search?ratecodes=PC1&tgo=secret&vifp=123456789',
  tgo: 'secret',
  vifp: '123456789',
  tierCode: '03',
  tierName: 'Platinum',
  resident: 'AZ',
  locality: '1',
  currency: 'USD',
  rateCodes: [{ code: 'PC1', offerName: 'Test Offer', bookingLink: 'https://www.carnival.com/cruise-search?ratecodes=PC1&tgo=secret&vifp=123456789', endDate: '2026-08-01' }],
  actionCards: [],
  noOffersConfirmed: false,
};
const identity = buildCarnivalCheckpointIdentity({ catalog, appProfileId: 'profile-a', authenticatedEmail: 'traveler@example.com' });
const context = buildCarnivalCheckpointOfferContext(catalog, catalog.rateCodes[0]);
const checkpoint = {
  version: 2,
  identity,
  catalogCodes: ['PC1'],
  catalogHash: identity.catalogHash,
  codeStates: {
    PC1: { status: 'success', rows: [], context, totalResults: 0, pagesVisited: 1, updatedAt: new Date().toISOString() },
  },
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};
assert(isCarnivalCheckpointCompatible(checkpoint, identity, { PC1: context }), 'Same user/profile/VIFP/context must resume its checkpoint.');
const otherProfile = buildCarnivalCheckpointIdentity({ catalog, appProfileId: 'profile-b', authenticatedEmail: 'traveler@example.com' });
assert(!isCarnivalCheckpointCompatible(checkpoint, otherProfile, { PC1: context }), 'A different EasySeas profile must not resume the checkpoint.');
const otherEmail = buildCarnivalCheckpointIdentity({ catalog, appProfileId: 'profile-a', authenticatedEmail: 'other@example.com' });
assert(!isCarnivalCheckpointCompatible(checkpoint, otherEmail, { PC1: context }), 'A different EasySeas account must not resume the checkpoint.');
const otherCatalog = { ...catalog, vifp: '987654321', personalizedSearchUrl: catalog.personalizedSearchUrl.replace('123456789', '987654321') };
const otherVifp = buildCarnivalCheckpointIdentity({ catalog: otherCatalog, appProfileId: 'profile-a', authenticatedEmail: 'traveler@example.com' });
assert(!isCarnivalCheckpointCompatible(checkpoint, otherVifp, { PC1: buildCarnivalCheckpointOfferContext(otherCatalog, otherCatalog.rateCodes[0]) }), 'A different Carnival VIFP account must not resume the checkpoint.');

const screen = fs.readFileSync(path.join(root, 'app/carnival-sync.tsx'), 'utf8');
const settings = fs.readFileSync(path.join(root, 'app/(tabs)/settings.tsx'), 'utf8');
const provider = fs.readFileSync(path.join(root, 'state/RoyalCaribbeanSyncProvider.tsx'), 'utf8');
const access = fs.readFileSync(path.join(root, 'lib/carnival/carnivalAccess.ts'), 'utf8');

assert(screen.includes('getCarnivalSyncAccess'), 'Carnival route must use the shared access gate.');
assert(!screen.includes('if (!isAdmin)'), 'Carnival route must not have an admin-only branch.');
assert(settings.includes('carnivalSyncAccess.eligible'), 'Settings must expose Carnival to eligible authenticated users.');
assert(!settings.includes('settings-admin-carnival-sync'), 'Settings must not retain the admin-only Carnival test ID.');
assert(provider.includes('Carnival sync start blocked:'), 'Provider must independently block unauthorized starts.');
assert(provider.includes('carnivalSyncAccess.nativeSupported'), 'Provider must block unsupported live platforms.');
assert(provider.includes('currentUser?.id') && provider.includes('authenticatedEmail'), 'Active run ownership must include profile/account context.');
assert(access.includes('EXPO_PUBLIC_CARNIVAL_SYNC_ENABLED'), 'Emergency kill switch is missing.');
assert(access.includes('EXPO_PUBLIC_CARNIVAL_SYNC_ROLLOUT_PERCENT'), 'Staged rollout control is missing.');
assert(provider.includes('checkpointIdentity.fingerprint'), 'Correct Carnival request identity must remain in use.');
assert(!provider.includes('identity.fingerprint'), 'Undefined legacy identity reference must not return.');

const safeSync = fs.readFileSync(path.join(root, 'lib/carnival/carnivalSafeSync.ts'), 'utf8');
for (const marker of [
  'capturedValue(/^(?:vifppoints|totalpoints)$/i)',
  'capturedValue(/^(?:cruisedaypoints|cruise_day_points)$/i)',
  'capturedValue(/^(?:totalcruises|cruisecount|total_cruises)$/i)',
]) assert(safeSync.includes(marker), `Carnival loyalty parser must bind exact labels: ${marker}`);
assert(!screen.includes('console.log(username') && !screen.includes('console.log(password') && !screen.includes('console.log(cookies'), 'Carnival UI must not log credentials or raw cookies.');

console.log('PASS testRORK2CarnivalGeneralUserAccess');
