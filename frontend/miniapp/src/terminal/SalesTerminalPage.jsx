import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { trackEvent } from '../analytics/trackEvent.js';
import { PromotionPricePanel } from '../promotion/PromotionPricePanel.jsx';
import { resolveMachineId } from '../promotion/PricingQuoteApi.js';
import { usePricingQuote } from '../promotion/usePricingQuote.js';
import { getMachineCatalog } from './MachineCatalogApi.js';

const IDLE_TIMEOUT_MS = 120_000;
const STEPS = Object.freeze({ IDLE: 'idle', HOME: 'home', CLUB: 'club', CHOICE: 'choice', SUMMARY: 'summary', PAYMENT: 'payment' });
const ProductMediaContext = createContext(null);
const digits = (value) => value.replace(/\D/g, '').slice(0, 10);
const phoneText = (value) => { const v = digits(value).padEnd(10, '_'); return `+7 (${v.slice(0, 3)}) ${v.slice(3, 6)}-${v.slice(6, 8)}-${v.slice(8, 10)}`; };
const money = (value, currency = 'RUB') => {
  const amount = Number(value);
  if (value === null || value === undefined || value === '' || !Number.isFinite(amount) || amount < 0) return '—';
  return new Intl.NumberFormat('ru-RU', { style: 'currency', currency, maximumFractionDigits: 2 }).format(amount);
};

function Header({ catalog }) { return <header className="display-header"><div className="display-brand"><span>🍦</span><div><strong>У Тимоши</strong><small>Счастье в одном стаканчике</small></div></div><div className="display-machine"><i />{catalog?.machine?.name || 'Автомат'}{catalog?.machine?.location ? ` · ${catalog.machine.location}` : ''}</div></header>; }
function ProductHero({ alt, src }) { const catalogSrc = useContext(ProductMediaContext); const resolvedSrc = src || catalogSrc; return <figure className="display-product">{resolvedSrc ? <img src={resolvedSrc} alt={alt} /> : <div className="display-product-placeholder" aria-hidden="true">🍦</div>}<figcaption>Мягкое мороженое — приготовим прямо сейчас.</figcaption></figure>; }
function IdleScreen({ onStart, heroPath }) { return <button className="display-idle" type="button" onClick={onStart} aria-label="Коснитесь экрана, чтобы начать"><div className="idle-copy"><p>У ТИМОШИ</p><h1>Счастье в одном стаканчике</h1><span>Мягкое мороженое — приготовим прямо сейчас.</span><strong>Коснитесь экрана, чтобы начать</strong></div><ProductHero alt="Мягкое мороженое У Тимоши" src={heroPath} /></button>; }

function PhoneKeypad({ value, onChange, onContinue, onSkip }) {
  const keys = ['1','2','3','4','5','6','7','8','9','0'];
  return <section className="display-phone"><p className="display-kicker">Клуб Тимоши</p><h1>Получите свою скидку</h1><p>Введите российский номер телефона или продолжите покупку без клуба.</p><output aria-label="Номер телефона">{phoneText(value)}</output><div className="display-keys">{keys.map((key) => <button key={key} type="button" onClick={() => onChange(digits(value + key))}>{key}</button>)}<button type="button" aria-label="Удалить цифру" onClick={() => onChange(value.slice(0, -1))}>⌫</button></div><div className="display-phone-actions"><button type="button" className="display-secondary" onClick={onSkip}>Продолжить без скидки</button><button type="button" className="display-primary" disabled={value.length !== 10} onClick={onContinue}>Продолжить</button></div></section>;
}

function OptionCard({ item, selected, onClick }) { return <button className={`display-option ${selected ? 'is-selected' : ''}`} type="button" onClick={onClick}><span className={`option-art option-${item.category.toLowerCase()}`} aria-hidden="true">{item.systemItem ? '×' : item.category === 'SPRINKLE' ? '✦' : '●'}</span><strong>{item.nameRu}</strong><small>{item.basePrice === 0 ? 'Без доплаты' : money(item.basePrice, item.currency)}</small><i>{selected ? '✓' : ''}</i></button>; }

export function SalesTerminalPage() {
  const machineId = useMemo(() => resolveMachineId(), []);
  const [catalogState, setCatalogState] = useState({ status: 'loading', catalog: null, error: null });
  const [step, setStep] = useState(STEPS.IDLE);
  const [phone, setPhone] = useState('');
  const [sprinkleSku, setSprinkleSku] = useState(null);
  const [toppingSku, setToppingSku] = useState(null);
  const [quoteRefreshKey, setQuoteRefreshKey] = useState(0);
  useEffect(() => { const controller = new AbortController(); getMachineCatalog(machineId, { signal: controller.signal }).then((catalog) => { setCatalogState({ status: 'ready', catalog, error: null }); setSprinkleSku(catalog.sprinkles[0]?.sku || null); setToppingSku(catalog.toppings[0]?.sku || null); }).catch((error) => { if (error.name !== 'AbortError') setCatalogState({ status: 'error', catalog: null, error }); }); return () => controller.abort(); }, [machineId]);
  useEffect(() => { if (step === STEPS.IDLE) return undefined; const reset = () => setStep(STEPS.IDLE); let timer = window.setTimeout(reset, IDLE_TIMEOUT_MS); const activity = () => { window.clearTimeout(timer); timer = window.setTimeout(reset, IDLE_TIMEOUT_MS); }; window.addEventListener('pointerdown', activity); window.addEventListener('keydown', activity); return () => { window.clearTimeout(timer); window.removeEventListener('pointerdown', activity); window.removeEventListener('keydown', activity); }; }, [step]);
  const catalog = catalogState.catalog;
  const selectedItems = useMemo(() => catalog ? [catalog.currentFlavor, catalog.sprinkles.find((item) => item.sku === sprinkleSku), catalog.toppings.find((item) => item.sku === toppingSku)].filter(Boolean) : [], [catalog, sprinkleSku, toppingSku]);
  const pricing = usePricingQuote({ machineId, channel: 'TERMINAL', items: step === STEPS.IDLE ? [] : selectedItems, refreshKey: quoteRefreshKey });
  const canContinue = pricing.status === 'ready' && !pricing.lockExpired;
  const begin = () => { setStep(STEPS.HOME); trackEvent('TerminalSessionStarted', { machine_id: machineId }); };
  if (step === STEPS.IDLE) return <IdleScreen onStart={begin} heroPath={catalog?.currentFlavor?.mediaPath} />;
  if (catalogState.status === 'loading') return <main className="display-state"><div className="display-spinner" /><h1>Загружаем меню…</h1></main>;
  if (catalogState.status === 'error') return <main className="display-state is-error"><h1>Покупка временно недоступна</h1><p>{catalogState.error?.message || 'Не удалось проверить каталог и цену.'}</p><button type="button" onClick={() => window.location.reload()}>Повторить</button></main>;
  return <ProductMediaContext.Provider value={catalog.currentFlavor.mediaPath}><main className="display-shell"><Header catalog={catalog} />
    {step === STEPS.HOME && <section className="display-home"><ProductHero alt={catalog.currentFlavor.nameRu} /><div className="display-home-copy"><p className="display-kicker">Сегодня в аппарате</p><h1>{catalog.currentFlavor.nameRu}</h1><p>Собери свой вкус: выберите посыпку и топпинг.</p><div className="display-home-price">от {money(catalog.currentFlavor.basePrice, catalog.currency)}</div><button className="display-primary" type="button" onClick={() => setStep(STEPS.CHOICE)}>Собрать мороженое</button><button className="display-club" type="button" onClick={() => setStep(STEPS.CLUB)}><span>♡</span><div><strong>Клуб Тимоши</strong><small>Каждая 50-я покупка — в подарок</small></div><b>Получить свою скидку</b></button><div className="display-values"><span>Натуральные ингредиенты</span><span>Улыбка с каждым стаканчиком</span><span>Подари свою улыбку!</span></div></div></section>}
    {step === STEPS.CLUB && <PhoneKeypad value={phone} onChange={setPhone} onSkip={() => setStep(STEPS.CHOICE)} onContinue={() => setStep(STEPS.CHOICE)} />}
    {step === STEPS.CHOICE && <section className="display-choice"><div className="display-choice-hero"><ProductHero alt={catalog.currentFlavor.nameRu} /><div><p className="display-kicker">Текущий вкус</p><h2>{catalog.currentFlavor.nameRu}</h2></div></div><div className="display-choice-content"><h1>Собери свой вкус</h1><h2>Посыпка</h2><div className="display-option-grid">{catalog.sprinkles.map((item) => <OptionCard key={item.id} item={item} selected={sprinkleSku === item.sku} onClick={() => setSprinkleSku(item.sku)} />)}</div><h2>Топпинг</h2><div className="display-option-grid">{catalog.toppings.map((item) => <OptionCard key={item.id} item={item} selected={toppingSku === item.sku} onClick={() => setToppingSku(item.sku)} />)}</div><PromotionPricePanel pricing={pricing} onRefresh={() => setQuoteRefreshKey((value) => value + 1)} /><div className="display-nav"><button className="display-secondary" type="button" onClick={() => setStep(STEPS.HOME)}>Назад</button><button className="display-primary" type="button" disabled={!canContinue} onClick={() => setStep(STEPS.SUMMARY)}>{pricing.status === 'loading' ? 'Проверяем цену…' : 'Продолжить'}</button></div></div></section>}
    {step === STEPS.SUMMARY && <section className="display-summary"><div><p className="display-kicker">Ваш заказ</p><h1>Всё верно?</h1><ul>{selectedItems.map((item) => <li key={item.id}><span>{item.nameRu}</span><strong>{money(item.basePrice, item.currency)}</strong></li>)}</ul><div className="display-total"><span>К оплате</span><strong>{money(pricing.quote?.finalAmount, pricing.quote?.currency)}</strong></div><p className="display-price-proof">Цена подтверждена сервером · quote {pricing.quote?.id}</p></div><ProductHero alt={catalog.currentFlavor.nameRu} /><div className="display-nav"><button className="display-secondary" type="button" onClick={() => setStep(STEPS.CHOICE)}>Изменить</button><button className="display-primary" type="button" disabled={!canContinue} onClick={() => setStep(STEPS.PAYMENT)}>Перейти к оплате</button></div></section>}
    {step === STEPS.PAYMENT && <section className="display-payment"><p className="display-kicker">Безналичная оплата</p><h1>{Number(pricing.quote?.finalAmount) === 0 ? 'Подтверждаем подарок' : `К оплате ${money(pricing.quote?.finalAmount, pricing.quote?.currency)}`}</h1><div className="display-qr" aria-label="Платёжный QR-код будет получен от Payment Runtime">СБП</div><p>Платёж создаёт и подтверждает Payment Runtime. Этот экран не может самостоятельно отметить оплату или выдачу успешной.</p><div className="display-waiting"><span />Ожидаем подтверждение сервера</div><button className="display-secondary" type="button" onClick={() => setStep(STEPS.SUMMARY)}>Вернуться к заказу</button></section>}
  </main></ProductMediaContext.Provider>;
}
