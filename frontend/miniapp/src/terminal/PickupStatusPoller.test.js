import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source = fs.readFileSync(new URL('../../public/pickup-status-poller.js', import.meta.url), 'utf8');
function setup() {
  const timers = new Map(); let id = 0;
  const window = { setTimeout: callback => { timers.set(++id, callback); return id; }, clearTimeout: key => timers.delete(key) };
  vm.runInNewContext(source, { window });
  return { start: window.SoftIceStartPickupPolling, timers, tick: async () => {
    const [key, callback] = timers.entries().next().value;
    timers.delete(key); await callback();
  } };
}
test('одинаковый промежуточный статус не прекращает опрос', async () => {
  const { start, timers, tick } = setup();
  const statuses = ['AUTHORIZED', 'AUTHORIZED', 'DISPENSED']; const seen = [];
  const stop = start(async () => { const status = statuses.shift(); seen.push(status); if (status === 'DISPENSED') stop(); });
  await tick(); await tick(); await tick();
  assert.deepEqual(seen, ['AUTHORIZED', 'AUTHORIZED', 'DISPENSED']);
  assert.equal(timers.size, 0);
});
test('долгий запрос не пересекается со следующим; уход отменяет повторение', async () => {
  const { start, timers, tick } = setup(); let resolve;
  const stop = start(() => new Promise(done => { resolve = done; }));
  const pending = tick(); assert.equal(timers.size, 0);
  stop(); resolve(); await pending; assert.equal(timers.size, 0);
});
