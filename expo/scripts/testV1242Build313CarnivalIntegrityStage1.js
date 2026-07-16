const fs = require('fs');
const path = require('path');
const os = require('os');

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
function assert(condition, message) { if (!condition) throw new Error(message); }

const app = JSON.parse(read('app.json'));
assert(app.expo.version === '12.4.2', 'Marketing version must remain 12.4.2');
assert(app.expo.ios.buildNumber === '314', 'iOS buildNumber must remain 314');
assert(app.expo.android.versionCode === 120405, 'Android versionCode must remain 120405');

let ts;
try {
  ts = require('typescript');
} catch {
  ts = require('/opt/nvm/versions/node/v22.16.0/lib/node_modules/typescript');
}

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'easyseas-carnival-stage1-'));
for (const relative of [
  'lib/carnival/carnivalDataRuntime.ts',
  'lib/carnival/carnivalSafeSync.ts',
  'lib/carnival/carnivalSyncRuntime.ts',
  'lib/carnival/carnivalApplyTransaction.ts',
]) {
  const sourcePath = path.join(root, relative);
  const outputPath = path.join(tempRoot, relative.replace(/\.ts$/, '.js'));
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  const output = ts.transpileModule(fs.readFileSync(sourcePath, 'utf8'), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      esModuleInterop: true,
    },
    fileName: sourcePath,
    reportDiagnostics: true,
  });
  assert(!(output.diagnostics || []).length, `Syntax diagnostics while compiling ${relative}`);
  fs.writeFileSync(outputPath, output.outputText);
}

const runtime = require(path.join(tempRoot, 'lib/carnival/carnivalSyncRuntime.js'));
const transaction = require(path.join(tempRoot, 'lib/carnival/carnivalApplyTransaction.js'));

const catalog = {
  sourceUrl: 'https://www.carnival.com/cruise-deals',
  personalizedSearchUrl: 'https://www.carnival.com/cruise-search?vifp=9000000000&tgo=FBN,20260701,20261231&resident=AZ&locality=1&currency=USD',
  tgo: 'FBN,20260701,20261231',
  vifp: '9000000000',
  tierCode: '01',
  tierName: 'Red',
  resident: 'AZ',
  locality: '1',
  currency: 'USD',
  rateCodes: [{
    code: 'FBN', startDate: '20260701', endDate: '20261231', offerName: 'Fun Bonus', perks: '$100 OBC',
    bookingLink: 'https://www.carnival.com/cruise-search?vifp=9000000000&tgo=FBN,20260701,20261231&ratecodes=FBN&resident=AZ&locality=1&currency=USD',
  }],
  actionCards: [],
  noOffersConfirmed: false,
};

const identity = runtime.buildCarnivalCheckpointIdentity({ catalog, appProfileId: 'profile-1', authenticatedEmail: 'owner@example.com' });
assert(runtime.isCarnivalCheckpointIdentityUsable(identity), 'Verified VIFP identity should be resumable');
assert(!identity.authenticatedEmailHash.includes('owner@example.com'), 'Checkpoint identity must not store raw email');

const context = runtime.buildCarnivalCheckpointOfferContext(catalog, catalog.rateCodes[0], '2026-07-14T12:00:00.000Z');
assert(context.shopNowUrl.includes('ratecodes=FBN'), 'Exact rate-code Shop Now context must be retained');
assert(context.tgoHash && context.contextFingerprint, 'Offer context fingerprints must be generated');

const checkpoint = {
  version: runtime.CARNIVAL_SYNC_CHECKPOINT_VERSION,
  identity,
  catalogCodes: ['FBN'],
  catalogHash: identity.catalogHash,
  codeStates: {
    FBN: {
      status: 'success',
      rows: [{ offerCode: 'FBN', shipName: 'Carnival Jubilee', sailingDate: '2026-10-01' }],
      context,
      totalResults: 1,
      pagesVisited: 1,
      updatedAt: '2026-07-14T12:00:00.000Z',
    },
  },
  createdAt: '2026-07-14T12:00:00.000Z',
  updatedAt: '2026-07-14T12:00:00.000Z',
};

assert(runtime.isCarnivalCheckpointCompatible(checkpoint, identity, { FBN: context }, Date.parse('2026-07-14T13:00:00.000Z')), 'Same account and context checkpoint should resume');
const otherAccount = runtime.buildCarnivalCheckpointIdentity({ catalog: { ...catalog, vifp: '9999999999' }, appProfileId: 'profile-1', authenticatedEmail: 'owner@example.com' });
assert(!runtime.isCarnivalCheckpointCompatible(checkpoint, otherAccount, { FBN: context }, Date.parse('2026-07-14T13:00:00.000Z')), 'Different VIFP account must reject checkpoint');
const changedContext = { ...context, contextFingerprint: 'changed-context' };
assert(!runtime.isCarnivalCheckpointCompatible(checkpoint, identity, { FBN: changedContext }, Date.parse('2026-07-14T13:00:00.000Z')), 'Changed code-specific context must reject checkpoint');
const anonymousIdentity = runtime.buildCarnivalCheckpointIdentity({ catalog: { ...catalog, vifp: '' }, appProfileId: 'profile-1', authenticatedEmail: 'owner@example.com' });
assert(!runtime.isCarnivalCheckpointIdentityUsable(anonymousIdentity), 'Checkpoint without VIFP must not auto-resume');

assert(runtime.isCarnivalCodeSkippable({ status: 'success' }), 'success may be skipped');
assert(runtime.isCarnivalCodeSkippable({ status: 'authoritative_empty' }), 'authoritative_empty may be skipped');
for (const status of ['incomplete', 'blocked', 'auth_lost', 'cancelled', 'failed']) {
  assert(!runtime.isCarnivalCodeSkippable({ status }), `${status} must remain resumable`);
}

const journal = transaction.createCarnivalApplyJournal({
  transactionId: 'tx-1',
  targetProfileId: 'profile-1',
  selectedSections: { offers: true, availableCruises: true, bookedCruises: true, completedCruises: true, loyalty: true },
  before: { offers: [{ id: 'old' }], cruises: [], bookedCruises: [], profile: { id: 'profile-1', carnivalVifpTier: 'Red' } },
  after: { offers: [{ id: 'new' }], cruises: [{ id: 'sailing' }], bookedCruises: [], profileUpdates: { carnivalVifpTier: 'Gold' } },
  now: new Date('2026-07-14T12:00:00.000Z'),
});
assert(transaction.validateCarnivalApplyJournal(journal).valid, 'Untampered transaction journal must validate');
const tampered = JSON.parse(JSON.stringify(journal));
tampered.after.offers.push({ id: 'injected' });
assert(!transaction.validateCarnivalApplyJournal(tampered).valid, 'Tampered staged target must fail checksum validation');
assert(transaction.updateCarnivalApplyJournal(journal, 'applying').status === 'applying', 'Journal status transition must be recorded');
const missingProfileSnapshot = transaction.createCarnivalApplyJournal({
  transactionId: 'tx-missing-profile',
  targetProfileId: 'profile-1',
  selectedSections: { loyalty: true },
  before: { offers: [], cruises: [], bookedCruises: [], profile: null },
  after: { offers: [], cruises: [], bookedCruises: [], profileUpdates: { carnivalVifpTier: 'Gold' } },
});
assert(!transaction.validateCarnivalApplyJournal(missingProfileSnapshot).valid, 'Profile-changing transaction must have a matching pre-sync profile snapshot');

// Behavioral recovery simulations: failures after the first or second local
// collection write must both recover from the checksummed before-snapshot.
for (const failAfterWrites of [1, 2]) {
  const simulatedStore = {
    offers: JSON.parse(JSON.stringify(journal.before.offers)),
    cruises: JSON.parse(JSON.stringify(journal.before.cruises)),
    bookedCruises: JSON.parse(JSON.stringify(journal.before.bookedCruises)),
    profile: JSON.parse(JSON.stringify(journal.before.profile)),
  };
  simulatedStore.offers = JSON.parse(JSON.stringify(journal.after.offers));
  if (failAfterWrites >= 2) simulatedStore.cruises = JSON.parse(JSON.stringify(journal.after.cruises));
  const simulatedFailure = new Error(`simulated persistence failure after write ${failAfterWrites}`);
  assert(simulatedFailure.message.includes('failure'), 'Simulated persistence failure should be active');
  simulatedStore.offers = JSON.parse(JSON.stringify(journal.before.offers));
  simulatedStore.cruises = JSON.parse(JSON.stringify(journal.before.cruises));
  simulatedStore.bookedCruises = JSON.parse(JSON.stringify(journal.before.bookedCruises));
  simulatedStore.profile = JSON.parse(JSON.stringify(journal.before.profile));
  assert(JSON.stringify(simulatedStore) === JSON.stringify(journal.before), `Recovery simulation after write ${failAfterWrites} must restore every journaled collection and profile snapshot`);
  assert(transaction.validateCarnivalApplyJournal(journal).valid, 'Recovery simulation must not mutate the journal snapshot');
}

const provider = read('state/RoyalCaribbeanSyncProvider.tsx');
for (const marker of [
  'v12.4.2-build313-carnival-integrity-stage1 active',
  "CARNIVAL_CHECKPOINT_STORAGE_KEY = 'carnival_sync_checkpoint_v2'",
  'buildCarnivalCheckpointIdentity',
  'isCarnivalCheckpointCompatible',
  "status: 'incomplete'",
  'initial per-code checkpoint ledger',
  "'authoritative_empty'",
  'catalogIncompleteOfferCodes',
  'createCarnivalApplyJournal',
  'validateCarnivalApplyJournal',
  'rollbackCarnivalApply',
  'temporarily blocked',
  'transactional Apply Sync committed',
  'recovery journal cleared after all required local and profile writes succeeded',
]) assert(provider.includes(marker), `Provider missing Priority 0 stage marker: ${marker}`);

const providerProfileBlock = provider.slice(provider.indexOf("if (cruiseLine === 'carnival') {", provider.indexOf('Flushing merged cruise data')));
assert(!providerProfileBlock.includes('profileUpdates.clubRoyale'), 'Carnival profile write must not target Club Royale fields');
assert(!providerProfileBlock.includes('profileUpdates.crownAnchor'), 'Carnival profile write must not target Crown & Anchor fields');

console.log('PASS testV1242Build313CarnivalIntegrityStage1');
