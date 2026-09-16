import { useMemo, useState } from 'react';
import { terminalContent } from './data/terminalContent.js';
import { CatalogService } from './services/catalogService.js';
import { PriceService } from './services/priceService.js';
import './styles.css';

const FLOW = ['home', 'syrup', 'topping', 'summary'];

function IceCreamVisual() {
  return <div className="product-visual" aria-hidden="true"><div className="soft-serve"><span className="swirl swirl-top"/><span className="swirl swirl-middle"/><span className="swirl swirl-bottom"/></div><div className="cup"><div className="cup-brand">У Тимоши</div><div className="cup-heart">♥</div></div></div>;
}

function Choice({ item, selected, currency, onClick }) {
  return <button type="button" className={`option-card ${selected ? 'selected' : ''}`} aria-pressed={selected} onClick={onClick}><strong>{item.name}</strong><span>{item.id === 'none' ? 'Без доплаты' : PriceService.format(item.price, currency)}</span></button>;
}

export default function App() {
  const catalog = useMemo(() => CatalogService.getSnapshot(), []);
  const [screen, setScreen] = useState('home');
  const [syrup, setSyrup] = useState(null);
  const [topping, setTopping] = useState(null);
  const product = catalog.product;
  const total = PriceService.total(product, syrup, topping);
  const commercialCatalogReady = catalog.source !== 'local-placeholder';
  const canPay = commercialCatalogReady && product.available !== false && PriceService.canPay(total);

  const back = () => {
    const index = FLOW.indexOf(screen);
    if (index > 0) setScreen(FLOW[index - 1]);
  };

  if (screen === 'home') return <main className="terminal-shell"><header className="brand-header"><div className="brand-mark" aria-label={terminalContent.brand}>Т</div><div><div className="brand-name">{terminalContent.brand}</div><div className="brand-caption">{terminalContent.eyebrow}</div></div></header><section className="hero"><div className="hero-copy"><div className="eyebrow">Мороженое рядом</div><h1>{terminalContent.title}</h1><p className="subtitle">{terminalContent.subtitle}</p></div><IceCreamVisual/><p className="flavor-note">{terminalContent.flavorNote}</p></section><section className="actions" aria-label="Действия"><button className="primary-action" type="button" disabled={product.available === false} onClick={() => setScreen('syrup')}>{product.available === false ? 'Временно недоступно' : terminalContent.primaryAction}<span aria-hidden="true">→</span></button><button className="club-card" type="button" onClick={() => window.dispatchEvent(new CustomEvent('terminal:navigate',{detail:{screen:'loyalty'}}))}><span className="club-icon" aria-hidden="true">♥</span><span className="club-copy"><strong>{terminalContent.clubTitle}</strong><small>{terminalContent.clubText}</small></span><span className="club-cta">{terminalContent.clubAction}</span></button></section><footer className="terminal-footer"><span>Оплата картой или СБП</span><span className="status-dot" aria-hidden="true"/><span>{product.available === false ? 'Мороженое временно недоступно' : 'Аппарат готов к заказу'}</span></footer></main>;

  if (screen === 'syrup') return <Selection title="Выберите сироп" subtitle="Один вариант на порцию" items={catalog.syrups} selected={syrup} currency={product.currency} onSelect={setSyrup} onBack={back} onNext={() => setScreen('topping')} />;
  if (screen === 'topping') return <Selection title="Выберите добавку" subtitle="Один вариант на порцию" items={catalog.toppings} selected={topping} currency={product.currency} onSelect={setTopping} onBack={back} onNext={() => setScreen('summary')} />;

  return <main className="terminal-shell flow-shell"><header className="flow-header"><button className="back-action" type="button" onClick={back}>← Назад</button><div className="brand-name">{terminalContent.brand}</div></header><section className="order-panel"><div><div className="eyebrow">Ваш заказ</div><h1>Проверьте выбор</h1></div><div className="summary-card"><div><span>{product.name}</span><strong>{PriceService.format(product.price, product.currency)}</strong></div><div><span>Сироп: {syrup?.name}</span><strong>{PriceService.format(syrup?.price, product.currency)}</strong></div><div><span>Добавка: {topping?.name}</span><strong>{PriceService.format(topping?.price, product.currency)}</strong></div><div className="summary-total"><span>Итого</span><strong>{PriceService.format(total, product.currency)}</strong></div></div>{!commercialCatalogReady && <p className="notice">Финальная цена будет доступна после подключения утверждённого каталога платформы.</p>}<button className="primary-action" type="button" disabled={!canPay}>Перейти к оплате <span aria-hidden="true">→</span></button></section></main>;
}

function Selection({ title, subtitle, items, selected, currency, onSelect, onBack, onNext }) {
  const empty = items.length === 0;
  return <main className="terminal-shell flow-shell"><header className="flow-header"><button className="back-action" type="button" onClick={onBack}>← Назад</button><div className="brand-name">{terminalContent.brand}</div></header><section className="selection-panel"><div><div className="eyebrow">Соберите свой вкус</div><h1>{title}</h1><p className="subtitle">{subtitle}</p></div><div className="option-grid">{items.map(item => <Choice key={item.id} item={item} selected={selected?.id === item.id} currency={currency} onClick={() => onSelect(item)}/>)}</div>{empty && <p className="notice">Сейчас нет доступных вариантов.</p>}<button className="primary-action" type="button" disabled={!selected || empty} onClick={onNext}>Продолжить <span aria-hidden="true">→</span></button></section></main>;
}
