const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');

const root = path.resolve(__dirname, '..');
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');

function compileTs(relativePath, stubs) {
  const filename = path.join(root, relativePath);
  const compiled = ts.transpileModule(read(relativePath), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
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

(async () => {
  const auth = read('state/AuthProvider.tsx');
  const login = read('components/LoginScreen.tsx');
  const settings = read('app/(tabs)/settings.tsx');
  const pkg = JSON.parse(read('package.json'));
  const app = JSON.parse(read('app.json')).expo;

  assert.doesNotMatch(auth, /ADMIN_PASSWORD/, 'administrator password must not be compiled into the mobile app');
  assert.doesNotMatch(login, /admin password/i, 'login UI must not expose a special embedded administrator password path');
  assert.match(auth, /verifyOrCreateDeviceCredential/);
  assert.match(auth, /authenticateDeviceCredentialWithBiometrics/);
  assert.match(login, /Create Secure Access/);
  assert.match(login, /easyseas-biometric-unlock/);
  assert.match(auth, /DEVICE_CREDENTIAL_TIMEOUT_MS/, 'secure storage must be bounded during startup');
  assert.match(auth, /requiresCredentialEnrollment/);
  assert.match(settings, /secure-access-settings-card/);
  assert.match(settings, /device-pin-enrollment-modal/);
  assert.equal(pkg.dependencies['expo-secure-store'], '~15.0.8');
  assert.equal(pkg.dependencies['expo-local-authentication'], '~17.0.8');
  assert.ok(app.plugins.some((plugin) => Array.isArray(plugin) && plugin[0] === 'expo-secure-store'));
  assert.ok(app.plugins.some((plugin) => Array.isArray(plugin) && plugin[0] === 'expo-local-authentication'));

  const secrets = new Map();
  let biometricCalls = 0;
  const secureStore = {
    AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY: 'after-first-unlock-this-device-only',
    isAvailableAsync: async () => true,
    getItemAsync: async (key) => secrets.get(key) ?? null,
    setItemAsync: async (key, value) => { secrets.set(key, value); },
    deleteItemAsync: async (key) => { secrets.delete(key); },
  };
  const localAuthentication = {
    hasHardwareAsync: async () => true,
    isEnrolledAsync: async () => true,
    authenticateAsync: async () => { biometricCalls += 1; return { success: true }; },
  };
  const device = compileTs('lib/auth/deviceCredential.ts', {
    'react-native': { Platform: { OS: 'ios' } },
    'expo-secure-store': secureStore,
    'expo-local-authentication': localAuthentication,
  });

  assert.equal(await device.getDeviceCredentialMode('owner@example.com'), 'create');
  assert.deepEqual(await device.verifyOrCreateDeviceCredential('owner@example.com', '123'), { success: false, error: 'invalid_pin' });

  const owner = await device.verifyOrCreateDeviceCredential('owner@example.com', '123456');
  assert.equal(owner.success, true);
  assert.equal(owner.created, true);
  assert.equal(owner.role, 'owner');
  assert.equal(await device.getDeviceCredentialMode('owner@example.com'), 'unlock');

  const incorrect = await device.verifyOrCreateDeviceCredential('owner@example.com', '654321');
  assert.equal(incorrect.success, false);
  assert.equal(incorrect.error, 'incorrect_pin');
  const unlocked = await device.verifyOrCreateDeviceCredential('owner@example.com', '123456');
  assert.equal(unlocked.success, true);
  assert.equal(unlocked.role, 'owner');

  const member = await device.verifyOrCreateDeviceCredential('member@example.com', '987654');
  assert.equal(member.success, true);
  assert.equal(member.role, 'member');

  const biometric = await device.authenticateDeviceCredentialWithBiometrics('owner@example.com');
  assert.equal(biometric.success, true);
  assert.equal(biometric.role, 'owner');
  assert.equal(biometricCalls, 1);

  console.log('PASS build395_device_access_regression — credentials are device protected, owner role is stored outside email identity, biometric unlock works, and no administrator password is bundled');
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
