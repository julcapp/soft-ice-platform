# Pricing Engine

**Статус:** Draft  
**Версия:** 0.1  
**Проект:** Soft ICE Platform

---

# 1. Назначение

Pricing Engine отвечает за расчёт полной финансовой модели заказа.

Он рассчитывает не только базовую цену продукта, но и применимые скидки, правила клуба, допустимость бонусов и итоговую сумму к оплате.

Pricing Engine ничего не списывает и не выполняет платёж.

---

# 2. Место в архитектуре

```text
Product
    ↓
Configuration Engine
    ↓
Recipe Engine
    ↓
Pricing Engine
    ↓
Wallet Engine
    ↓
Payment Engine
    ↓
Machine Engine
    ↓
Notification Engine
```

---

# 3. Основные задачи

Pricing Engine отвечает за:

- получение базовой цены продукта;
- расчёт итоговой цены конфигурации;
- применение скидок;
- применение клубных правил;
- определение лимита списания бонусов;
- подготовку Pricing Result для Wallet и Payment Engine.

---

# 4. Входные данные

Pricing Engine получает:

```json
{
  "productId": "product_soft_ice_vanilla_cup",
  "configurationId": "configuration_soft_ice_vanilla_cup",
  "customerId": "customer_demo",
  "channel": "miniapp",
  "timestamp": "2026-07-01T00:00:00Z"
}
```

---

# 5. Выходные данные

Pricing Engine возвращает Pricing Result:

```json
{
  "basePrice": 130,
  "discounts": [],
  "bonusAllowed": true,
  "bonusLimit": 104,
  "bonusNominalRate": 1,
  "currency": "RUB",
  "finalPrice": 130
}
```

---

# 6. Бонусная логика

Пользовательский принцип:

```text
1 бонус = 1 рубль скидки
```

Архитектурный принцип:

```text
Bonus Point — это право на скидку номиналом 1 рубль, а не денежные средства.
```

Pricing Engine может рассчитывать допустимый лимит списания бонусов, но не списывает бонусы.

Списание бонусов выполняет Wallet / Bonus Engine через Transaction Ledger.

---

# 7. Правила

Pricing Engine:

- не принимает оплату;
- не списывает деньги;
- не списывает бонусы;
- не управляет Wallet;
- не отправляет уведомления;
- не управляет автоматом;
- не зависит от React;
- не зависит от UI.

---

# 8. Pricing Rule Engine

Правила ценообразования должны быть отделены от основного движка.

В будущем Pricing Rule Engine будет включать:

- Base Price Rules;
- Club Discount Rules;
- Bonus Limit Rules;
- Promotion Rules;
- Time Rules;
- Birthday Rules;
- Tax Rules.

---

# 9. MVP-правила

На этапе MVP используются следующие правила:

- базовая цена каждого товара читается из PostgreSQL Catalog Runtime;
- активная коммерческая позиция без цены считается ошибочной конфигурацией;
- нулевая цена допустима только для системного варианта «без добавки» или явно бесплатной позиции;
- состав заказа передаётся на сервер только как SKU и количество; переданная клиентом цена игнорируется;
- бонусы могут покрывать до 80% стоимости заказа;
- 1 бонус = 1 ₽ скидки;
- валюта: RUB.

## 9.1 Порядок расчёта

```text
CatalogItem / MachineCatalogItem
    ↓ authoritative base prices and machine availability
Pricing Engine
    ↓ immutable PricingQuote / PricingSnapshot
Promotion Engine
    ↓ discounts, gifts and campaign mechanics
final quote
```

Изменение базовой цены влияет только на новые расчёты. Существующие `PricingQuote` и `PricingSnapshot` не пересчитываются.

---

# 10. Не входит в обязанности

Pricing Engine не:

- хранит баланс клиента;
- создаёт транзакции Wallet;
- вызывает ЮKassa;
- вызывает СБП;
- формирует бухгалтерские проводки;
- отправляет сообщения клиенту.

---

# 11. Долгосрочная цель

Pricing Engine должен поддерживать:

- разные категории продуктов;
- разные каналы продаж;
- клубные скидки;
- бонусы;
- подарочные балансы;
- акции;
- франчайзинговые правила;
- региональные цены;
- интеграцию с бухгалтерией через отдельный адаптер.

---

# 12. Roadmap развития

## Версия 0.1

- архитектурное описание;
- базовая модель Pricing Result;
- базовая цена продукта.

## Версия 0.2

- правила бонусного лимита;
- клубные скидки;
- промо-правила.

## Версия 1.0

- интеграция с Wallet Engine;
- интеграция с Payment Engine;
- поддержка налогов и бухгалтерского адаптера.
