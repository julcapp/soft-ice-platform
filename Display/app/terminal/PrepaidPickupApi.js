async function request(path, options) {
  const response = await fetch(`/api/v1/orders/pickup/${path}`, options);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw Object.assign(new Error(payload.error?.message || 'Не удалось проверить получение заказа.'), { code: payload.error?.code });
  if (!payload.data?.attributes) throw new Error('Сервер вернул неполный ответ получения заказа.');
  return payload.data.attributes;
}
export function redeemPrepaidOrder(machineId, { code, qrPayload }, { signal } = {}) {
  if (!machineId) throw new Error('Не указан аппарат.');
  return request('redeem', { method: 'POST', signal, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ machineId, ...(qrPayload ? { qrPayload } : { code }) }) });
}
export function getPrepaidPickupStatus(machineId, attemptId, { signal } = {}) {
  return request(`${encodeURIComponent(attemptId)}/status?machineId=${encodeURIComponent(machineId)}`, { signal });
}
