# Media Library Structure

Статус: Draft
Версия: 0.1
Проект: Soft ICE Platform / «У Тимоши»

## 1. Назначение

Документ фиксирует структуру медиатеки Soft ICE Platform.

Медиатека нужна для единого хранения изображений, которые используются в Mini App, сайте, терминале, CRM, Telegram Bot, MAX Mini App, Seller App и маркетинговых материалах.

## 2. Главный принцип

Один медиа-ресурс должен иметь понятное имя, понятное место хранения, описание и связь с каталогом.

## 3. Базовая структура

```text
frontend/miniapp/public/images/
├── icecream/
│   ├── base/
│   ├── syrup/
│   ├── topping/
│   └── composed/
├── syrups/
├── toppings/
├── club/
├── branding/
│   └── timofey/
├── ui/
├── marketing/
└── vending/
```

## 4. Icecream

```text
icecream/base/       — базовое мороженое
icecream/syrup/      — мороженое с сиропом
icecream/topping/    — мороженое с топпингом
icecream/composed/   — итоговые комбинации
```

## 5. Ingredients

```text
syrups/              — отдельные изображения сиропов
toppings/            — отдельные изображения топпингов
```

## 6. Club and branding

```text
club/                — карточки и изображения Клуба Тимоши
branding/timofey/    — бренд-персонаж Тимофей
```

Рекомендуемая структура для Тимофея:

```text
branding/timofey/
├── source/
├── processed/
└── emotions/
```

## 7. UI and marketing

```text
ui/                  — декоративные элементы интерфейса
marketing/           — рекламные материалы
vending/             — изображения для терминала и автомата
```

## 8. Naming convention

Файлы называются латиницей, в нижнем регистре, через подчёркивание.

Примеры:

```text
vanilla.webp
vanilla_chocolate_sprinkles.webp
syrup_strawberry.webp
club_timofey_welcome.webp
```

## 9. Каталогизация

Каждый важный файл должен быть связан с записью каталога или моделью изображения.

Минимальные поля:

```json
{
  "id": "vanilla_chocolate_sprinkles",
  "path": "/images/icecream/composed/vanilla_chocolate_sprinkles.webp",
  "type": "composed",
  "alt": "Ванильное мягкое мороженое с шоколадным сиропом и цветной посыпкой",
  "status": "approved"
}
```

## 10. Правило развития

При добавлении нового сиропа, топпинга или вкуса необходимо обновить:

1. каталог продукта;
2. каталог ингредиента;
3. медиатеку;
4. модель изображений;
5. alt-описания;
6. тестовые сценарии интерфейса.

## 11. Связанные документы

- `docs/design/PHOTO_STANDARD.md`
- `docs/design/RESPONSIVE_UI_STANDARD.md`
- `docs/domain/PRODUCT_IMAGE_MODEL.md`
- `docs/domain/PRODUCT_CATALOG.md`
- `docs/domain/SYRUP_CATALOG.md`
- `docs/domain/TOPPING_CATALOG.md`

## Реклама после получения — 19.10.2026

`public/images/marketing/pickup/`: три одобренных владельцем изображения от19.10.2026 (`vanilla_cup`, `strawberry_swirl`, `strawberry_cup`), WebP до900px с сохранением пропорций. Это рекламные материалы, не изображение состава заказа. Реестр и подпись: `src/domain/media/pickupPromotion.js`; экран не выбирает рекламные фото по ингредиентам.
