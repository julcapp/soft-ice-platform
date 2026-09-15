const isMoney = value => typeof value === 'number' && Number.isFinite(value) && value >= 0;
const safeCurrency = value => typeof value === 'string' && /^[A-Z]{3}$/.test(value) ? value : 'RUB';

export const PriceService = {
  format(value, currency = 'RUB', fallback = 'Цена уточняется') {
    if (!isMoney(value)) return fallback;
    const unit = safeCurrency(currency);
    try {
      return new Intl.NumberFormat('ru-RU', { style: 'currency', currency: unit, maximumFractionDigits: 0 }).format(value);
    } catch {
      return `${value} ${unit}`;
    }
  },
  total(product, syrup, topping) {
    const values = [product?.price, syrup?.price, topping?.price];
    return values.every(isMoney) ? values.reduce((a, b) => a + b, 0) : null;
  },
  canPay(total) {
    return isMoney(total) && total > 0;
  }
};
