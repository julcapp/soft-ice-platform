const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const text = fs.readFileSync(__dirname + '/preorder-test.js', 'utf8');
const api = text.slice(text.indexOf('  async function api('), text.indexOf('  function notice('));
function setup(fetch, initData = 'signed', fireTimeout = false) {
  const ctx = { tg: { initData }, AbortController, Error, JSON, fetch,
    setTimeout: fn => { if (fireTimeout) queueMicrotask(fn); return 1; },
    clearTimeout: () => { ctx.cleared = true; } };
  vm.createContext(ctx); vm.runInContext(api + ';this.request = api;', ctx); return ctx;
}
test('keeps signed identity and POST body, clears deadline after success', async () => {
  let options;
  const ctx = setup(async (url, opts) => { options = opts; assert.equal(url, '/api/tma/shared-preorder/catalog'); return { ok: true, json: async () => ({data: {ok: true}}) }; });
  assert.equal((await ctx.request('catalog')).ok, true);
  assert.equal(JSON.parse(options.body).init_data, 'signed'); assert.equal(ctx.cleared, true);
});
test('rejects absent Telegram identity without server call', async () => {
  const ctx = setup(() => { throw Error('must not call'); }, '');
  await assert.rejects(ctx.request('catalog'), /Telegram/);
});
test('stalled body is aborted and exposes retry without automatic replay', async () => {
  let calls = 0;
  const ctx = setup(async (_, opts) => { calls++; return {ok: true, json: () => new Promise((resolve,reject) => {
    const abort = () => reject(Object.assign(Error(), {name:'AbortError'}));
    if (opts.signal.aborted) abort(); else opts.signal.addEventListener('abort', abort);
  })}; }, 'signed', true);
  await assert.rejects(ctx.request('orders'), /повторно платить не нужно/);
  assert.equal(calls, 1); assert.equal(ctx.cleared, true);
});
test('HTML preserves SDK-before-app order with defer and initial status', () => {
  const html = fs.readFileSync(__dirname + '/preorder-test.html', 'utf8');
  assert.ok(html.includes('<script defer src="/telegram-web-app-59.js"></script>'));
  assert.ok(html.includes('<script defer src="/preorder-test.js?v=startup-20261016"></script>'));
  assert.ok(html.includes('role="status"')); assert.ok(!html.includes('https://telegram.org/'));
});
