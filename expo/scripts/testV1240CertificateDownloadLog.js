const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

const app = JSON.parse(read('app.json'));
const pkg = JSON.parse(read('package.json'));
const logger = read('lib/certificates/certificateDownloadLogger.ts');
const panel = read('components/certificates/CertificateDownloadLogPanel.tsx');
const batch = read('lib/certificates/certificateBatchDownload.ts');
const codes = read('app/certificate-codes.tsx');
const lookup = read('app/certificate-lookup.tsx');

assert(app.expo.version === '12.4.2', 'App version must be 12.4.2');
assert(app.expo.ios.buildNumber === '314', 'iOS build number must be 314');
assert(app.expo.android.versionCode === 120405, 'Android version code must be 120405');
assert(pkg.version === '12.4.2', 'Package version must be 12.4.2');
assert(logger.includes('v12.4.0-certificate-download-live-log-export'), 'Certificate log runtime marker missing');
assert(logger.includes('getLogsAsText'), 'Certificate logger must support text export');
assert(logger.includes('currentCertificateCodes'), 'Certificate logger must track current certificate codes');
assert(batch.includes('Downloading ${codes.join'), 'Batch downloader must report the certificate codes currently downloading');
assert(batch.includes('Retrying ${entry.certificateCode} individually'), 'Individual retry activity must be logged');
assert(batch.includes('certificateDownloadLogger.finish'), 'Certificate download completion must be logged');
assert(panel.includes('Export Certificate Download Log'), 'Certificate log must be exportable');
assert(panel.includes('Certificate download status'), 'Certificate download status blurb missing');
assert(panel.includes('Certificate Log'), 'Certificate log UI missing');
assert(codes.includes('<CertificateDownloadLogPanel'), 'Certificate Codes screen must show the log panel');
assert(lookup.includes('<CertificateDownloadLogPanel'), 'Certificate Lookup screen must show the log panel');
assert(codes.includes('resetLog: true'), 'Download All must start a fresh log session');
assert(codes.includes('resetLog: false'), 'Single-code downloads must append to the current log');

console.log('PASS testV1240CertificateDownloadLog');
