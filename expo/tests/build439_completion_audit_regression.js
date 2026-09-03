const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

for (const folder of ['app', 'components', 'state', 'lib', 'constants']) {
  const visit = (directory) => fs.readdirSync(directory, { withFileTypes: true }).forEach((entry) => {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) visit(target);
    else if (/\.(ts|tsx)$/.test(entry.name)) assert.ok(fs.statSync(target).size > 0, `${path.relative(root, target)} must not be empty`);
  });
  visit(path.join(root, folder));
}

const layout = read('app/_layout.tsx');
assert.match(layout, /ExperienceProvider/);
assert.match(layout, /reducedMotion/);
assert.match(layout, /ExperienceRootSurface/);
assert.match(layout, /contentStyle: \{ backgroundColor: colors\.background \}/);
const tabLayout = read('app/(tabs)/_layout.tsx');
assert.match(tabLayout, /useExperience/);
assert.match(tabLayout, /preferences\.reducedMotion/);
for (const sharedControl of ['components/ui/PressableCard.tsx', 'components/ui/ActionButton.tsx']) {
  assert.match(read(sharedControl), /useExperience/);
  assert.match(read(sharedControl), /reducedMotion/);
}
const legacyTheme = read('constants/theme.ts');
for (const color of ['#1C2F7A', '#0E7FA7', '#2C1D9A', '#273D9A', '#4EC0A5']) assert.match(legacyTheme, new RegExp(color));

const artworkConsumers = ['app/voyage-command-center.tsx', 'app/offer-details.tsx', 'components/VoyageWeatherSection.tsx', 'components/ClubRoyalePoints.tsx', 'components/casino/CasinoCommandCenter.tsx'];
for (const file of artworkConsumers) assert.match(read(file), /PremiumVoyageArtwork/, `${file} must consume voyage artwork`);
assert.match(read('components/certificates/CertificateDownloadLogPanel.tsx'), /AccessibleProgress|PurposefulSuccess/);
assert.match(read('components/casino/CasinoCommandCenter.tsx'), /AccessibleProgress/);

const provenanceConsumers = ['components/ClubRoyalePoints.tsx', 'components/SailingWeatherCard.tsx', 'app/offer-details.tsx', 'app/certificate-portfolio.tsx', 'components/casino/CasinoCommandCenter.tsx'];
for (const file of provenanceConsumers) assert.match(read(file), /EntityProvenanceDisclosure/, `${file} must expose field provenance`);

const integrity = read('lib/integrity/integrityCenter.ts');
for (const evidence of ['applyIntegrityRepair', 'integrity_quarantine', 'listRepairHistory', 'quarantine_orphan_link', 'request_loyalty_sync']) assert.match(integrity, new RegExp(evidence));
const trust = read('app/data-trust-center.tsx');
for (const evidence of ['Before', 'Proposed result', 'Preview and apply safe repair', 'Repair history', 'localChainUri', 'restoreUserPreferenceStorage']) assert.match(trust, new RegExp(evidence));
const healthTrustDatabase = read('lib/database/HealthTrustDatabase.ts');
assert.match(healthTrustDatabase, /HEALTH_TRUST_SCHEMA_VERSION = 6/);
assert.match(healthTrustDatabase, /migration-rollback-audit/);
assert.match(healthTrustDatabase, /migration_rollback_history/);
assert.match(read('lib/database/highVolumeMigration.ts'), /discoverProfileKeys/);
assert.doesNotMatch(read('components/DataTrustObserver.tsx'), /filter\(\(row\) => !row\.domain\.startsWith\('crew_'\)\)/);
const crew = read('state/CrewRecognitionProvider.tsx');
assert.match(crew, /BASE_STORAGE_KEY_STATS/);
assert.match(crew, /Imports launched from Settings must not leave the entire registry/);

const inbox = read('app/action-inbox.tsx');
for (const evidence of ['assignedOwnerId', 'bulkDecide', 'Select all', 'All profiles']) assert.match(inbox, new RegExp(evidence, 'i'));
const relationships = read('app/relationship-explorer.tsx');
assert.match(relationships, /relationshipCorrections/);
assert.match(relationships, /buildRelationshipGraph/);
assert.doesNotMatch(relationships, /\.slice\(-8\)|searchableCertificates\.slice\(0, 8\)|casinoOffers \?\? \[\]\)\.slice\(0, 6\)/);
const relationshipEngine = read('lib/relationships/relationshipGraph.ts');
for (const evidence of ['realized.?value', 'earned:', 'offer-link:', 'exact', 'inferred', 'corrections']) assert.match(relationshipEngine, new RegExp(evidence, 'i'));
const relationshipMap = read('components/ui/InteractiveRelationshipMap.tsx');
for (const evidence of ['Load 50 more relationships', 'Confirm link', 'Reject link', 'bounded to']) assert.match(relationshipMap, new RegExp(evidence));

const settings = read('app/(tabs)/settings.tsx');
for (const route of ['experience-settings', 'data-trust-center', 'relationship-explorer', 'action-inbox']) assert.match(settings, new RegExp(route));
const home = read('app/easy-seas-home.tsx');
for (const evidence of ['HOME_PRESETS', 'Move ${action.label} up', 'Resize ${action.label}', "hidden: !preset.visible.includes"]) assert.match(home, new RegExp(evidence.replace(/[${}]/g, '\\$&')));
const watchlists = read('app/saved-watchlists.tsx');
for (const evidence of ['reevaluateWatchlist', 'SAVED_WATCHLISTS', 'added', 'removed', 'paused']) assert.match(watchlists, new RegExp(evidence));
const compare = read('app/compare-workspace.tsx');
for (const evidence of ['compareCandidates', 'Choose 2–5 records', 'Not recorded', 'FlatList']) assert.match(compare, new RegExp(evidence));
const productivity = read('app/productivity-center.tsx');
assert.match(productivity, /\/saved-watchlists/); assert.match(productivity, /\/compare-workspace/);
const bundle = read('lib/dataBundle/bundleOperations.ts');
for (const evidence of ['userPreferences?:', 'exportUserPreferenceStorage', 'restoreUserPreferenceStorage']) assert.match(bundle, new RegExp(evidence.replace('?', '\\?')));
assert.match(read('lib/storage/storageKeys.ts'), /SAVED_WATCHLISTS/);

for (const file of ['app/_layout.tsx', 'app/(tabs)/_layout.tsx', 'app/action-inbox.tsx', 'app/relationship-explorer.tsx', 'app/data-trust-center.tsx', 'app/easy-seas-home.tsx', 'app/saved-watchlists.tsx', 'app/compare-workspace.tsx', 'components/ui/InteractiveRelationshipMap.tsx', 'components/ui/PressableCard.tsx', 'components/ui/ActionButton.tsx', 'state/CrewRecognitionProvider.tsx', 'lib/dataBundle/bundleOperations.ts', 'lib/integrity/integrityCenter.ts', 'lib/database/highVolumeMigration.ts', 'lib/relationships/relationshipGraph.ts']) {
  const result = ts.transpileModule(read(file), { compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 }, reportDiagnostics: true });
  assert.equal((result.diagnostics || []).filter((item) => item.category === ts.DiagnosticCategory.Error).length, 0, `${file} must transpile`);
}
console.log('Build 439 completion audit regression passed');
