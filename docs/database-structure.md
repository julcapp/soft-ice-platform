# ER-модель CRM 2.0

## Основные таблицы

### customers
Клиенты программы лояльности.

### customer_consents
Согласия клиентов с привязкой к версии документа.

### document_versions
Версии юридических документов.

### club_accounts
Клубный счёт клиента.

### club_topups
Пополнения клубного счёта.

### bonus_accounts
Текущий бонусный баланс.

### bonus_transactions
История начислений и списаний бонусов.

### machines
Вендинговые автоматы.

### machine_inventory
Остатки автомата: стаканы, сиропы, топпинги, смесь.

### orders
Покупки.

### referrals
Реферальные связи.

### photo_challenges
Челленджи «Фото с Тимошей».

### birthday_rewards
Подарки на день рождения.

## Важные связи

- customers 1:1 club_accounts
- customers 1:1 bonus_accounts
- customers 1:N orders
- orders 1:N bonus_transactions
- customers 1:N referrals as referrer
- customers 1:N referrals as referred
- orders 1:1 photo_challenges
- document_versions 1:N customer_consents
