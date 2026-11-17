'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {MaxSellerOtpSender}=require('../src/modules/seller_auth/MaxSellerOtpSender');
test('only verified recipient MAX ID is used; no channel spoofing',async()=>{
 const delivered=[];
 const sender=new MaxSellerOtpSender({maxClient:{async sendMessage(msg){delivered.push(msg);return {ok:true}}}});
 await sender.sendPrivateMessage({recipientId:'123456789',text:'Код входа в TimoPOS: 246810. Действует 5 минут. Никому не сообщайте код.'});
 assert.deepEqual(delivered,[{userId:'123456789',text:'Код входа в TimoPOS: 246810. Действует 5 минут. Никому не сообщайте код.',notify:true}]);
});
test('reject malformed IDs and OTP messages',async()=>{
 const sender=new MaxSellerOtpSender({maxClient:{sendMessage(){throw Error('should not send')}}});
 for(const recipientId of ['abc','-1','999999999999999999999',''])await assert.rejects(sender.sendPrivateMessage({recipientId,text:'Код входа в TimoPOS: 246810. Действует 5 минут.'}),/INVALID_MAX_RECIPIENT/);
 await assert.rejects(sender.sendPrivateMessage({recipientId:'1',text:'other message'}),/INVALID_SELLER_OTP_MESSAGE/);
});
test('requires configured actual MAX client',()=>{
 assert.throws(()=>new MaxSellerOtpSender({}),/requires/);
});
