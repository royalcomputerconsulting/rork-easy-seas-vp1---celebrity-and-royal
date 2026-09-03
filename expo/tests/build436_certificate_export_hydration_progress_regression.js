const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const provider = read('state/CertificatesProvider.tsx');
const settings = read('app/(tabs)/settings.tsx');
const exporter = read('lib/certificates/certificateCsvZipExport.ts');

const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

assert(provider.includes('loadSearchableCertificates: () => Promise<Certificate[]>'), 'CertificatesProvider must expose explicit export hydration');
assert(provider.includes("await loadCertificateDocuments({ force: true })"), 'Export hydration must load retained certificate documents without mounting the Certificates page');
assert(provider.includes('certificateDocumentsRef.current = documents'), 'Hydrated document rows must be immediately available to the awaiting exporter');
assert(settings.includes('const exportCertificates = await loadSearchableCertificates()'), 'Settings export must await durable certificate hydration');
assert(settings.includes('Loaded ${exportCertificates.length.toLocaleString()} certificates'), 'Settings must show loaded certificate and row counts');
assert(settings.includes('progress: certificateExportProgress'), 'The export action row must receive visible progress');
assert(exporter.includes("stage: 'compressing'"), 'ZIP generation must publish a compression stage');
assert(exporter.includes('metadata.percent'), 'ZIP generation must publish real JSZip percentage progress');
assert(exporter.includes("stage: 'sharing'"), 'Export must report share-sheet and ready stages');

console.log('Build 436 certificate export hydration/progress regression passed');
