const fs = require('fs');
const path = require('path');
const os = require('os');
const vm = require('vm');

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const readJson = (file) => JSON.parse(read(file));
function assert(condition, message) { if (!condition) throw new Error(message); }

let ts;
try { ts = require('typescript'); }
catch { ts = require('/opt/nvm/versions/node/v22.16.0/lib/node_modules/typescript'); }

function transpile(relative, tempRoot) {
  const sourcePath = path.join(root, relative);
  const output = ts.transpileModule(fs.readFileSync(sourcePath, 'utf8'), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      jsx: ts.JsxEmit.ReactJSX,
      esModuleInterop: true,
    },
    fileName: sourcePath,
    reportDiagnostics: true,
  });
  const errors = (output.diagnostics || []).filter((item) => item.category === ts.DiagnosticCategory.Error);
  assert(errors.length === 0, `Syntax diagnostics while compiling ${relative}: ${errors.map((item) => ts.flattenDiagnosticMessageText(item.messageText, ' ')).join('; ')}`);
  const outputPath = path.join(tempRoot, relative.replace(/\.tsx?$/, '.js'));
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, output.outputText);
}

async function executeProbe(probeSource, input) {
  let posted = null;
  const response = input.response;
  const context = {
    window: {
      location: { href: input.url || 'https://www.carnival.com/profilemanagement/profiles/cruises' },
      ReactNativeWebView: { postMessage: (value) => { posted = JSON.parse(value); } },
      fetch: async () => response,
    },
    document: {
      body: { innerText: input.bodyText || 'My Cruises' },
      cookie: input.cookie || '',
      querySelector: () => input.hasPassword ? {} : null,
    },
    AbortController,
    Date,
    JSON,
    Object,
    Array,
    Number,
    String,
    RegExp,
    Promise,
    setTimeout,
    clearTimeout,
    console,
  };
  vm.createContext(context);
  vm.runInContext(probeSource, context);
  for (let index = 0; index < 40 && !posted; index += 1) {
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  assert(posted, 'Carnival authentication probe did not return a bridge result');
  return posted;
}

async function main() {
  const app = readJson('app.json');
  assert(app.expo.version === '12.4.2', 'Marketing version must remain 12.4.2');
  assert(app.expo.ios.buildNumber === '314', 'Original iOS buildNumber must remain 314');
  assert(app.expo.android.versionCode === 120405, 'Original Android versionCode must remain 120405');

  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'easyseas-carnival-auth-fix-'));
  for (const relative of [
    'lib/carnival/carnivalDataRuntime.ts',
    'lib/carnival/carnivalInventoryRuntime.ts',
    'lib/carnival/carnivalSafeSync.ts',
    'lib/royalCaribbean/authDetection.ts',
    'state/RoyalCaribbeanSyncProvider.tsx',
  ]) transpile(relative, tempRoot);

  const safeSync = require(path.join(tempRoot, 'lib/carnival/carnivalSafeSync.js'));
  const authDetection = require(path.join(tempRoot, 'lib/royalCaribbean/authDetection.js'));
  const probe = safeSync.injectCarnivalAuthenticationProbe('auth-request', 'auth-run');
  new Function(probe);
  new Function(authDetection.AUTH_DETECTION_SCRIPT);

  assert(probe.includes('/profilemanagement/api/v1.0/Profiles'), 'Auth probe must call Carnival protected Profiles API');
  assert(probe.includes("credentials: 'include'"), 'Auth probe must use the authenticated WebView cookie jar');
  assert(probe.includes("source: source || 'unknown'"), 'Auth probe must return diagnostic verification source');
  assert(probe.includes('__easySeasCarnivalAuthProbeInFlight'), 'Auth probe must be isolated from booking extraction');

  const authenticated = await executeProbe(probe, {
    response: {
      ok: true,
      status: 200,
      url: 'https://www.carnival.com/profilemanagement/api/v1.0/Profiles',
      headers: { get: () => 'application/json' },
      text: async () => JSON.stringify({ bookings: [{ shipName: 'Carnival Panorama' }] }),
    },
  });
  assert(authenticated.authenticated && authenticated.source === 'protected_profile_api', 'A valid protected Profiles API response must verify login');

  const rejected = await executeProbe(probe, {
    response: {
      ok: false,
      status: 401,
      url: 'https://www.carnival.com/profilemanagement/api/v1.0/Profiles',
      headers: { get: () => 'application/json' },
      text: async () => JSON.stringify({ message: 'Unauthorized' }),
    },
  });
  assert(!rejected.authenticated && rejected.source === 'protected_profile_api_rejected', 'HTTP 401 from protected Profiles API must remain login expired');

  const visibleLogin = await executeProbe(probe, {
    url: 'https://www.carnival.com/login',
    bodyText: 'Please sign in',
    hasPassword: true,
    response: null,
  });
  assert(!visibleLogin.authenticated && visibleLogin.source === 'explicit_login_page', 'Visible Carnival login page must override any stale evidence');

  const authSource = read('lib/royalCaribbean/authDetection.ts');
  for (const marker of [
    'isCarnivalProtectedProfileApiUrl',
    'markCarnivalProtectedApiAuthenticated',
    '__easySeasCarnivalApiAuthenticatedAt',
    'carnivalRecentProtectedApi',
    'carnivalAuthProbeRequest',
  ]) assert(authSource.includes(marker), `Auth detector missing false-negative repair marker: ${marker}`);

  const provider = read('state/RoyalCaribbeanSyncProvider.tsx');
  for (const marker of [
    'injectCarnivalAuthenticationProbe',
    'CarnivalAuthProbeResult',
    'Ignoring weaker DOM auth false-negative after protected profile API verification',
    'Carnival authentication preflight passed via',
  ]) assert(provider.includes(marker), `Provider missing protected-profile auth repair marker: ${marker}`);
  assert(!provider.includes('post(!hasPassword && !loginRoute && profileRoute && (userCookie || accountEvidence))'), 'Old cookie/DOM-only Carnival verifier must be removed');

  const packageJson = readJson('package.json');
  assert(packageJson.dependencies['react'] === '19.1.0', 'React dependency must remain unchanged');
  assert(packageJson.dependencies['react-native'] === '0.81.5', 'React Native dependency must remain unchanged');
  assert(packageJson.packageManager === 'bun@1.3.13', 'Bun package-manager declaration must remain unchanged');
  assert(!fs.existsSync(path.join(root, 'package-lock.json')), 'No npm lockfile may be introduced');
  assert(!fs.existsSync(path.join(root, 'bun.lock')), 'No new Bun lockfile may be introduced');
  assert(!fs.existsSync(path.join(root, '.github', 'workflows')), 'No CI/workflow files may be introduced');

  console.log('PASS testV1242Build314CarnivalAuthFalseNegativeFix');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
