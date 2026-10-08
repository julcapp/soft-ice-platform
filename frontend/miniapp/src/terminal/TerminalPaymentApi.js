const normalize = (payload) => {
  const data = payload?.data;
  const attrs = data?.attributes;
  if (!data?.id || !attrs?.order_id || !['PENDING','SUCCESS','ERROR'].includes(attrs?.user_state)
      || (attrs?.user_state === 'SUCCESS' && attrs?.status !== 'SUCCEEDED')
      || (attrs?.user_state === 'ERROR' && !['FAILED', 'CANCELED'].includes(attrs?.status))) {
    const error = new Error('Некорректный ответ платёжного сервера.');
    error.code = 'TERMINAL_PAYMENT_RESPONSE_INVALID';
    throw error;
  }
  return {
    paymentId: data.id,
    orderId: attrs.order_id,
    machineId: attrs.machine_id || null,
    status: attrs.status || null,
    userState: attrs.user_state,
    amount: attrs.amount == null ? null : Number(attrs.amount),
    currency: attrs.currency || 'RUB',
    confirmationUrl: safeConfirmationUrl(attrs.confirmation_url),
    failureCode: attrs.failure_code || null,
    succeededAt: attrs.succeeded_at || null,
    fulfillmentState: ['COMPLETED', 'ATTENTION_REQUIRED'].includes(attrs.fulfillment_state) ? attrs.fulfillment_state : 'WAITING',
  };
};

function safeConfirmationUrl(value) {
  if (!value) return null;
  try { const url = new URL(value); return url.protocol === 'https:' && !url.username && !url.password ? url.href : null; } catch { return null; }
}

async function parse(response) {
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(payload?.error?.message || 'Платёж временно недоступен.');
    error.code = payload?.error?.code || 'TERMINAL_PAYMENT_FAILED';
    error.status = response.status;
    throw error;
  }
  return normalize(payload);
}

export async function createTerminalPayment({ machineId, quoteId, purchaseToken = null, signal } = {}) {
  const response = await fetch('/api/v1/payments/terminal/checkout', {
    method: 'POST',
    credentials: 'omit',
    cache: 'no-store',
    signal,
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'Idempotency-Key': `terminal:${machineId}:${quoteId}`,
    },
    body: JSON.stringify({
      machine_id: machineId,
      quote_id: quoteId,
      purchase_token: purchaseToken,
      method: 'sbp',
    }),
  });
  return parse(response);
}

export async function getTerminalPaymentStatus({ machineId, paymentId, signal } = {}) {
  const query = new URLSearchParams({ machineId });
  const response = await fetch(`/api/v1/payments/terminal/${encodeURIComponent(paymentId)}/status?${query}`, {
    method: 'GET',
    credentials: 'omit',
    cache: 'no-store',
    signal,
    headers: { Accept: 'application/json' },
  });
  return parse(response);
}

export function terminalPaymentErrorMessage(error) {
  const code = String(error?.code || '');
  if (code === 'PAYMENT_CHECKOUT_NOT_AVAILABLE' || code === 'PAYMENT_CHECKOUT_DISABLED' || code === 'TERMINAL_CHECKOUT_DISABLED' || code === 'YOOKASSA_NOT_CONFIGURED' || code === 'PAYMENT_PROVIDER_BLOCKED_EXTERNAL') return 'Оплата пока не подключена.';
  if (code.includes('QUOTE_EXPIRED')) return 'Время фиксации цены истекло. Вернитесь к заказу и обновите цену.';
  if (code.includes('INVENTORY')) return 'Выбранный состав временно недоступен.';
  if (code.includes('PAYMENT_METHOD')) return 'Этот способ оплаты сейчас недоступен.';
  return 'Не удалось создать платёж. Попробуйте ещё раз.';
}
