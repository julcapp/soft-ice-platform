import React, { useMemo, useState } from 'react';
import { trackEvent } from '../analytics/trackEvent.js';
import { salesTerminalService } from './SalesTerminalService.js';
import { PAYMENT_METHODS, SALES_CHANNELS } from './salesChannelData.js';

const STEP_LABELS = ['Выбор', 'Оплата', 'Выдача'];

function BrandMark() {
  return (
    <div className="terminal-brand">
      <span className="terminal-logo" aria-hidden="true">🍦</span>
      <span><strong>У Тимоши</strong><small>панель продаж</small></span>
    </div>
  );
}

function Stepper({ step }) {
  return (
    <ol className="terminal-stepper" aria-label="Этапы покупки">
      {STEP_LABELS.map((label, index) => (
        <li className={index <= step ? 'is-active' : ''} key={label}>
          <span>{index + 1}</span>{label}
        </li>
      ))}
    </ol>
  );
}

function ChoiceCard({ active, children, onClick }) {
  return (
    <button className={active ? 'terminal-choice is-selected' : 'terminal-choice'} type="button" onClick={onClick}>
      {children}<span className="choice-check" aria-hidden="true">{active ? '✓' : ''}</span>
    </button>
  );
}

function ProductArtwork({ syrupId, toppingId }) {
  return (
    <div className={`terminal-artwork ${syrupId}`} aria-label="Ванильное мягкое мороженое">
      <span className="soft-serve">●</span>
      <span className="soft-serve middle">●</span>
      <span className="soft-serve top">●</span>
      <span className="sprinkles">{toppingId === 'topping_oreo' ? '●  ●' : toppingId === 'topping_rainbow_sprinkles' ? '•  •  •' : '▪  ▪'}</span>
      <span className="cup">У ТИМОШИ</span>
    </div>
  );
}

function QrPattern() {
  return (
    <svg className="payment-qr" viewBox="0 0 120 120" role="img" aria-label="Демонстрационный QR-код оплаты">
      <rect width="120" height="120" rx="12" fill="#fff" />
      <path fill="#241b16" d="M10 10h34v34H10zm8 8v18h18V18zM76 10h34v34H76zm8 8v18h18V18zM10 76h34v34H10zm8 8v18h18V84zM54 12h10v10H54zm0 20h10v20H44V42h10zm18 22h12v10H72zm20 0h18v10H92zM48 68h12v12H48zm20 0h10v20H68zm20 0h22v10H98v12H86V78h2zM48 90h12v20H48zm20 8h12v12H68zm20 0h22v12H88z" />
    </svg>
  );
}

export function SalesTerminalPage() {
  const catalog = useMemo(() => salesTerminalService.getCatalogView(), []);
  const [channelId, setChannelId] = useState('vending');
  const [syrupId, setSyrupId] = useState(catalog.syrups[0].id);
  const [toppingId, setToppingId] = useState(catalog.toppings[0].id);
  const [methodId, setMethodId] = useState('sbp');
  const [step, setStep] = useState(0);
  const [payment, setPayment] = useState(null);
  const preview = useMemo(
    () => salesTerminalService.createOrderPreview({ syrupId, toppingId }),
    [syrupId, toppingId],
  );
  const selectedChannel = SALES_CHANNELS.find(({ id }) => id === channelId);
  const syrup = catalog.syrups.find(({ id }) => id === syrupId);
  const topping = catalog.toppings.find(({ id }) => id === toppingId);

  function startPayment() {
    const intent = salesTerminalService.createPaymentIntent({
      channelId,
      methodId,
      orderPreview: preview,
    });
    setPayment(intent);
    setStep(1);
    trackEvent('TerminalPaymentStarted', { channel_id: channelId, payment_method: methodId });
  }

  function confirmDemoPayment() {
    const confirmed = salesTerminalService.applyDemoPaymentConfirmation(payment);
    setPayment(confirmed);
    setStep(2);
    trackEvent('TerminalDemoPaymentConfirmed', { channel_id: channelId, order_id: payment.orderId });
  }

  function restart() {
    setPayment(null);
    setStep(0);
  }

  return (
    <main className="terminal-shell">
      <header className="terminal-header">
        <BrandMark />
        <div className="terminal-point">
          <span className="online-dot" />Точка № 07 · готова к продажам
        </div>
      </header>

      <Stepper step={step} />

      {step === 0 && (
        <div className="terminal-layout">
          <section className="terminal-main">
            <div className="terminal-title">
              <div><p className="terminal-kicker">Мягкое мороженое</p><h1>Соберите свой десерт</h1></div>
              <span className="terminal-price">{preview.pricing.finalPrice} ₽</span>
            </div>
            <div className="terminal-product">
              <ProductArtwork syrupId={syrupId} toppingId={toppingId} />
              <div>
                <span className="terminal-pill">Вкус дня</span>
                <h2>{catalog.flavor.name.ru}</h2>
                <p>Нежное ванильное мороженое, один сироп и один топпинг уже входят в стоимость.</p>
                <div className="included-list"><span>✓ Стаканчик</span><span>✓ Сироп</span><span>✓ Топпинг</span></div>
              </div>
            </div>

            <div className="terminal-config">
              <section>
                <p className="config-number">01</p><h3>Выберите сироп</h3>
                <div className="choice-grid">
                  {catalog.syrups.map((item) => (
                    <ChoiceCard active={syrupId === item.id} key={item.id} onClick={() => setSyrupId(item.id)}>
                      <span className={`flavor-swatch ${item.id}`} /><strong>{item.name.ru}</strong>
                    </ChoiceCard>
                  ))}
                </div>
              </section>
              <section>
                <p className="config-number">02</p><h3>Добавьте топпинг</h3>
                <div className="choice-grid">
                  {catalog.toppings.map((item) => (
                    <ChoiceCard active={toppingId === item.id} key={item.id} onClick={() => setToppingId(item.id)}>
                      <span className={`topping-symbol ${item.id}`}>✦</span><strong>{item.name.ru}</strong>
                    </ChoiceCard>
                  ))}
                </div>
              </section>
            </div>
          </section>

          <aside className="terminal-summary">
            <div>
              <p className="terminal-kicker">Формат выдачи</p>
              <div className="channel-switch">
                {SALES_CHANNELS.map((channel) => (
                  <button className={channel.id === channelId ? 'is-active' : ''} key={channel.id} type="button" onClick={() => setChannelId(channel.id)}>
                    <span>{channel.icon}</span>{channel.name}
                  </button>
                ))}
              </div>
              <p className="channel-note">{selectedChannel.description}</p>
            </div>
            <div className="receipt">
              <p className="terminal-kicker">Ваш заказ</p>
              <h3>{catalog.product.name.ru}</h3>
              <dl><dt>Сироп</dt><dd>{syrup.name.ru}</dd><dt>Топпинг</dt><dd>{topping.name.ru}</dd></dl>
              <div className="receipt-total"><span>К оплате</span><strong>{preview.pricing.finalPrice} ₽</strong></div>
            </div>
            <button className="terminal-cta" type="button" onClick={startPayment}>Перейти к оплате <span>→</span></button>
            <p className="safe-payment">Безопасная оплата через ЮKassa</p>
          </aside>
        </div>
      )}

      {step === 1 && (
        <section className="payment-screen">
          <div className="payment-panel">
            <button className="terminal-back" type="button" onClick={restart}>← Вернуться к заказу</button>
            <p className="terminal-kicker">Заказ {payment.orderId}</p>
            <h1>Оплатите {payment.amount} ₽</h1>
            <p>Выберите удобный способ. Терминал дождётся подтверждения от платёжной системы.</p>
            <div className="payment-methods">
              {PAYMENT_METHODS.map((method) => (
                <ChoiceCard active={methodId === method.id} key={method.id} onClick={() => setMethodId(method.id)}>
                  <span className="method-icon">{method.icon}</span><span><strong>{method.name}</strong><small>{method.description}</small></span>
                </ChoiceCard>
              ))}
            </div>
            <div className="payment-action">
              {methodId === 'sbp' ? <QrPattern /> : <div className="card-redirect">Ю<span>Касса</span></div>}
              <div><strong>{methodId === 'sbp' ? 'Наведите камеру телефона' : 'Откройте защищённую форму'}</strong><p>После оплаты не закрывайте экран — статус обновится автоматически.</p></div>
            </div>
            <div className="pending-status"><span className="status-spinner" />Ожидаем подтверждение оплаты</div>
            <button className="demo-confirm" type="button" onClick={confirmDemoPayment}>Демо: получить подтверждение Payment Runtime</button>
            <p className="demo-disclaimer">В рабочей системе эту кнопку заменяет подтверждённый webhook ЮKassa. Возврат на страницу сам по себе оплату не подтверждает.</p>
          </div>
          <aside className="payment-order-card">
            <ProductArtwork syrupId={syrupId} toppingId={toppingId} />
            <h2>{catalog.product.name.ru}</h2>
            <p>{syrup.name.ru} · {topping.name.ru}</p>
            <strong>{payment.amount} ₽</strong>
          </aside>
        </section>
      )}

      {step === 2 && (
        <section className="success-screen">
          <div className="success-check">✓</div>
          <p className="terminal-kicker">Оплата подтверждена</p>
          <h1>{payment.fulfillment === 'machine' ? 'Начинаем готовить!' : 'Покажите код продавцу'}</h1>
          <p>{payment.fulfillment === 'machine'
            ? 'Заказ передан автомату. Заберите десерт после сигнала готовности.'
            : 'Продавец уже получил уведомление об оплаченном заказе.'}</p>
          <div className="sale-code"><span>Заказ</span><strong>{payment.orderId}</strong><span>Код выдачи</span><b>{payment.saleCode}</b></div>
          <div className="fulfillment-status">
            <span>✓ Оплата подтверждена</span>
            <span>{payment.fulfillment === 'machine' ? '● Команда выдачи отправлена автомату' : '● Продавец уведомлён и сверит код'}</span>
          </div>
          <button className="terminal-cta compact" type="button" onClick={restart}>Новый заказ</button>
        </section>
      )}
    </main>
  );
}
