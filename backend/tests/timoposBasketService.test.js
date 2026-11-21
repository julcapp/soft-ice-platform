'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {METHOD,makeQuote,addLine,removeLine,TimoPosBasketService}
 =require('../src/modules/timopos/TimoPosBasketService');
const items=[
 {sku:'ICE-VAN',name:'Мороженое ванильное',group:'ICE_CREAM',priceKopecks:9500,available:true,unit:'шт.'},
 {sku:'TOP-CHOC',name:'Шоколадный топпинг',group:'TOPPING',priceKopecks:4500,available:true,unit:'шт.'},
 {sku:'OUT',name:'Недоступная позиция',group:'OTHER',priceKopecks:100,available:false},
];
let allowed=true;const factory=()=>new TimoPosBasketService({
 catalog:{getPointOffer:async()=>({version:'catalog-v7',items}),
 resolveBarcode:async({barcode})=>({sku:barcode==='4601234567890'?'ICE-VAN':'UNKNOWN'})},
 access:{assertSalesAccess:async()=>{if(!allowed)throw Error('SHIFT_OR_BREAK_DENIED');}},
 clock:()=>new Date('2026-11-14T12:00:00Z')});
const ctx={pointId:'point-1',terminalId:'POS-001',sellerId:'seller-1',shiftId:'shift-1'};
test('cart supports manual items and sums server catalog values',async()=>{
 const service=factory();const lines=addLine(addLine([], 'ICE-VAN',2),'TOP-CHOC');
 const quote=await service.quote({...ctx,lines});
 assert.equal(quote.totalKopecks,23500);
 assert.equal(quote.totalQuantity,3);
 assert.equal(quote.lines[0].name,'Мороженое ванильное');
 assert.equal(quote.catalogVersion,'catalog-v7');
});
test('barcode scans resolve product through point offer',async()=>{
 const result=await factory().addByBarcode({...ctx,lines:[],barcode:'4601234567890'});
 assert.deepEqual(result,[{sku:'ICE-VAN',quantity:1}]);
 await assert.rejects(factory().addByBarcode({...ctx,lines:[],barcode:'99999999'}),{code:'PRODUCT_NOT_AVAILABLE'});
});
test('cash or cashless selection does not mark paid or award bonuses',async()=>{
 for(const method of Object.values(METHOD)){
 const prep=await factory().prepareCheckout({context:ctx,lines:[{sku:'ICE-VAN',quantity:1}],paymentMethod:method,clubChoice:'DECLINED'});
 assert.equal(prep.paymentMethod,method);
 assert.equal(prep.status,'AWAITING_PAYMENT');assert.equal(prep.canFulfill,false);
 assert.equal(prep.canAwardBonuses,false);assert.equal(prep.clubEligibility,'GUEST');
 }
});
test('pending club registration does not block a sale',async()=>{
 const prep=await factory().prepareCheckout({context:ctx,lines:[{sku:'ICE-VAN',quantity:1}],paymentMethod:'CASH',clubChoice:'PENDING'});
 assert.equal(prep.clubEligibility,'PENDING_VERIFICATION');
 assert.equal(prep.clubVerificationId,null);
});
test('known member must have independent club verification reference',async()=>{
 await assert.rejects(factory().prepareCheckout({context:ctx,lines:[{sku:'ICE-VAN',quantity:1}],paymentMethod:'CASHLESS',clubChoice:'VERIFIED'}),{code:'CLUB_VERIFICATION_REQUIRED'});
 const prep=await factory().prepareCheckout({context:ctx,lines:[{sku:'ICE-VAN',quantity:1}],paymentMethod:'CASHLESS',clubChoice:'VERIFIED',clubVerificationId:'club-proof-123'});
 assert.equal(prep.clubEligibility,'VERIFIED');
});
test('server enforces shift, working hours and active break through access adapter',async()=>{
 allowed=false;
 try{await assert.rejects(factory().prepareCheckout({context:ctx,lines:[{sku:'ICE-VAN',quantity:1}],paymentMethod:'CASH'}),/SHIFT_OR_BREAK_DENIED/);}
 finally{allowed=true;}
});
test('unavailable item, fake price and invalid quantities are rejected or ignored',async()=>{
 await assert.rejects(factory().quote({...ctx,lines:[{sku:'OUT',quantity:1}]}),{code:'PRODUCT_NOT_AVAILABLE'});
 await assert.rejects(factory().quote({...ctx,lines:[{sku:'ICE-VAN',quantity:0}]}),{code:'QUANTITY_INVALID'});
 const q=await factory().quote({...ctx,lines:[{sku:'ICE-VAN',quantity:1,priceKopecks:1}]});
 assert.equal(q.totalKopecks,9500);
});
test('repeated scan increments quantity, removal clears line',()=>{
 const lines=addLine(addLine([],'ICE-VAN'),'ICE-VAN');
 assert.deepEqual(lines,[{sku:'ICE-VAN',quantity:2}]);
 assert.deepEqual(removeLine(lines,'ICE-VAN'),[]);
});
test('invalid or empty basket cannot proceed to payment',async()=>{
 await assert.rejects(factory().prepareCheckout({context:ctx,lines:[],paymentMethod:'CASH'}),{code:'CART_EMPTY'});
 await assert.rejects(factory().prepareCheckout({context:ctx,lines:[{sku:'ICE-VAN',quantity:1}],paymentMethod:'CRYPTO'}),{code:'PAYMENT_METHOD_INVALID'});
});
