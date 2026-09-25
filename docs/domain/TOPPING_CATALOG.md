# Topping Catalog

Статус: Draft  
Версия: 0.1  
Проект: Soft ICE Platform / «У Тимоши»

## 1. Назначение

Topping Catalog описывает топпинги, доступные для выбора при покупке мягкого мороженого.

## 2. Главный принцип

> Топпинги управляются через каталог и медиатеку, чтобы один набор данных использовался всеми каналами Soft ICE Platform.

## 3. MVP-топпинги

```json
[
  {
    "id": "oreo",
    "name": "Oreo",
    "price": 10,
    "currency": "RUB",
    "available": true,
    "image": "/images/toppings/oreo.webp",
    "icecreamImage": "/images/icecream/topping/vanilla_oreo.webp",
    "sort": 10
  },
  {
    "id": "sprinkles",
    "name": "Цветная посыпка",
    "price": 10,
    "currency": "RUB",
    "available": true,
    "image": "/images/toppings/sprinkles.webp",
    "icecreamImage": "/images/icecream/topping/vanilla_sprinkles.webp",
    "sort": 20
  },
  {
    "id": "chocolate_chips",
    "name": "Шоколадная крошка",
    "price": 10,
    "currency": "RUB",
    "available": true,
    "image": "/images/toppings/chocolate_chips.webp",
    "icecreamImage": "/images/icecream/topping/vanilla_chocolate_chips.webp",
    "sort": 30
  }
]
```

## 4. Topping fields

| Поле | Тип | Описание |
|---|---|---|
| `id` | string | уникальный идентификатор |
| `name` | string | название для пользователя |
| `price` | number | доплата |
| `currency` | string | валюта |
| `available` | boolean | доступность |
| `image` | string | фото топпинга |
| `icecreamImage` | string | фото мороженого с топпингом |
| `sort` | number | порядок вывода |

## 5. Правило добавления нового топпинга

При добавлении нового топпинга нужно создать:

1. запись в каталоге;
2. изображение топпинга;
3. изображение мороженого с топпингом;
4. изображения собранных комбинаций с сиропами;
5. alt-описания;
6. тестовый сценарий выбора.

## 6. Analytics events

- `ToppingSelected`;
- `ToppingUnavailableShown`;
- `ToppingChanged`.

## 7. Связанные документы

- `docs/domain/PRODUCT_CATALOG.md`
- `docs/domain/SYRUP_CATALOG.md`
- `docs/domain/PRODUCT_IMAGE_MODEL.md`
- `docs/design/PHOTO_STANDARD.md`

## 8. Runtime mapping

Для display v1 добавки публикуются как независимые `CatalogItem` категорий `SPRINKLE` и `TOPPING`. Доступность задаётся на уровне автомата. В каждой категории должна присутствовать защищённая системная позиция «Без ...» с явной ценой 0; отсутствие цены у обычной активной позиции блокирует публикацию.
