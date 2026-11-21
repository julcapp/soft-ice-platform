'use strict';
async function recordTestClubTopupMessage(tx,row,now=new Date()) {
  if(row.status!=='SUCCEEDED'||row.test!==true||!row.confirmedAt||!row.providerPaymentId)return null;
  const messageId='club-test-topup:'+row.id;
  const confirmed=new Date(row.confirmedAt).toLocaleString('ru-RU',{timeZone:'Asia/Tomsk'});
  const body=`Тестовый клубный счёт пополнен на ${row.amountCents/100} ₽. Оплата подтверждена ${confirmed} (Томск). Пополнение № ${row.id}. Реальный денежный счёт и бонусы не изменены.`;
  await tx.$executeRawUnsafe(`INSERT INTO "ProjectMessage" (id,source,"sourceId","recipientType","recipientId",subject,body,sender,"correlationId","createdAt") VALUES ($1,'CLUB_TEST_TOPUP',$2,'CUSTOMER',$3,'Тестовый клубный счёт пополнен',$4,'Сервер',$2,$5) ON CONFLICT (source,"sourceId") DO NOTHING`,messageId,row.id,row.customerId,body,now);
  await tx.$executeRawUnsafe(`INSERT INTO "ProjectMessageDelivery" (id,"messageId",channel,status,"createdAt","updatedAt") SELECT $1,id,'MINI_APP','AVAILABLE',$3,$3 FROM "ProjectMessage" WHERE source='CLUB_TEST_TOPUP' AND "sourceId"=$2 ON CONFLICT (id) DO NOTHING`,messageId+':miniapp',row.id,now);
  // The existing DB trigger records the status history once. AVAILABLE is not SENT/DELIVERED.
  return messageId;
}
async function backfillConfirmedTopupMessages(prisma) {
  const rows=await prisma.$queryRawUnsafe(`SELECT t.* FROM "MiniAppClubTopupCheckout" t WHERE t.status='SUCCEEDED' AND t.test=TRUE AND t."confirmedAt" IS NOT NULL AND t."providerPaymentId" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "ProjectMessage" m WHERE m.source='CLUB_TEST_TOPUP' AND m."sourceId"=t.id) ORDER BY t."confirmedAt" LIMIT 100`);
  for(const row of rows)await prisma.$transaction(tx=>recordTestClubTopupMessage(tx,row));
  return {journaled:rows.length,financialPostings:0,externalSends:0};
}
module.exports={recordTestClubTopupMessage,backfillConfirmedTopupMessages};
