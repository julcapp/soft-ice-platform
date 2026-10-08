// Store only the checkout snapshot, never phone numbers or buyer credentials.
const key = (machineId) => `soft_ice_terminal_checkout:${machineId}`;
export function readTerminalPaymentSession(machineId) {
  try {
    const value = JSON.parse(window.sessionStorage.getItem(key(machineId)) || 'null');
    return value?.quote?.id && Array.isArray(value.items) ? value : null;
  } catch { return null; }
}
export function saveTerminalPaymentSession(machineId, value) {
  // If storage is unavailable, do not start a checkout that cannot be recovered.
  window.sessionStorage.setItem(key(machineId), JSON.stringify(value));
}
export function clearTerminalPaymentSession(machineId) {
  window.sessionStorage.removeItem(key(machineId));
}
