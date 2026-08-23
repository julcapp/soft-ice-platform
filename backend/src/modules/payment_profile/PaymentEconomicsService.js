const { randomUUID } = require('crypto');

class PaymentEconomicsService {
  constructor({ prisma, clock = () => new Date() }) {
    if (!prisma) throw new Error('prisma is required');
    this.prisma = prisma;
    this.clock = clock;
  }

  async recordFromPayment({ customerId = null, paymentSourceType, paymentSourceId, provider = 'YOOKASSA', providerPaymentId = null, paymentMethodType = null, grossAmountRub, incomeAmountRub, occurredAt = this.clock() }) {
    const gross = roundMoney(grossAmountRub);
    const net = roundMoney(incomeAmountRub);
    if (!(gross >= 0) || !(net >= 0) || net > gross) throw new Error('payment economics amounts are invalid');
    const cost = roundMoney(gross - net);
    const existing = await this.prisma.$queryRawUnsafe('SELECT * FROM "PaymentProviderCost" WHERE "paymentSourceType"=$1 AND "paymentSourceId"=$2 LIMIT 1', paymentSourceType, paymentSourceId);
    if (existing[0]) return existing[0];
    const id = randomUUID();
    await this.prisma.$executeRawUnsafe(
      `INSERT INTO "PaymentProviderCost" ("id","customerId","paymentSourceType","paymentSourceId","provider","providerPaymentId","paymentMethodType","grossAmountRub","netSettlementRub","processorCostTotalRub","calculationSource","isFinal","occurredAt","createdAt","updatedAt") VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'PAYMENT_API_INCOME_AMOUNT',FALSE,$11,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)`,
      id, customerId, paymentSourceType, paymentSourceId, String(provider).toUpperCase(), providerPaymentId, paymentMethodType, gross, net, cost, occurredAt,
    );
    return { id, customerId, paymentSourceType, paymentSourceId, provider: String(provider).toUpperCase(), providerPaymentId, paymentMethodType, grossAmountRub: gross, netSettlementRub: net, processorCostTotalRub: cost, calculationSource: 'PAYMENT_API_INCOME_AMOUNT', isFinal: false, occurredAt };
  }

  async finalizeFromRegistry({ paymentSourceType, paymentSourceId, processorCommissionRub, processorCommissionVatRub, commissionRatePct = null }) {
    const commission = roundMoney(processorCommissionRub);
    const vat = roundMoney(processorCommissionVatRub);
    const rows = await this.prisma.$queryRawUnsafe('SELECT * FROM "PaymentProviderCost" WHERE "paymentSourceType"=$1 AND "paymentSourceId"=$2 LIMIT 1', paymentSourceType, paymentSourceId);
    const row = rows[0];
    if (!row) throw new Error('payment provider cost not found');
    const total = roundMoney(commission + vat);
    const gross = Number(row.grossAmountRub || 0);
    const net = roundMoney(gross - total);
    await this.prisma.$executeRawUnsafe(
      `UPDATE "PaymentProviderCost" SET "processorCommissionRub"=$3,"processorCommissionVatRub"=$4,"commissionRatePct"=$5,"processorCostTotalRub"=$6,"netSettlementRub"=$7,"calculationSource"='SETTLEMENT_REGISTRY',"isFinal"=TRUE,"updatedAt"=CURRENT_TIMESTAMP WHERE "paymentSourceType"=$1 AND "paymentSourceId"=$2`,
      paymentSourceType, paymentSourceId, commission, vat, commissionRatePct == null ? null : Number(commissionRatePct), total, net,
    );
    return { paymentSourceType, paymentSourceId, processorCommissionRub: commission, processorCommissionVatRub: vat, processorCostTotalRub: total, netSettlementRub: net, commissionRatePct: commissionRatePct == null ? null : Number(commissionRatePct), calculationSource: 'SETTLEMENT_REGISTRY', isFinal: true };
  }

  async stats({ from, toExclusive }) {
    const [costRows, refundRows] = await Promise.all([
      this.prisma.$queryRawUnsafe(
        `SELECT COALESCE(SUM("grossAmountRub"),0)::float8 AS gross,
                COALESCE(SUM("netSettlementRub"),0)::float8 AS net,
                COALESCE(SUM("processorCostTotalRub"),0)::float8 AS cost,
                COALESCE(SUM("processorCommissionRub"),0)::float8 AS commission,
                COALESCE(SUM("processorCommissionVatRub"),0)::float8 AS commission_vat,
                COUNT(*) FILTER (WHERE "isFinal"=FALSE)::int AS provisional_count
         FROM "PaymentProviderCost" WHERE "occurredAt">=$1 AND "occurredAt"<$2`, from, toExclusive),
      this.prisma.$queryRawUnsafe(
        `SELECT COALESCE(SUM("amountRub"),0)::float8 AS refunded FROM "PaymentRefund" WHERE "status"='SUCCEEDED' AND "succeededAt">=$1 AND "succeededAt"<$2`, from, toExclusive),
    ]);
    const cost = Number(costRows[0]?.cost || 0);
    const commission = Number(costRows[0]?.commission || 0);
    const commissionVat = Number(costRows[0]?.commission_vat || 0);
    const net = Number(costRows[0]?.net || 0);
    const refunded = Number(refundRows[0]?.refunded || 0);
    return {
      grossProcessedRub: Number(costRows[0]?.gross || 0),
      providerCostTotalRub: cost,
      providerCommissionRub: commission,
      providerCommissionVatRub: commissionVat,
      providerCostUnallocatedRub: roundMoney(cost - commission - commissionVat),
      netSettledRub: net,
      refundsToCustomersRub: refunded,
      netCashAfterProviderCostsAndRefundsRub: roundMoney(net - refunded),
      provisionalPayments: Number(costRows[0]?.provisional_count || 0),
      status: 'READY',
    };
  }
}

function roundMoney(value) { return Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100; }
module.exports = { PaymentEconomicsService, roundMoney };
