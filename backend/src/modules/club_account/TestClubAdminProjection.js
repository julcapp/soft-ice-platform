'use strict';
const mask = value => value ? String(value).slice(0,4)+'••••••'+String(value).slice(-4) : null;
const topupHistory = row => ({id:'test-club-topup:'+row.id,source:'TEST_CLUB_TOPUP',paymentId:row.id,linkedEntity:{type:'CLUB_TOPUP',id:row.id},provider:'YOOKASSA',providerPaymentRef:mask(row.providerPaymentId),kind:'CLUB_INITIAL_TOPUP',paymentMethodType:'UNKNOWN',amountRub:Number(row.amountCents)/100,currency:'RUB',status:row.status==='CREATING'?'CREATED':row.status,description:'Тестовое первоначальное пополнение клубного счёта',test:true,refundAllowed:false,economics:null,occurredAt:row.confirmedAt||row.createdAt});
async function readTestClubAccount(prisma, customerId) {
  const [row] = await prisma.$queryRawUnsafe(`SELECT
    COALESCE((SELECT SUM("amountCents") FROM "MiniAppClubTopupCheckout" WHERE "customerId"=$1 AND status='SUCCEEDED' AND test=TRUE),0) AS "creditCents",
    COALESCE((SELECT SUM("amountCents") FROM "MiniAppTestClubDebit" WHERE "customerId"=$1 AND test=TRUE),0) AS "debitCents"`,customerId);
  const creditCents=Number(row?.creditCents||0),debitCents=Number(row?.debitCents||0);
  if (![creditCents,debitCents,creditCents-debitCents].every(Number.isSafeInteger)||debitCents>creditCents) throw Object.assign(new Error('Тестовый остаток требует сверки.'),{code:'CLUB_TEST_BALANCE_INVALID',statusCode:409});
  return {test:true,currency:'RUB',availableBalanceRub:(creditCents-debitCents)/100,creditedRub:creditCents/100,debitedRub:debitCents/100};
}
async function readTestClubTopups(prisma, customerId) {
  const rows=await prisma.$queryRawUnsafe('SELECT id,status,"amountCents","providerPaymentId","createdAt","confirmedAt" FROM "MiniAppClubTopupCheckout" WHERE "customerId"=$1 AND test=TRUE ORDER BY "createdAt" DESC LIMIT 100',customerId);
  return rows.map(topupHistory);
}
async function listPlatformTestTopups(prisma,filters={},scope={}) {
  // A pooled customer deposit has no organization assignment. Never expose it to tenant admins.
  if(!scope.platform||scope.organizationId||filters.organizationId||filters.provider&&String(filters.provider).toUpperCase()!=='YOOKASSA')return [];
  const params=[],where=['test=TRUE'];
  if(filters.status){params.push(filters.status==='CREATED'?'CREATING':filters.status);where.push('status=$'+params.length);}
  for(const [field,op] of [['dateFrom','>='],['dateTo','<=']])if(filters[field]){const date=new Date(filters[field]);if(!Number.isFinite(date.getTime()))throw Object.assign(new Error('Укажите корректную дату.'),{statusCode:422,code:'PAYMENT_DATE_INVALID'});params.push(date);where.push('"createdAt"'+op+'$'+params.length);}
  params.push(Math.min(Math.max(Number.parseInt(filters.limit,10)||100,1),500));
  const rows=await prisma.$queryRawUnsafe('SELECT id,"customerId",status,"amountCents","providerPaymentId","createdAt","confirmedAt" FROM "MiniAppClubTopupCheckout" WHERE '+where.join(' AND ')+' ORDER BY "createdAt" DESC LIMIT $'+params.length,...params);
  return rows.map(row=>({id:row.id,customerId:row.customerId,orderId:null,organizationId:null,provider:'YOOKASSA',status:row.status==='CREATING'?'CREATED':row.status,amount:Number(row.amountCents)/100,currency:'RUB',createdAt:row.createdAt,updatedAt:row.confirmedAt||row.createdAt,providerPaymentId:mask(row.providerPaymentId),test:true,paymentSourceType:'TEST_CLUB_TOPUP',reconciliationItems:[]}));
}
module.exports={readTestClubAccount,readTestClubTopups,listPlatformTestTopups,topupHistory};
