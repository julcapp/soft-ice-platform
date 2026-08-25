class RetryPolicy {
  constructor({ baseDelayMs = 1000, maxDelayMs = 300000 } = {}) { this.baseDelayMs=baseDelayMs; this.maxDelayMs=maxDelayMs; }
  delay(attemptNumber) { return Math.min(this.baseDelayMs * (2 ** Math.max(0, attemptNumber - 1)), this.maxDelayMs); }
}
class OutboxWorker {
  constructor({ repository, publisher, workerId, clock=()=>new Date(), batchSize=50, leaseMs=60000, retryPolicy=new RetryPolicy() }) { Object.assign(this,{repository,publisher,workerId,clock,batchSize,leaseMs,retryPolicy}); }
  async runOnce({ organizationId, eventTypes } = {}) {
    const now=this.clock(); await this.repository.releaseExpiredLocks({before:new Date(now.getTime()-this.leaseMs),now});
    const events=await this.repository.claimPendingEvents({workerId:this.workerId,batchSize:this.batchSize,now,organizationId,eventTypes});
    const results=[];
    for(const event of events){
      try { await this.publisher.publish(toEnvelope(event)); }
      catch(error){ const nextAttempt=event.attemptCount+1; results.push(nextAttempt>=event.maxAttempts ? await this.repository.markDeadLetter(event.eventId,this.workerId,error) : await this.repository.scheduleRetry(event.eventId,this.workerId,{availableAt:new Date(this.clock().getTime()+this.retryPolicy.delay(nextAttempt)),error})); continue; }
      results.push(await this.repository.markPublished(event.eventId,this.workerId,this.clock()));
    }
    return results;
  }
}
class InMemoryPublisher { constructor({fail}={}){this.fail=fail;this.published=[];} async publish(event){if(this.fail)throw(this.fail instanceof Error?this.fail:new Error('TEST_PUBLISH_FAILURE'));this.published.push(event);return event;} }
function toEnvelope(event){return {eventId:event.eventId,eventType:event.eventType,eventVersion:event.eventVersion,occurredAt:event.occurredAt,aggregateType:event.aggregateType,aggregateId:event.aggregateId,organizationId:event.organizationId,correlationId:event.correlationId,causationId:event.causationId,payload:event.payload};}
module.exports={OutboxWorker,RetryPolicy,InMemoryPublisher,toEnvelope};
