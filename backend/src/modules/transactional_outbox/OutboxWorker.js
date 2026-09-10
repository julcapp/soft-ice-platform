class RetryPolicy {
  constructor({ baseDelayMs = 1000, maxDelayMs = 300000 } = {}) { this.baseDelayMs=baseDelayMs; this.maxDelayMs=maxDelayMs; }
  delay(attemptNumber) { return Math.min(this.baseDelayMs * (2 ** Math.max(0, attemptNumber - 1)), this.maxDelayMs); }
}
class OutboxWorker {
  constructor({ repository, publisher, workerId, eventType=null, clock=()=>new Date(), batchSize=50, leaseMs=60000, retryPolicy=new RetryPolicy() }) { Object.assign(this,{repository,publisher,workerId,eventType,clock,batchSize,leaseMs,retryPolicy}); }
  async runOnce({ organizationId, eventTypes } = {}) {
    const now=this.clock(); await this.repository.releaseExpiredLocks({before:new Date(now.getTime()-this.leaseMs),now});
    const results=[]; const types=Array.isArray(eventTypes)&&eventTypes.length?eventTypes:(this.eventType?[this.eventType]:undefined);
    for(let index=0;index<this.batchSize;index+=1){
      const [event]=await this.repository.claimPendingEvents({workerId:this.workerId,batchSize:1,now:this.clock(),organizationId,eventTypes:types});
      if(!event)break;
      try { await this.publishWithLeaseHeartbeat(event); }
      catch(error){
        if(error.deferWithoutAttempt){results.push(await this.repository.deferWithoutAttempt(event.eventId,this.workerId,{availableAt:error.availableAt,error}));continue;}
        const nextAttempt=event.attemptCount+1; results.push(error.permanent || nextAttempt>=event.maxAttempts ? await this.repository.markDeadLetter(event.eventId,this.workerId,error) : await this.repository.scheduleRetry(event.eventId,this.workerId,{availableAt:new Date(this.clock().getTime()+this.retryPolicy.delay(nextAttempt)),error})); continue;
      }
      results.push(await this.repository.markPublished(event.eventId,this.workerId,this.clock()));
    }
    return results;
  }
  async publishWithLeaseHeartbeat(event) {
    const heartbeatIntervalMs=Math.max(10,Math.floor(this.leaseMs/3));
    let renewals=Promise.resolve(); let heartbeatError=null;
    const heartbeat=setInterval(()=>{renewals=renewals.then(()=>this.repository.renewLease(event.eventId,this.workerId,this.clock())).catch((error)=>{heartbeatError=heartbeatError||error;});},heartbeatIntervalMs);
    let result; let publishError=null;
    try { result=await this.publisher.publish(toEnvelope(event)); }
    catch(error){publishError=error;}
    finally {clearInterval(heartbeat);await renewals;}
    if(heartbeatError)throw heartbeatError;
    await this.repository.renewLease(event.eventId,this.workerId,this.clock());
    if(publishError)throw publishError;
    return result;
  }
}
class InMemoryPublisher { constructor({fail}={}){this.fail=fail;this.published=[];} async publish(event){if(this.fail)throw(this.fail instanceof Error?this.fail:new Error('TEST_PUBLISH_FAILURE'));this.published.push(event);return event;} }
function toEnvelope(event){return {eventId:event.eventId,eventType:event.eventType,eventVersion:event.eventVersion,occurredAt:event.occurredAt,aggregateType:event.aggregateType,aggregateId:event.aggregateId,organizationId:event.organizationId,correlationId:event.correlationId,causationId:event.causationId,payload:event.payload};}
module.exports={OutboxWorker,RetryPolicy,InMemoryPublisher,toEnvelope};
