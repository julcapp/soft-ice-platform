const {test}=require('node:test');const assert=require('node:assert/strict');const {classifyTerminalAttempt}=require('../src/modules/payment/TerminalFulfillmentState');
test('ambiguous and failed results require attention instead of endless waiting',()=>{for(const status of ['RECONCILIATION_REQUIRED','TIMED_OUT','FAILED','CANCELED','DISPENSED'])assert.equal(classifyTerminalAttempt({status}),'ATTENTION_REQUIRED');});
test('preparing requires actual acceptance evidence',()=>{assert.equal(classifyTerminalAttempt({status:'ACCEPTED'}),'WAITING');assert.equal(classifyTerminalAttempt({status:'DISPENSING',startedAt:new Date()}),'PREPARING');assert.equal(classifyTerminalAttempt({status:'SENT'}),'TRANSMITTING');});

test('refunded payment never returns to waiting/preparing',()=>assert.equal(classifyTerminalAttempt({status:'DISPENSING',startedAt:new Date()},'REFUNDED'),'ATTENTION_REQUIRED'));
