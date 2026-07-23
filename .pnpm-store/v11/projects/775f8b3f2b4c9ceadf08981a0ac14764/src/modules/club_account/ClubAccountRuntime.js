const { ApiError } = require('../../platform/errors/ApiError');

const CLUB_ACCOUNT_STATUS = {
  ACTIVE: 'active',
  PENDING_ACTIVATION: 'pending_activation',
  SUSPENDED: 'suspended',
  CLOSING_PENDING: 'closing_pending',
  CLOSED: 'closed',
};

const SUPPORTED_CURRENCY = 'RUB';

class ClubAccountRuntime {
  constructor({ clubAccountRepository, auditRepository }) {
    this.clubAccountRepository = clubAccountRepository;
    this.auditRepository = auditRepository;
  }

  async ensureAccountForCustomer(customer, context) {
    const existing = await this.clubAccountRepository.findByCustomerId(customer.id);

    if (existing) {
      return {
        clubAccount: existing,
        created: false,
      };
    }

    const clubAccount = await this.clubAccountRepository.createForCustomer(customer.id);

    await this.auditRepository.record({
      eventType: 'ClubAccounts.Created',
      subjectType: 'user',
      subjectId: customer.id,
      targetType: 'ClubAccount',
      targetId: clubAccount.id,
      action: 'create',
      decision: 'success',
      reasonCode: 'customer_registration',
      authMethod: context.authMethod,
      sourceChannel: context.sourceChannel,
      correlationId: context.correlationId,
      metadata: {
        currency: 'RUB',
      },
    });

    return {
      clubAccount,
      created: true,
    };
  }

  async getOwnAccount(customerId) {
    const clubAccount = await this.clubAccountRepository.findByCustomerId(customerId);

    if (!clubAccount) {
      throw new ApiError({
        statusCode: 404,
        code: 'RESOURCE_NOT_FOUND',
        message: 'Club Account was not found.',
        source: 'runtime',
      });
    }

    return clubAccount;
  }

  async topUpOwnAccount(customerId, request, context = {}) {
    const clubAccount = await this.getOwnAccount(customerId);

    assertAccountCanChangeBalance(clubAccount);
    const amountRub = parsePositiveAmount(request.amount);
    const currency = request.currency || SUPPORTED_CURRENCY;

    if (currency !== SUPPORTED_CURRENCY) {
      throw new ApiError({
        statusCode: 422,
        code: 'UNSUPPORTED_CURRENCY',
        message: 'Club Account supports only RUB in the MVP.',
        source: 'runtime',
      });
    }

    const result = await this.clubAccountRepository.appendBalanceTransaction({
      clubAccountId: clubAccount.id,
      customerId,
      transactionType: 'top_up_credit',
      direction: 'credit',
      amountRub,
      currency,
      reason: request.reason || 'initial_club_deposit',
      referenceEntityType: request.referenceEntityType || 'mvp_vertical_slice',
      referenceEntityId: request.referenceEntityId || context.correlationId || null,
      sourceDomain: 'club_account',
      sourceId: request.sourceId || request.clientRequestId || null,
      idempotencyKey: context.idempotencyKey || null,
      actorType: 'customer',
      actorId: customerId,
      correlationId: context.correlationId || null,
    });

    await this.auditRepository.record({
      eventType: 'ClubAccounts.TopUpCredited',
      subjectType: 'user',
      subjectId: customerId,
      targetType: 'ClubAccountTransaction',
      targetId: result.transaction.id,
      action: 'credit',
      decision: result.created ? 'success' : 'duplicate',
      reasonCode: request.reason || 'initial_club_deposit',
      authMethod: context.authMethod,
      sourceChannel: context.sourceChannel,
      correlationId: context.correlationId,
      metadata: {
        club_account_id: clubAccount.id,
        amount: amountRub,
        currency,
        balance_after: result.transaction.balanceAfterRub,
      },
    });

    return result;
  }

  async debitOwnAccount(customerId, request, context = {}) {
    const clubAccount = await this.getOwnAccount(customerId);

    assertAccountCanChangeBalance(clubAccount);
    const amountRub = parsePositiveAmount(request.amount);
    const currency = request.currency || SUPPORTED_CURRENCY;

    if (currency !== SUPPORTED_CURRENCY) {
      throw new ApiError({
        statusCode: 422,
        code: 'UNSUPPORTED_CURRENCY',
        message: 'Club Account supports only RUB in the MVP.',
        source: 'runtime',
      });
    }

    const result = await this.clubAccountRepository.appendBalanceTransaction({
      clubAccountId: clubAccount.id,
      customerId,
      transactionType: request.transactionType || 'loyalty_debit',
      direction: 'debit',
      amountRub,
      currency,
      reason: request.reason || 'loyalty_debit',
      referenceEntityType: request.referenceEntityType || null,
      referenceEntityId: request.referenceEntityId || null,
      sourceDomain: request.sourceDomain || 'club_account',
      sourceId: request.sourceId || null,
      idempotencyKey: context.idempotencyKey || null,
      actorType: context.actorType || 'system',
      actorId: context.actorId || null,
      correlationId: context.correlationId || null,
    });

    await this.auditRepository.record({
      eventType: 'ClubAccounts.Debited',
      subjectType: 'user',
      subjectId: customerId,
      targetType: 'ClubAccountTransaction',
      targetId: result.transaction.id,
      action: 'debit',
      decision: result.created ? 'success' : 'duplicate',
      reasonCode: request.reason || 'loyalty_debit',
      authMethod: context.authMethod,
      sourceChannel: context.sourceChannel,
      correlationId: context.correlationId,
      metadata: {
        club_account_id: clubAccount.id,
        amount: amountRub,
        currency,
        balance_after: result.transaction.balanceAfterRub,
      },
    });

    return result;
  }

  async getOwnHistory(customerId, options) {
    await this.getOwnAccount(customerId);

    return this.clubAccountRepository.findTransactionsByCustomerId(customerId, options);
  }

  async calculateOwnBalance(customerId) {
    const clubAccount = await this.getOwnAccount(customerId);
    const balance = await this.clubAccountRepository.calculateBalanceFromTransactions(
      clubAccount.id,
    );

    return {
      available_balance: balance.availableBalanceRub,
      reserved_balance: balance.reservedBalanceRub,
      total_balance: balance.availableBalanceRub + balance.reservedBalanceRub,
    };
  }

  async prepareOrderPaidIntegration(order) {
    return {
      service: 'ClubAccountService',
      status: 'prepared',
      applied: false,
      order_id: order.id,
      customer_id: order.customerId,
      amount: Number(order.amount ?? order.amountPaidRub ?? 0),
      currency: order.currency || SUPPORTED_CURRENCY,
      future_capabilities: ['bonus_accrual', 'deposit_usage', 'loyalty_rules'],
    };
  }
}

function assertAccountCanChangeBalance(clubAccount) {
  const status = clubAccount.status || (clubAccount.clubActive ? 'active' : 'pending_activation');

  if (status !== CLUB_ACCOUNT_STATUS.ACTIVE) {
    throw new ApiError({
      statusCode: 422,
      code: 'CLUB_ACCOUNT_NOT_ACTIVE',
      message: 'Club Account is not active.',
      source: 'runtime',
    });
  }
}

function parsePositiveAmount(amount) {
  const parsed = Number(amount);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new ApiError({
      statusCode: 400,
      code: 'VALIDATION_FAILED',
      message: 'Request validation failed.',
      details: [
        {
          field: 'amount',
          issue: 'must be a number greater than zero',
        },
      ],
      source: 'api',
    });
  }

  return parsed;
}

module.exports = {
  CLUB_ACCOUNT_STATUS,
  ClubAccountRuntime,
  SUPPORTED_CURRENCY,
};
