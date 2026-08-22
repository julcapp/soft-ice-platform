import React, { useEffect, useState } from 'react';
import { cancelPrivateChannelSubscription, getPrivateChannelState, startPrivateChannelCheckout } from './PrivateChannelApi.js';

const CHANNEL_LABEL = { TELEGRAM: 'Telegram', MAX: 'MAX' };

export function PrivateChannelScreen({ onBack }) {
  const [channelType, setChannelType] = useState('TELEGRAM');
  const [state, setState] = useState(null);
  const [recurring, setRecurring] = useState(false);
  const [message, setMessage] = useState('');

  async function refresh(channel = channelType) {
    setState(null);
    setState(await getPrivateChannelState({ channelType: channel }));
  }
  useEffect(() => { refresh(channelType).catch(() => setMessage('Не удалось загрузить подписку.')); }, [channelType]);

  async function checkout() {
    const result = await startPrivateChannelCheckout({ recurringEnabled: recurring, channelType });
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
  const { plan, subscription, paymentProvider, accessProvider, access = [] } = state;
  const active = subscription?.status === 'ACTIVE';
  const activeAccess = access.find((item) => item.status === 'ACTIVE');

  return <main className="app-shell">
    <button type="button" onClick={onBack}>← Назад</button>
    <section className="hero-card">
      <p className="eyebrow">Клуб Тимоши</p>
      <h2>Закрытые каналы</h2>
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        {Object.keys(CHANNEL_LABEL).map((channel) => <button key={channel} type="button" aria-pressed={channelType === channel} onClick={() => { setChannelType(channel); setMessage(''); setRecurring(false); }}>{CHANNEL_LABEL[channel]}</button>)}
      </div>
      <h3>{CHANNEL_LABEL[channelType]}</h3>
      <p>{plan.name}: {Number(plan.priceRub).toLocaleString('ru-RU')} ₽ на {plan.billingPeriodDays} дней.</p>
      {!plan.isActive && <p><strong>Подписка пока не открыта.</strong> Платёжный и access-контур подготовлены, но продажи ещё не включены.</p>}
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
        {activeAccess?.inviteLink && <p><a href={activeAccess.inviteLink} target="_blank" rel="noreferrer">Открыть закрытый канал {CHANNEL_LABEL[channelType]}</a></p>}
        {!activeAccess && <p>Оплата подтверждена. Доступ к каналу готовится.</p>}
        {!accessProvider.configured && <small>Автоматическая выдача доступа ещё не настроена для production.</small>}
        {subscription.recurringEnabled && <button type="button" onClick={() => cancel().catch((error) => setMessage(error.message))}>Отключить автопродление</button>}
      </>}
      {channelType === 'MAX' && <small>Для MAX используется приватная ссылка канала. Официальный Bot API пока не позволяет боту напрямую добавлять подписчиков канала; поэтому доступ выдаётся после оплаты ссылкой, а членство контролируется отдельно.</small>}
      {message && <p role="status">{message}</p>}
    </section>
  </main>;
}
