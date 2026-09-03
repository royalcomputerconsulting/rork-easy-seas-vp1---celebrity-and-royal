const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),Module=require('node:module'),ts=require('typescript');
const root=path.resolve(__dirname,'..'),file=path.join(root,'lib/backup/incrementalEncryptedBackup.ts');
let source=fs.readFileSync(file,'utf8').replace("import { getHealthTrustDatabase, HEALTH_TRUST_SCHEMA_VERSION } from '@/lib/database/HealthTrustDatabase';","const HEALTH_TRUST_SCHEMA_VERSION=4; const getHealthTrustDatabase=async()=>({withTransactionAsync:async(fn)=>fn(),runAsync:async()=>undefined});");
const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,mod=new Module(file,module);mod.filename=file;mod.paths=Module._nodeModulePaths(path.dirname(file));mod._compile(js,file);const x=mod.exports;
(async()=>{
  const first=await x.createIncrementalEncryptedBackup({ownerId:'u',appVersion:'13.0.73',password:'correct horse battery',datasets:{cruises:{a:{points:1},b:{points:2}}}});
  assert.equal(first.envelope.manifest.kind,'full');assert.equal(first.envelope.records.length,2);
  const second=await x.createIncrementalEncryptedBackup({ownerId:'u',appVersion:'13.0.73',password:'correct horse battery',recoveryKey:first.recoveryKey,previousChain:[first.envelope],datasets:{cruises:{a:{points:3},b:{points:2}}}});
  assert.equal(second.envelope.manifest.kind,'incremental');assert.equal(second.envelope.records.length,1,'unchanged rows must not be rewritten');assert.equal(second.envelope.records[0].operation,'update');
  const raw=x.serializeBackupArchive([first.envelope,second.envelope]),archive=x.parseBackupArchive(raw);
  const passwordData=await x.decryptBackupArchive(archive,'correct horse battery');assert.deepEqual(passwordData.cruises,{a:{points:3},b:{points:2}});
  const recoveryData=await x.decryptBackupArchive(archive,first.recoveryKey,'recovery-key');assert.deepEqual(recoveryData,passwordData,'one recovery key must unlock the whole exported chain');
  const preview=x.previewBackupDatasetMap({cruises:{a:{points:3},c:{points:9}}},passwordData,'b2');assert.equal(preview.totals.add,1);assert.equal(preview.totals.preserve,1);assert.equal(preview.totals.delete,1);assert.equal(preview.requiresConfirmation,true);
  console.log('Build 439 encrypted backup runtime round-trip regression passed');
})().catch(error=>{console.error(error);process.exitCode=1});
