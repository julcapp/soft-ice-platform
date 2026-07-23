function toCustomerProfileDto(customer, clubAccount) {
  return {
    type: 'customer_profile',
    id: customer.id,
    attributes: {
      customer_id: customer.id,
      display_name: customer.name || null,
      phone: customer.phone || null,
      phone_verified: Boolean(customer.phoneVerified),
      primary_identifier: customer.phoneVerified ? 'phone' : null,
      status: customer.status,
      club_membership_status: clubAccount && clubAccount.clubActive ? 'active' : 'not_joined',
      telegram_linked: Boolean(customer.telegramLinked),
      sber_id_linked: Boolean(customer.sberIdLinked),
      max_linked: Boolean(customer.maxLinked),
      created_at: customer.createdAt.toISOString(),
      updated_at: customer.updatedAt.toISOString(),
    },
  };
}

function toCustomerIdentityDto(identity) {
  return {
    type: 'customer_identity', id: identity.id,
    attributes: {
      provider: identity.provider, status: identity.status,
      display_name: identity.displayName || null,
      linked_at: identity.linkedAt.toISOString(), verified_at: identity.verifiedAt.toISOString(),
    },
  };
}

module.exports = {
  toCustomerProfileDto,
  toCustomerIdentityDto,
};
