'use strict';
/**
 * Run from a dedicated systemd timer with a database connection and audit callback.
 * The caller must implement a transactionally consistent audit trail before activation.
 */
async function releaseExpiredBlocks({ repository, audit, clock = () => new Date() }) {
 if(!repository || typeof repository.releaseExpiredBlocks !== 'function') throw new TypeError('Repository required');
 if(typeof audit !== 'function') throw new TypeError('Audit callback required');
 const now=clock();
 const released=await repository.releaseExpiredBlocks(now);
 for(const item of released) {
  await audit({eventType:'CRM.CustomerBlockExpired',customerId:item.id,occurredAt:now.toISOString()});
 }
 return released.length;
}
module.exports={releaseExpiredBlocks};

