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

  try {
    require('ts-node/register/transpile-only');
  } catch (error) {
    require('/opt/nvm/versions/node/v22.16.0/lib/node_modules/ts-node/register/transpile-only');
  }
}

function loadTs(relativePath) {
  install();
  return require(path.join(root, relativePath));
}

module.exports = { root, loadTs };
