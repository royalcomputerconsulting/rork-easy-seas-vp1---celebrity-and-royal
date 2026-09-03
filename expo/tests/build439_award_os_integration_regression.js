const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),ts=require('typescript');
const root=path.resolve(__dirname,'..'),read=p=>fs.readFileSync(path.join(root,p),'utf8');
const center=read('app/operating-center.tsx');for(let id=47;id<=50;id++)assert.match(center,new RegExp(`id: ${id}`));assert.match(center,/group: 'Trust'/);
const productivity=read('app/productivity-center.tsx');assert.match(productivity,/relationship-explorer/);assert.match(productivity,/action-inbox/);
const relationship=read('app/relationship-explorer.tsx');
const relationshipEngine=read('lib/relationships/relationshipGraph.ts');
const relationshipImplementation=`${relationship}\n${relationshipEngine}`;
for(const term of ['completed','points','certificate','offers','realized'])assert.match(relationshipImplementation,new RegExp(term,'i'));
assert.match(relationshipImplementation,/exact|inferred/);
assert.match(relationship,/buildRelationshipGraph/);
const inbox=read('app/action-inbox.tsx');for(const term of ['integrityIssuesToInbox','expir','incomplete','snooz','dedupe'])assert.match(inbox,new RegExp(term,'i'));
const settings=read('app/(tabs)/settings.tsx');assert.match(settings,/Data Trust Center/);assert.match(settings,/data-trust-center/);
const layout=read('app/_layout.tsx');assert.match(layout,/DataTrustObserver/);assert.match(layout,/<DataTrustObserver/);
for(const route of ['app/data-trust-center.tsx','app/relationship-explorer.tsx','app/action-inbox.tsx'])assert(fs.existsSync(path.join(root,route)),route);
for(const file of ['app/operating-center.tsx','app/productivity-center.tsx','app/relationship-explorer.tsx','app/action-inbox.tsx','lib/relationships/relationshipGraph.ts']){const out=ts.transpileModule(read(file),{compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022},reportDiagnostics:true});assert.equal((out.diagnostics||[]).filter(x=>x.category===ts.DiagnosticCategory.Error).length,0,file)}
console.log('Build 439 award-level OS integration regression passed');
