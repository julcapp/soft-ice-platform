class PaymentProviderAdapter {
  constructor({provider}){this.provider=provider;}
  createPayment(){throw blocked();} getPaymentStatus(){throw blocked();} cancelPayment(){throw blocked();} refundPayment(){throw blocked();}
  verifyWebhookSignature(){throw blocked('PAYMENT_WEBHOOK_SIGNATURE_BLOCKED_EXTERNAL','Проверка подписи webhook не подключена.');}
  parseWebhook(){throw blocked('PAYMENT_WEBHOOK_MAPPING_BLOCKED_EXTERNAL','Маппинг production webhook не подключён.');}
}
class BlockedExternalPaymentProviderAdapter extends PaymentProviderAdapter {constructor({provider='YOOKASSA'}={}){super({provider});this.implementationKind='PRODUCTION';this.integrationStatus='BLOCKED_EXTERNAL';}}
class TestPaymentProviderAdapter extends PaymentProviderAdapter {
  constructor({provider='TEST',payments={}}={}){super({provider});this.payments=new Map(Object.entries(payments));this.implementationKind='TEST_ONLY';}
  async createPayment(request){const value={providerPaymentId:`test_${request.paymentId}`,status:'PENDING',amount:request.amount,currency:request.currency};this.payments.set(value.providerPaymentId,value);return value;}
  async getPaymentStatus(id){return this.payments.get(id)||null;} async cancelPayment(id){const value=this.payments.get(id);return value?Object.assign(value,{status:'CANCELED'}):null;}
  async refundPayment(request){return{providerRefundId:`test_refund_${request.refundId}`,status:'PENDING',amount:request.amount,currency:request.currency};}
  async verifyWebhookSignature(){return true;} setPayment(id,value){this.payments.set(id,{...value,providerPaymentId:id});}
  async parseWebhook({body}){return body;}
}
function blocked(code='PAYMENT_PROVIDER_BLOCKED_EXTERNAL',message='Production Payment provider не подключён.'){return Object.assign(new Error(message),{code,statusCode:503});}
module.exports={PaymentProviderAdapter,BlockedExternalPaymentProviderAdapter,TestPaymentProviderAdapter};
