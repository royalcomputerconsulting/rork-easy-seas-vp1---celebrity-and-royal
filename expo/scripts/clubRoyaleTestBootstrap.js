const path = require('path');
const Module = require('module');

const root = path.resolve(__dirname, '..');
let installed = false;

function install() {
  if (installed) return;
  installed = true;
  process.env.TS_NODE_SKIP_PROJECT = '1';
  process.env.TS_NODE_TRANSPILE_ONLY = '1';
  process.env.TS_NODE_COMPILER_OPTIONS = JSON.stringify({
    module: 'CommonJS',
    moduleResolution: 'node',
    jsx: 'react-jsx',
    target: 'ES2020',
    esModuleInterop: true,
  });

  const originalResolveFilename = Module._resolveFilename;
  Module._resolveFilename = function resolveEasySeasAlias(request, parent, isMain, options) {
    const resolvedRequest = request.startsWith('@/') ? path.join(root, request.slice(2)) : request;
    return originalResolveFilename.call(this, resolvedRequest, parent, isMain, options);
  };

  // Some archived node_modules snapshots expose the pako export names but the
  // functions are undefined under Node's CommonJS loader. Metro/Hermes receives
  // the normal static pako import; regression tests use Node's native zlib only
  // when that CommonJS package surface is materially unusable.
  const originalLoad = Module._load;
  Module._load = function loadEasySeasTestDependency(request, parent, isMain) {
    const loaded = originalLoad.call(this, request, parent, isMain);
    if (request !== 'pako' || (typeof loaded?.inflate === 'function' && typeof loaded?.inflateRaw === 'function')) return loaded;
    const zlib = require('node:zlib');
    return {
      inflate: (bytes) => new Uint8Array(zlib.inflateSync(Buffer.from(bytes))),
      inflateRaw: (bytes) => new Uint8Array(zlib.inflateRawSync(Buffer.from(bytes))),
    };
  };

  try {
    require('ts-node/register/transpile-only');
  } catch (_error) {
    // The source release intentionally does not require a global ts-node
    // installation. Use the project's pinned TypeScript compiler as a portable
    // CommonJS require hook when ts-node is unavailable.
    const fs = require('fs');
    const ts = require('typescript');
    const compileTypeScript = (module, filename) => {
      const source = fs.readFileSync(filename, 'utf8');
      const compiled = ts.transpileModule(source, {
        compilerOptions: {
          module: ts.ModuleKind.CommonJS,
          moduleResolution: ts.ModuleResolutionKind.NodeJs,
          jsx: ts.JsxEmit.ReactJSX,
          target: ts.ScriptTarget.ES2020,
          esModuleInterop: true,
        },
        fileName: filename,
      });
      module._compile(compiled.outputText, filename);
    };
    require.extensions['.ts'] = compileTypeScript;
    require.extensions['.tsx'] = compileTypeScript;
  }
}

function loadTs(relativePath) {
  install();
  return require(path.join(root, relativePath));
}

module.exports = { root, loadTs };
