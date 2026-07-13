function toCustomerProfileDto(customer, clubAccount) {
  return {
    type: 'customer_profile',
    id: customer.id,
    attributes: {
      customer_id: customer.id,
      display_name: customer.name || null,
      status: customer.status,
      club_membership_status: clubAccount && clubAccount.clubActive ? 'active' : 'not_joined',
      telegram_linked: Boolean(customer.telegramLinked),
      created_at: customer.createdAt.toISOString(),
      updated_at: customer.updatedAt.toISOString(),
    },
  };
}

module.exports = {
  toCustomerProfileDto,
};
