const assert = require('node:assert/strict');
const { test } = require('node:test');

const { PostgresCurrencyRateRepository } = require('../src/modules/currency');

function fakePrisma(seedRow = null) {
  const state = { row: seedRow, inserts: 0 };
  return {
    state,
    async $queryRaw(_strings, ..._values) {
      return state.row ? [state.row] : [];
    },
    async $executeRaw(_strings, ...values) {
      state.inserts += 1;
      if (!state.row) {
        state.row = {
          id: 'rate-1',
          currencyCode: values[0],
          requestedDate: values[1],
          rateDate: values[2],
          nominal: values[3],
          rate: values[4],
          unitRate: values[5],
          source: values[6],
          status: values[7],
          rawResponseHash: values[8],
          receivedAt: values[9],
          createdBy: values[10],
          createdAt: new Date('2026-09-15T08:00:00.000Z'),
        };
      }
      return 1;
    },
  };
}

test('PostgresCurrencyRateRepository serializes persisted decimals and dates without Number coercion', async () => {
  const prisma = fakePrisma({
    id: 'rate-1',
    currencyCode: 'CNY',
    requestedDate: new Date('2026-09-15T00:00:00.000Z'),
    rateDate: new Date('2026-09-15T00:00:00.000Z'),
    nominal: { toString: () => '1.000000' },
    rate: { toString: () => '11.75000000' },
    unitRate: { toString: () => '11.75000000' },
    source: 'CBR',
    status: 'VALID',
    rawResponseHash: 'abc',
    receivedAt: new Date('2026-09-15T08:00:00.000Z'),
    createdBy: null,
    createdAt: new Date('2026-09-15T08:00:00.000Z'),
  });
  const repository = new PostgresCurrencyRateRepository(prisma);

  const row = await repository.findExact({ currencyCode: 'CNY', requestedDate: '2026-09-15', source: 'CBR' });

  assert.equal(row.requestedDate, '2026-09-15');
  assert.equal(row.rateDate, '2026-09-15');
  assert.equal(row.unitRate, '11.75000000');
});

test('PostgresCurrencyRateRepository save is idempotent at currency/date/source boundary', async () => {
  const prisma = fakePrisma();
  const repository = new PostgresCurrencyRateRepository(prisma);
  const input = {
    currencyCode: 'USD',
    requestedDate: '2026-09-13',
    rateDate: '2026-09-11',
    nominal: '1',
    rate: '84.25000000',
    unitRate: '84.25000000',
    source: 'CBR',
    status: 'VALID',
    rawResponseHash: 'hash',
    receivedAt: '2026-09-15T08:00:00.000Z',
  };

  const first = await repository.save(input);
  const second = await repository.save(input);

  assert.equal(first.currencyCode, 'USD');
  assert.equal(first.requestedDate, '2026-09-13');
  assert.equal(first.rateDate, '2026-09-11');
  assert.equal(second.id, first.id);
  assert.equal(prisma.state.inserts, 2);
});
