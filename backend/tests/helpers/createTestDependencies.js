const { ClubAccountRuntime } = require('../../src/modules/club_account/ClubAccountRuntime');
const { CustomerRuntime } = require('../../src/modules/customer/CustomerRuntime');
const { NoopAuditRepository } = require('../../src/platform/audit/AuditRepository');
const { InMemoryIdempotencyRepository } = require('../../src/platform/idempotency/IdempotencyRepository');
const { IdempotencyService } = require('../../src/platform/idempotency/IdempotencyService');
const { AuthCoreService } = require('../../src/platform/security/AuthCoreService');
const { verifyTelegramInitData } = require('../../src/platform/security/telegramMiniAppVerifier');

function createTestDependencies({ botToken, now = new Date('2026-07-13T12:00:00.000Z') }) {
  const auditRepository = new NoopAuditRepository();
  const customerRepository = new InMemoryCustomerRepository();
  const clubAccountRepository = new InMemoryClubAccountRepository();
  const authSessionRepository = new InMemoryAuthSessionRepository();
  const idempotencyService = new IdempotencyService(new InMemoryIdempotencyRepository());

  const customerRuntime = new CustomerRuntime({
    customerRepository,
    auditRepository,
  });

  const clubAccountRuntime = new ClubAccountRuntime({
    clubAccountRepository,
    auditRepository,
  });

  const authCoreService = new AuthCoreService({
    authSessionRepository,
    customerRuntime,
    clubAccountRuntime,
    auditRepository,
    idempotencyService,
    telegramVerifier: (initData) =>
      verifyTelegramInitData(initData, {
        botToken,
        maxAgeSeconds: 86400,
      }),
    tokenFactory: createTokenFactory(),
    clock: () => now,
  });

  return {
    authCoreService,
    customerRuntime,
    clubAccountRuntime,
  };
}

class InMemoryCustomerRepository {
  constructor() {
    this.customers = new Map();
    this.identities = new Map();
    this.customerSequence = 0;
    this.identitySequence = 0;
  }

  async findById(customerId) {
    const customer = this.customers.get(customerId);

    if (!customer) {
      return null;
    }

    return markTelegramLinked({
      ...customer,
      identities: this.findIdentitiesForCustomer(customerId),
    });
  }

  async findByIdentity(provider, externalSubjectHash) {
    const identity = this.identities.get(`${provider}:${externalSubjectHash}`);

    if (!identity || identity.revokedAt) {
      return null;
    }

    return {
      identity,
      customer: await this.findById(identity.customerId),
    };
  }

  async createTelegramCustomer({ telegramIdentity, displayName, sourceChannel }) {
    this.customerSequence += 1;
    this.identitySequence += 1;

    const now = new Date();
    const customer = {
      id: `customer_test_${this.customerSequence}`,
      name: displayName,
      status: 'active',
      createdAt: now,
      updatedAt: now,
    };
    const identity = {
      id: `identity_test_${this.identitySequence}`,
      customerId: customer.id,
      provider: 'telegram',
      externalSubjectHash: telegramIdentity.subjectHash,
      externalUsername: telegramIdentity.user.username,
      displayName,
      verificationMethod: 'telegram_init_data',
      status: 'active',
      sourceChannel,
      verifiedAt: now,
      linkedAt: now,
      lastSeenAt: now,
      revokedAt: null,
    };

    this.customers.set(customer.id, customer);
    this.identities.set(`telegram:${telegramIdentity.subjectHash}`, identity);

    return {
      customer: markTelegramLinked({
        ...customer,
        identities: [identity],
      }),
      identity,
    };
  }

  async updateTelegramIdentitySeen(identityId, { displayName, username }) {
    const identity = [...this.identities.values()].find(({ id }) => id === identityId);

    identity.displayName = displayName;
    identity.externalUsername = username;
    identity.lastSeenAt = new Date();

    return {
      identity,
      customer: await this.findById(identity.customerId),
    };
  }

  findIdentitiesForCustomer(customerId) {
    return [...this.identities.values()].filter(
      (identity) => identity.customerId === customerId,
    );
  }
}

class InMemoryClubAccountRepository {
  constructor() {
    this.accounts = new Map();
    this.transactions = new Map();
    this.sequence = 0;
    this.transactionSequence = 0;
  }

  async findByCustomerId(customerId) {
    return this.accounts.get(customerId) || null;
  }

  async createForCustomer(customerId) {
    this.sequence += 1;

    const now = new Date();
    const clubAccount = {
      id: `club_account_test_${this.sequence}`,
      customerId,
      status: 'active',
      currency: 'RUB',
      balanceRub: 0,
      availableBalanceRub: 0,
      reservedBalanceRub: 0,
      clubActive: true,
      activatedAt: now,
      lastTopupAt: null,
      lastTransactionId: null,
      projectionVersion: 0,
      createdAt: now,
      updatedAt: now,
    };

    this.accounts.set(customerId, clubAccount);
    return clubAccount;
  }

  async appendBalanceTransaction(command) {
    if (command.idempotencyKey) {
      const existing = [...this.transactions.values()].find(
        (transaction) =>
          transaction.clubAccountId === command.clubAccountId &&
          transaction.idempotencyKey === command.idempotencyKey,
      );

      if (existing) {
        return {
          account: this.accounts.get(existing.customerId),
          transaction: existing,
          created: false,
        };
      }
    }

    const account = [...this.accounts.values()].find(
      ({ id }) => id === command.clubAccountId,
    );

    if (!account) {
      return null;
    }

    const availableDelta =
      command.direction === 'credit' ? command.amountRub : -command.amountRub;
    const nextAvailable = account.availableBalanceRub + availableDelta;

    if (nextAvailable < 0) {
      const error = new Error('Club Account available balance is insufficient.');
      error.statusCode = 422;
      error.code = 'INSUFFICIENT_AVAILABLE_BALANCE';
      error.source = 'runtime';
      throw error;
    }

    this.transactionSequence += 1;
    const now = new Date();
    const transaction = {
      id: `club_tx_test_${this.transactionSequence}`,
      clubAccountId: account.id,
      customerId: account.customerId,
      transactionType: command.transactionType,
      direction: command.direction,
      amountRub: command.amountRub,
      currency: command.currency,
      availableDeltaRub: availableDelta,
      reservedDeltaRub: 0,
      availableBalanceAfterRub: nextAvailable,
      reservedBalanceAfterRub: account.reservedBalanceRub,
      balanceAfterRub: nextAvailable + account.reservedBalanceRub,
      status: 'posted',
      reason: command.reason,
      referenceEntityType: command.referenceEntityType || null,
      referenceEntityId: command.referenceEntityId || null,
      sourceDomain: command.sourceDomain || null,
      sourceId: command.sourceId || null,
      idempotencyKey: command.idempotencyKey || null,
      actorType: command.actorType || 'customer',
      actorId: command.actorId || null,
      correlationId: command.correlationId || null,
      createdAt: now,
      postedAt: now,
    };

    account.balanceRub = nextAvailable;
    account.availableBalanceRub = nextAvailable;
    account.lastTransactionId = transaction.id;
    account.projectionVersion += 1;
    account.updatedAt = now;

    if (command.transactionType === 'top_up_credit') {
      account.lastTopupAt = now;
    }

    this.transactions.set(transaction.id, transaction);

    return {
      account,
      transaction,
      created: true,
    };
  }

  async findTransactionsByCustomerId(customerId, { limit = 50 } = {}) {
    return [...this.transactions.values()]
      .filter((transaction) => transaction.customerId === customerId)
      .sort((left, right) => {
        const postedDiff = right.postedAt.getTime() - left.postedAt.getTime();

        if (postedDiff !== 0) {
          return postedDiff;
        }

        return right.id.localeCompare(left.id);
      })
      .slice(0, limit);
  }

  async calculateBalanceFromTransactions(clubAccountId) {
    return [...this.transactions.values()]
      .filter(
        (transaction) =>
          transaction.clubAccountId === clubAccountId && transaction.status === 'posted',
      )
      .reduce(
        (balance, transaction) => ({
          availableBalanceRub:
            balance.availableBalanceRub + Number(transaction.availableDeltaRub || 0),
          reservedBalanceRub:
            balance.reservedBalanceRub + Number(transaction.reservedDeltaRub || 0),
        }),
        {
          availableBalanceRub: 0,
          reservedBalanceRub: 0,
        },
      );
  }
}

class InMemoryAuthSessionRepository {
  constructor() {
    this.sessions = new Map();
    this.sequence = 0;
  }

  async createCustomerSession({
    customerId,
    accessTokenHash,
    authMethod,
    consumerType,
    expiresAt,
    correlationId,
  }) {
    this.sequence += 1;

    const now = new Date();
    const session = {
      id: `session_test_${this.sequence}`,
      subjectType: 'user',
      customerId,
      accessTokenHash,
      authMethod,
      consumerType,
      tokenType: 'Bearer',
      correlationId,
      createdAt: now,
      lastSeenAt: now,
      expiresAt,
      revokedAt: null,
    };

    this.sessions.set(accessTokenHash, session);
    return session;
  }

  async findValidByAccessTokenHash(accessTokenHash, now = new Date()) {
    const session = this.sessions.get(accessTokenHash);

    if (!session || session.revokedAt || session.expiresAt <= now) {
      return null;
    }

    return session;
  }

  async touch(sessionId) {
    const session = [...this.sessions.values()].find(({ id }) => id === sessionId);

    if (session) {
      session.lastSeenAt = new Date();
    }

    return session || null;
  }
}

function markTelegramLinked(customer) {
  return {
    ...customer,
    telegramLinked: Boolean(
      customer.identities &&
        customer.identities.some(
          (identity) => identity.provider === 'telegram' && !identity.revokedAt,
        ),
    ),
  };
}

function createTokenFactory() {
  let sequence = 0;

  return () => {
    sequence += 1;
    return `test_access_token_${sequence}`;
  };
}

module.exports = {
  createTestDependencies,
};
