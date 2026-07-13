const { ApiError } = require('../../platform/errors/ApiError');

class ClubAccountRepository {
  constructor(prisma) {
    this.prisma = prisma;
  }

  async findByCustomerId(customerId) {
    return this.prisma.clubAccount.findUnique({
      where: { customerId },
    });
  }

  async createForCustomer(customerId) {
    return this.prisma.clubAccount.create({
      data: {
        customerId,
        status: 'active',
        currency: 'RUB',
        balanceRub: 0,
        availableBalanceRub: 0,
        reservedBalanceRub: 0,
        clubActive: true,
        activatedAt: new Date(),
        projectionVersion: 0,
      },
    });
  }

  async appendBalanceTransaction(command) {
    if (command.idempotencyKey) {
      const existing = await this.prisma.clubAccountTransaction.findUnique({
        where: {
          clubAccountId_idempotencyKey: {
            clubAccountId: command.clubAccountId,
            idempotencyKey: command.idempotencyKey,
          },
        },
      });

      if (existing) {
        const account = await this.prisma.clubAccount.findUnique({
          where: { id: command.clubAccountId },
        });

        return {
          account,
          transaction: existing,
          created: false,
        };
      }
    }

    return this.prisma.$transaction(async (tx) => {
      const account = await tx.clubAccount.findUnique({
        where: { id: command.clubAccountId },
      });

      if (!account) {
        throw new ApiError({
          statusCode: 404,
          code: 'RESOURCE_NOT_FOUND',
          message: 'Club Account was not found.',
          source: 'runtime',
        });
      }

      const currentAvailable = getAvailableBalance(account);
      const currentReserved = getReservedBalance(account);
      const availableDelta = command.direction === 'credit'
        ? command.amountRub
        : -command.amountRub;
      const nextAvailable = currentAvailable + availableDelta;
      const nextReserved = currentReserved;

      if (nextAvailable < 0) {
        throw new ApiError({
          statusCode: 422,
          code: 'INSUFFICIENT_AVAILABLE_BALANCE',
          message: 'Club Account available balance is insufficient.',
          source: 'runtime',
        });
      }

      const transaction = await tx.clubAccountTransaction.create({
        data: {
          clubAccountId: account.id,
          customerId: account.customerId,
          transactionType: command.transactionType,
          direction: command.direction,
          amountRub: command.amountRub,
          currency: command.currency,
          availableDeltaRub: availableDelta,
          reservedDeltaRub: 0,
          availableBalanceAfterRub: nextAvailable,
          reservedBalanceAfterRub: nextReserved,
          balanceAfterRub: nextAvailable + nextReserved,
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
          postedAt: command.postedAt || new Date(),
        },
      });

      const updatedAccount = await tx.clubAccount.update({
        where: { id: account.id },
        data: {
          balanceRub: nextAvailable,
          availableBalanceRub: nextAvailable,
          reservedBalanceRub: nextReserved,
          lastTransactionId: transaction.id,
          projectionVersion: account.projectionVersion + 1,
          lastTopupAt:
            command.transactionType === 'top_up_credit'
              ? transaction.postedAt
              : account.lastTopupAt,
        },
      });

      return {
        account: updatedAccount,
        transaction,
        created: true,
      };
    });
  }

  async findTransactionsByCustomerId(customerId, { limit = 50 } = {}) {
    return this.prisma.clubAccountTransaction.findMany({
      where: { customerId },
      orderBy: [{ postedAt: 'desc' }, { id: 'desc' }],
      take: limit,
    });
  }

  async calculateBalanceFromTransactions(clubAccountId) {
    const transactions = await this.prisma.clubAccountTransaction.findMany({
      where: {
        clubAccountId,
        status: 'posted',
      },
      select: {
        availableDeltaRub: true,
        reservedDeltaRub: true,
      },
    });

    return transactions.reduce(
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

function getAvailableBalance(account) {
  if (typeof account.availableBalanceRub === 'number') {
    return account.availableBalanceRub;
  }

  return Number(account.balanceRub || 0);
}

function getReservedBalance(account) {
  if (typeof account.reservedBalanceRub === 'number') {
    return account.reservedBalanceRub;
  }

  return 0;
}

module.exports = {
  ClubAccountRepository,
  getAvailableBalance,
  getReservedBalance,
};
