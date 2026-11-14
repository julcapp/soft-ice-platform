'use strict';

/**
 * Server-authoritative TimoPOS basket.
 * Catalog/price/availability are loaded from Soft_ICE by the backend adapter,
 * never from a terminal-provided price or cached barcode label.
 * Cash/cart card/QR are payment-method choices; this service DOES NOT mark an
 * order paid, issue a fiscal receipt, fulfill an order or award club bonuses.
 */
const METHOD=Object.freeze({CASH:'CASH',CASHLESS:'CASHLESS'});
function fail(code){return Object.assign(new Error('Операция с корзиной недоступна.'),{code});}
function validQuantity(value){return Number.isSafeInteger(value)&&value>0&&value<=999;}
function validKopecks(value){return Number.isSafeInteger(value)&&value>=0&&value<=1000000000;}
function presentItem(item){
 if(!item||!item.sku||typeof item.name!=='string'||!validKopecks(item.priceKopecks)||item.available!==true)
   throw fail('PRODUCT_NOT_AVAILABLE');
 return {sku:item.sku,name:item.name,group:item.group||'OTHER',
  priceKopecks:item.priceKopecks,unit:item.unit||'шт.',available:true};
}
function makeQuote({lines,catalogItems,version}){
 if(!Array.isArray(lines)||!lines.length)throw fail('CART_EMPTY');
 const bySku=new Map((catalogItems||[]).map(item=>[item.sku,item]));
 let total=0,quantity=0;
 const result=lines.map(line=>{
  if(!line||!validQuantity(line.quantity))throw fail('QUANTITY_INVALID');
  const item=presentItem(bySku.get(line.sku));
  const lineTotal=item.priceKopecks*line.quantity;
  if(!Number.isSafeInteger(lineTotal))throw fail('AMOUNT_OVERFLOW');
  total+=lineTotal;quantity+=line.quantity;
  if(!Number.isSafeInteger(total)||total>100000000000)throw fail('AMOUNT_OVERFLOW');
  return {...item,quantity:line.quantity,lineTotalKopecks:lineTotal};
 });
 return Object.freeze({currency:'RUB',catalogVersion:version??null,
  totalKopecks:total,totalQuantity:quantity,lines:result});
}
function addLine(lines,sku,count=1){
 if(typeof sku!=='string'||!sku.trim()||!validQuantity(count))throw fail('INVALID_LINE');
 const current=Array.isArray(lines)?lines:[];
 const found=current.find(row=>row.sku===sku);
 if(found && !validQuantity(found.quantity+count))throw fail('QUANTITY_INVALID');
 if(!found&&current.length>=200)throw fail('BASKET_TOO_LARGE');
 return found?current.map(row=>row.sku===sku?{sku,quantity:row.quantity+count}:row)
   :[...current,{sku,quantity:count}];
}
function removeLine(lines,sku){return (lines||[]).filter(line=>line.sku!==sku);}
class TimoPosBasketService {
 constructor({catalog,access,clock=()=>new Date()}={}){
  if(!catalog?.getPointOffer||!catalog?.resolveBarcode||!access?.assertSalesAccess)
    throw Error('TimoPOS catalog/access adapters required');
  this.catalog=catalog;this.access=access;this.clock=clock;
 }
 async getCatalog({pointId,terminalId}){
  const offer=await this.catalog.getPointOffer({pointId,terminalId});
  if(!offer||!Array.isArray(offer.items))throw fail('CATALOG_UNAVAILABLE');
  return {version:offer.version??null,items:offer.items.filter(x=>x.available===true).map(presentItem)};
 }
 async addByBarcode({pointId,terminalId,lines,barcode}){
  const code=String(barcode||'').trim();
  if(!/^[0-9A-Za-z.-]{4,64}$/.test(code))throw fail('BARCODE_INVALID');
  const resolved=await this.catalog.resolveBarcode({pointId,terminalId,barcode:code});
  if(!resolved?.sku)throw fail('BARCODE_UNKNOWN');
  const offer=await this.getCatalog({pointId,terminalId});
  if(!offer.items.some(x=>x.sku===resolved.sku))throw fail('PRODUCT_NOT_AVAILABLE');
  return addLine(lines,resolved.sku);
 }
 async quote({pointId,terminalId,lines}){
  const offer=await this.getCatalog({pointId,terminalId});
  return makeQuote({lines,catalogItems:offer.items,version:offer.version});
 }
 async prepareCheckout({context,lines,paymentMethod,clubChoice='DECLINED',clubVerificationId=null}){
  if(!Object.values(METHOD).includes(paymentMethod))throw fail('PAYMENT_METHOD_INVALID');
  if(!['VERIFIED','DECLINED','PENDING'].includes(clubChoice))throw fail('CLUB_CHOICE_INVALID');
  if(clubChoice==='VERIFIED'&&!clubVerificationId)throw fail('CLUB_VERIFICATION_REQUIRED');
  await this.access.assertSalesAccess({...context,at:this.clock()});
  const quote=await this.quote({pointId:context.pointId,terminalId:context.terminalId,lines});
  if(quote.totalKopecks<=0)throw fail('ZERO_TOTAL_REQUIRES_SEPARATE_POLICY');
  return {quote,paymentMethod,clubEligibility:clubChoice==='VERIFIED'?'VERIFIED':
    clubChoice==='PENDING'?'PENDING_VERIFICATION':'GUEST',
    clubVerificationId:clubChoice==='VERIFIED'?clubVerificationId:null,
    status:'AWAITING_PAYMENT',canFulfill:false,canAwardBonuses:false};
 }
}
module.exports={METHOD,makeQuote,addLine,removeLine,TimoPosBasketService};
