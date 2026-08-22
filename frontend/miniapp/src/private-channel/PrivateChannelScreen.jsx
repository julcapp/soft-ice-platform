import React, { useEffect, useState } from 'react';
import { cancelPrivateChannelSubscription, getPrivateChannelState, startPrivateChannelCheckout } from './PrivateChannelApi.js';

export function PrivateChannelScreen({ onBack }) {
  const [state, setState] = useState(null);
  const [recurring, setRecurring] = useState(false);
  const [message, setMessage] = useState('');

  async function refresh() { setState(await getPrivateChannelState()); }
  useEffect(() => { refresh().catch(() => setMessage('Не удалось загрузить подписку.')); }, []);

  async function checkout() {
    const result = await startPrivateChannelCheckout({ recurringEnabled: recurring });
    const url = result?.payment?.confirmationUrl;
    if (url) window.location.href = url;
    else setMessage('Платёж создан, но ссылка подтверждения не получена.');
  }

  async function cancel() {
    await cancelPrivateChannelSubscription(state.subscription.id, true);
    setMessage('Автопродление отключено. Доступ сохранится до конца оплаченного периода.');
    await refresh();
  }

  if (!state) return <main className="app-shell"><button onClick={onBack}>← Назад</button><p>Загрузка…</p>{message && <p>{message}</p>}</main>;
  const { plan, subscription, paymentProvider } = state;
  const active = subscription?.status === 'ACTIVE';

  return <main className="app-shell">
    <button type="button" onClick={onBack}>← Назад</button>
    <section className="hero-card">
      <p className="eyebrow">Клуб Тимоши</p>
      <h2>Приватный канал</h2>
      <p>{plan.name}: {Number(plan.priceRub).toLocaleString('ru-RU')} ₽ на {plan.billingPeriodDays} дней.</p>
      {!plan.isActive && <p><strong>Подписка пока не открыта.</strong> Мы подготовили платёжный контур, но продажи ещё не включены.</p>}
      {plan.isActive && !active && <>
        <label style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
          <input type="checkbox" checked={recurring} onChange={(e) => setRecurring(e.target.checked)} />
          <span>Согласен на автоматическое продление подписки каждые {plan.billingPeriodDays} дней. Отменить автопродление можно в личном кабинете до следующего списания.</span>
        </label>
        <button type="button" disabled={!paymentProvider.configured} onClick={() => checkout().catch((error) => setMessage(error.message))}>Перейти к оплате</button>
        {!paymentProvider.configured && <small>Платёжный провайдер ещё не настроен для production.</small>}
      </>}
      {active && <>
        <p><strong>Подписка активна.</strong></p>
        <p>Оплачено до: {subscription.currentPeriodEnd ? new Date(subscription.currentPeriodEnd).toLocaleString('ru-RU') : '—'}</p>
        <p>Автопродление: {subscription.recurringEnabled ? 'включено' : 'выключено'}</p>
        {subscription.recurringEnabled && <button type="button" onClick={() => cancel().catch((error) => setMessage(error.message))}>Отключить автопродление</button>}
      </>}
      {message && <p role="status">{message}</p>}
    </section>
  </main>;
}
