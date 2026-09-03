const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');

const root = path.resolve(__dirname, '..');
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');
const filename = path.join(root, 'lib/analytics/hostMeetingBrief.ts');
const output = ts.transpileModule(read('lib/analytics/hostMeetingBrief.ts'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }, fileName: filename }).outputText;
const originalLoad = Module._load;
Module._load = function patchedLoad(request, parent, isMain) {
  if (request === '@/types/models' || request === '@/state/CasinoSessionProvider' || request === '@/components/CertificateManagerModal') return {};
  return originalLoad.call(this, request, parent, isMain);
};
let lib;
try { const mod = new Module(filename, module); mod.filename = filename; mod.paths = Module._nodeModulePaths(path.dirname(filename)); mod._compile(output, filename); lib = mod.exports; } finally { Module._load = originalLoad; }

const brief = lib.buildCasinoHostMeetingBrief({
  profile: { displayName: 'Scott', email: 'scott@example.com', clubRoyaleId: 'CR123', clubRoyaleTier: 'Signature' },
  bookedCruises: [
    { id: 'past', shipName: 'Icon of the Seas', sailDate: '2026-07-01', returnDate: '2026-07-08', nights: 7, status: 'completed', pointsEarned: 4200, coinIn: 21000, theoreticalLoss: 1680, cashResult: -900, hoursPlayed: 18, casinoOpenDays: 6, offerCode: '26ABC', reservationNumber: 'SECRET', calculationConfidence: 'actual', instantCertificateWon: true, instantCertificateOfferCode: '2607C05', instantCertificateValue: 1500 },
    { id: 'future', shipName: 'Harmony of the Seas', sailDate: '2026-09-10', returnDate: '2026-09-15', nights: 5, offerCode: '26NEXT', reservationNumber: 'FUTURE' },
  ],
  sessions: [], certificates: [], request: 'Please review upgrade consideration.', now: new Date('2026-08-21T12:00:00Z'),
  redaction: { identity: true, loyaltyIds: true, cashResults: true, reservationNumbers: true },
});
assert.equal(brief.points, 4200);
assert.equal(brief.coinIn, 21000);
assert.equal(brief.theoreticalLoss, 1680);
assert.equal(brief.averagePointsPerDay, 700);
assert.equal(brief.certificatesEarned[0].code, '2607C05');
assert.equal(brief.bookedOfferCount, 1);
assert.equal(brief.upcomingCruises.length, 1);
assert.ok(brief.sourceNotes.some((note) => /never converts points to coin-in/i.test(note)));
const html = lib.buildCasinoHostBriefHtml(brief);
assert.match(html, /Specific request for the host/);
assert.doesNotMatch(html, /scott@example\.com|CR123|SECRET|FUTURE|\-\$900/, 'redacted PDF must not contain protected values');
assert.match(html, /Redacted/);

const screen = read('app/casino/host-meeting-brief.tsx');
const analytics = read('app/(tabs)/analytics.tsx');
assert.match(screen, /host-brief-safe-share/);
assert.match(screen, /host-brief-export-pdf/);
assert.match(screen, /Specific request to make/);
assert.match(analytics, /casino-host-meeting-brief/);

console.log('PASS build402_casino_host_meeting_brief_regression — factual points/coin-in/theo/ADT inputs, certificate and offer history, upcoming trips, specific ask, source labels, redaction, and PDF export verified');
