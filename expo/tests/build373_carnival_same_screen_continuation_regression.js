const fs = require('fs');
const path = require('path');
const ts = require('typescript');

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const assert = (condition, message) => { if (!condition) throw new Error(message); };

const screen = read('app/carnival-sync.tsx');
const boundary = read('state/CarnivalSyncProvider.tsx');
const provider = read('state/RoyalCaribbeanSyncProvider.tsx');

for (const marker of ['Logged In — Ready to Sync', 'Press SYNC NOW once when you are ready', 'carnival-login-ready-banner']) {
  assert(screen.includes(marker), `Carnival explicit-start marker missing: ${marker}`);
}
for (const forbidden of ['autoSyncAttemptInFlightRef', 'autoSyncSnapshotRef', 'setInterval(attemptStart', 'continuing sync on this screen']) {
  assert(!screen.includes(forbidden), `Carnival must not auto-start after login: ${forbidden}`);
}
assert(
  boundary.includes('const runIngestion = useCallback(') && boundary.includes('[requireCarnivalAccess, runtime.runIngestion]'),
  'Carnival boundary must retain a stable guarded ingestion callback',
);
assert(
  provider.includes("compatibility.state === 'authentication_required' && hasAuthenticatedCarnivalSession"),
  'A confirmed Carnival session must survive a transient stale readiness probe',
);
assert(
  provider.includes("status: 'logged_in', error: null"),
  'Transient Carnival readiness must remain retryable on the same screen',
);

for (const file of [
  'app/carnival-sync.tsx',
  'state/CarnivalSyncProvider.tsx',
  'state/RoyalCaribbeanSyncProvider.tsx',
]) {
  const result = ts.transpileModule(read(file), {
    compilerOptions: {
      jsx: ts.JsxEmit.ReactJSX,
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2020,
    },
    fileName: file,
    reportDiagnostics: true,
  });
  const errors = (result.diagnostics || []).filter((item) => item.category === ts.DiagnosticCategory.Error);
  assert(
    errors.length === 0,
    `${file} has syntax diagnostics: ${errors.map((item) => ts.flattenDiagnosticMessageText(item.messageText, ' ')).join('; ')}`,
  );
}

console.log('PASS Carnival login reaches a same-screen ready state and waits for explicit Sync Now');
