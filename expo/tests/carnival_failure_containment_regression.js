const assert = require('node:assert/strict');
const fs = require('node:fs');

const provider = fs.readFileSync('state/RoyalCaribbeanSyncProvider.tsx', 'utf8');

assert.match(provider, /const preserveCarnivalFailureCheckpoint = useCallback/);
assert.match(provider, /Promise<'saved' \| 'owner_changed' \| 'failed'>/);
assert.match(provider, /'cancelled_ingestion'/);
assert.match(provider, /'failed_ingestion'/);
assert.match(provider, /'application_persistence'/);
assert.match(provider, /if \(isCarnivalMode\) \{[\s\S]{0,900}preserveCarnivalFailureCheckpoint/);
assert.match(provider, /if \(syncSource === 'carnival'\) \{[\s\S]{0,900}preserveCarnivalFailureCheckpoint/);
assert.match(provider, /return saved \? 'saved' : 'owner_changed'/);
assert.match(provider, /hasResumableCarnivalCheckpoint: true/);

console.log('Carnival failure containment regression checks passed');
