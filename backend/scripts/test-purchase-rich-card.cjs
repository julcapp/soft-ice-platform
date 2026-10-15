const fs = require('fs');
const crypto = require('crypto');
const root = '/home/julcapp/soft-ice-worktrees/display-product-v1/backend';
function envValue(file, key) {
 const line = fs.readFileSync(file,'utf8').split(/\r?\n/).find(line=>line.startsWith(key+'='));
 return line ? line.slice(key.length+1).trim().replace(/^(['"])(.*)\1$/, '$2') : null;
}
const databaseUrl=envValue('/etc/softice/display-backend.env','DATABASE_URL');
if(!databaseUrl)throw new Error('Service database configuration is missing.');
const { PrismaClient } = require(root+'/node_modules/@prisma/client');
const db=new PrismaClient({datasources:{db:{url:databaseUrl}}});
const { buildPurchaseRichCard } = require('/home/julcapp/PurchaseRichCard.js');
const { TelegramBotApiClient } = require(root+'/src/modules/bot_core/TelegramBotApiClient');
const { MessageJournal } = require(root+'/src/modules/message_center/MessageJournal');
async function run(){
 const orderId='a5cebb16-77d6-451f-9d26-7446aef2ac07', customerId='251eda93-85b5-4cb4-83b7-00a5ce335150',telegramId='93614095';
 const order=await db.order.findUnique({where:{id:orderId}});
 if(!order || order.customerId!==customerId)throw new Error('Test order ownership mismatch.');
 const identity=await db.customerIdentity.findFirst({where:{customerId,provider:'telegram',externalSubjectHash:crypto.createHash('sha256').update(telegramId).digest('hex'),revokedAt:null}});
 if(!identity || identity.status!=='active')throw new Error('Verified Telegram recipient does not match the customer.');
 const composition=[order.flavor,order.syrup,order.topping].filter(value=>typeof value==='string' && /[А-Яа-яЁё]/.test(value));
 const card=buildPurchaseRichCard(order,{miniAppUrl:'https://miniapp.utimoshi.ru/',composition});
 console.log(card.text);
 if(!process.argv.includes('--send')){console.log('PREVIEW ONLY: сообщение не отправлено.');return;}
 const token=envValue('/home/julcapp/soft-ice-bot-test/backend/.env','TELEGRAM_TEST_BOT_TOKEN');
 const client=new TelegramBotApiClient({token,features:{richMessages:true}});
 const bot=await client.getMe();if(String(bot.username).toLowerCase()!=='exgorod_bot')throw new Error('Expected test bot @exgorod_bot.');
 const sourceId='test-rich-purchase-v1:'+orderId;
 await db.$transaction(async(tx)=>{
  await tx.$queryRawUnsafe('SELECT 1 AS locked FROM pg_advisory_xact_lock(hashtext($1))',sourceId);
  const previous=await tx.$queryRawUnsafe('SELECT "id" FROM "ProjectMessage" WHERE "source"=$1 AND "sourceId"=$2 LIMIT 1','BOT',sourceId);
  if(previous.length){console.log('SKIPPED: тест уже имеет запись в Центре сообщений; повтор не отправлен.');return;}
  const journal=new MessageJournal({prisma:db});
  const result=await journal.track({source:'BOT',sourceId,channel:'TELEGRAM',recipientType:'CUSTOMER',recipientId:customerId,recipientAddress:telegramId,subject:'Тестовая карточка покупки',body:card.text,correlationId:sourceId},()=>client.sendRichMessage(telegramId,card.richMessage));
  console.log('SENT: @exgorod_bot, providerMessageId='+result.message_id);
 },{timeout:45000});
}
run().catch(error=>{console.error('TEST_FAILED:',error.code || error.message);process.exitCode=1;}).finally(()=>db.$disconnect());
