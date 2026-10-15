const test = require('node:test');
const assert = require('node:assert/strict');
const { MessageJournal } = require('../src/modules/message_center/MessageJournal');
const { MessageCenterService } = require('../src/modules/message_center/MessageCenterService');
const { AdminSecurityDelivery } = require('../src/platform/security/AdminSecurityDelivery');
const { BotTransportSender } = require('../src/modules/bot_core/BotTransportSender');
function db() { const calls=[];const prisma={$queryRawUnsafe:async(...args)=>{calls.push(args);return [{id:'message-1',roles:['PLATFORM_OWNER']}];},$executeRawUnsafe:async(...args)=>{calls.push(args);return 1;},$transaction:async(fn)=>fn(prisma)};return{prisma,calls}; }
test('journal records intent before provider send and never claims confirmed delivery for acceptance',async()=>{
 const {prisma,calls}=db();const journal=new MessageJournal({prisma});
 await journal.track({source:'BOT',channel:'TELEGRAM',body:'Текст'},async()=>{assert.match(calls[1][0],/ProjectMessageDelivery/);return{message_id:91};});
 assert.equal(calls[2][2],'SENT');assert.equal(calls[2][3],'91');
});
test('journal stops an unrecorded send and preserves original provider errors',async()=>{
 const {prisma,calls}=db();prisma.$transaction=async()=>{throw new Error('DB down')};let sent=false;
 await assert.rejects(new MessageJournal({prisma}).track({source:'BOT',channel:'MAX'},async()=>{sent=true}),/DB down/);assert.equal(sent,false);
 const next=db();await assert.rejects(new MessageJournal({prisma:next.prisma}).track({source:'BOT',channel:'MAX'},async()=>{throw Object.assign(new Error('provider'),{code:'DENIED'})}),/provider/);assert.equal(next.calls[2][2],'FAILED');
});
test('codes are redacted before persistence and unavailable bot clients are not marked sent',async()=>{
 const {prisma,calls}=db();const journal=new MessageJournal({prisma});
 const sender=new AdminSecurityDelivery({messageJournal:journal});sender.sendMax=async()=>{};
 await sender.send({channel:'MAX',destination:'123',code:'987654'});
 assert.equal(JSON.stringify(calls).includes('987654'),false);assert.ok(JSON.stringify(calls).includes('Код подтверждения скрыт.'));
 const bot=new BotTransportSender({messageJournal:journal});await bot.send({channel:'telegram',destination:{chatId:'1'},rendered:{text:'Привет'}});assert.equal(calls.at(-1)[2],'UNAVAILABLE');
});
test('a journal result failure does not cause an accepted message to be sent again',async()=>{
 const {prisma}=db();let writes=0,sends=0;prisma.$executeRawUnsafe=async()=>{if(++writes===2)throw new Error('DB down');};
 const log=console.error;console.error=()=>{};try{const result=await new MessageJournal({prisma}).track({source:'BOT',channel:'MAX'},async()=>{sends++;return{mid:'confirmed'}});assert.equal(result.mid,'confirmed');assert.equal(sends,1);}finally{console.error=log;}
});
test('message center authorizes active database roles, not caller-supplied role headers',async()=>{
 const {prisma}=db();const service=new MessageCenterService({prisma});
 await assert.rejects(service.list({}, {roles:['PLATFORM_OWNER']}),{code:'MESSAGE_CENTER_ACCESS_DENIED'});
 prisma.$queryRawUnsafe=async()=>[{roles:['SERVICE_SPECIALIST']}];
 await assert.rejects(service.get('id',{auth_method:'password',subject_id:'staff',roles:['PLATFORM_OWNER']}),{code:'MESSAGE_CENTER_ACCESS_DENIED'});
});
test('filters remain parameters and human message numbers resolve to their sequence',async()=>{
 const {prisma,calls}=db();prisma.$queryRawUnsafe=async(sql,...args)=>{calls.push([sql,...args]);return sql.includes('AdminUser')?[{roles:['ADMIN']}]:sql.includes('count(*)')?[{total:0}]:[];};
 const context={auth_method:'password',subject_id:'owner'};await new MessageCenterService({prisma}).list({query:'MSG-123',channel:'MAX',from:'2026-10-08'},context);
 assert.equal(calls[1][1],'123');assert.equal(calls[1][4],'2026-10-08');assert.match(calls[1][0],/LIMIT \$6 OFFSET \$7/);
 await assert.rejects(new MessageCenterService({prisma}).list({from:'2026-02-30'},context),{code:'MESSAGE_DATE_INVALID'});
});
