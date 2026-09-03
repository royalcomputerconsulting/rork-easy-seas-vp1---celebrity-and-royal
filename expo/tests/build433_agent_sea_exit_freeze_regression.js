const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

const provider = read('state/AgentXProvider.tsx');
assert.match(provider, /if \(!isVisible\) \{[\s\S]*?return undefined;[\s\S]*scheduleAgentSeaSourceManifestRebuild/,
  'the tens-of-thousands-row source manifest must not rebuild after Agent SEA closes');
assert.match(provider, /catalogSearchRequestRef\.current \+= 1;/,
  'closing Agent SEA must invalidate repository searches');
assert.match(provider, /activeAIRequestRef\.current\?\.abort\(\);/,
  'closing Agent SEA must abort an in-flight AI request');
assert.match(provider, /if \(activeRequest\.signal\.aborted \|\| !visibleRef\.current\) return;/,
  'an answer finishing after navigation must not update the closed screen');

const registry = read('lib/agentSea/sourceRegistry.ts');
assert.match(registry, /cancelIdleCallback/,
  'idle source-manifest work must be actually cancelled, not merely invalidated after it runs');

const screen = read('app/ask-my-data.tsx');
assert.match(screen, /const leaveAgentSea = useCallback/);
assert.match(screen, /Keyboard\.dismiss\(\);[\s\S]*setVisible\(false\);[\s\S]*router\.back\(\);/,
  'the close button must tear down Agent SEA before starting back navigation');
assert.match(screen, /onPress=\{leaveAgentSea\}/);

const ai = read('lib/agentSeaAI.ts');
assert.match(ai, /signal\?: AbortSignal/);
assert.match(ai, /request\.signal\?\.addEventListener\('abort'/);
assert.match(ai, /request\.signal\?\.removeEventListener\('abort'/);

const app = JSON.parse(read('app.json')).expo;
const pkg = JSON.parse(read('package.json'));
assert.equal(app.version, '13.0.67');
assert.equal(String(app.ios.buildNumber), '433');
assert.equal(app.android.versionCode, 130099);
assert.equal(pkg.version, '13.0.67');

console.log('PASS Build 433 Agent SEA exit cancellation and navigation freeze regression');
