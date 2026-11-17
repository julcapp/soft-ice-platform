export async function lookupTerminalCustomerByPhone(phone, { signal } = {}) {
  const token = import.meta.env.VITE_TERMINAL_API_TOKEN;
  if (!token) throw new Error('TERMINAL_API_TOKEN is not configured.');

  const response = await fetch('/api/v1/terminal/customers/by-phone', {
    method: 'POST',
    signal,
    headers: {
      'Content-Type': 'application/json',
      'X-Terminal-Token': token,
    },
    body: JSON.stringify({ phone }),
  });

  if (!response.ok) {
    const error = new Error('Не удалось получить данные клиента.');
    error.status = response.status;
    throw error;
  }

  const payload = await response.json();
  const attributes = payload.data?.attributes || {};
  return {
    found: Boolean(attributes.found),
    customer: attributes.customer ? {
      customerId: attributes.customer.customer_id,
      displayName: attributes.customer.display_name,
      bonusBalance: Number(attributes.customer.bonus_balance || 0),
      status: attributes.customer.status,
    } : null,
  };
}
