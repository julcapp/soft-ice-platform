import React, { useEffect, useState } from 'react';

export function VerifyEmailScreen() {
  const [status, setStatus] = useState('Проверяем ссылку…');
  useEffect(() => {
    const token = new URLSearchParams(window.location.search).get('token');
    if (!token) { setStatus('Токен подтверждения отсутствует.'); return; }
    fetch('/api/v1/customers/email-verifications/confirm', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token }),
    }).then(async (response) => {
      const body = await response.json();
      if (!response.ok) throw new Error(body?.error?.message || 'Не удалось подтвердить электронную почту.');
      setStatus('Электронная почта подтверждена. Теперь можно вернуться в личный кабинет.');
    }).catch((error) => setStatus(error.message));
  }, []);
  return <main className="app-shell"><section className="hero-card"><h2>Подтверждение электронной почты</h2><p>{status}</p><button type="button" onClick={() => { window.location.href = '/'; }}>Вернуться в Клуб Тимоши</button></section></main>;
}
