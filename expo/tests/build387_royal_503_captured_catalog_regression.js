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
  const sharedCode = '2607TOR403';
  const capturedListPayload = {
    offers: [
      { playerOfferId: 'PLAYER-OFFER-A', campaignOffer: { offerCode: sharedCode, name: 'Shared Code Offer A', reserveByDate: '2026-08-31' } },
      { playerOfferId: 'PLAYER-OFFER-B', campaignOffer: { offerCode: sharedCode, name: 'Shared Code Offer B', reserveByDate: '2026-08-31' } },
    ],
  };
  const document = {
    readyState: 'complete',
    cookie: 'accessToken=header.payload.signature; VDS_ID=GTEST387; loyalty_ID=LTEST387',
    querySelectorAll: () => [],
    querySelector: () => null,
    addEventListener: () => {},
    implementation: { createHTMLDocument: () => ({ body: { innerHTML: '' }, querySelectorAll: () => [] }) },
    body: { innerText: '', textContent: '' },
  };
  const localStorage = { length: 0, getItem: () => null, key: () => null };
  const fetch = async (input, options = {}) => {
    const url = String(input);
    requested.push({ url, options });
    if (url.includes('/api/casino/v1/partners/player')) {
      return new Response(JSON.stringify({ data: [{ partnershipId: 'P387' }] }), { status: 200, headers: { 'content-type': 'application/json' } });
    }
    if (url.includes('/api/casino/v2/offers/list')) {
      return new Response(JSON.stringify({ message: 'temporary Royal upstream outage' }), { status: 503, headers: { 'content-type': 'application/json' } });
    }
    if (url.includes('/api/casino/v2/offers/details')) {
      const parsed = new URL(url);
      const playerOfferId = parsed.searchParams.get('playerOfferId');
      const isSecond = playerOfferId === 'PLAYER-OFFER-B';
      return new Response(JSON.stringify({
        offers: [{
          playerOfferId,
          campaignOffer: {
            offerCode: sharedCode,
            name: isSecond ? 'Shared Code Offer B' : 'Shared Code Offer A',
            reserveByDate: '2026-08-31',
            sailings: [{
              shipName: isSecond ? 'Icon of the Seas' : 'Navigator of the Seas',
              shipCode: isSecond ? 'IC' : 'NV',
              sailDate: isSecond ? '2026-10-03' : '2026-09-01',
              itineraryDescription: isSecond ? '7 Night Caribbean' : '4 Night Ensenada',
              roomType: 'Balcony',
              departurePort: { name: isSecond ? 'Miami' : 'Los Angeles' },
            }],
          },
        }],
      }), { status: 200, headers: { 'content-type': 'application/json' } });
    }
    throw new Error(`Unexpected fetch URL: ${url}`);
  };

  const nativeSetTimeout = setTimeout;
  const sandbox = {
    window: {
      ReactNativeWebView: { postMessage: (value) => messages.push(JSON.parse(value)) },
      capturedPayloads: {
        offers: capturedListPayload,
        offerCandidates: [{
          url: 'https://www.royalcaribbean.com/api/casino/v2/offers/list?partnershipIds=P387',
          data: capturedListPayload,
        }],
      },
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
  assert.equal(requested.filter((entry) => entry.url.includes('/api/casino/v2/offers/list')).length, 0, 'captured signed-in list must avoid the failing duplicate list request');
  const detailRequests = requested.filter((entry) => entry.url.includes('/api/casino/v2/offers/details'));
  assert.equal(detailRequests.length, 2);
  assert.deepEqual(new Set(detailRequests.map((entry) => new URL(entry.url).searchParams.get('playerOfferId'))), new Set(['PLAYER-OFFER-A', 'PLAYER-OFFER-B']));

  const rows = messages.filter((message) => message.type === 'offers_batch').flatMap((message) => message.data || []);
  assert.equal(rows.length, 2);
  assert.equal(new Set(rows.map((row) => row.playerOfferId)).size, 2, 'offers sharing one code must remain distinct by playerOfferId');
  assert.deepEqual(new Set(rows.map((row) => row.shipName)), new Set(['Navigator of the Seas', 'Icon of the Seas']));
  assert.ok(rows.every((row) => row.offerCode === sharedCode));
  const complete = messages.find((message) => message.type === 'step_complete');
  assert.ok(complete);
  assert.equal(complete.totalCount, 2);
  assert.equal(complete.offerCount, 2);
  assert.ok(messages.some((message) => message.type === 'log' && String(message.message).includes('signed-in website offer list already captured')));
  assert.ok(messages.some((message) => message.type === 'log' && String(message.message).includes('Preserved 2 distinct offer instances sharing code')));
  console.log('Build 387 Royal HTTP 503 captured-catalog full sailing recovery regression passed.');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
