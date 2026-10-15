function buildPurchaseRichCard(order, { miniAppUrl, composition = [] } = {}) {
  if (order?.status !== 'COMPLETED') throw new Error('Only completed orders may produce a purchase card.');
  const amount = Number(order.amountPaidRub);
  const bonus = Number(order.bonusEarned);
  if (order.amountPaidRub == null || !Number.isFinite(amount) || amount < 0) throw new Error('Recorded paid amount is required.');
  if (order.bonusEarned == null || !Number.isInteger(bonus) || bonus < 0) throw new Error('Recorded bonus accrual is required.');
  const url = new URL(miniAppUrl);
  if (url.protocol !== 'https:') throw new Error('HTTPS Mini App URL is required.');
  const parts = composition.filter((item) => typeof item === 'string' && item.trim()).map((item) => item.trim());
  const lines = [parts.length ? `Состав: ${parts.join(', ')}` : 'Состав заказа не зафиксирован.', `Оплачено: ${new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB' }).format(amount)}`, `Начислено бонусов: ${bonus}`];
  const title = 'Тестовая карточка завершённой покупки 🍦';
  return { text: [title, ...lines, 'Открыть кабинет'].join('\n'), richMessage: { blocks: [{ type: 'heading', text: title, size: 2 }, ...lines.map((text) => ({ type: 'paragraph', text })), { type: 'buttons', buttons: [{ text: 'Открыть кабинет', style: 'primary', web_app: { url: url.href } }] }] } };
}
module.exports = { buildPurchaseRichCard };
