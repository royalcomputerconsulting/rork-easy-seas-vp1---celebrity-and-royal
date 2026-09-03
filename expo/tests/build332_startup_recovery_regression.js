const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');

const root = path.resolve(__dirname, '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

function compileTs(relativePath, stubs = {}) {
  const filename = path.join(root, relativePath);
  const source = fs.readFileSync(filename, 'utf8');
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.ReactJSX,
      esModuleInterop: true,
    },
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
    mod._compile(compiled, filename);
    return mod.exports;
  } finally {
    Module._load = originalLoad;
  }
}

async function verifyAuthStartupIsLocalFirst() {
  const state = [];
  const effects = [];
  const reactStub = {
    useState(initial) {
      const index = state.length;
      state.push(initial);
      return [state[index], (value) => {
        state[index] = typeof value === 'function' ? value(state[index]) : value;
      }];
    },
    useRef(initial) { return { current: initial }; },
    useCallback(fn) { return fn; },
    useEffect(effect) {
      const cleanup = effect();
      if (typeof cleanup === 'function') effects.push(cleanup);
    },
  };

  const values = new Map([
    ['easyseas_authenticated', 'true'],
    ['easyseas_auth_email', 'scott.merlis1@gmail.com'],
    ['easyseas_fresh_start', 'false'],
    ['email-whitelist-global', JSON.stringify(['scott.merlis1@gmail.com'])],
    ['email-whitelist-legacy', JSON.stringify(['scott.merlis1@gmail.com'])],
  ]);
  const asyncStorage = {
    getItem: async (key) => values.get(key) ?? null,
    setItem: async (key, value) => { values.set(key, value); },
    removeItem: async (key) => { values.delete(key); },
    clear: async () => { values.clear(); },
  };
  let cloudWhitelistCalls = 0;
  const trpcClient = {
    access: {
      getWhitelist: {
        query: () => {
          cloudWhitelistCalls += 1;
          return Promise.reject(new Error('startup must not call backend'));
        },
      },
      addToWhitelist: { mutate: async () => ({}) },
      removeFromWhitelist: { mutate: async () => ({}) },
    },
  };
  let providerFactory;
  const createContextHook = (factory) => {
    providerFactory = factory;
    return [function Provider() {}, function useContext() {}];
  };
  compileTs('state/AuthProvider.tsx', {
    react: reactStub,
    '@react-native-async-storage/async-storage': { __esModule: true, default: asyncStorage },
    '@nkzw/create-context-hook': { __esModule: true, default: createContextHook },
    '@/lib/storage/storageKeys': {
      STORAGE_KEYS: {
        EMAIL_WHITELIST_GLOBAL: 'email-whitelist-global',
        EMAIL_WHITELIST: 'email-whitelist-legacy',
        EMAIL_WHITELIST_PENDING: 'email-whitelist-pending',
        HAS_LAUNCHED_BEFORE: 'has-launched-before',
      },
    },
    '@/lib/trpc': { trpcClient },
    '@/lib/auth/deviceCredential': {
      authenticateDeviceCredentialWithBiometrics: async () => ({ success: false, error: 'unavailable' }),
      getDeviceCredentialMode: async () => 'create',
      getDeviceCredentialRole: async () => 'owner',
      hasDeviceCredential: async () => false,
      moveDeviceCredential: async () => {},
      reserveLegacyOwner: async () => {},
      verifyOrCreateDeviceCredential: async () => ({ success: true, role: 'owner' }),
    },
  });

  assert.equal(typeof providerFactory, 'function', 'AuthProvider hook factory must be captured');
  const originalWarn = console.warn;
  console.warn = () => {};
  providerFactory();
  await new Promise((resolve) => setTimeout(resolve, 20));
  assert.equal(state[1], false, 'auth loading must finish from local storage before the cloud whitelist request settles');
  assert.equal(state[0], true, 'persisted authenticated state must be restored locally');
  assert.equal(state[3], 'scott.merlis1@gmail.com', 'persisted email must be restored locally');
  assert.equal(state[5], true, 'local whitelist access must be available at startup');
  await new Promise((resolve) => setTimeout(resolve, 40));
  assert.equal(cloudWhitelistCalls, 0, 'startup must not issue any backend whitelist request');
  effects.reverse().forEach((cleanup) => cleanup());
  console.warn = originalWarn;
}

(async () => {
  const auth = read('state/AuthProvider.tsx');
  assert.match(auth, /AUTH_BOOTSTRAP_TIMEOUT_MS = 3500/);
  assert.match(auth, /AUTH_BOOTSTRAP_WATCHDOG_MS = 4500/);
  assert.match(auth, /Loaded local auth state without waiting for the network/);
  assert.match(auth, /no backend refresh was started/);
  assert.doesNotMatch(auth, /refreshWhitelistInBackground\(bootstrapEmail\)/);
  assert.match(auth, /Startup watchdog released the splash screen/);
  const checkAuthenticationBody = auth.slice(auth.indexOf('const checkAuthentication'), auth.indexOf('const initializeAuth'));
  assert.doesNotMatch(checkAuthenticationBody, /await checkWhitelistStatus/);
  assert.doesNotMatch(checkAuthenticationBody, /trpcClient\.access\.getWhitelist/);

  const splash = read('components/WelcomeSplash.tsx');
  assert.match(splash, /onAnimationCompleteRef/);
  assert.match(splash, /\[fadeAnim, duration\]/);
  assert.doesNotMatch(splash, /\[fadeAnim, duration, onAnimationComplete\]/);

  const userDataSync = read('state/UserDataSyncProvider.tsx');
  assert.match(userDataSync, /Local device storage is the startup authority/);
  assert.match(userDataSync, /setInitialCheckComplete\(true\)/);

  const layout = read('app/_layout.tsx');
  assert.match(layout, /duration=\{1800\}/);
  assert.match(layout, /ignoreSplashCompletion/);
  assert.match(layout, /<AuthenticatedProviderTree \/>/);

  await verifyAuthStartupIsLocalFirst();
  console.log('PASS build332_startup_recovery_regression — startup never calls the cloud whitelist and animation no longer restarts on callback identity');
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
