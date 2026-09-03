const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),ts=require('typescript');
const root=path.resolve(__dirname,'..'),read=p=>fs.readFileSync(path.join(root,p),'utf8');
const repo=read('lib/cruiseInventory/CruiseInventoryRepository.ts'),screen=read('app/sync-change-history.tsx'),center=read('app/operating-center.tsx');
assert.match(repo,/SCHEMA_VERSION = 3/);
assert.match(repo,/CREATE TABLE IF NOT EXISTS cruise_inventory_changes/);
assert.match(repo,/CREATE TABLE IF NOT EXISTS cruise_sync_reports/);
assert.match(repo,/present-in-new-provider-capture-only/);
assert.match(repo,/absent-from-complete-new-provider-capture/);
assert.match(repo,/CATALOG_EXPECTED_ROW_MISMATCH/);
assert.match(repo,/CATALOG_READBACK_MISMATCH/);
assert.match(repo,/getSyncReports/);assert.match(repo,/getSyncChanges/);
assert.match(screen,/added/);assert.match(screen,/removed/);assert.match(screen,/rejected/);assert.match(screen,/preserved/);
assert.match(screen,/Incomplete captures preserve the prior active catalog/);
assert.match(center,/id: 29/);assert.match(center,/id: 30/);
for(const file of ['lib/cruiseInventory/CruiseInventoryRepository.ts','app/sync-change-history.tsx','app/operating-center.tsx']){const out=ts.transpileModule(read(file),{compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2020},reportDiagnostics:true});const errors=(out.diagnostics||[]).filter(d=>d.category===ts.DiagnosticCategory.Error);assert.equal(errors.length,0,`${file}: ${errors.map(e=>ts.flattenDiagnosticMessageText(e.messageText,' ')).join('; ')}`)}
console.log('Build 438 items 29-30 sync history regression passed');
