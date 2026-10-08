const test = require('node:test');
const assert = require('node:assert/strict');
const { PaymentEconomicsService, roundMoney } = require('../src/modules/payment_profile/PaymentEconomicsService');

function fixture() {
  const executed = [];
  const rows = new Map();
  const prisma = {
    $queryRawUnsafe: async (sql, ...args) => {
      if (sql.includes('WHERE "paymentSourceType"=$1 AND "paymentSourceId"=$2')) {
        const key = `${args[0]}:${args[1]}`;
        return rows.has(key) ? [rows.get(key)] : [];
      }
      if (sql.includes('FROM "PaymentProviderCost" WHERE "occurredAt"')) return [{ gross: 206, net: 199, cost: 7, commission: 5.8, commission_vat: 1.2, provisional_count: 1 }];
      if (sql.includes('FROM "PaymentRefund"')) return [{ refunded: 96 }];
      return [];
    },
    $executeRawUnsafe: async (sql, ...args) => {
      executed.push([sql, ...args]);
      if (sql.startsWith('INSERT INTO "PaymentProviderCost"')) {
        rows.set(`${args[2]}:${args[3]}`, { paymentSourceType: args[2], paymentSourceId: args[3], grossAmountRub: args[7], netSettlementRub: args[8], processorCostTotalRub: args[9] });
      }
      return 1;
    },
  };
  return { prisma, executed, rows };
}

test('records actual total provider cost from gross minus YooKassa income_amount', async () => {
  const f = fixture();
  const service = new PaymentEconomicsService({ prisma: f.prisma, clock: () => new Date('2026-08-23T00:00:00Z') });
  const result = await service.recordFromPayment({ customerId: 'c1', paymentSourceType: 'PRIVATE_CHANNEL', paymentSourceId: 'pp1', providerPaymentId: 'pay1', paymentMethodType: 'bank_card', grossAmountRub: 103, incomeAmountRub: 99.23 });
  assert.equal(result.grossAmountRub, 103);
  assert.equal(result.netSettlementRub, 99.23);
  assert.equal(result.processorCostTotalRub, 3.77);
  assert.equal(result.isFinal, false);
  assert.equal(f.executed.some(([sql]) => sql.includes('PAYMENT_API_INCOME_AMOUNT')), true);
});

test('final registry reconciliation splits commission and VAT without changing customer price', async () => {
  const f = fixture();
  f.rows.set('PRIVATE_CHANNEL:pp1', { grossAmountRub: 103, netSettlementRub: 99.23, processorCostTotalRub: 3.77 });
  const service = new PaymentEconomicsService({ prisma: f.prisma });
  const result = await service.finalizeFromRegistry({ paymentSourceType: 'PRIVATE_CHANNEL', paymentSourceId: 'pp1', processorCommissionRub: 3.09, processorCommissionVatRub: 0.68, commissionRatePct: 3 });
  assert.equal(result.processorCostTotalRub, 3.77);
  assert.equal(result.netSettlementRub, 99.23);
  assert.equal(result.isFinal, true);
});

test('stats keeps provider costs and customer refunds separate', async () => {
  const f = fixture();
  const service = new PaymentEconomicsService({ prisma: f.prisma });
  const result = await service.stats({ from: new Date('2026-08-01T00:00:00Z'), toExclusive: new Date('2026-09-01T00:00:00Z') });
  assert.deepEqual(result, {
    grossProcessedRub: 206,
    providerCostTotalRub: 7,
    providerCommissionRub: 5.8,
    providerCommissionVatRub: 1.2,
    providerCostUnallocatedRub: 0,
    netSettledRub: 199,
    refundsToCustomersRub: 96,
    netCashAfterProviderCostsAndRefundsRub: 103,
    provisionalPayments: 1,
    status: 'READY',
  });
});

test('roundMoney is stable for monetary differences', () => {
  assert.equal(roundMoney(103 - 99.23), 3.77);
});
