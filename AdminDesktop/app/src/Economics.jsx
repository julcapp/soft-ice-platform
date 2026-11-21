import React from 'react';
import { DataTable, StatisticCard, StatusBadge } from './components';

const packaging = {
  id: 'cup-spoon',
  name: 'Стаканчик с ложкой на дне',
  unitCost: 6,
  minOrderQty: 3000,
  supplier: 'Поставщик упаковки',
  comment: 'Обязательная упаковка для каждой порции мороженого.',
  active: true,
};

const recipe = {
  base: {
    zhuQDefault: 120,
    zhuQMin: 85,
    zhuQMax: 120,
    supplierExpectedWeightMin: 80,
    supplierExpectedWeightMax: 100,
    dispenseSeconds: 2.5,
  },
  sauce: { guoQ: 40 },
  topping: { dingQ: 20 },
};

const calibrationHistory = [
  {
    id: 'baseline-2026-10-29',
    date: '29.10.2026',
    machine: 'Базовая конфигурация',
    zhuQ: 120,
    actualWeight: 'Требует контрольного взвешивания',
    author: 'Владелец платформы',
    comment: 'Стартовая калибровочная точка. Допустима регулировка вниз до 85 г.',
  },
];

const priceHistory = [
  {
    id: 'cup-2026-10-29',
    effectiveFrom: '29.10.2026',
    item: 'Стаканчик с ложкой',
    unitCost: 6,
    minOrderQty: 3000,
    minOrderCost: 18000,
    comment: 'Начальная закупочная цена для расчёта экономики продукта.',
  },
];

const rub = (value) => new Intl.NumberFormat('ru-RU', {
  style: 'currency',
  currency: 'RUB',
  maximumFractionDigits: 0,
}).format(value);

export function EconomicsPage() {
  const minimumPurchase = packaging.unitCost * packaging.minOrderQty;

  return <div className="economics-workspace">
    <section className="statistics" aria-label="Базовые параметры экономики продукта">
      <StatisticCard label="Упаковка на порцию" value={rub(packaging.unitCost)} detail="Стаканчик с ложкой" />
      <StatisticCard label="Минимальная партия" value={packaging.minOrderQty.toLocaleString('ru-RU') + ' шт.'} />
      <StatisticCard label="Минимальная закупка" value={rub(minimumPurchase)} tone="warning" />
      <StatisticCard label="База zhuQ" value={recipe.base.zhuQDefault + ' г'} detail={'Диапазон ' + recipe.base.zhuQMin + '–' + recipe.base.zhuQMax + ' г'} tone="success" />
    </section>

    <section className="card economics-section">
      <div className="card-heading">
        <div>
          <h2>Упаковка и себестоимость</h2>
          <p>Стоимость упаковки автоматически включается в себестоимость каждой порции.</p>
        </div>
        <StatusBadge status={packaging.active ? 'ACTIVE' : 'INACTIVE'} />
      </div>
      <dl className="economics-details">
        <dt>Позиция</dt><dd>{packaging.name}</dd>
        <dt>Цена за единицу</dt><dd>{rub(packaging.unitCost)}</dd>
        <dt>Минимальная партия</dt><dd>{packaging.minOrderQty.toLocaleString('ru-RU')} шт.</dd>
        <dt>Минимальная сумма закупки</dt><dd>{rub(minimumPurchase)}</dd>
        <dt>Поставщик</dt><dd>{packaging.supplier}</dd>
        <dt>Комментарий</dt><dd>{packaging.comment}</dd>
      </dl>
    </section>

    <section className="card economics-section">
      <div className="card-heading">
        <div>
          <h2>Рецепт и аппаратная калибровка</h2>
          <p>Значения SDK подтверждены поставщиком в граммах. zhuQ 120 г — стартовая калибровочная точка, не жёсткий норматив.</p>
        </div>
        <StatusBadge status="FOUNDATION_ONLY" />
      </div>
      <div className="recipe-grid">
        <article>
          <span>База мороженого</span>
          <strong>zhuQ = {recipe.base.zhuQDefault} г</strong>
          <small>Разрешённый диапазон настройки: {recipe.base.zhuQMin}–{recipe.base.zhuQMax} г</small>
        </article>
        <article>
          <span>Ожидаемый фактический выход</span>
          <strong>{recipe.base.supplierExpectedWeightMin}–{recipe.base.supplierExpectedWeightMax} г</strong>
          <small>По данным поставщика при выдаче около {recipe.base.dispenseSeconds} с</small>
        </article>
        <article>
          <span>Соус</span>
          <strong>guoQ = {recipe.sauce.guoQ} г</strong>
          <small>Рекомендованное поставщиком значение</small>
        </article>
        <article>
          <span>Посыпка</span>
          <strong>dingQ = {recipe.topping.dingQ} г</strong>
          <small>Рекомендованное поставщиком значение</small>
        </article>
      </div>
      <p className="economics-note">Каждая фактическая калибровка должна сохранять аппарат, установленное zhuQ, реальный вес контрольной порции, дату, автора и комментарий. Значение ниже 85 г или выше 120 г в рабочей конфигурации запрещено без отдельного инженерного решения.</p>
    </section>

    <DataTable
      title="История цены упаковки"
      rows={priceHistory}
      columns={[
        { key: 'effectiveFrom', label: 'Действует с' },
        { key: 'item', label: 'Позиция' },
        { key: 'unitCost', label: 'Цена/шт.', render: (value) => rub(value) },
        { key: 'minOrderQty', label: 'Мин. партия', render: (value) => value.toLocaleString('ru-RU') + ' шт.' },
        { key: 'minOrderCost', label: 'Мин. закупка', render: (value) => rub(value) },
        { key: 'comment', label: 'Комментарий' },
      ]}
    />

    <DataTable
      title="История калибровок zhuQ"
      rows={calibrationHistory}
      columns={[
        { key: 'date', label: 'Дата' },
        { key: 'machine', label: 'Аппарат' },
        { key: 'zhuQ', label: 'zhuQ', render: (value) => value + ' г' },
        { key: 'actualWeight', label: 'Фактический вес' },
        { key: 'author', label: 'Кто изменил' },
        { key: 'comment', label: 'Комментарий' },
      ]}
    />
  </div>;
}
