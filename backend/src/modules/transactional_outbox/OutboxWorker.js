'use strict';

class RetryPolicy {
  constructor({ baseDelayMs = 1000, maxDelayMs = 300000 } = {}) {
    this.baseDelayMs = baseDelayMs;
    this.maxDelayMs = maxDelayMs;
  }
  delay(attemptNumber) {
    return Math.min(this.baseDelayMs * (2 ** Math.max(0, attemptNumber - 1)), this.maxDelayMs);
  }
}

class OutboxWorker {
  constructor({
    repository, publisher, workerId, clock = () => new Date(),
    batchSize = 50, leaseMs = 60000, retryPolicy = new RetryPolicy(),
    eventType = null,
  }) {
    Object.assign(this, { repository, publisher, workerId, clock, batchSize, leaseMs, retryPolicy, eventType });
  }

  async runOnce({ organizationId, eventTypes } = {}) {
    const now = this.clock();
    await this.repository.releaseExpiredLocks({
      before: new Date(now.getTime() - this.leaseMs),
      now,
    });

    const constrainedTypes = this.eventType ? [this.eventType] : eventTypes;
    const results = [];
    // Claim one event at a time: avoid holding other events while slow external calls run.
    for (let i = 0; i < this.batchSize; i++) {
      const batch = await this.repository.claimPendingEvents({
        workerId: this.workerId, batchSize: 1, now: this.clock(),
        organizationId, eventTypes: constrainedTypes,
      });
      if (!batch.length) break;
      const event = batch[0];
      let renewalError;
      let renewalPending = Promise.resolve();
      let timer;
      if (typeof this.repository.renewLease === 'function') {
        const renew = () => {
          renewalPending = renewalPending.then(async () => {
            try {
              await this.repository.renewLease(event.eventId, this.workerId, this.clock());
            } catch (error) {
              renewalError = error;
            }
          });
          return renewalPending;
        };
        await renew();
        if (renewalError) throw renewalError;
        timer = setInterval(renew, Math.max(5, Math.floor(this.leaseMs / 3)));
        timer.unref?.();
      }
      let publishingError;
      try {
        await this.publisher.publish(toEnvelope(event));
      } catch (error) {
        publishingError = error;
      } finally {
        if (timer) clearInterval(timer);
        await renewalPending;
      }
      if (renewalError) throw renewalError;
      if (publishingError) {
        const attempt = event.attemptCount + 1;
        if (publishingError.deferWithoutAttempt) {
          results.push(await this.repository.scheduleRetry(event.eventId, this.workerId, {
            availableAt: publishingError.availableAt || new Date(this.clock().getTime() + this.retryPolicy.delay(attempt)),
            error: publishingError, preserveAttempt: true,
          }));
        } else if (publishingError.permanent || attempt >= event.maxAttempts) {
          results.push(await this.repository.markDeadLetter(event.eventId, this.workerId, publishingError));
        } else {
          results.push(await this.repository.scheduleRetry(event.eventId, this.workerId, {
            availableAt: new Date(this.clock().getTime() + this.retryPolicy.delay(attempt)),
            error: publishingError,
          }));
        }
        continue;
      }
      results.push(await this.repository.markPublished(event.eventId, this.workerId, this.clock()));
    }
    return results;
  }
}

class InMemoryPublisher {
  constructor({ fail } = {}) { this.fail = fail; this.published = []; }
  async publish(event) {
    if (this.fail) throw (this.fail instanceof Error ? this.fail : new Error('TEST_PUBLISH_FAILURE'));
    this.published.push(event);
    return event;
  }
}

function toEnvelope(event) {
  return {
    eventId: event.eventId, eventType: event.eventType, eventVersion: event.eventVersion,
    occurredAt: event.occurredAt, aggregateType: event.aggregateType,
    aggregateId: event.aggregateId, organizationId: event.organizationId,
    correlationId: event.correlationId, causationId: event.causationId,
    payload: event.payload,
  };
}
module.exports = { OutboxWorker, RetryPolicy, InMemoryPublisher, toEnvelope };
