export const SALES_CHANNELS = Object.freeze([
  {
    id: 'vending',
    name: 'Автомат',
    description: 'После подтверждения оплаты заказ автоматически передаётся на выдачу.',
    icon: '▦',
    fulfillment: 'machine',
  },
  {
    id: 'mobile_point',
    name: 'Мобильная точка',
    description: 'Продавец получает номер заказа и выдаёт товар по коду покупателя.',
    icon: '⌂',
    fulfillment: 'seller',
  },
]);

export const PAYMENT_METHODS = Object.freeze([
  {
    id: 'sbp',
    name: 'СБП',
    description: 'QR-код или банковское приложение',
    icon: 'СБП',
  },
  {
    id: 'yookassa_card',
    name: 'Банковская карта',
    description: 'Защищённая страница ЮKassa',
    icon: '••••',
  },
]);
