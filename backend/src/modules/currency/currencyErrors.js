class CurrencyError extends Error {
  constructor(code, message, details = undefined) {
    super(message);
    this.name = 'CurrencyError';
    this.code = code;
    this.details = details;
  }
}

module.exports = {
  CurrencyError,
};
