import React, { useEffect, useMemo, useState } from 'react';
import { terminalContent } from './data/terminalContent.js';
import { CatalogService } from './services/catalogService.js';
import { PriceService } from './services/priceService.js';
import './styles.css';

const FLOW = ['home', 'sprinkle', 'sauce', 'summary', 'payment'];
const NONE = { id: 'none', name: 'Без добавки', price: 0, available: true };
const PRIMARY_ICE_IMAGE = '/media/ice/UT-ICE-Hero-001.png';
const BRAND_OWNER_IMAGE = '/media/brand/owner.jpg';

function StatusBar() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => { const id = window.setInterval(() => setNow(new Date()), 30000); return () => window.clearInterval(id); }, []);
  const date = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long' }).format(now);
  const time = new Intl.DateTimeFormat('ru-RU', { hour: '2-digit', minute: '2-digit' }).format(now);
  return <div className="status-bar" aria-label="Дата, время и погода"><span>{date}</span><strong>{time}</strong><span className="weather-slot" data-weather-state="pending">Погода —</span></div>;
}

function IceCreamVisual() { return <div className="product-visual"><img className="product-hero-image" src={PRIMARY_ICE_IMAGE} alt="Сливочное мягкое мороженое в фирменном стаканчике У Тимоши" /></div>; }
function BrandMark() { const [failed,setFailed]=useState(false); return <div className="brand-mark">{!failed?<img src={BRAND_OWNER_IMAGE} alt="Владелец бренда" onError={()=>setFailed(true)}/>:<span>Т</span>}</div>; }
function Choice({ item, selected, currency, onClick }) { return <button type="button" className={`option-card ${selected ? 'selected' : ''}`} aria-pressed={selected} onClick={onClick}><strong>{item.name}</strong>{item.description && <small>{item.description}</small>}<span>{item.id === 'none' ? 'Без доплаты' : PriceService.format(item.price, currency)}</span></button>; }
function FlowHeader({ onBack }) { return <><StatusBar/><header className="flow-header"><BrandMark/><div className="flow-header-spacer"/></header></>; }

function PaymentScreen({ product, sprinkle, sauce, total, onBack }) {
  const [method, setMethod] = useState('sbp');
  const [phoneMode, setPhoneMode] = useState(false);
  const [phone, setPhone] = useState('');
  const orderRows = [
    { label: `Мягкое мороженое (${product.name})`, price: product.price },
    ...(sauce?.id !== 'none' ? [{ label: `Топпинг — ${sauce.name}`, price: sauce.price }] : []),
    ...(sprinkle?.id !== 'none' ? [{ label: `Посыпка — ${sprinkle.name}`, price: sprinkle.price }] : []),
  ];
  return <main className="terminal-shell payment-shell">
    <StatusBar/>
    <header className="payment-top"><BrandMark/><button className="payment-back" type="button" onClick={onBack}>← Назад</button></header>
    <div className="payment-slogan">Счастье<br/>в одном стаканчике! ♡</div>
    <section className="payment-layout">
      <aside className="payment-order-card">
        <h2>Ваш заказ</h2>
        <div className="payment-product"><IceCreamVisual/></div>
        <div className="payment-order-lines">{orderRows.map((row, index)=><div className="payment-order-line" key={`${row.label}-${index}`}><span>{row.label}</span><strong>{PriceService.format(row.price, product.currency)}</strong></div>)}</div>
        <div className="payment-total"><span>Итого к оплате</span><strong>{PriceService.format(total, product.currency)}</strong></div>
      </aside>
      <section className="payment-methods-card">
        <h2>Выберите способ оплаты</h2>
        <div className="payment-method-grid">
          <button type="button" className={`payment-method ${method === 'sbp' ? 'selected' : ''}`} onClick={()=>{setMethod('sbp');setPhoneMode(false);}}>
            <span className="method-icon">▰</span><span><strong>Оплата по СБП</strong><small>Быстро и удобно</small></span>{method === 'sbp' && <b>✓</b>}
          </button>
          <button type="button" className={`payment-method ${method === 'card' ? 'selected' : ''}`} onClick={()=>{setMethod('card');setPhoneMode(false);}}>
            <span className="method-icon">▣</span><span><strong>Банковская карта</strong><small>Visa · Mastercard · Мир</small></span>{method === 'card' && <b>✓</b>}
          </button>
        </div>
        {method === 'sbp' && <div className="sbp-stage">
          <div className="sbp-copy"><strong>Оплата QR-кодом</strong><span>Откройте приложение вашего банка и отсканируйте QR-код</span><ol><li>Откройте приложение банка</li><li>Отсканируйте QR-код</li><li>Подтвердите оплату</li></ol></div>
          <div className="qr-placeholder"><strong>QR СБП</strong><span>появится после создания платежа</span></div>
        </div>}
        {method === 'card' && <div className="card-stage"><div className="pos-placeholder"><span className="contactless">)))</span><strong>К оплате<br/>{PriceService.format(total, product.currency)}</strong></div><div><h3>Оплата банковской картой</h3><p>После запуска платежа терминал предложит приложить или вставить карту.</p></div></div>}
        {method === 'sbp' && !phoneMode && <button className="send-phone-action" type="button" onClick={()=>setPhoneMode(true)}>Отправить мне на телефон</button>}
        {method === 'sbp' && phoneMode && <div className="phone-payment"><label htmlFor="payment-phone">Номер телефона для ссылки на оплату</label><div><span>+7</span><input id="payment-phone" inputMode="numeric" maxLength={10} value={phone} onChange={e=>setPhone(e.target.value.replace(/\D/g,'').slice(0,10))} placeholder="___ ___-__-__"/><button type="button" disabled={phone.length !== 10}>Отправить ссылку</button></div><button className="phone-cancel" type="button" onClick={()=>{setPhoneMode(false);setPhone('');}}>Отмена</button></div>}
      </section>
    </section>
  </main>;
}

export default function App() {
  const catalog = useMemo(() => CatalogService.getSnapshot(), []);
  const [screen, setScreen] = useState('home'); const [sprinkle, setSprinkle] = useState(NONE); const [sauce, setSauce] = useState(NONE);
  const product = catalog.product; const total = PriceService.total(product, sprinkle, sauce); const commercialCatalogReady = catalog.source !== 'local-placeholder'; const canPay = commercialCatalogReady && product.available !== false && PriceService.canPay(total);
  const back = () => { const index = FLOW.indexOf(screen); if (index > 0) setScreen(FLOW[index - 1]); };
  if (screen === 'home') return <main className="terminal-shell"><StatusBar/><header className="brand-header"><BrandMark/><div><div className="brand-name">{terminalContent.brand}</div><div className="brand-caption">{terminalContent.eyebrow}</div></div></header><section className="hero"><div className="hero-copy"><div className="eyebrow">Сегодня в аппарате</div><h1>{product.name}</h1><p className="subtitle">Мягкое мороженое в фирменном стаканчике</p></div><IceCreamVisual/><p className="flavor-note">{terminalContent.flavorNote}</p></section><section className="actions"><button className="primary-action" type="button" disabled={product.available === false} onClick={() => setScreen('sprinkle')}>{product.available === false ? 'Временно недоступно' : 'Начать покупку'}<span>→</span></button><button className="club-card" type="button"><span className="club-icon">♥</span><span className="club-copy"><strong>{terminalContent.clubTitle}</strong><small>{terminalContent.clubText}</small></span><span className="club-cta">{terminalContent.clubAction}</span></button></section><footer className="terminal-footer"><span>Оплата картой или СБП</span><span className="status-dot"/><span>{product.available === false ? 'Мороженое временно недоступно' : 'Аппарат готов к заказу'}</span></footer></main>;
  if (screen === 'sprinkle') return <Selection title="Выберите посыпку" subtitle="Можно продолжить без посыпки" items={[{...NONE,name:'Без посыпки'}, ...catalog.sprinkles]} selected={sprinkle} currency={product.currency} onSelect={setSprinkle} onBack={back} onNext={() => setScreen('sauce')} />;
  if (screen === 'sauce') return <Selection title="Выберите топпинг" subtitle="Можно продолжить без топпинга" items={[{...NONE,name:'Без топпинга'}, ...catalog.sauces]} selected={sauce} currency={product.currency} onSelect={setSauce} onBack={back} onNext={() => setScreen('summary')} />;
  if (screen === 'payment') return <PaymentScreen product={product} sprinkle={sprinkle} sauce={sauce} total={total} onBack={back}/>;
  return <main className="terminal-shell flow-shell"><FlowHeader onBack={back}/><section className="order-panel"><div><div className="eyebrow">Ваше мороженое</div><h1>Вы собрали своё мороженое</h1></div><IceCreamVisual/><div className="summary-card"><div><span>{product.name}</span><strong>{PriceService.format(product.price, product.currency)}</strong></div><div><span>Посыпка: {sprinkle.name}</span><strong>{PriceService.format(sprinkle.price, product.currency)}</strong></div><div><span>Топпинг: {sauce.name}</span><strong>{PriceService.format(sauce.price, product.currency)}</strong></div><div className="summary-total"><span>Итого</span><strong>{PriceService.format(total, product.currency)}</strong></div></div>{!commercialCatalogReady && <p className="notice">Продажа станет доступна после публикации утверждённого прайса на аппарат.</p>}<button className="primary-action" type="button" disabled={!canPay} onClick={()=>setScreen('payment')}>Перейти к оплате <span>→</span></button></section></main>;
}
function Selection({ title, subtitle, items, selected, currency, onSelect, onBack, onNext }) { return <main className="terminal-shell flow-shell"><FlowHeader onBack={onBack}/><section className="selection-panel"><div className="selection-title"><div className="eyebrow">Соберите своё мороженое</div><h1>{title}</h1><p className="subtitle">{subtitle}</p></div><IceCreamVisual/><div className="option-grid">{items.filter(item => item.available !== false).map(item => <Choice key={item.id} item={item} selected={selected?.id === item.id} currency={currency} onClick={() => onSelect(item)}/>)}</div><button className="primary-action selection-next" type="button" onClick={onNext}>Продолжить <span>→</span></button></section></main>; }
