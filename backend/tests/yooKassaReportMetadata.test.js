const test = require('node:test');
const assert = require('node:assert/strict');
const { parseCsv, extractReportMetadata, normalizePaymentRow } = require('../src/modules/payment_profile/YooKassaDailyReconciliationService');

test('uses YooKassa payment date and contract metadata from registry preamble', () => {
  const csv = [
    'РЕЕСТР ПЛАТЕЖЕЙ ПО ДОГОВОРУ НЭК.450626.01 (1368517)',
    'Дата платежей: 2026-08-22',
    'Идентификатор платежа;Сумма платежа;Валюта платежа;Сумма за вычетом комиссии и НДС;Сумма комиссии без НДС;Комиссия за чеки с НДС;Время платежа;Идентификатор платежного средства;Описание;Тип платежа;Имя плательщика;Адрес плательщика;ИНН плательщика;НДС с комиссии',
    'pay_1;100.00;RUB;96.34;3.00;0;2026-08-22T10:00:00+03:00;pm_1;Заказ;bank_card;;;;0.66',
  ].join('\n');
  assert.deepEqual(extractReportMetadata(csv, 'PAYMENTS'), {
    reportDate: '2026-08-22',
    contractRef: 'НЭК.450626.01 (1368517)',
    shopId: '1368517',
  });
  const rows = parseCsv(csv);
  assert.equal(rows.length, 1);
  assert.deepEqual(normalizePaymentRow(rows[0]), {
    paymentId: 'pay_1', grossAmountRub: 100, netAmountRub: 96.34,
    commissionRub: 3, commissionVatRub: 0.66, providerCostRub: 3.66,
    paymentMethod: 'bank_card',
  });
});
