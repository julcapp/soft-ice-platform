# Product Catalog

Статус: Draft  
Версия: 0.1  
Проект: Soft ICE Platform / «У Тимоши»

## 1. Назначение

Product Catalog описывает товары, которые пользователь может купить через Mini App, сайт, терминал, Telegram Bot, MAX Mini App и Seller App.

Каталог должен быть единым источником данных для всех каналов.

## 2. Главный принцип

> Продукт, цена, изображение, доступность и состав не должны быть жёстко зашиты в интерфейсе.

Интерфейс читает данные из каталога.

## 3. Базовый продукт MVP

```json
{
  "id": "soft_ice_cup_vanilla",
  "type": "soft_ice",
  "name": "Ванильное мягкое мороженое",
  "shortName": "Мягкое мороженое",
  "baseFlavor": "vanilla",
  "container": "cup",
  "price": 130,
  "currency": "RUB",
  "included": {
    "syrupCount": 0,
    "toppingCount": 0
  },
  "available": true,
  "sort": 10,
  "image": "/images/icecream/base/vanilla.webp"
}
```

## 4. Ценовая модель

MVP-модель:

| Позиция | Цена |
|---|---:|
| Базовое мороженое | 130 ₽ |
| Сироп | +10 ₽ |
| Топпинг | +10 ₽ |

Итоговая цена рассчитывается как:

```text
product.price + syrup.price + topping.price
```

## 5. Product fields

| Поле | Тип | Описание |
|---|---|---|
| `id` | string | уникальный идентификатор |
| `type` | string | тип продукта |
| `name` | string | полное название |
| `shortName` | string | короткое название для UI |
| `baseFlavor` | string | базовый вкус |
| `container` | string | стаканчик / иной формат |
| `price` | number | базовая цена |
| `currency` | string | валюта |
| `available` | boolean | доступность |
| `image` | string | базовое изображение |
| `sort` | number | порядок вывода |

## 6. Product states

| State | Описание |
|---|---|
| `available` | доступен к покупке |
| `sold_out` | временно закончился |
| `hidden` | скрыт из интерфейса |
| `seasonal` | сезонное предложение |
| `draft` | черновик |

## 7. Каналы использования

Один и тот же каталог используется в:

- Mini App;
- Telegram Bot;
- MAX Mini App;
- Web App;
- терминале;
- CRM;
- Seller App.

## 8. Связанные документы

- `docs/domain/SYRUP_CATALOG.md`
- `docs/domain/TOPPING_CATALOG.md`
- `docs/domain/PRODUCT_IMAGE_MODEL.md`
- `docs/domain/MEDIA_LIBRARY_STRUCTURE.md`
- `docs/design/PHOTO_STANDARD.md`

## 9. PostgreSQL runtime contract (v0.36.0)

Канонический runtime-каталог хранится в `CatalogItem` и `MachineCatalogItem`.

`CatalogItem` содержит стабильный SKU, категорию `ICE_CREAM | SPRINKLE | TOPPING`, русское название, nullable базовую цену, валюту, active/system/free flags, порядок и ссылку на медиаресурс. `MachineCatalogItem` определяет доступность позиции на конкретном автомате и текущий вкус.

Инварианты:

- у автомата не более одного `isCurrentFlavor=true`;
- текущий вкус — только активный `ICE_CREAM` с валидной ценой;
- активная платная позиция без цены не публикуется;
- «Без посыпки» и «Без топпинга» являются защищёнными системными позициями с ценой 0;
- canonical SKU этих позиций — `sprinkle_none` и `topping_none`; migration безопасно reconciles их как `0 RUB`, а назначение автомату выполняется отдельно и аудируется;
- Admin Console изменяет каталог через backend API, а не напрямую через Prisma;
- display получает machine-specific projection через `GET /api/v1/catalog/machines/:machineId`;
- frontend-репозитории не являются источником серверной цены.
