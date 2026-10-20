'use strict';
const express=require('express');
const {SberQrPaymentAdapter}=require('../../modules/payment/sber/SberQrPaymentAdapter');
function installSberQrGateway(dependencies) {
  const checkout=dependencies.paymentCheckoutService;
  const adapter=dependencies.sberQrPaymentAdapter||new SberQrPaymentAdapter({prisma:dependencies.prisma||dependencies.paymentRepository?.prisma||require('../../common/database').getPrismaClient()});
  if(checkout?.providers)checkout.providers.SBER_SBP=adapter;
  if(dependencies.paymentService?.providers)dependencies.paymentService.providers.SBER_SBP=adapter;
  dependencies.sberQrPaymentAdapter=adapter;
  const router=express.Router();
  router.get('/capabilities',(req,res)=>{res.set('Cache-Control','no-store');res.json({data:adapter.capability(String(req.query.machineId||''))});});
  return router;
}
module.exports={installSberQrGateway};
