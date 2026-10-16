const test=require('node:test');const assert=require('node:assert/strict');
const {PrepaidOrderReminderWorker}=require('../src/modules/bot_core/PrepaidOrderReminderWorker');
test('reminders require verified allowlisted recipient and durable claim prevents duplicate sends',async()=>{
 let claimed=false,sends=0;const logs=[];
 const order={id:'order',customerId:'customer',machineId:'TEST-MACHINE-001',expiresAt:new Date('2026-10-18T00:00:00Z')};
 const prisma={$queryRawUnsafe:async sql=>{if(sql.startsWith('SELECT o.'))return [order];if(claimed)return [];claimed=true;return [{id:'claim'}];},order:{findFirst:async()=>order}};
 let recipient={recipientId:'123',verifiedAt:new Date()};
 const worker=new PrepaidOrderReminderWorker({prisma,bindingService:{resolve:async()=>recipient},telegramClient:{sendMessage:async(id,body)=>{assert.equal(id,'123');assert.match(body,/Получить до/);sends++;}},journal:{track:async(input,fn)=>{logs.push(input);return fn();}},allowedTelegramIds:['123'],miniAppUrl:'https://bot-test.utimoshi.ru/miniapp/',clock:()=>new Date('2026-10-16T03:00:00Z')});
 await worker.runOnce();await worker.runOnce();assert.equal(sends,1);assert.equal(logs[0].source,'PREPAID_REMINDER');
 claimed=false;recipient={recipientId:'456',verifiedAt:new Date()};await worker.runOnce();assert.equal(sends,1);assert.equal(claimed,false);
});
test('received/refunded/expired recheck suppresses reminder before claim',async()=>{
 let sends=0;const worker=new PrepaidOrderReminderWorker({prisma:{$queryRawUnsafe:async()=>[{id:'order',customerId:'customer'}],order:{findFirst:async()=>null}},bindingService:{resolve:async()=>({recipientId:'123',verifiedAt:new Date()})},telegramClient:{sendMessage:async()=>sends++},journal:{},allowedTelegramIds:['123'],clock:()=>new Date('2026-10-16T03:00:00Z')});await worker.runOnce();assert.equal(sends,0);
});

test('only two daytime Tomsk slots per day, no late catchup',()=>{
 const {reminderSlot}=require('../src/modules/bot_core/PrepaidOrderReminderWorker');
 assert.equal(reminderSlot(new Date('2026-10-16T03:00:00Z')),'2026-10-16:10');
 assert.equal(reminderSlot(new Date('2026-10-16T11:01:00Z')),'2026-10-16:18');
 for(const time of ['00:00','03:15','12:00','20:00'])assert.equal(reminderSlot(new Date('2026-10-16T'+time+':00Z')),null);
});
