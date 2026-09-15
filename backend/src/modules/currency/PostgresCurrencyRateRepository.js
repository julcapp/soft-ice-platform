const { CurrencyRateRepository } = require('./CurrencyRateRepository');

function asDateOnly(value) {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).slice(0, 10);
}

function serialize(row) {
  if (!row) return null;
  return {
    id: row.id,
    currencyCode: row.currencyCode,
    requestedDate: asDateOnly(row.requestedDate),
    rateDate: asDateOnly(row.rateDate),
    nominal: String(row.nominal),
    rate: String(row.rate),
    unitRate: String(row.unitRate),
    source: row.source,
    status: row.status,
    rawResponseHash: row.rawResponseHash || null,
    receivedAt: row.receivedAt instanceof Date ? row.receivedAt.toISOString() : String(row.receivedAt),
    createdBy: row.createdBy || null,
    createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : String(row.createdAt),
  };
}

class PostgresCurrencyRateRepository extends CurrencyRateRepository {
  constructor(prisma) {
    super();
    if (!prisma) throw new TypeError('PostgresCurrencyRateRepository requires Prisma client.');
    this.prisma = prisma;
  }

  async findExact({ currencyCode, requestedDate, source }) {
    const requested = new Date(`${requestedDate}T00:00:00.000Z`);
    const rows = await this.prisma.$queryRaw`
      SELECT *
      FROM "CurrencyRate"
      WHERE "currencyCode" = ${currencyCode}
        AND "requestedDate" = ${requested}
        AND "source" = ${source}
      LIMIT 1
    `;
    return serialize(rows[0]);
  }

  async save(record) {
    const requested = new Date(`${record.requestedDate}T00:00:00.000Z`);
    const rateDate = new Date(`${record.rateDate}T00:00:00.000Z`);
    const receivedAt = new Date(record.receivedAt);

    await this.prisma.$executeRaw`
      INSERT INTO "CurrencyRate" (
        "id", "currencyCode", "requestedDate", "rateDate", "nominal", "rate", "unitRate",
        "source", "status", "rawResponseHash", "receivedAt", "createdBy", "createdAt"
      )
      VALUES (
        gen_random_uuid()::text,
        ${record.currencyCode}, ${requested}, ${rateDate},
        ${record.nominal}::numeric, ${record.rate}::numeric, ${record.unitRate}::numeric,
        ${record.source}, ${record.status}, ${record.rawResponseHash || null}, ${receivedAt},
        ${record.createdBy || null}, NOW()
      )
      ON CONFLICT ("currencyCode", "requestedDate", "source") DO NOTHING
    `;

    return this.findExact({
      currencyCode: record.currencyCode,
      requestedDate: record.requestedDate,
      source: record.source,
    });
  }
}

module.exports = {
  PostgresCurrencyRateRepository,
};
