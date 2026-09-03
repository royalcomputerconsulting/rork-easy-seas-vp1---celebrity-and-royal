const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');

const root = path.resolve(__dirname, '..');
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');

function compileTs(relativePath, stubs) {
  const filename = path.join(root, relativePath);
  const output = ts.transpileModule(read(relativePath), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
    fileName: filename,
  }).outputText;
  const originalLoad = Module._load;
  Module._load = function patchedLoad(request, parent, isMain) {
    if (Object.prototype.hasOwnProperty.call(stubs, request)) return stubs[request];
    return originalLoad.call(this, request, parent, isMain);
  };
  try {
    const mod = new Module(filename, module);
    mod.filename = filename;
    mod.paths = Module._nodeModulePaths(path.dirname(filename));
    mod._compile(output, filename);
    return mod.exports;
  } finally {
    Module._load = originalLoad;
  }
}

function dateOnly(value) {
  return String(value ?? '').match(/^(\d{4}-\d{2}-\d{2})/)?.[1];
}
function addDays(value, amount) {
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + amount));
  return date.toISOString().slice(0, 10);
}

const planner = compileTs('lib/notifications/cruiseNotificationPlan.ts', {
  '@/types/models': {},
  '@/lib/date': {
    toCalendarDateOnly: dateOnly,
    toLocalCalendarDateOnly: () => '2026-08-21',
    addCalendarDateDays: addDays,
  },
});

const plan = planner.buildVoyageNotificationPlan({
  now: new Date(2026, 7, 21, 8, 0, 0),
  bookedCruises: [{
    id: 'booking-1', shipName: 'Harmony of the Seas', sailDate: '2026-09-10', returnDate: '2026-09-15',
    departurePort: 'Miami', destination: 'Bahamas', nights: 5, checkInDate: '2026-08-01', balanceDueDate: '2026-09-01', balanceDue: 450,
  }],
  offers: [{ id: 'offer-1', title: 'Balcony Offer', offerType: 'comped', offerCode: '26ABC', expiryDate: '2026-08-30', status: 'active' }],
  certificates: [
    { id: 'cert-1', type: 'freeplay', label: '2608A01', value: 500, expiryDate: '2026-09-05', status: 'available' },
    { id: 'cert-used', type: 'freeplay', label: 'USED', value: 100, expiryDate: '2026-09-05', status: 'used' },
  ],
});

assert.equal(plan.length, 5, 'past check-in and used certificate reminders must be omitted');
assert.equal(new Set(plan.map((item) => item.id)).size, plan.length, 'every reminder must have a stable unique ID');
assert.ok(plan.every((item) => item.id.startsWith('easyseas-voyage:')));
assert.ok(plan.some((item) => item.kind === 'final_payment' && /\$450/.test(item.body)));
assert.ok(plan.some((item) => item.kind === 'offer_expiry' && item.route.includes('offer-details')));
assert.ok(plan.some((item) => item.kind === 'certificate_expiry' && item.route === '/certificate-lookup'));
assert.deepEqual(plan.map((item) => item.triggerAt), [...plan].map((item) => item.triggerAt).sort(), 'reminders must be ordered by trigger time');

const app = JSON.parse(read('app.json')).expo;
const pkg = JSON.parse(read('package.json'));
const settings = read('app/(tabs)/settings.tsx');
const observer = read('components/VoyageNotificationObserver.tsx');
const service = read('lib/notifications/localVoyageNotifications.ts');
assert.equal(pkg.dependencies['expo-notifications'], '~0.32.17');
assert.ok(app.plugins.some((plugin) => Array.isArray(plugin) && plugin[0] === 'expo-notifications'));
assert.match(settings, /voyage-notifications-toggle/);
assert.match(settings, /requestVoyageNotificationPermission/);
assert.match(observer, /searchableCertificates/);
assert.match(observer, /reconcileVoyageNotifications/);
assert.doesNotMatch(service, /cancelAllScheduledNotificationsAsync/, 'Easy Seas must never cancel notifications owned by other apps/features');
assert.match(service, /isEasySeasVoyageNotificationId/);

console.log('PASS build397_voyage_notifications_regression — opt-in permissions, bounded deterministic planning, certificate/offer/cruise deadlines, owned-only cancellation, and actionable routes verified');
