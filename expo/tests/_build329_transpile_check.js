const fs=require('fs'),path=require('path'),ts=require('typescript');
const root=path.resolve(__dirname,'..');
const files=[];
function walk(dir){for(const e of fs.readdirSync(dir,{withFileTypes:true})){if(['node_modules','.git','__MACOSX'].includes(e.name))continue;const p=path.join(dir,e.name);if(e.isDirectory())walk(p);else if(/\.(ts|tsx)$/.test(e.name))files.push(p);}}
walk(root);
const errors=[];
for(const file of files){const result=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true},fileName:file,reportDiagnostics:true}); for(const d of result.diagnostics||[]){if(d.category===ts.DiagnosticCategory.Error)errors.push({file:path.relative(root,file),message:ts.flattenDiagnosticMessageText(d.messageText,' ')})}}
if(errors.length){console.error(JSON.stringify(errors,null,2));process.exit(1)}
console.log(`TypeScript/TSX syntax transpilation passed (${files.length} files).`);
