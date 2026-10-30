const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
(async () => {
  const rows = await p.payment.findMany({
    where: { amount: 6, status: { in: ['SUCCEEDED','REFUND_PENDING','REFUNDED'] } },
    orderBy: { createdAt: 'desc' },
    take: 5,
    select: {
      id:true, orderId:true, status:true, amount:true, currency:true, provider:true,
      providerPaymentId:true, machineId:true, organizationId:true, createdAt:true,
      refunds:{select:{id:true,status:true,amount:true,providerRefundId:true}}
    }
  });
  console.log(JSON.stringify(rows,null,2));
})().catch(e=>{console.error(e);process.exitCode=1}).finally(async()=>{await p.$disconnect()});
