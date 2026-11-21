'use strict';

/** Shared summary DTO for TimoPOS and admin. All money in integer kopecks.
 * Only verified backend records, with a single immutable ID each.
 * Previously paid orders issued now are an operating metric, not new revenue.
 */
const LIMIT=100000000000;
function err(code){return Object.assign(new Error('Shift summary invalid'),{code});}
function money(n){if(!Number.isSafeInteger(n)||n<0||n>LIMIT)throw err('INVALID_AMOUNT');return n;}
function add(total,amount){const v=total+money(amount);if(!Number.isSafeInteger(v)||v>LIMIT)throw err('TOTAL_OVERFLOW');return v;}
function summarizePointShift({point,seller,shift,transactions=[],issues=[]}){
 if(!point?.id||!point.code||!seller?.id||!seller.fullName||!shift?.id||
   !['OPEN','CLOSED'].includes(shift.status))throw err('MISSING_SHIFT_SCOPE');
 if(!Array.isArray(transactions)||!Array.isArray(issues))throw err('INVALID_RECORDS');
 const totals={cashKopecks:0,cardKopecks:0,sbpKopecks:0,refundKopecks:0,prepaidIssuedKopecks:0,
   paidTransactions:0,prepaidIssues:0};
 const paidIds=new Set(),issueIds=new Set();
 for(const t of transactions){
  if(!t?.id||paidIds.has(t.id))throw err('DUPLICATE_TRANSACTION');
  paidIds.add(t.id);
  if(t.shiftId!==shift.id||t.pointId!==point.id||t.sellerId!==seller.id)throw err('SCOPE_MISMATCH');
  if(t.status==='PENDING'||t.status==='FAILED'||t.status==='CANCELLED')continue;
  if(t.status==='REFUNDED'){totals.refundKopecks=add(totals.refundKopecks,t.amountKopecks);continue}
  if(t.method==='CASH'&&t.status==='CASH_CONFIRMED'&&t.fiscalized===true)
    totals.cashKopecks=add(totals.cashKopecks,t.amountKopecks);
  else if(t.method==='CARD'&&t.status==='SUCCEEDED'&&t.verifiedByBackend===true)
    totals.cardKopecks=add(totals.cardKopecks,t.amountKopecks);
  else if(t.method==='SBP'&&t.status==='SUCCEEDED'&&t.verifiedByBackend===true)
    totals.sbpKopecks=add(totals.sbpKopecks,t.amountKopecks);
  else if(t.status==='SUCCEEDED'||t.status==='CASH_CONFIRMED')throw err('UNVERIFIED_PAYMENT');
  else continue;
  totals.paidTransactions++;
 }
 for(const issue of issues){
  if(!issue?.id||issueIds.has(issue.id))throw err('DUPLICATE_ISSUE');
  issueIds.add(issue.id);
  if(issue.shiftId!==shift.id||issue.pointId!==point.id||issue.sellerId!==seller.id)
    throw err('SCOPE_MISMATCH');
  if(issue.status!=='ISSUED')continue;
  if(issue.prepaid===true){
   if(issue.paymentVerified!==true||!issue.prepaidOrderId)throw err('PREPAID_NOT_VERIFIED');
   totals.prepaidIssuedKopecks=add(totals.prepaidIssuedKopecks,issue.amountKopecks);
   totals.prepaidIssues++;
  }
 }
 totals.cashlessKopecks=add(totals.cardKopecks,totals.sbpKopecks);
 totals.currentShiftRevenueKopecks=add(totals.cashKopecks,totals.cashlessKopecks);
 if(totals.refundKopecks>totals.currentShiftRevenueKopecks){
   // Refunds can belong to earlier shifts; a negative shift net is legitimate.
   totals.netRevenueKopecks=totals.currentShiftRevenueKopecks-totals.refundKopecks;
 }else totals.netRevenueKopecks=totals.currentShiftRevenueKopecks-totals.refundKopecks;
 totals.servicedValueKopecks=add(totals.currentShiftRevenueKopecks,totals.prepaidIssuedKopecks);
 return {point:{id:point.id,code:point.code,name:point.name||null},
 seller:{id:seller.id,fullName:seller.fullName},shift:{id:shift.id,status:shift.status,
 startedAt:shift.startedAt||null,closedAt:shift.closedAt||null},
 totals,note:'Previously-paid issues are NOT added to current-shift revenue.'};
}
module.exports={summarizePointShift};
