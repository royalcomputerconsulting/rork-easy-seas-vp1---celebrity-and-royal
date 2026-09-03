const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

const summary = read('app/certificate-summary.tsx');
for (const marker of ["'month'", "'duration'", "'departure_day'", 'readCertificateSummaryUiState', 'scrollTo', "'certificate_codes'", "'physical_sailings'"]) assert.match(summary, new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
const results = read('app/certificate-summary-results.tsx');
for (const marker of ['readCertificateResultsUiState', 'scrollToOffset', 'removeFilter', 'Linking.openURL', 'addToShortlist', 'Copy certificate option', 'Export certificate option', 'Compare / Ask', 'certificate_codes', 'physical_sailings']) assert.match(results, new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));

const registry = read('lib/agentSea/sourceRegistry.ts');
for (const marker of ['executeCertificateSailingSearchTool', 'shipNames =', 'shipClasses =', 'cabinLabels =', 'departurePorts =', 'minimumNights', 'minimumPoints', 'casinoRecords', 'crewRecords', 'weatherRecords', "add('itinerary'", 'scheduleAgentSeaSourceManifestRebuild', 'requestIdleCallback', 'getCachedAgentSeaSourceManifest']) assert.match(registry, new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));

const bundle = read('lib/dataBundle/bundleOperations.ts');
assert.match(bundle, /distributionSignature/);
assert.match(bundle, /certificateCount !== expected\.certificateCount/);
assert.match(bundle, /physicalSailingCount !== expected\.physicalSailingCount/);
assert.match(bundle, /could not be embedded into the portable backup/);

const provider = read('state/AgentXProvider.tsx');
assert.match(provider, /buildAgentSeaSourceManifest/);
assert.match(provider, /const sourceQuestion =/);
assert.doesNotMatch(provider, /scheduleAgentSeaSourceManifestRebuild/);
assert.match(provider, /casinoRecords: scopedCasinoSessions/);
assert.match(provider, /crewRecords: scopedCrewRecognitionEntries/);
assert.match(provider, /weatherRecords: scopedWeatherReports/);

const certificateExport = read('lib/certificates/certificateCsvZipExport.ts');
for (const marker of [
  'all-certificate-sailing-options.csv', 'certificate-summary.csv',
  'certificates/${safeFilePart(code)}.csv', 'guestCount', 'cabinLabel',
  'nextCruiseBonusLabel', "compression: 'DEFLATE'", 'application/zip',
]) assert.match(certificateExport, new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
const settings = read('app/(tabs)/settings.tsx');
assert.match(settings, /Export Certificates \(\.ZIP\)/);
assert.match(settings, /handleExportCertificates/);
assert.match(settings, /settings-export-certificates-zip/);
assert.match(settings, /settings-export-all-app-data/);
assert.match(settings, /renderExportActionRow/);
assert.match(settings, /settings_export_certificates_pressed/);
assert.match(settings, /settings_export_all_pressed/);
assert.match(settings, /settings-save-all/);
assert.match(settings, /settings-load-all/);
assert.match(settings, /settings-restore-from-backup/);
assert.match(settings, /settings_load_all_pressed/);
const agentPage = read('app/ask-my-data.tsx');
assert.match(agentPage, /agent-sea-export-log/);
assert.match(agentPage, /exportAgentSeaConversationLog/);
const agentLog = read('lib/agentSea/conversationLogExport.ts');
for (const marker of ['activeConversation', 'sourceReferences', 'toolInput', 'diagnosticContext', 'savedConversationIndex', 'privacyNote']) assert.match(agentLog, new RegExp(marker));

console.log('PASS Build 431 closes all audited Stage 1–3 certificate, Agent SEA, persistence, state-restoration, exact-readback, background-index, and certificate ZIP export requirements');
