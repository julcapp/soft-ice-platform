const crypto = require('crypto');
const { randomUUID } = require('crypto');
const { ApiError } = require('../../platform/errors/ApiError');

class YooKassaDailyReconciliationService {
  constructor({ prisma, clock = () => new Date() }) {
    if (!prisma) throw new Error('prisma is required');
    this.prisma = prisma;
    this.clock = clock;
  }

  async importCsv({ csvText, reportType, reportDate = null, fileName = null, shopId = null, actorId = 'admin' }) {
    const type = normalizeReportType(reportType);
    const text = String(csvText || '').replace(/^\uFEFF/, '');
    if (!text.trim()) throw validation('YOOKASSA_REPORT_EMPTY', 'Реестр пуст.');
    const metadata = extractReportMetadata(text, type);
    const date = normalizeDate(metadata.reportDate || reportDate);
    if (metadata.reportDate && reportDate && metadata.reportDate !== reportDate) {
      throw validation('YOOKASSA_REPORT_DATE_MISMATCH', `Дата внутри реестра ${metadata.reportDate} не совпадает с датой ${reportDate}, определённой из письма или имени файла.`);
    }
    const effectiveShopId = metadata.shopId || shopId;
    const fileHash = crypto.createHash('sha256').update(text).digest('hex');
    const duplicate = await this.prisma.$queryRawUnsafe('SELECT * FROM "YooKassaDailyReport" WHERE "fileHash"=$1 LIMIT 1', fileHash);
    if (duplicate[0]) return { ...duplicate[0], idempotentReplay: true };

    const rows = parseCsv(text);
    if (!rows.length) throw validation('YOOKASSA_REPORT_NO_ROWS', 'В реестре нет строк операций.');
    const normalized = rows.map((row) => type === 'PAYMENTS' ? normalizePaymentRow(row) : normalizeRefundRow(row));
    const reportId = randomUUID();
    const totals = type === 'PAYMENTS' ? paymentTotals(normalized) : refundTotals(normalized);
    const result = await this.#reconcile(reportId, type, normalized);
    const now = this.clock();

    await this.prisma.$executeRawUnsafe(
      `INSERT INTO "YooKassaDailyReport" ("id","shopId","reportDate","reportType","fileName","fileHash","status","rowsTotal","rowsMatched","rowsMissingLocal","rowsMismatch","grossAmountRub","netAmountRub","commissionRub","commissionVatRub","refundAmountRub","importedBy","importedAt","reconciledAt","createdAt") VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$18,$18)`,
      reportId, effectiveShopId, date, type, fileName, fileHash, result.issues.length ? 'RECONCILED_WITH_ISSUES' : 'RECONCILED', normalized.length, result.matched, result.missingLocal, result.mismatch, totals.grossAmountRub, totals.netAmountRub, totals.commissionRub, totals.commissionVatRub, totals.refundAmountRub, actorId, now,
    );
    for (const item of result.issues) await this.#insertIssue(reportId, type, item);
    return { reportId, reportType: type, reportDate: date, shopId: effectiveShopId, contractRef: metadata.contractRef, fileName, rowsTotal: normalized.length, ...result, totals, status: result.issues.length ? 'RECONCILED_WITH_ISSUES' : 'RECONCILED', idempotentReplay: false };
  }

  async stats({ from, toExclusive }) {
    const [reports, issues] = await Promise.all([
      this.prisma.$queryRawUnsafe(`SELECT COUNT(*)::int AS reports, COALESCE(SUM("grossAmountRub"),0)::float8 AS gross, COALESCE(SUM("netAmountRub"),0)::float8 AS net, COALESCE(SUM("commissionRub"),0)::float8 AS commission, COALESCE(SUM("commissionVatRub"),0)::float8 AS vat, COALESCE(SUM("refundAmountRub"),0)::float8 AS refunds, COALESCE(SUM("rowsMismatch"),0)::int AS mismatches, COALESCE(SUM("rowsMissingLocal"),0)::int AS missing FROM "YooKassaDailyReport" WHERE "reportDate">=$1::date AND "reportDate"<$2::date`, from, toExclusive),
      this.prisma.$queryRawUnsafe(`SELECT COUNT(*)::int AS open FROM "YooKassaReconciliationIssue" i JOIN "YooKassaDailyReport" r ON r."id"=i."reportId" WHERE i."status"='OPEN' AND r."reportDate">=$1::date AND r."reportDate"<$2::date`, from, toExclusive),
    ]);
    return {
      reportsImported: Number(reports[0]?.reports || 0), grossAmountRub: Number(reports[0]?.gross || 0), netAmountRub: Number(reports[0]?.net || 0), commissionRub: Number(reports[0]?.commission || 0), commissionVatRub: Number(reports[0]?.vat || 0), refundAmountRub: Number(reports[0]?.refunds || 0), mismatchRows: Number(reports[0]?.mismatches || 0), missingLocalRows: Number(reports[0]?.missing || 0), openIssues: Number(issues[0]?.open || 0),
    };
  }

  async listIssues({ limit = 100, status = 'OPEN' } = {}) {
    const safeLimit = Math.min(Math.max(Number(limit) || 100, 1), 500);
    return this.prisma.$queryRawUnsafe(`SELECT i.*, r."reportDate", r."fileName" FROM "YooKassaReconciliationIssue" i JOIN "YooKassaDailyReport" r ON r."id"=i."reportId" WHERE i."status"=$1 ORDER BY i."createdAt" DESC LIMIT $2`, String(status || 'OPEN').toUpperCase(), safeLimit);
  }

  async #reconcile(_reportId, type, rows) {
    let matched = 0; let missingLocal = 0; let mismatch = 0; const issues = [];
    for (const row of rows) {
      if (type === 'PAYMENTS') {
        const localRows = await this.prisma.$queryRawUnsafe('SELECT * FROM "PaymentProviderCost" WHERE "provider"=\'YOOKASSA\' AND "providerPaymentId"=$1 LIMIT 1', row.paymentId);
        const local = localRows[0];
        if (!local) { missingLocal += 1; issues.push(issue('MISSING_LOCAL_PAYMENT', row.paymentId, row.paymentId, null, row)); continue; }
        const diffs = numericDiffs(local, row, [['grossAmountRub','grossAmountRub'],['netSettlementRub','netAmountRub']]);
        if (diffs.length) { mismatch += 1; issues.push(issue('PAYMENT_AMOUNT_MISMATCH', row.paymentId, row.paymentId, pick(local, diffs.map((d) => d.localKey)), row)); }
        else matched += 1;
        const rate = row.grossAmountRub > 0 ? Number(((row.commissionRub / row.grossAmountRub) * 100).toFixed(4)) : null;
        await this.prisma.$executeRawUnsafe(
          `UPDATE "PaymentProviderCost" SET "grossAmountRub"=$2,"netSettlementRub"=$3,"processorCostTotalRub"=$4,"processorCommissionRub"=$5,"processorCommissionVatRub"=$6,"commissionRatePct"=$7,"calculationSource"='SETTLEMENT_REGISTRY',"isFinal"=TRUE,"updatedAt"=$8 WHERE "id"=$1`,
          local.id, row.grossAmountRub, row.netAmountRub, row.providerCostRub, row.commissionRub, row.commissionVatRub, rate, this.clock(),
        );
      } else {
        const localRows = await this.prisma.$queryRawUnsafe('SELECT * FROM "PaymentRefund" WHERE "provider"=\'YOOKASSA\' AND "providerRefundId"=$1 LIMIT 1', row.refundId);
        const local = localRows[0];
        if (!local) { missingLocal += 1; issues.push(issue('MISSING_LOCAL_REFUND', row.refundId, row.paymentId, null, row)); continue; }
        const amountDiff = Math.abs(Number(local.amountRub || 0) - row.refundAmountRub) > 0.009;
        if (amountDiff) { mismatch += 1; issues.push(issue('REFUND_AMOUNT_MISMATCH', row.refundId, row.paymentId, { amountRub: Number(local.amountRub || 0) }, row)); }
        else matched += 1;
      }
    }
    return { matched, missingLocal, mismatch, issues };
  }

  async #insertIssue(reportId, reportType, item) {
    await this.prisma.$executeRawUnsafe(`INSERT INTO "YooKassaReconciliationIssue" ("id","reportId","reportType","providerOperationId","providerPaymentId","issueType","severity","expected","actual","status","createdAt") VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9::jsonb,'OPEN',$10)`, randomUUID(), reportId, reportType, item.providerOperationId, item.providerPaymentId, item.issueType, item.severity || 'WARNING', JSON.stringify(item.expected || null), JSON.stringify(item.actual || null), this.clock());
  }
}

function parseCsv(text) {
  const lines = String(text || '').replace(/^\uFEFF/, '').split(/\r?\n/);
  const headerIndex = lines.findIndex((line) => isOperationHeader(line));
  if (headerIndex < 0) return [];
  const headerLine = lines[headerIndex];
  const delimiter = detectDelimiter(headerLine);
  const headers = splitCsvLine(headerLine, delimiter).map(cleanHeader);
  return lines.slice(headerIndex + 1)
    .filter((line) => line.trim())
    .map((line) => splitCsvLine(line, delimiter))
    .filter((cells) => cells.some((v) => String(v).trim()))
    .filter((cells) => !isFooterOrMetadataRow(cells))
    .map((cells) => Object.fromEntries(headers.map((header, index) => [header, String(cells[index] ?? '').trim()])));
}
function isOperationHeader(line) {
  const normalized = cleanHeader(line);
  return normalized.includes('идентификатор платежа') || normalized.includes('идентификатор возврата') || normalized.includes('payment_id') || normalized.includes('refund_id');
}
function isFooterOrMetadataRow(cells) {
  if (cells.length > 1) return false;
  const value = cleanHeader(cells[0]);
  return value.startsWith('итого') || value.startsWith('дата платеж') || value.startsWith('дата возврат') || value.startsWith('реестр ');
}
function extractReportMetadata(text, reportType = null) {
  const lines = String(text || '').replace(/^\uFEFF/, '').split(/\r?\n/).slice(0, 30);
  const head = lines.join('\n');
  const datePatterns = reportType === 'REFUNDS'
    ? [/дата\s+возврат(?:ов|а)?\s*:\s*(20\d{2}-\d{2}-\d{2})/i, /дата\s+операций\s*:\s*(20\d{2}-\d{2}-\d{2})/i]
    : [/дата\s+платеж(?:ей|а)?\s*:\s*(20\d{2}-\d{2}-\d{2})/i, /дата\s+операций\s*:\s*(20\d{2}-\d{2}-\d{2})/i];
  let reportDate = null;
  for (const pattern of datePatterns) { const match = head.match(pattern); if (match) { reportDate = match[1]; break; } }
  const contractMatch = head.match(/реестр\s+(?:платежей|возвратов)\s+по\s+договору\s+([^\r\n;]+)/i);
  const contractRef = contractMatch ? contractMatch[1].trim() : null;
  const shopMatch = contractRef && contractRef.match(/\((\d+)\)\s*$/);
  return { reportDate, contractRef, shopId: shopMatch ? shopMatch[1] : null };
}
function detectDelimiter(line) { return (line.match(/;/g) || []).length >= (line.match(/,/g) || []).length ? ';' : ','; }
function splitCsvLine(line, delimiter) { const out=[]; let cell=''; let quoted=false; for (let i=0;i<line.length;i++){ const c=line[i]; if(c==='"'){ if(quoted && line[i+1]==='"'){cell+='"';i++;} else quoted=!quoted; } else if(c===delimiter && !quoted){out.push(cell);cell='';} else cell+=c; } out.push(cell); return out; }
function cleanHeader(value) { return String(value || '').trim().replace(/^"|"$/g,'').toLowerCase().replace(/ё/g,'е').replace(/\s+/g,' '); }
function field(row, aliases) { for (const alias of aliases) { const key=cleanHeader(alias); if (Object.hasOwn(row,key) && row[key] !== '') return row[key]; } return null; }
function money(value) { const n=Number(String(value ?? '').replace(/\s/g,'').replace(',','.')); return Number.isFinite(n) ? Number(n.toFixed(2)) : 0; }
function normalizePaymentRow(row) {
  const paymentId = field(row,['Идентификатор платежа','Номер транзакции','payment id','payment_id']); if (!paymentId) throw validation('YOOKASSA_REPORT_PAYMENT_ID_MISSING','В строке реестра платежей отсутствует идентификатор платежа.');
  const gross=money(field(row,['Сумма платежа','amount'])); const net=money(field(row,['Сумма за вычетом комиссии и НДС','Сумма за вычетом комиссии','income amount','income_amount'])); const commission=money(field(row,['Сумма комиссии без НДС','Комиссия','commission'])); const vat=money(field(row,['НДС с комиссии','commission vat','vat']));
  return { paymentId, grossAmountRub:gross, netAmountRub:net, commissionRub:commission, commissionVatRub:vat, providerCostRub:Number((commission+vat).toFixed(2)), paymentMethod:field(row,['Тип платежа','Способ оплаты','payment method']) };
}
function normalizeRefundRow(row) { const refundId=field(row,['Идентификатор возврата','refund id','refund_id']); const paymentId=field(row,['Идентификатор платежа','Номер транзакции','payment id','payment_id']); if(!refundId) throw validation('YOOKASSA_REPORT_REFUND_ID_MISSING','В строке реестра возвратов отсутствует идентификатор возврата.'); return { refundId, paymentId, refundAmountRub:money(field(row,['Сумма возврата','amount'])) }; }
function paymentTotals(rows){return rows.reduce((a,r)=>({grossAmountRub:a.grossAmountRub+r.grossAmountRub,netAmountRub:a.netAmountRub+r.netAmountRub,commissionRub:a.commissionRub+r.commissionRub,commissionVatRub:a.commissionVatRub+r.commissionVatRub,refundAmountRub:0}),{grossAmountRub:0,netAmountRub:0,commissionRub:0,commissionVatRub:0,refundAmountRub:0});}
function refundTotals(rows){return {grossAmountRub:0,netAmountRub:0,commissionRub:0,commissionVatRub:0,refundAmountRub:Number(rows.reduce((s,r)=>s+r.refundAmountRub,0).toFixed(2))};}
function numericDiffs(local,row,pairs){return pairs.filter(([lk,rk])=>Math.abs(Number(local[lk]||0)-Number(row[rk]||0))>0.009).map(([localKey,reportKey])=>({localKey,reportKey}));}
function pick(obj,keys){return Object.fromEntries(keys.map(k=>[k,Number(obj[k]||0)]));}
function issue(issueType,providerOperationId,providerPaymentId,expected,actual){return {issueType,providerOperationId,providerPaymentId,expected,actual,severity:issueType.startsWith('MISSING_')?'CRITICAL':'WARNING'};}
function normalizeReportType(value){const v=String(value||'').toUpperCase(); if(!['PAYMENTS','REFUNDS'].includes(v)) throw validation('YOOKASSA_REPORT_TYPE_INVALID','reportType must be PAYMENTS or REFUNDS.'); return v;}
function normalizeDate(value){if(!/^\d{4}-\d{2}-\d{2}$/.test(String(value||''))) throw validation('YOOKASSA_REPORT_DATE_INVALID','Не удалось определить дату реестра в формате YYYY-MM-DD.'); return String(value);}
function validation(code,message){return new ApiError({statusCode:400,code,message,source:'yookassa_reconciliation'});}
module.exports={YooKassaDailyReconciliationService,parseCsv,extractReportMetadata,normalizePaymentRow,normalizeRefundRow};
