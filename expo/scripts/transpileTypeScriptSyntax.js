const fs = require('fs');
const path = require('path');
const ts = require('typescript');

const root = process.cwd();
const ignoredDirectories = new Set(['node_modules', '.git', '.expo', 'dist', 'build', 'outputs']);
const files = [];

function walk(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (ignoredDirectories.has(entry.name)) continue;
    const absolutePath = path.join(directory, entry.name);
    if (entry.isDirectory()) walk(absolutePath);
    else if (/\.(ts|tsx)$/.test(entry.name) && !/\.d\.ts$/.test(entry.name)) files.push(absolutePath);
  }
}

walk(root);
const errors = [];
for (let fileIndex = 0; fileIndex < files.length; fileIndex += 1) {
  const file = files[fileIndex];
  const source = fs.readFileSync(file, 'utf8');
  try {
    const result = ts.transpileModule(source, {
      compilerOptions: {
        jsx: ts.JsxEmit.React,
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
      },
      fileName: file,
      reportDiagnostics: true,
    });
    for (const diagnostic of result.diagnostics ?? []) {
      if (diagnostic.category === ts.DiagnosticCategory.Error) {
        errors.push(`${path.relative(root, file)} ${ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n')}`);
      }
    }
  } catch (error) {
    errors.push(`${path.relative(root, file)} ${error instanceof Error ? error.message : String(error)}`);
  }
  if ((fileIndex + 1) % 50 === 0) {
    console.log(`Syntax scan progress: ${fileIndex + 1}/${files.length}`);
  }
}

console.log(`Scanned ${files.length} TypeScript/TSX files.`);
if (errors.length > 0) {
  console.error(`FAIL ${errors.length} TypeScript/TSX syntax diagnostics`);
  console.error(errors.join('\n'));
  process.exit(1);
}
console.log('PASS TypeScript/TSX syntax transpilation');
