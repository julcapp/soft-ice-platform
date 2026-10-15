const { test } = require('node:test');
const assert = require('node:assert/strict');
const { buildPurchaseRichCard } = require('../src/modules/bot_core/PurchaseRichCard');
test('completed purchase uses recorded amount and zero accrual without inventing rewards',()=>{
 const result=buildPurchaseRichCard({status:'COMPLETED',amountPaidRub:5,bonusEarned:0},{miniAppUrl:'https://miniapp.utimoshi.ru/',composition:['Сливочное']});
 assert.match(result.text,/Начислено бонусов: 0/);assert.match(result.text,/Сливочное/);assert.equal(result.richMessage.blocks.at(-1).buttons[0].web_app.url,'https://miniapp.utimoshi.ru/');
});
test('uncompleted orders, missing financial facts and insecure cabinet links are rejected',()=>{
 for(const order of [{status:'PAID',amountPaidRub:5,bonusEarned:0},{status:'COMPLETED',bonusEarned:0},{status:'COMPLETED',amountPaidRub:5}])assert.throws(()=>buildPurchaseRichCard(order,{miniAppUrl:'https://miniapp.utimoshi.ru/'}));
 assert.throws(()=>buildPurchaseRichCard({status:'COMPLETED',amountPaidRub:5,bonusEarned:0},{miniAppUrl:'http://example.org'}));
});
