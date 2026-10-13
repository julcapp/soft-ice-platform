'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawnSync } = require('child_process');
const { getPrismaClient } = require('/home/julcapp/soft-ice-worktrees/display-product-v1/backend/src/common/database');

const ROOT = '/home/julcapp/softice-backups';
const TZ_OFFSET_HOURS = 7; // Asia/Tomsk
const prisma = getPrismaClient();

function previousTomskMonth() {
  const nowTomsk = new Date(Date.now() + TZ_OFFSET_HOURS * 3600000);
  let y = nowTomsk.getUTCFullYear();
  let m = nowTomsk.getUTCMonth() + 1;
  m -= 1;
  if (m === 0) { m = 12; y -= 1; }
  return `${y}-${String(m).padStart(2,'0')}`;
}

function parseMonth(value) {
  const m = /^(\d{4})-(\d{2})$/.exec(value || '');
  if (!m) throw new Error('Month must be YYYY-MM');
  const year = Number(m[1]), month = Number(m[2]);
  if (month < 1 || month > 12) throw new Error('Invalid month');
  return { year, month, label: value };
}

function monthRangeTomsk({year, month}) {
  // Tomsk midnight converted to UTC.
  const start = new Date(Date.UTC(year, month - 1, 1, -TZ_OFFSET_HOURS, 0, 0, 0));
  const nextYear = month === 12 ? year + 1 : year;
  const nextMonth = month === 12 ? 1 : month + 1;
  const end = new Date(Date.UTC(nextYear, nextMonth - 1, 1, -TZ_OFFSET_HOURS, 0, 0, 0));
  return { start, end };
}

function jsonSafe(value) {
  if (value === null || value === undefined) return value;
  if (typeof value === 'bigint') return value.toString();
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(jsonSafe);
  if (typeof value === 'object') {
    if (typeof value.toJSON === 'function') return jsonSafe(value.toJSON());
    const out = {};
    for (const [k,v] of Object.entries(value)) out[k] = jsonSafe(v);
    return out;
  }
  return value;
}

function csvCell(value) {
  if (value === null || value === undefined) return '';
  let text = typeof value === 'object' ? JSON.stringify(jsonSafe(value)) : String(value);
  if (/[",\r\n]/.test(text)) text = '"' + text.replace(/"/g,'""') + '"';
  return text;
}

function writeDataset(dir, name, rows) {
  const safeRows = jsonSafe(rows);
  fs.writeFileSync(path.join(dir, name + '.json'), JSON.stringify(safeRows, null, 2), {mode:0o600});
  const keys = [...new Set(safeRows.flatMap(r => Object.keys(r || {})))];
  const lines = [keys.map(csvCell).join(',')];
  for (const row of safeRows) lines.push(keys.map(k => csvCell(row[k])).join(','));
  fs.writeFileSync(path.join(dir, name + '.csv'), '\uFEFF' + lines.join('\r\n'), {mode:0o600});
  return safeRows.length;
}

async function raw(sql, ...params) {
  return prisma.$queryRawUnsafe(sql, ...params);
}

async function paymentData(start, end) {
  const paymentIds = await raw(`
    SELECT DISTINCT id FROM (
      SELECT p."id" AS id FROM "Payment" p
       WHERE p."createdAt">=$1 AND p."createdAt"<$2
      UNION SELECT r."paymentId" FROM "PaymentRefund" r
       WHERE (r."createdAt">=$1 AND r."createdAt"<$2)
          OR (r."updatedAt">=$1 AND r."updatedAt"<$2)
          OR (r."succeededAt">=$1 AND r."succeededAt"<$2)
      UNION SELECT o."paymentId" FROM "PaymentOperation" o
       WHERE (o."createdAt">=$1 AND o."createdAt"<$2)
          OR (o."completedAt">=$1 AND o."completedAt"<$2)
      UNION SELECT i."paymentId" FROM "PaymentProviderInbox" i
       WHERE i."paymentId" IS NOT NULL
         AND ((i."receivedAt">=$1 AND i."receivedAt"<$2) OR (i."processedAt">=$1 AND i."processedAt"<$2))
      UNION SELECT c."paymentId" FROM "PaymentReconciliation" c
       WHERE c."paymentId" IS NOT NULL
         AND ((c."detectedAt">=$1 AND c."detectedAt"<$2) OR (c."resolvedAt">=$1 AND c."resolvedAt"<$2))
      UNION SELECT a."paymentId" FROM "PaymentAuditEntry" a
       WHERE a."occurredAt">=$1 AND a."occurredAt"<$2
    ) x WHERE id IS NOT NULL
  `, start, end);
  const ids = paymentIds.map(r=>r.id);
  if (!ids.length) return {
    payments:[], payment_refunds:[], payment_operations:[], payment_provider_inbox:[],
    payment_reconciliation:[], payment_audit_entries:[]
  };
  return {
    payments: await prisma.payment.findMany({where:{id:{in:ids}},orderBy:{createdAt:'asc'}}),
    payment_refunds: await prisma.paymentRefund.findMany({where:{paymentId:{in:ids}},orderBy:{createdAt:'asc'}}),
    payment_operations: await prisma.paymentOperation.findMany({where:{paymentId:{in:ids}},orderBy:{createdAt:'asc'}}),
    payment_provider_inbox: await prisma.paymentProviderInbox.findMany({where:{paymentId:{in:ids}},orderBy:{receivedAt:'asc'}}),
    payment_reconciliation: await prisma.paymentReconciliation.findMany({where:{paymentId:{in:ids}},orderBy:{detectedAt:'asc'}}),
    payment_audit_entries: await prisma.paymentAuditEntry.findMany({where:{paymentId:{in:ids}},orderBy:{occurredAt:'asc'}}),
  };
}

async function messageData(start, end) {
  const idsRows = await raw(`
    SELECT DISTINCT id FROM (
      SELECT m."id" AS id FROM "ProjectMessage" m
       WHERE m."createdAt">=$1 AND m."createdAt"<$2
      UNION SELECT d."messageId" FROM "ProjectMessageDelivery" d
       WHERE (d."createdAt">=$1 AND d."createdAt"<$2)
          OR (d."updatedAt">=$1 AND d."updatedAt"<$2)
          OR (d."sentAt">=$1 AND d."sentAt"<$2)
          OR (d."deliveredAt">=$1 AND d."deliveredAt"<$2)
          OR (d."readAt">=$1 AND d."readAt"<$2)
      UNION SELECT d."messageId"
        FROM "ProjectMessageDeliveryHistory" h
        JOIN "ProjectMessageDelivery" d ON d."id"=h."deliveryId"
       WHERE h."occurredAt">=$1 AND h."occurredAt"<$2
    ) x
  `, start, end);
  const ids = idsRows.map(r=>r.id);
  if (!ids.length) return {messages:[], message_deliveries:[], message_delivery_history:[]};

  const messages = await raw('SELECT * FROM "ProjectMessage" WHERE "id" = ANY($1::text[]) ORDER BY "createdAt","number"', ids);
  const deliveries = await raw('SELECT * FROM "ProjectMessageDelivery" WHERE "messageId" = ANY($1::text[]) ORDER BY "createdAt","id"', ids);
  const deliveryIds = deliveries.map(r=>r.id);
  const history = deliveryIds.length
    ? await raw('SELECT * FROM "ProjectMessageDeliveryHistory" WHERE "deliveryId" = ANY($1::text[]) ORDER BY "occurredAt","id"', deliveryIds)
    : [];
  return {messages, message_deliveries:deliveries, message_delivery_history:history};
}

function makeZip(sourceDir, zipPath) {
  const py = spawnSync('/usr/bin/python3', ['-c',
    'import os,sys,zipfile; src,dst=sys.argv[1],sys.argv[2]; z=zipfile.ZipFile(dst,"w",zipfile.ZIP_DEFLATED); [(z.write(os.path.join(root,f),os.path.relpath(os.path.join(root,f),src))) for root,_,files in os.walk(src) for f in files]; z.close()',
    sourceDir, zipPath], {encoding:'utf8'});
  if (py.status !== 0) throw new Error('ZIP failed: ' + (py.stderr || py.stdout));
}

function sha256(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

async function archiveSection(section, month, range, data) {
  const year = month.slice(0,4);
  const destDir = path.join(ROOT, section, year);
  fs.mkdirSync(destDir,{recursive:true,mode:0o700});
  const finalZip = path.join(destDir, `${section}-${month}.zip`);
  const finalSha = finalZip + '.sha256';
  const force = process.argv.includes('--force');
  if (fs.existsSync(finalZip) && !force) return {section,status:'already_exists',zip:finalZip};

  const work = path.join(ROOT,'.work',`${section}-${month}-${process.pid}`);
  fs.mkdirSync(work,{recursive:true,mode:0o700});
  const counts = {};
  for (const [name,rows] of Object.entries(data)) counts[name]=writeDataset(work,name,rows);

  const manifest = {
    version:1,
    section,
    month,
    timezone:'Asia/Tomsk',
    periodStartUtc:range.start.toISOString(),
    periodEndExclusiveUtc:range.end.toISOString(),
    createdAt:new Date().toISOString(),
    counts,
    selectionRule: section==='payments'
      ? 'Payments with any payment lifecycle activity in the calendar month; all related payment child rows included.'
      : 'Messages with message/delivery/history activity in the calendar month; related delivery/history rows included.',
    deletionPolicy:'No production rows are deleted by this backup.',
    retention:'indefinite',
  };
  fs.writeFileSync(path.join(work,'manifest.json'),JSON.stringify(manifest,null,2),{mode:0o600});

  const tmpZip = finalZip + '.tmp';
  if (fs.existsSync(tmpZip)) fs.unlinkSync(tmpZip);
  makeZip(work,tmpZip);
  fs.renameSync(tmpZip,finalZip);
  fs.chmodSync(finalZip,0o600);
  const digest=sha256(finalZip);
  fs.writeFileSync(finalSha,`${digest}  ${path.basename(finalZip)}\n`,{mode:0o600});
  fs.rmSync(work,{recursive:true,force:true});
  return {section,status:'created',zip:finalZip,sha256:digest,counts};
}

(async()=>{
  const month = parseMonth(process.argv.find(a=>/^\d{4}-\d{2}$/.test(a)) || previousTomskMonth());
  const range = monthRangeTomsk(month);
  fs.mkdirSync(path.join(ROOT,'.work'),{recursive:true,mode:0o700});
  fs.mkdirSync(path.join(ROOT,'logs'),{recursive:true,mode:0o700});

  const payments = await paymentData(range.start,range.end);
  const messages = await messageData(range.start,range.end);
  const results = [
    await archiveSection('payments',month.label,range,payments),
    await archiveSection('messages',month.label,range,messages),
  ];
  const line=JSON.stringify({ok:true,month:month.label,at:new Date().toISOString(),results});
  fs.appendFileSync(path.join(ROOT,'logs','monthly-backup.log'),line+'\n',{mode:0o600});
  console.log(line);
})().catch(err=>{
  try{
    fs.mkdirSync(path.join(ROOT,'logs'),{recursive:true,mode:0o700});
    fs.appendFileSync(path.join(ROOT,'logs','monthly-backup.log'),JSON.stringify({ok:false,at:new Date().toISOString(),error:String(err.stack||err)})+'\n',{mode:0o600});
  }catch{}
  console.error(err.stack||err);
  process.exitCode=1;
}).finally(()=>prisma.$disconnect());
