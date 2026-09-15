import React, { useEffect, useMemo, useRef, useState } from 'react';
import { trackEvent } from '../analytics/trackEvent.js';
import { PromotionPricePanel } from '../promotion/PromotionPricePanel.jsx';
import { PromotionPreStartBanner } from '../promotion/PromotionPreStartBanner.jsx';
import { TerminalPromotionHero } from '../promotion/PromotionAwareness.jsx';
import { resolveMachineId } from '../promotion/PricingQuoteApi.js';
import { usePricingQuote } from '../promotion/usePricingQuote.js';
import { usePromotionAwareness } from '../promotion/usePromotionAwareness.js';
import { salesTerminalService } from './SalesTerminalService.js';
import { PAYMENT_METHODS } from './salesChannelData.js';

const STEP_LABELS = ['Выбор', 'Оплата', 'Выдача'];
const BASE_PRODUCT_IMAGE_URL = '/product-base.png';
const IDLE_TIMEOUT_MS = 3 * 60 * 1000;

function BrandMark() { return <div className="terminal-brand"><span className="terminal-logo" aria-hidden="true">🍦</span><span><strong>У Тимоши</strong><small>панель продаж</small></span></div>; }
function Stepper({ step }) { return <ol className="terminal-stepper" aria-label="Этапы покупки">{STEP_LABELS.map((label, index) => <li className={index <= step ? 'is-active' : ''} key={label}><span>{index + 1}</span>{label}</li>)}</ol>; }
function ChoiceCard({ active, children, onClick }) { return <button className={active ? 'terminal-choice is-selected' : 'terminal-choice'} type="button" onClick={onClick}>{children}<span className="choice-check" aria-hidden="true">{active ? '✓' : ''}</span></button>; }
function ProductArtwork({ syrupId, toppingId, compact = false }) { const hasSyrup = syrupId && syrupId !== 'syrup_none'; const hasTopping = toppingId && toppingId !== 'topping_none'; return <div className={compact ? 'terminal-product-image compact' : 'terminal-product-image'}><img src={BASE_PRODUCT_IMAGE_URL} alt="Мягкое мороженое У Тимоши в фирменном стаканчике" />{(hasSyrup || hasTopping) && <div className="terminal-product-layers">{hasSyrup && <span>+ сироп</span>}{hasTopping && <span>+ посыпка</span>}</div>}</div>; }
function QrPattern() { return <svg className="payment-qr" viewBox="0 0 120 120" role="img" aria-label="Демонстрационный QR-код оплаты"><rect width="120" height="120" rx="12" fill="#fff" /><path fill="#241b16" d="M10 10h34v34H10zm8 8v18h18V18zM76 10h34v34H76zm8 8v18h18V18zM10 76h34v34H10zm8 8v18h18V84zM54 12h10v10H54zm0 20h10v20H44V42h10zm18 22h12v10H72zm20 0h18v10H92zM48 68h12v12H48zm20 0h10v20H68zm20 0h22v10H98v12H86V78h2zM48 90h12v20H48zm20 8h12v12H68zm20 0h22v12H88z" /></svg>; }

function IdleScreen({ onExit }) { return <div className="terminal-idle" role="button" tabIndex={0} onClick={onExit} onKeyDown={onExit}><div className="terminal-idle-card"><img src={BASE_PRODUCT_IMAGE_URL} alt="Мороженое У Тимоши" /><div className="terminal-idle-copy"><p className="terminal-kicker">У Тимоши</p><h1>Счастье в одном стаканчике</h1><p>Мягкое мороженое — приготовим прямо сейчас.</p><span className="terminal-idle-touch">Коснитесь экрана, чтобы начать</span></div></div></div>; }

function LoyaltyModal({ phone, setPhone, onContinue, onSkip }) { return <div className="terminal-modal-backdrop"><section className="terminal-modal" role="dialog" aria-modal="true" aria-labelledby="loyalty-title"><p className="terminal-kicker">Клуб Тимоши</p><h2 id="loyalty-title">Хотите получать бонусы?</h2><p>Введите номер телефона — мы привяжем эту покупку. Регистрация не мешает оплате и не уводит вас от аппарата.</p><input className="terminal-phone" inputMode="tel" autoComplete="tel" placeholder="+7 (___) ___-__-__" value={phone} onChange={(event) => setPhone(event.target.value)} /><div className="terminal-modal-actions"><button className="terminal-cta" type="button" onClick={onContinue}>Продолжить с бонусами</button><button className="terminal-secondary" type="button" onClick={onSkip}>Оплатить без бонусов</button></div></section></div>; }

export function SalesTerminalPage() {
  const catalog = useMemo(() => salesTerminalService.getCatalogView(), []);
  const machineId = useMemo(() => resolveMachineId(), []);
  const [syrupId, setSyrupId] = useState('syrup_none');
  const [toppingId, setToppingId] = useState('topping_none');
  const [methodId, setMethodId] = useState('sbp');
  const [step, setStep] = useState(0);
  const [selectionStage, setSelectionStage] = useState('base');
  const [payment, setPayment] = useState(null);
  const [quoteRefreshKey, setQuoteRefreshKey] = useState(0);
  const [loyaltyOpen, setLoyaltyOpen] = useState(false);
  const [phone, setPhone] = useState('');
  const [idle, setIdle] = useState(false);
  const [serviceOpen, setServiceOpen] = useState(false);
  const idleTimer = useRef(null);
  const serviceClicks = useRef([]);
  const preview = useMemo(() => salesTerminalService.createOrderPreview({ syrupId, toppingId }), [syrupId, toppingId]);
  const awareness = usePromotionAwareness({ machineId, channel: 'TERMINAL' });
  const pricing = usePricingQuote({ machineId, channel: 'TERMINAL', productId: catalog.product.id, productName: catalog.product.name.ru, refreshKey: quoteRefreshKey });
  const syrup = catalog.syrups.find(({ id }) => id === syrupId);
  const topping = catalog.toppings.find(({ id }) => id === toppingId);
  const serverPrice = pricing.status === 'ready' && pricing.quote && !pricing.lockExpired ? Number(pricing.quote.finalAmount) : preview.pricing.finalPrice;
  const canPay = pricing.status === 'ready' && !pricing.lockExpired;

  function armIdle() { clearTimeout(idleTimer.current); if (step === 0 && !loyaltyOpen && !serviceOpen) idleTimer.current = setTimeout(() => { setIdle(true); setSelectionStage('base'); trackEvent('TerminalIdleStarted', { machine_id: machineId }); }, IDLE_TIMEOUT_MS); }
  useEffect(() => { const events = ['pointerdown', 'keydown', 'touchstart']; const reset = () => { if (!idle) armIdle(); }; events.forEach((name) => window.addEventListener(name, reset, { passive: true })); armIdle(); return () => { clearTimeout(idleTimer.current); events.forEach((name) => window.removeEventListener(name, reset)); }; }, [step, loyaltyOpen, serviceOpen, idle]);

  function exitIdle() { setIdle(false); setSelectionStage('base'); armIdle(); trackEvent('TerminalIdleExitTouch', { machine_id: machineId }); }
  function refreshQuote() { setQuoteRefreshKey((value) => value + 1); trackEvent('PricingQuoteRefreshRequested', { machine_id: machineId, channel: 'TERMINAL' }); }
  function requestPayment() { if (canPay) setLoyaltyOpen(true); }
  function startPayment(customerPhone = null) { if (!canPay) return; setLoyaltyOpen(false); const intent = salesTerminalService.createPaymentIntent({ channelId: 'vending', methodId, orderPreview: preview, quote: pricing.quote }); setPayment({ ...intent, customerPhone }); setStep(1); trackEvent('TerminalPaymentStarted', { channel_id: 'vending', payment_method: methodId, quote_id: pricing.quote.id, syrup_id: syrupId, topping_id: toppingId, loyalty_phone_provided: Boolean(customerPhone) }); }
  function continueWithPhone() { const normalized = phone.replace(/\D/g, ''); if (normalized.length < 10) return; startPayment(phone); }
  function confirmDemoPayment() { const confirmed = salesTerminalService.applyDemoPaymentConfirmation(payment); setPayment(confirmed); setStep(2); trackEvent('TerminalDemoPaymentConfirmed', { channel_id: 'vending', order_id: payment.orderId }); }
  function restart() { setPayment(null); setStep(0); setSelectionStage('base'); setSyrupId('syrup_none'); setToppingId('topping_none'); setPhone(''); refreshQuote(); }
  function serviceTap() { const now = Date.now(); serviceClicks.current = [...serviceClicks.current.filter((value) => now - value < 1200), now]; if (serviceClicks.current.length >= 3) { serviceClicks.current = []; setServiceOpen(true); trackEvent('TerminalServiceGatewayOpened', { machine_id: machineId }); } }

  if (idle) return <IdleScreen onExit={exitIdle} />;

  return <main className="terminal-shell">
    <header className="terminal-header"><BrandMark /><button className="terminal-point" type="button" onClick={serviceTap}><span className="online-dot" />{machineId ? `Автомат ${machineId}` : 'Тестовый терминал'}</button></header>
    <Stepper step={step} />

    {step === 0 && selectionStage === 'base' && <><PromotionPreStartBanner awareness={awareness} terminal /><TerminalPromotionHero pricing={pricing} /><div className="terminal-layout"><section className="terminal-main"><div className="terminal-title"><div><p className="terminal-kicker">Мягкое мороженое</p><h1>Соберите свой десерт</h1></div><span className="terminal-price">{serverPrice} ₽</span></div><PromotionPricePanel pricing={pricing} onRefresh={refreshQuote} /><div className="terminal-product"><ProductArtwork syrupId={syrupId} toppingId={toppingId} /><div><span className="terminal-pill">Базовый десерт</span><h2>{catalog.flavor.name.ru}</h2><p>Мягкое ванильное мороженое в фирменном стаканчике. Дальше выберите сироп и посыпку.</p><div className="included-list"><span>✓ Мороженое</span><span>✓ Стаканчик</span></div></div></div><button className="terminal-cta" type="button" onClick={() => setSelectionStage('syrup')}>Выбрать сироп <span>→</span></button></section><aside className="terminal-summary"><div className="terminal-point-card"><p className="terminal-kicker">Точка продажи</p><strong>{machineId ? `Автомат № ${machineId}` : 'Тестовый терминал'}</strong><small>Тип точки определяется системой автоматически</small><span className="terminal-point-status"><span className="online-dot" /> Работает</span></div><div className="receipt"><p className="terminal-kicker">Ваш заказ</p><h3>{catalog.product.name.ru}</h3><div className="receipt-total"><span>К оплате</span><strong>{serverPrice} ₽</strong></div></div></aside></div></>}

    {step === 0 && selectionStage === 'syrup' && <section className="terminal-main terminal-config-screen"><div className="terminal-config-screen-head"><div><p className="terminal-kicker">Шаг 1 из 2</p><h1>Выберите сироп</h1></div><span className="terminal-price">{serverPrice} ₽</span></div><div className="choice-grid">{catalog.syrups.map((item) => <ChoiceCard active={syrupId === item.id} key={item.id} onClick={() => setSyrupId(item.id)}><span className={`flavor-swatch ${item.id}`} /><strong>{item.name.ru}</strong></ChoiceCard>)}</div><div className="terminal-config-actions"><button className="terminal-secondary" type="button" onClick={() => setSelectionStage('base')}>← Назад</button><button className="terminal-cta" type="button" onClick={() => setSelectionStage('topping')}>Дальше: посыпка <span>→</span></button></div></section>}

    {step === 0 && selectionStage === 'topping' && <section className="terminal-main terminal-config-screen"><div className="terminal-config-screen-head"><div><p className="terminal-kicker">Шаг 2 из 2</p><h1>Добавьте посыпку</h1></div><span className="terminal-price">{serverPrice} ₽</span></div><div className="choice-grid">{catalog.toppings.map((item) => <ChoiceCard active={toppingId === item.id} key={item.id} onClick={() => setToppingId(item.id)}><span className={`topping-symbol ${item.id}`}>{item.id === 'topping_none' ? '—' : '✦'}</span><strong>{item.name.ru}</strong></ChoiceCard>)}</div><div className="terminal-config-actions"><button className="terminal-secondary" type="button" onClick={() => setSelectionStage('syrup')}>← Назад</button><button className="terminal-cta" type="button" onClick={() => setSelectionStage('summary')}>Проверить заказ <span>→</span></button></div></section>}

    {step === 0 && selectionStage === 'summary' && <div className="terminal-layout"><section className="terminal-main"><div className="terminal-title"><div><p className="terminal-kicker">Проверьте заказ</p><h1>Всё готово</h1></div><span className="terminal-price">{serverPrice} ₽</span></div><div className="terminal-product"><ProductArtwork syrupId={syrupId} toppingId={toppingId} /><div><h2>{catalog.product.name.ru}</h2><p>Сироп: <strong>{syrup.name.ru}</strong></p><p>Посыпка: <strong>{topping.name.ru}</strong></p></div></div><div className="terminal-config-actions"><button className="terminal-secondary" type="button" onClick={() => setSelectionStage('syrup')}>Изменить состав</button><button className="terminal-cta" type="button" onClick={requestPayment} disabled={!canPay}>{pricing.status === 'loading' ? 'Проверяем цену…' : 'Перейти к оплате'} <span>→</span></button></div></section><aside className="terminal-summary"><div className="receipt"><p className="terminal-kicker">Ваш заказ</p><h3>{catalog.product.name.ru}</h3><dl><dt>Сироп</dt><dd>{syrup.name.ru}</dd><dt>Посыпка</dt><dd>{topping.name.ru}</dd></dl><div className="receipt-total"><span>К оплате</span><strong>{serverPrice} ₽</strong></div></div><p className="safe-payment">Бонусы не являются обязательным условием покупки</p></aside></div>}

    {loyaltyOpen && <LoyaltyModal phone={phone} setPhone={setPhone} onContinue={continueWithPhone} onSkip={() => startPayment(null)} />}

    {step === 1 && <section className="payment-screen"><div className="payment-panel"><button className="terminal-back" type="button" onClick={restart}>← Вернуться к заказу</button><p className="terminal-kicker">Заказ {payment.orderId}</p><h1>{payment.paymentRequired ? `Оплатите ${payment.amount} ₽` : 'Подарок готов к выдаче'}</h1><p>Выберите удобный способ. Терминал дождётся подтверждения от платёжной системы.</p>{payment.paymentRequired && <><div className="payment-methods">{PAYMENT_METHODS.map((method) => <ChoiceCard active={methodId === method.id} key={method.id} onClick={() => setMethodId(method.id)}><span className="method-icon">{method.icon}</span><span><strong>{method.name}</strong><small>{method.description}</small></span></ChoiceCard>)}</div><div className="payment-action">{methodId === 'sbp' ? <QrPattern /> : <div className="card-redirect">Ю<span>Касса</span></div>}<div><strong>{methodId === 'sbp' ? 'Наведите камеру телефона' : 'Откройте защищённую форму'}</strong><p>После оплаты не закрывайте экран — статус обновится автоматически.</p></div></div></>}<button className="demo-confirm" type="button" onClick={confirmDemoPayment}>Демо: подтвердить оплату</button></div><aside className="payment-order-card"><ProductArtwork syrupId={syrupId} toppingId={toppingId} compact /><h2>{catalog.product.name.ru}</h2><p>{syrup.name.ru} · {topping.name.ru}</p><strong>{payment.amount} ₽</strong></aside></section>}

    {step === 2 && <section className="success-screen"><div className="success-check">✓</div><p className="terminal-kicker">Оплата подтверждена</p><h1>Начинаем готовить!</h1><p>Заказ передан автомату. Заберите десерт после сигнала готовности.</p>{payment.customerPhone && <div className="terminal-saving">Покупка привязана к вашему номеру. Дальше с бонусами и отзывами работает Клуб Тимоши — аппарат ждать не нужно.</div>}<div className="sale-code"><span>Заказ</span><strong>{payment.orderId}</strong><span>Код выдачи</span><b>{payment.saleCode}</b></div><button className="terminal-cta compact" type="button" onClick={restart}>Новый заказ</button></section>}

    {serviceOpen && <div className="terminal-modal-backdrop"><section className="terminal-modal"><p className="terminal-kicker">Сервисный доступ</p><h2>Требуется авторизация</h2><p>Тройное нажатие открывает только защищённый шлюз. Выход в Android/Windows будет доступен после авторизации техника или мастера и проверки роли.</p><div className="terminal-modal-actions"><button className="terminal-secondary" type="button" onClick={() => setServiceOpen(false)}>Закрыть</button><button className="terminal-cta" type="button" disabled>Авторизация QR — следующий этап</button></div></section></div>}
  </main>;
}
