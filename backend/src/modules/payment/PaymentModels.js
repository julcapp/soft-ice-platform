const PAYMENT_STATUS = Object.freeze({ CREATED:'CREATED', PENDING:'PENDING', AUTHORIZED:'AUTHORIZED', SUCCEEDED:'SUCCEEDED', FAILED:'FAILED', CANCELED:'CANCELED', REFUND_PENDING:'REFUND_PENDING', REFUNDED:'REFUNDED' });
const REFUND_STATUS = Object.freeze({ REQUESTED:'REQUESTED', PENDING:'PENDING', SUCCEEDED:'SUCCEEDED', FAILED:'FAILED' });
const TRANSITIONS = new Map([['CREATED',new Set(['PENDING','CANCELED','FAILED'])],['PENDING',new Set(['AUTHORIZED','SUCCEEDED','FAILED','CANCELED'])],['AUTHORIZED',new Set(['SUCCEEDED','FAILED','CANCELED'])],['SUCCEEDED',new Set(['REFUND_PENDING'])],['REFUND_PENDING',new Set(['REFUNDED','SUCCEEDED'])],['FAILED',new Set()],['CANCELED',new Set()],['REFUNDED',new Set()]]);
function assertPaymentTransition(from,to){if(from===to||!TRANSITIONS.get(from)?.has(to))throw error('PAYMENT_TRANSITION_INVALID',`Переход Payment ${from} -> ${to} запрещён.`,409);}
function money(value){if(value===null||value===undefined||value===''||!Number.isFinite(Number(value)))throw error('PAYMENT_AMOUNT_INVALID','Сумма платежа некорректна.',400);const normalized=Number(value).toFixed(2);if(Number(normalized)<=0)throw error('PAYMENT_AMOUNT_INVALID','Сумма платежа должна быть положительной.',400);return normalized;}
function sameMoney(left,right){return money(left)===money(right);}
function error(code,message,statusCode=400){return Object.assign(new Error(message),{code,statusCode});}
module.exports={PAYMENT_STATUS,REFUND_STATUS,assertPaymentTransition,money,sameMoney,error};
