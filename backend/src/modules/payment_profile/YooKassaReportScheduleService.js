const { randomUUID } = require('crypto');

class YooKassaReportScheduleService {
  constructor({ prisma, ingestor, clock = () => new Date(), config = process.env }) {
    if (!prisma) throw new Error('prisma is required');
    if (!ingestor) throw new Error('ingestor is required');
    this.prisma = prisma;
    this.ingestor = ingestor;
    this.clock = clock;
    this.config = config;
  }

  async run() {
    const ingestion = await this.ingestor.run();
    const now = this.clock();
    const reportDate = moscowYesterday(now);
    const deadlineHour = clampHour(this.config.YOOKASSA_REPORT_EXPECTED_BY_MSK_HOUR, 5);
    const deadline = moscowDeadlineUtc(reportDate, deadlineHour);
    const results = [];

    for (const reportType of ['PAYMENTS', 'REFUNDS']) {
      const reportRows = await this.prisma.$queryRawUnsafe(
        'SELECT "id","status" FROM "YooKassaDailyReport" WHERE "reportDate"=$1::date AND "reportType"=$2 ORDER BY "importedAt" DESC LIMIT 1',
        reportDate, reportType,
      );
      const received = Boolean(reportRows[0]);
      const status = received ? 'RECEIVED' : now >= deadline ? 'MISSING' : 'EXPECTED';
      await this.#upsertExpectation({ reportDate, reportType, status, deadline, received, now });
      results.push({ reportDate, reportType, status, expectedBy: deadline.toISOString() });
    }

    const missing = results.filter((item) => item.status === 'MISSING');
    return {
      status: ingestion.status === 'BLOCKED' ? 'BLOCKED' : (ingestion.status === 'DEGRADED' || missing.length ? 'DEGRADED' : 'READY'),
      ingestion,
      expectations: results,
      missing,
    };
  }

  async #upsertExpectation({ reportDate, reportType, status, deadline, received, now }) {
    const rows = await this.prisma.$queryRawUnsafe(
      'SELECT "id","status" FROM "YooKassaReportExpectation" WHERE "reportDate"=$1::date AND "reportType"=$2 LIMIT 1',
      reportDate, reportType,
    );
    if (!rows[0]) {
      await this.prisma.$executeRawUnsafe(
        `INSERT INTO "YooKassaReportExpectation" ("id","reportDate","reportType","status","expectedBy","detectedAt","resolvedAt","lastCheckedAt","createdAt","updatedAt") VALUES ($1,$2::date,$3,$4,$5,$6,$7,$8,$8,$8)`,
        randomUUID(), reportDate, reportType, status, deadline, status === 'MISSING' ? now : null, received ? now : null, now,
      );
      return;
    }
    await this.prisma.$executeRawUnsafe(
      `UPDATE "YooKassaReportExpectation"
       SET "status"=$3,
           "expectedBy"=$4,
           "detectedAt"=CASE WHEN $3='MISSING' THEN COALESCE("detectedAt",$5) ELSE "detectedAt" END,
           "resolvedAt"=CASE WHEN $3='RECEIVED' AND "status"='MISSING' THEN COALESCE("resolvedAt",$5) ELSE "resolvedAt" END,
           "lastCheckedAt"=$5,
           "updatedAt"=$5
       WHERE "reportDate"=$1::date AND "reportType"=$2`,
      reportDate, reportType, status, deadline, now,
    );
  }
}

function moscowYesterday(now) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Moscow', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  const utcMidnight = new Date(`${values.year}-${values.month}-${values.day}T00:00:00Z`);
  utcMidnight.setUTCDate(utcMidnight.getUTCDate() - 1);
  return utcMidnight.toISOString().slice(0, 10);
}

function moscowDeadlineUtc(reportDate, hour) {
  return new Date(`${reportDate}T${String(hour).padStart(2, '0')}:00:00+03:00`);
}
function clampHour(value, fallback) {
  const number = Number(value);
  return Number.isInteger(number) && number >= 0 && number <= 23 ? number : fallback;
}

module.exports = { YooKassaReportScheduleService, moscowYesterday, moscowDeadlineUtc };
