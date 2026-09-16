import React, { useEffect, useMemo, useState } from 'react';
import { terminalContent } from './data/terminalContent.js';
import { CatalogService } from './services/catalogService.js';
import { PriceService } from './services/priceService.js';
import './styles.css';

const FLOW = ['home', 'sprinkle', 'sauce', 'summary'];
const NONE = { id: 'none', name: 'Без добавки', price: 0, available: true };
const PRIMARY_ICE_IMAGE = '/media/ice/UT-ICE-Hero-001.png';

function StatusBar() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => { const id = window.setInterval(() => setNow(new Date()), 30000); return () => window.clearInterval(id); }, []);
  const date = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long' }).format(now);
  const time = new Intl.DateTimeFormat('ru-RU', { hour: '2-digit', minute: '2-digit' }).format(now);
  return <div className="status-bar" aria-label="Дата, время и погода"><span>{date}</span><strong>{time}</strong><span className="weather-slot" data-weather-state="pending" aria-label="Погода появится после синхронизации сервера">Погода —</span></div>;
}

function IceCreamVisual() {
  return <div className="product-visual"><img className="product-hero-image" src={PRIMARY_ICE_IMAGE} alt="Сливочное мягкое мороженое в фирменном стаканчике У Тимоши" /></div>;
}

function Choice({ item, selected, currency, onClick }) {
  return <button type="button" className={`option-card ${selected ? 'selected' : ''}`} aria-pressed={selected} onClick={onClick}><strong>{item.name}</strong>{item.description && <small>{item.description}</small>}<span>{item.id === 'none' ? 'Без доплаты' : PriceService.format(item.price, currency)}</span></button>;
}

function FlowHeader({ onBack }) { return <><StatusBar/><header className="flow-header"><button className="back-action" type="button" onClick={onBack}>← Назад</button><div className="brand-name">{terminalContent.brand}</div></header></>; }

export default function App() {
  const catalog = useMemo(() => CatalogService.getSnapshot(), []);
  const [screen, setScreen] = useState('home');
  const [sprinkle, setSprinkle] = useState(NONE);
  const [sauce, setSauce] = useState(NONE);
  const product = catalog.product;
  const total = PriceService.total(product, sprinkle, sauce);
  const commercialCatalogReady = catalog.source !== 'local-placeholder';
  const canPay = commercialCatalogReady && product.available !== false && PriceService.canPay(total);
  const back = () => { const index = FLOW.indexOf(screen); if (index > 0) setScreen(FLOW[index - 1]); };

  if (screen === 'home') return <main className="terminal-shell"><StatusBar/><header className="brand-header"><div className="brand-mark" aria-label={terminalContent.brand}>Т</div><div><div className="brand-name">{terminalContent.brand}</div><div className="brand-caption">{terminalContent.eyebrow}</div></div></header><section className="hero"><div className="hero-copy"><div className="eyebrow">Сегодня в аппарате</div><h1>{product.name}</h1><p className="subtitle">Мягкое мороженое в фирменном стаканчике</p></div><IceCreamVisual/><p className="flavor-note">{terminalContent.flavorNote}</p></section><section className="actions" aria-label="Действия"><button className="primary-action" type="button" disabled={product.available === false} onClick={() => setScreen('sprinkle')}>{product.available === false ? 'Временно недоступно' : 'Начать покупку'}<span aria-hidden="true">→</span></button><button className="club-card" type="button" onClick={() => window.dispatchEvent(new CustomEvent('terminal:navigate',{detail:{screen:'loyalty'}}))}><span className="club-icon" aria-hidden="true">♥</span><span className="club-copy"><strong>{terminalContent.clubTitle}</strong><small>{terminalContent.clubText}</small></span><span className="club-cta">{terminalContent.clubAction}</span></button></section><footer className="terminal-footer"><span>Оплата картой или СБП</span><span className="status-dot" aria-hidden="true"/><span>{product.available === false ? 'Мороженое временно недоступно' : 'Аппарат готов к заказу'}</span></footer></main>;

  if (screen === 'sprinkle') return <Selection title="Выберите посыпку" subtitle="Можно продолжить без посыпки" items={[NONE, ...catalog.sprinkles]} selected={sprinkle} currency={product.currency} onSelect={setSprinkle} onBack={back} onNext={() => setScreen('sauce')} />;
  if (screen === 'sauce') return <Selection title="Выберите топпинг" subtitle="Можно продолжить без топпинга" items={[NONE, ...catalog.sauces]} selected={sauce} currency={product.currency} onSelect={setSauce} onBack={back} onNext={() => setScreen('summary')} />;

  return <main className="terminal-shell flow-shell"><FlowHeader onBack={back}/><section className="order-panel"><div><div className="eyebrow">Ваше мороженое</div><h1>Проверьте выбор</h1></div><IceCreamVisual/><div className="summary-card"><div><span>{product.name}</span><strong>{PriceService.format(product.price, product.currency)}</strong></div><div><span>Посыпка: {sprinkle.name}</span><strong>{PriceService.format(sprinkle.price, product.currency)}</strong></div><div><span>Топпинг: {sauce.name}</span><strong>{PriceService.format(sauce.price, product.currency)}</strong></div><div className="summary-total"><span>Итого</span><strong>{PriceService.format(total, product.currency)}</strong></div></div>{!commercialCatalogReady && <p className="notice">Продажа станет доступна после публикации утверждённого прайса на аппарат.</p>}<button className="primary-action" type="button" disabled={!canPay}>Перейти к оплате <span aria-hidden="true">→</span></button></section></main>;
}

function Selection({ title, subtitle, items, selected, currency, onSelect, onBack, onNext }) {
  return <main className="terminal-shell flow-shell"><FlowHeader onBack={onBack}/><section className="selection-panel"><div><div className="eyebrow">Соберите своё мороженое</div><h1>{title}</h1><p className="subtitle">{subtitle}</p></div><IceCreamVisual/><div className="option-grid">{items.filter(item => item.available !== false).map(item => <Choice key={item.id} item={item} selected={selected?.id === item.id} currency={currency} onClick={() => onSelect(item)}/>)}</div><button className="primary-action" type="button" onClick={onNext}>Продолжить <span aria-hidden="true">→</span></button></section></main>;
}
