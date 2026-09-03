const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const vm = require('node:vm');
const ts = require('typescript');

const root = path.resolve(__dirname, '..');
const sourceFile = path.join(root, 'lib/royalCaribbean/step1_offers.ts');
const compiled = ts.transpileModule(fs.readFileSync(sourceFile, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  fileName: sourceFile,
}).outputText;
const mod = new Module(sourceFile, module);
mod.filename = sourceFile;
mod.paths = Module._nodeModulePaths(path.dirname(sourceFile));
mod._compile(compiled, sourceFile);

async function main() {
  const messages = [];
  const requested = [];
  let listAttempts = 0;
  const document = {
    readyState: 'complete',
    cookie: 'accessToken=header.payload.signature; VDS_ID=GTEST100; loyalty_ID=LTEST200',
    querySelectorAll: () => [],
    querySelector: () => null,
    addEventListener: () => {},
    implementation: { createHTMLDocument: () => ({ body: { innerHTML: '' }, querySelectorAll: () => [] }) },
    body: { innerText: '', textContent: '' },
  };
  const localStorage = {
    length: 0,
    getItem: () => null,
    key: () => null,
  };
  const fetch = async (input, options = {}) => {
    const url = String(input);
    requested.push({ url, options });
    if (url.includes('/api/casino/v1/partners/player')) {
      return new Response(JSON.stringify({ data: [{ partnershipId: 'P100' }] }), { status: 200, headers: { 'content-type': 'application/json' } });
    }
    if (url.includes('/api/casino/v2/offers/list')) {
      listAttempts += 1;
      if (listAttempts === 1) {
        return new Response(JSON.stringify({ message: 'temporary outage' }), { status: 503, headers: { 'content-type': 'application/json' } });
      }
      return new Response(JSON.stringify({ offers: [{ playerOfferId: 'PO100', campaignOffer: { offerCode: '26TEST100', name: 'Current API Test', reserveByDate: '2026-08-01' } }] }), { status: 200, headers: { 'content-type': 'application/json' } });
    }
    if (url.includes('/api/casino/v2/offers/details')) {
      return new Response(JSON.stringify({ offers: [{ campaignOffer: { offerCode: '26TEST100', name: 'Current API Test', reserveByDate: '2026-08-01', sailings: [{ shipName: 'Navigator of the Seas', shipCode: 'NV', sailDate: '2026-09-01', itineraryDescription: '4 Night Ensenada', roomType: 'Balcony', departurePort: { name: 'Los Angeles' } }] } }] }), { status: 200, headers: { 'content-type': 'application/json' } });
    }
    throw new Error(`Unexpected fetch URL: ${url}`);
  };

  const nativeSetTimeout = setTimeout;
  const sandbox = {
    window: {
      ReactNativeWebView: { postMessage: (value) => messages.push(JSON.parse(value)) },
      capturedPayloads: {},
      capturedRequestHeaders: {},
    },
    document,
    localStorage,
    location: { hostname: 'www.royalcaribbean.com', origin: 'https://www.royalcaribbean.com', href: 'https://www.royalcaribbean.com/club-royale/offers' },
    fetch,
    Response,
    Headers,
    Request,
    URL,
    URLSearchParams,
    AbortController,
    DOMParser: class { parseFromString() { return document; } },
    MouseEvent: class {},
    KeyboardEvent: class {},
    console,
    JSON, Object, Array, String, Number, Boolean, Math, Date, RegExp, Map, Set,
    atob: global.atob,
    btoa: global.btoa,
    setTimeout: (callback, ms, ...args) => nativeSetTimeout(callback, ms >= 10000 ? 500 : 0, ...args),
    clearTimeout,
  };
  sandbox.window.window = sandbox.window;
  vm.runInNewContext(mod.exports.injectOffersExtraction(false), sandbox, { timeout: 5000 });

  const deadline = Date.now() + 3000;
  while (!messages.some((message) => message.type === 'step_complete') && Date.now() < deadline) {
    await new Promise((resolve) => nativeSetTimeout(resolve, 20));
  }

  assert.ok(requested.some((entry) => entry.url.includes('/api/casino/v1/partners/player')));
  assert.ok(requested.some((entry) => entry.url.includes('/api/casino/v2/offers/list?partnershipIds=P100')));
  assert.equal(listAttempts, 2, 'temporary Royal 503 responses must be retried before falling back');
  assert.ok(requested.some((entry) => entry.url.includes('/api/casino/v2/offers/details?offerCode=26TEST100')));
  assert.ok(!requested.some((entry) => entry.url.includes('/api/casino/casino-offers/')));

  for (const entry of requested) {
    assert.equal(entry.options.credentials, 'include');
    assert.equal(entry.options.headers['x-account-id'], 'GTEST100');
    assert.equal(entry.options.headers['x-loyalty-id'], 'LTEST200');
    assert.equal(entry.options.headers.authorization, 'Bearer header.payload.signature');
  }

  const rows = messages.filter((message) => message.type === 'offers_batch').flatMap((message) => message.data || []);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].offerCode, '26TEST100');
  assert.equal(rows[0].shipName, 'Navigator of the Seas');
  assert.equal(rows[0].sailingDate, '09/01/2026');
  const complete = messages.find((message) => message.type === 'step_complete');
  assert.ok(complete);
  assert.equal(complete.totalCount, 1);
  assert.equal(complete.offerCount, 1);
  assert.ok(messages.some((message) => message.type === 'log' && String(message.message).includes('Current Club Royale API completed')));
  console.log('Build 329 Royal current three-step API flow regression passed.');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
