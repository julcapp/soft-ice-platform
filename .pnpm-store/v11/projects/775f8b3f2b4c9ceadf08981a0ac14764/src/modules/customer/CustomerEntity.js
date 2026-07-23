const IDENTITY_PROVIDER = Object.freeze({
  PHONE: 'phone',
  TELEGRAM: 'telegram',
  SBER_ID: 'sber_id',
  MAX: 'max',
});

const SUPPORTED_EXTERNAL_IDENTITY_PROVIDERS = Object.freeze([
  IDENTITY_PROVIDER.TELEGRAM,
  IDENTITY_PROVIDER.SBER_ID,
  IDENTITY_PROVIDER.MAX,
]);

function normalizePhone(value) {
  if (typeof value !== 'string') {
    return null;
  }

  const compact = value.trim().replace(/[\s()-]/g, '');
  const normalized = compact.startsWith('8') && compact.length === 11
    ? `+7${compact.slice(1)}`
    : compact;

  return /^\+[1-9]\d{7,14}$/.test(normalized) ? normalized : null;
}

function toCustomerIdentityState(customer) {
  const identities = (customer.identities || []).filter((identity) => !identity.revokedAt);

  return {
    ...customer,
    phoneVerified: Boolean(customer.phone && customer.phoneVerifiedAt),
    telegramLinked: identities.some(({ provider }) => provider === IDENTITY_PROVIDER.TELEGRAM),
    sberIdLinked: identities.some(({ provider }) => provider === IDENTITY_PROVIDER.SBER_ID),
    maxLinked: identities.some(({ provider }) => provider === IDENTITY_PROVIDER.MAX),
  };
}

module.exports = {
  IDENTITY_PROVIDER,
  SUPPORTED_EXTERNAL_IDENTITY_PROVIDERS,
  normalizePhone,
  toCustomerIdentityState,
};
