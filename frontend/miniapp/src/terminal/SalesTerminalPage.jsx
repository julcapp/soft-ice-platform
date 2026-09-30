import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { trackEvent } from '../analytics/trackEvent.js';
import { PromotionPricePanel } from '../promotion/PromotionPricePanel.jsx';
import { resolveMachineId } from '../promotion/PricingQuoteApi.js';
import { usePricingQuote } from '../promotion/usePricingQuote.js';
import { recognizeDisplayPhone } from './DisplayRecognitionApi.js';
import { RecognitionState } from './RecognitionState.jsx';
import { getMachineCatalog } from './MachineCatalogApi.js';

const IDLE_TIMEOUT_MS = 120_000;
const STEPS = Object.freeze({ IDLE: 'idle', HOME: 'home', CLUB: 'club', PREPAID: 'prepaid', CHOICE: 'choice', SUMMARY: 'summary', PAYMENT: 'payment' });
const ProductMediaContext = createContext(null);
const DEFAULT_PRODUCT_MEDIA = '/media/ice/UT-ICE-Hero-001-transparent.png';
const OWNER_PORTRAIT = '/media/brand/owner.jpg';
const TEST_DISPLAY_CITY = 'Обнинск';
const digits = (value) => value.replace(/\D/g, '').slice(0, 10);
const phoneText = (value) => { const v = digits(value).padEnd(10, '_'); return `+7 (${v.slice(0, 3)}) ${v.slice(3, 6)}-${v.slice(6, 8)}-${v.slice(8, 10)}`; };
const money = (value, currency = 'RUB') => {
  const amount = Number(value);
  if (value === null || value === undefined || value === '' || !Number.isFinite(amount) || amount < 0) return '—';
  return new Intl.NumberFormat('ru-RU', { style: 'currency', currency, maximumFractionDigits: 2 }).format(amount);
};

function Header({ catalog }) { return <header className="display-header" data-testid="display-header"><div className="display-brand"><img className="display-owner-photo" src={OWNER_PORTRAIT} alt="Собственник бренда У Тимоши" /><div><strong>У Тимоши</strong><small>Счастье в одном стаканчике</small></div></div><div className="display-machine"><i aria-hidden="true" />{catalog?.machine?.name || 'Автомат'}{catalog?.machine?.location ? ` · ${catalog.machine.location}` : ''}</div></header>; }
function ProductHero({ alt, src }) { const catalogSrc = useContext(ProductMediaContext); const resolvedSrc = src || catalogSrc || DEFAULT_PRODUCT_MEDIA; return <figure className="display-product"><img src={resolvedSrc} alt={alt} /><figcaption>Мягкое мороженое — приготовим прямо сейчас.</figcaption></figure>; }
function useDisplayClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => { const timer = window.setInterval(() => setNow(new Date()), 30_000); return () => window.clearInterval(timer); }, []);
  return now;
}

function weatherIcon(code) {
  if (code === 0) return '☀';
  if ([1,2].includes(code)) return '🌤';
  if ([3,45,48].includes(code)) return '☁';
  if ([51,53,55,56,57,61,63,65,66,67,80,81,82].includes(code)) return '🌧';
  if ([71,73,75,77,85,86].includes(code)) return '❄';
  if ([95,96,99].includes(code)) return '⛈';
  return '☁';
}

function useCurrentWeather(place) {
  const [weather, setWeather] = useState(null);
  useEffect(() => {
    if (!place) return undefined;
    const controller = new AbortController();
    const load = async () => {
      try {
        const geo = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(place)}&count=1&language=ru&format=json`, { signal: controller.signal }).then((r) => r.json());
        const point = geo?.results?.[0];
        if (!point) return;
        const data = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${point.latitude}&longitude=${point.longitude}&current=temperature_2m,weather_code&timezone=auto`, { signal: controller.signal }).then((r) => r.json());
        if (Number.isFinite(Number(data?.current?.temperature_2m))) setWeather({ temperature: Math.round(Number(data.current.temperature_2m)), code: Number(data.current.weather_code) });
      } catch (error) { if (error?.name !== 'AbortError') setWeather(null); }
    };
    load();
    const timer = window.setInterval(load, 15 * 60_000);
    return () => { controller.abort(); window.clearInterval(timer); };
  }, [place]);
  return weather;
}

function IdleScreen({ onStart, heroPath, catalog, machineId }) {
  const now = useDisplayClock();
  const dateText = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long' }).format(now);
  const timeText = new Intl.DateTimeFormat('ru-RU', { hour: '2-digit', minute: '2-digit' }).format(now);
  const rawLocation = String(catalog?.machine?.location || '').trim();
  const displayLocation = rawLocation && !/^Тестовая/i.test(rawLocation) ? rawLocation : TEST_DISPLAY_CITY;
  const weather = useCurrentWeather(machineId === 'TEST-MACHINE-001' ? TEST_DISPLAY_CITY : displayLocation);
  const temperature = weather ? `${weather.temperature > 0 ? '+' : ''}${weather.temperature}°` : '—°';
  return <button className="display-idle display-idle-v2" data-testid="display-idle" type="button" onClick={onStart} aria-label="Коснитесь экрана, чтобы начать">
    <div className="idle-topbar">
      <div className="idle-owner"><img src={OWNER_PORTRAIT} alt="Собственник бренда У Тимоши" /><div><strong>У Тимоши</strong><small>Счастье в одном стаканчике</small></div></div>
      <div className="idle-clock"><span>{dateText}</span><strong>{timeText}</strong><i aria-hidden="true">{weatherIcon(weather?.code)}</i><b>{temperature}</b></div>
      <div className="idle-machine-card"><strong>Аппарат № {machineId || '—'}</strong></div>
    </div>
    <div className="idle-location">{displayLocation}</div>
    <div className="idle-stage">
      <div className="idle-note idle-note-left">Счастье<br />рядом! <span>♡</span></div>
      <ProductHero alt={catalog?.currentFlavor?.nameRu || 'Сливочное мягкое мороженое У Тимоши'} src={heroPath} />
      <div className="idle-note idle-note-right">Натуральный<br />вкус <span>♡</span></div>
    </div>
    <div className="idle-footnote">* Вкус дня может быть изменён</div>
    <div className="idle-start-prompt">Коснитесь экрана, чтобы начать</div>
  </button>;
}

function PhoneKeypad({ value, onChange, onContinue, onSkip }) {
  const keys = ['1','2','3','4','5','6','7','8','9','0'];
  return <section className="display-phone"><p className="display-kicker">Клуб Тимоши</p><h1>Введите номер телефона</h1><p>Введите российский номер телефона или продолжите покупку без клуба.</p><output aria-label="Номер телефона">{phoneText(value)}</output><div className="display-keys">{keys.map((key) => <button key={key} type="button" onClick={() => onChange(digits(value + key))}>{key}</button>)}<button type="button" aria-label="Удалить цифру" onClick={() => onChange(value.slice(0, -1))}>⌫</button></div><div className="display-phone-actions"><button type="button" className="display-secondary" onClick={onSkip}>Продолжить без скидки</button><button type="button" className="display-primary" disabled={value.length !== 10} onClick={onContinue}>Продолжить</button></div></section>;
}

function PrepaidBoundary({ onBack }) {
  return <section className="display-prepaid" aria-labelledby="display-prepaid-title"><div className="display-prepaid-icon" aria-hidden="true">⌁</div><p className="display-kicker">Оплаченный заказ</p><h1 id="display-prepaid-title">Получение скоро будет доступно</h1><p>Получить оплаченный заказ здесь можно будет после подключения сервиса проверки кода и предзаказа.</p><p className="display-boundary-note">Сейчас экран не проверяет код, не создаёт заказ и не запускает выдачу.</p><button className="display-secondary" type="button" onClick={onBack}>Назад</button></section>;
}

function OptionCard({ item, selected, onClick }) { return <button className={`display-option ${selected ? 'is-selected' : ''}`} type="button" onClick={onClick}><span className={`option-art option-${item.category.toLowerCase()}`} aria-hidden="true">{item.systemItem ? '×' : item.category === 'SPRINKLE' ? '✦' : '●'}</span><strong>{item.nameRu}</strong><small>{item.basePrice === 0 ? 'Без доплаты' : money(item.basePrice, item.currency)}</small><i>{selected ? '✓' : ''}</i></button>; }

export function SalesTerminalPage() {
  const machineId = useMemo(() => resolveMachineId(), []);
  const [catalogState, setCatalogState] = useState({ status: 'loading', catalog: null, error: null });
  const [step, setStep] = useState(STEPS.IDLE);
  const [phone, setPhone] = useState('');
  const [recognition, setRecognition] = useState(null);
  const recognitionRequest = useRef(null);
  const clearRecognition = () => {
    recognitionRequest.current?.abort();
    recognitionRequest.current = null;
    setPhone('');
    setRecognition(null);
  };
  useEffect(() => () => recognitionRequest.current?.abort(), []);
  const recognize = async () => {
    recognitionRequest.current?.abort();
    const controller = new AbortController();
    recognitionRequest.current = controller;
    setRecognition({ state: 'LOADING' });
    const result = await recognizeDisplayPhone(machineId, `+7${phone}`, { signal: controller.signal });
    if (recognitionRequest.current !== controller || controller.signal.aborted) return;
    setPhone('');
    setRecognition(result);
  };
  const continueAnonymous = () => { clearRecognition(); setStep(STEPS.CHOICE); };
  const [sprinkleSku, setSprinkleSku] = useState(null);
  const [toppingSku, setToppingSku] = useState(null);
  const [quoteRefreshKey, setQuoteRefreshKey] = useState(0);
  useEffect(() => { const controller = new AbortController(); getMachineCatalog(machineId, { signal: controller.signal }).then((catalog) => { setCatalogState({ status: 'ready', catalog, error: null }); setSprinkleSku(catalog.sprinkles[0]?.sku || null); setToppingSku(catalog.toppings[0]?.sku || null); }).catch((error) => { if (error.name !== 'AbortError') setCatalogState({ status: 'error', catalog: null, error }); }); return () => controller.abort(); }, [machineId]);
  useEffect(() => { if (step === STEPS.IDLE) return undefined; const reset = () => { clearRecognition(); setStep(STEPS.IDLE); }; let timer = window.setTimeout(reset, IDLE_TIMEOUT_MS); const activity = () => { window.clearTimeout(timer); timer = window.setTimeout(reset, IDLE_TIMEOUT_MS); }; window.addEventListener('pointerdown', activity); window.addEventListener('keydown', activity); return () => { window.clearTimeout(timer); window.removeEventListener('pointerdown', activity); window.removeEventListener('keydown', activity); }; }, [step]);
  const catalog = catalogState.catalog;
  const selectedItems = useMemo(() => catalog ? [catalog.currentFlavor, catalog.sprinkles.find((item) => item.sku === sprinkleSku), catalog.toppings.find((item) => item.sku === toppingSku)].filter(Boolean) : [], [catalog, sprinkleSku, toppingSku]);
  const pricing = usePricingQuote({ machineId, channel: 'TERMINAL', items: step === STEPS.IDLE ? [] : selectedItems, refreshKey: quoteRefreshKey });
  const canContinue = pricing.status === 'ready' && !pricing.lockExpired;
  const begin = () => { setStep(STEPS.HOME); trackEvent('TerminalSessionStarted', { machine_id: machineId }); };
  if (step === STEPS.IDLE) return <IdleScreen onStart={begin} heroPath={catalog?.currentFlavor?.mediaPath} catalog={catalog} machineId={machineId} />;
  if (catalogState.status === 'loading') return <main className="display-state" data-testid="display-loading"><div className="display-spinner" /><h1>Загружаем меню…</h1></main>;
  if (catalogState.status === 'error') return <main className="display-state is-error" data-testid="display-error"><h1>Покупка временно недоступна</h1><p>{catalogState.error?.message || 'Не удалось проверить каталог и цену.'}</p><button type="button" onClick={() => window.location.reload()}>Повторить</button></main>;
  return <ProductMediaContext.Provider value={catalog.currentFlavor.mediaPath}><main className="display-shell" data-testid={`display-screen-${step}`}><Header catalog={catalog} />
    {step === STEPS.HOME && <section className="display-home"><ProductHero alt={catalog.currentFlavor.nameRu} /><div className="display-home-copy"><p className="display-kicker">Сегодня в аппарате</p><h1>{catalog.currentFlavor.nameRu}</h1><p>Собери свой вкус: выберите посыпку и топпинг.</p><div className="display-home-price">от {money(catalog.currentFlavor.basePrice, catalog.currency)}</div><div className="display-home-actions"><button className="display-primary" type="button" onClick={() => setStep(STEPS.CHOICE)}>Собрать мороженое</button><button className="display-secondary" data-testid="display-prepaid-entry" type="button" onClick={() => setStep(STEPS.PREPAID)}>Получить оплаченный заказ</button></div><button className="display-club" type="button" onClick={() => setStep(STEPS.CLUB)}><span>♡</span><div><strong>Клуб Тимоши</strong><small>Каждая 50-я покупка — в подарок</small></div><b>Получить свою скидку</b></button><div className="display-values"><span>Натуральные ингредиенты</span><span>Улыбка с каждым стаканчиком</span><span>Подари свою улыбку!</span></div></div></section>}
    {step === STEPS.CLUB && (recognition ? <RecognitionState result={recognition} onSkip={continueAnonymous} onReset={clearRecognition} /> : <PhoneKeypad value={phone} onChange={setPhone} onSkip={continueAnonymous} onContinue={recognize} />)}
    {step === STEPS.PREPAID && <PrepaidBoundary onBack={() => setStep(STEPS.HOME)} />}
    {step === STEPS.CHOICE && <section className="display-choice"><div className="display-choice-hero"><ProductHero alt={catalog.currentFlavor.nameRu} /><div><p className="display-kicker">Текущий вкус</p><h2>{catalog.currentFlavor.nameRu}</h2></div></div><div className="display-choice-content"><h1>Собери свой вкус</h1><h2>Посыпка</h2><div className="display-option-grid">{catalog.sprinkles.map((item) => <OptionCard key={item.id} item={item} selected={sprinkleSku === item.sku} onClick={() => setSprinkleSku(item.sku)} />)}</div><h2>Топпинг</h2><div className="display-option-grid">{catalog.toppings.map((item) => <OptionCard key={item.id} item={item} selected={toppingSku === item.sku} onClick={() => setToppingSku(item.sku)} />)}</div><PromotionPricePanel pricing={pricing} onRefresh={() => setQuoteRefreshKey((value) => value + 1)} /><div className="display-nav"><button className="display-secondary" type="button" onClick={() => setStep(STEPS.HOME)}>Назад</button><button className="display-primary" type="button" disabled={!canContinue} onClick={() => setStep(STEPS.SUMMARY)}>{pricing.status === 'loading' ? 'Проверяем цену…' : 'Продолжить'}</button></div></div></section>}
    {step === STEPS.SUMMARY && <section className="display-summary"><div><p className="display-kicker">Ваш заказ</p><h1>Всё верно?</h1><ul>{selectedItems.map((item) => <li key={item.id}><span>{item.nameRu}</span><strong>{money(item.basePrice, item.currency)}</strong></li>)}</ul><div className="display-total"><span>К оплате</span><strong>{money(pricing.quote?.finalAmount, pricing.quote?.currency)}</strong></div><p className="display-price-proof">Цена подтверждена сервером · quote {pricing.quote?.id}</p></div><ProductHero alt={catalog.currentFlavor.nameRu} /><div className="display-nav"><button className="display-secondary" type="button" onClick={() => setStep(STEPS.CHOICE)}>Изменить</button><button className="display-primary" type="button" disabled={!canContinue} onClick={() => setStep(STEPS.PAYMENT)}>Перейти к оплате</button></div></section>}
    {step === STEPS.PAYMENT && <section className="display-payment"><p className="display-kicker">Безналичная оплата</p><h1>{Number(pricing.quote?.finalAmount) === 0 ? 'Подтверждаем подарок' : `К оплате ${money(pricing.quote?.finalAmount, pricing.quote?.currency)}`}</h1><div className="display-payment-placeholder" role="status"><span aria-hidden="true">⌛</span><strong>QR-код появится после создания платёжной сессии</strong></div><p>Платёж создаёт и подтверждает Payment Runtime. Этот экран не может самостоятельно отметить оплату или выдачу успешной.</p><div className="display-waiting"><span />Ожидаем подтверждение сервера</div><button className="display-secondary" type="button" onClick={() => setStep(STEPS.SUMMARY)}>Вернуться к заказу</button></section>}
  </main></ProductMediaContext.Provider>;
}
