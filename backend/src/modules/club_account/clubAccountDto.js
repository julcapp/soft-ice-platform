const MINIMUM_RECOMMENDED_BALANCE_RUB = 150;
const RECOMMENDED_TOP_UP_AMOUNT_RUB = 100;

function toClubAccountDto(clubAccount) {
  const availableBalance = getAvailableBalance(clubAccount);
  const reservedBalance = getReservedBalance(clubAccount);

  return {
    type: 'club_account',
    id: clubAccount.id,
    attributes: {
      club_account_id: clubAccount.id,
      customer_id: clubAccount.customerId,
      status: clubAccount.status || (clubAccount.clubActive ? 'active' : 'pending_activation'),
      currency: clubAccount.currency || 'RUB',
      available_balance: availableBalance,
      reserved_balance: reservedBalance,
      total_balance: availableBalance + reservedBalance,
      minimum_recommended_balance: MINIMUM_RECOMMENDED_BALANCE_RUB,
      recommended_top_up_amount: RECOMMENDED_TOP_UP_AMOUNT_RUB,
      low_balance_state:
        availableBalance < MINIMUM_RECOMMENDED_BALANCE_RUB ? 'below_minimum' : 'ok',
      last_transaction_id: clubAccount.lastTransactionId || null,
      projection_version: clubAccount.projectionVersion || 0,
    },
  };
}

function toClubAccountTransactionDto(transaction) {
  return {
    type: 'club_account_transaction',
    id: transaction.id,
    attributes: {
      club_account_transaction_id: transaction.id,
      club_account_id: transaction.clubAccountId,
      customer_id: transaction.customerId,
      transaction_type: transaction.transactionType,
      direction: transaction.direction,
      amount: Number(transaction.amountRub || 0),
      currency: transaction.currency || 'RUB',
      available_delta: Number(transaction.availableDeltaRub || 0),
      reserved_delta: Number(transaction.reservedDeltaRub || 0),
      available_balance_after: Number(transaction.availableBalanceAfterRub || 0),
      reserved_balance_after: Number(transaction.reservedBalanceAfterRub || 0),
      balance_after: Number(transaction.balanceAfterRub || 0),
      status: transaction.status,
      reason: transaction.reason,
      reference_entity: {
        type: transaction.referenceEntityType || null,
        id: transaction.referenceEntityId || null,
      },
      posted_at: transaction.postedAt.toISOString(),
      created_at: transaction.createdAt.toISOString(),
    },
  };
}

function toClubAccountTopUpDto({ account, transaction }) {
  return {
    type: 'club_account_top_up',
    id: transaction.id,
    attributes: {
      top_up_id: transaction.id,
      club_account_id: account.id,
      customer_id: account.customerId,
      status: 'credited',
      amount: Number(transaction.amountRub || 0),
      currency: transaction.currency || 'RUB',
      reason: transaction.reason,
      balance_after: Number(transaction.balanceAfterRub || 0),
      transaction: toClubAccountTransactionDto(transaction).attributes,
      club_account: toClubAccountDto(account).attributes,
    },
  };
}

function getAvailableBalance(clubAccount) {
  if (typeof clubAccount.availableBalanceRub === 'number') {
    return clubAccount.availableBalanceRub;
  }

  return Number(clubAccount.balanceRub || 0);
}

function getReservedBalance(clubAccount) {
  if (typeof clubAccount.reservedBalanceRub === 'number') {
    return clubAccount.reservedBalanceRub;
  }

  return 0;
}

module.exports = {
  MINIMUM_RECOMMENDED_BALANCE_RUB,
  RECOMMENDED_TOP_UP_AMOUNT_RUB,
  toClubAccountDto,
  toClubAccountTopUpDto,
  toClubAccountTransactionDto,
};
