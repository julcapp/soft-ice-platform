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


export async function createDisplayChannelChallenge(machineId, phone, channel, { signal } = {}) {
  const response = await fetch('/api/v1/auth/display-phone/channel-challenges', {
    method: 'POST',
    credentials: 'omit',
    cache: 'no-store',
    signal,
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ machine_id: machineId, phone, channel }),
  });
  if (!response.ok) {
    const error = new Error('Не удалось открыть подтверждение в мессенджере.');
    error.code = 'CHANNEL_CHALLENGE_FAILED';
    throw error;
  }
  const payload = (await response.json())?.data;
  const attrs = payload?.attributes;
  if (!payload?.id || !attrs?.deep_link || !['MAX', 'TELEGRAM'].includes(attrs?.channel)) {
    const error = new Error('Некорректный ответ сервера.');
    error.code = 'CHANNEL_CHALLENGE_INVALID';
    throw error;
  }
  return {
    id: payload.id,
    channel: attrs.channel,
    deepLink: attrs.deep_link,
    expiresAt: attrs.expires_at || null,
  };
}


export async function getDisplayChannelChallengeStatus(challengeId, { signal } = {}) {
  const response = await fetch(`/api/v1/auth/display-phone/channel-challenges/${encodeURIComponent(challengeId)}/status`, {
    method: 'GET',
    credentials: 'omit',
    cache: 'no-store',
    signal,
    headers: { Accept: 'application/json' },
  });
  if (!response.ok) throw new Error('Не удалось проверить статус подтверждения.');
  const data = (await response.json())?.data;
  const attrs = data?.attributes;
  if (!data?.id || !['PENDING', 'STARTED', 'VERIFIED', 'EXPIRED', 'INVALIDATED'].includes(attrs?.status)) {
    throw new Error('Некорректный статус подтверждения.');
  }
  return {
    id: data.id,
    channel: attrs.channel,
    status: attrs.status,
    expiresAt: attrs.expires_at || null,
  };
}
