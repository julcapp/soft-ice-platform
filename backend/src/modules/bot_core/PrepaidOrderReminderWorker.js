'use strict';
const {randomUUID}=require('node:crypto');
class PrepaidOrderReminderWorker {
 constructor({prisma,bindingService,telegramClient,journal,allowedTelegramIds=[],miniAppUrl,clock=()=>new Date()}){Object.assign(this,{prisma,bindingService,telegramClient,journal,miniAppUrl,clock});this.allowed=new Set(allowedTelegramIds);this.running=false;}
 async runOnce(){
  if(this.running || !this.bindingService || !this.telegramClient || !this.journal || !this.allowed.size)return;
  const slot=reminderSlot(this.clock());if(!slot)return;
  this.running=true;
  try{
   const rows=await this.prisma.$queryRawUnsafe(`SELECT o."id",o."customerId",o."expiresAt",o."machineId" FROM "Order" o JOIN "Payment" p ON p."orderId"=o."id" JOIN "Customer" c ON c."id"=o."customerId" WHERE o."status"='PAID' AND p."status"='SUCCEEDED' AND o."expiresAt">$1 AND o."machineId"='TEST-MACHINE-001' AND c."status"='active' AND c."phoneVerifiedAt" IS NOT NULL AND EXISTS (SELECT 1 FROM "SaleFlow" s WHERE s."orderId"=o."id" AND s."metadata"->>'fulfillmentMode'='PICKUP') AND NOT EXISTS (SELECT 1 FROM "GiftTransfer" g WHERE g."originalOrderId"=o."id" AND g."status" NOT IN ('CANCELLED','EXPIRED')) ORDER BY o."expiresAt" LIMIT 100`,this.clock());
   for(const order of rows){
    const recipient=await this.bindingService.resolve(order.customerId,'telegram');
    if(!recipient?.verifiedAt || !this.allowed.has(String(recipient.recipientId)))continue;
    const active=await this.prisma.order.findFirst({where:{id:order.id,customerId:order.customerId,status:'PAID',payment:{is:{status:'SUCCEEDED'}},expiresAt:{gt:this.clock()}}});
    if(!active)continue;
    const phase=slot;
    const sourceId=order.id+':'+phase+':telegram';
    const expires=new Intl.DateTimeFormat('ru-RU',{timeZone:'Asia/Tomsk',dateStyle:'short',timeStyle:'short'}).format(new Date(order.expiresAt));
    const body=`У вас имеется оплаченный заказ № ${order.id}.\nАппарат: ${order.machineId}.\nПолучить до ${expires} (Томск).\nВы также можете подарить этот заказ другу.\nПовторно оплачивать заказ не нужно.`;
    // Claim once before external send. Ambiguous failures are never blindly repeated.
    const claimed=await this.prisma.$queryRawUnsafe(`INSERT INTO "ProjectMessage" ("id","source","sourceId","recipientType","recipientId","subject","body") VALUES ($1,'PREPAID_REMINDER',$2,'CUSTOMER',$3,'Оплаченный заказ ожидает получения',$4) ON CONFLICT ("source","sourceId") DO NOTHING RETURNING "id"`,randomUUID(),sourceId,order.customerId,body);
    if(!claimed.length)continue;
    try{await this.journal.track({source:'PREPAID_REMINDER',sourceId,recipientType:'CUSTOMER',recipientId:order.customerId,recipientAddress:String(recipient.recipientId),channel:'telegram',subject:'Оплаченный заказ ожидает получения',body},()=>this.telegramClient.sendMessage(recipient.recipientId,body,{reply_markup:{inline_keyboard:[[{text:'Открыть заказ',web_app:{url:this.miniAppUrl}}]]}}));}
    catch{/* The journal records a failed attempt; manual reconciliation prevents duplicate delivery. */}
   }
  }finally{this.running=false;}
 }
}
function reminderSlot(now){
 const parts=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Tomsk',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(now).map(x=>[x.type,x.value]));
 return ['10','18'].includes(parts.hour) && Number(parts.minute)<10 ? `${parts.year}-${parts.month}-${parts.day}:${parts.hour}` : null;
}
module.exports={PrepaidOrderReminderWorker,reminderSlot};
