const unavailable = () => ({ state: 'UNAVAILABLE' });

export async function recognizeDisplayPhone(machineId, phone, { signal } = {}) {
  const controller = new AbortController();
  const abort = () => controller.abort();
  signal?.addEventListener('abort', abort, { once: true });
  if (signal?.aborted) abort();
  const timer = setTimeout(abort, 15_000);
  try {
    const response = await fetch('/api/v1/auth/display-phone/recognition', {
      method: 'POST', credentials: 'omit', cache: 'no-store', signal: controller.signal,
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ machine_id: machineId, phone }),
    });
    if (!response.ok) return unavailable();
    const result = (await response.json())?.data?.attributes;
    if (!['RETURNING', 'NEW', 'UNAVAILABLE'].includes(result?.state)) return unavailable();
    // Keep only display-safe fields; never propagate arbitrary backend text or identity.
    return {
      state: result.state,
      bonusBalance: result.state === 'RETURNING' && Number.isFinite(Number(result.bonus_balance))
        ? Number(result.bonus_balance) : null,
      verification: result.state === 'NEW' ? {
        status: result.verification?.status === 'PENDING' ? 'PENDING' : 'UNAVAILABLE',
        maxAttempts: result.verification?.max_attempts === 3 ? 3 : null,
        remainingAttempts: Number.isInteger(result.verification?.remaining_attempts)
          && result.verification.remaining_attempts >= 0 && result.verification.remaining_attempts <= 3
          ? result.verification.remaining_attempts : null,
      } : null,
    };
  } catch { return unavailable(); }
  finally { clearTimeout(timer); signal?.removeEventListener('abort', abort); }
}
