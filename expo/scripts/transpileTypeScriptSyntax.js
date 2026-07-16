const fs = require('fs');
const path = require('path');

let ts;
try {
  ts = require('typescript');
} catch {
  ts = require('/opt/nvm/versions/node/v22.16.0/lib/node_modules/typescript');
}

const root = process.cwd();
const ignoredDirectories = new Set(['node_modules', '.git', '.expo', 'dist', 'build']);
const files = [];

function walk(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (ignoredDirectories.has(entry.name)) continue;
    const absolutePath = path.join(directory, entry.name);
    if (entry.isDirectory()) walk(absolutePath);
    else if (/\.(ts|tsx)$/.test(entry.name)) files.push(absolutePath);
  }
}

walk(root);
const errors = [];
for (const file of files) {
  const source = fs.readFileSync(file, 'utf8');
  const result = ts.transpileModule(source, {
    compilerOptions: {
      target: ts.ScriptTarget.ES2020,
      module: ts.ModuleKind.ESNext,
      jsx: ts.JsxEmit.ReactJSX,
      isolatedModules: true,
    },
    fileName: file,
    reportDiagnostics: true,
  });
  for (const diagnostic of result.diagnostics || []) {
    if (diagnostic.category !== ts.DiagnosticCategory.Error) continue;
    const position = diagnostic.file && typeof diagnostic.start === 'number'
      ? diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start)
      : null;
    errors.push(
      `${path.relative(root, file)}${position ? `:${position.line + 1}:${position.character + 1}` : ''} `
      + `TS${diagnostic.code} ${ts.flattenDiagnosticMessageText(diagnostic.messageText, ' ')}`,
    );
  }
}

console.log(`Scanned ${files.length} TypeScript/TSX files.`);
if (errors.length > 0) {
  console.error(`FAIL ${errors.length} TypeScript syntax diagnostics`);
  console.error(errors.join('\n'));
  process.exit(1);
}
console.log('PASS TypeScript/TSX syntax transpilation');
