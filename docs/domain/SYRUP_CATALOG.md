# Syrup Catalog

Статус: Draft  
Версия: 0.1  
Проект: Soft ICE Platform / «У Тимоши»

## 1. Назначение

Syrup Catalog описывает сиропы, доступные для выбора при покупке мягкого мороженого.

## 2. Главный принцип

> Новый сироп добавляется через каталог и медиатеку, а не через переписывание интерфейса.

## 3. MVP-сиропы

```json
[
  {
    "id": "strawberry",
    "name": "Клубника",
    "price": 10,
    "currency": "RUB",
    "available": true,
    "image": "/images/syrups/strawberry.webp",
    "icecreamImage": "/images/icecream/syrup/vanilla_strawberry.webp",
    "sort": 10
  },
  {
    "id": "chocolate",
    "name": "Шоколад",
    "price": 10,
    "currency": "RUB",
    "available": true,
    "image": "/images/syrups/chocolate.webp",
    "icecreamImage": "/images/icecream/syrup/vanilla_chocolate.webp",
    "sort": 20
  },
  {
    "id": "caramel",
    "name": "Карамель",
    "price": 10,
    "currency": "RUB",
    "available": true,
    "image": "/images/syrups/caramel.webp",
    "icecreamImage": "/images/icecream/syrup/vanilla_caramel.webp",
    "sort": 30
  }
]
```

## 4. Syrup fields

| Поле | Тип | Описание |
|---|---|---|
| `id` | string | уникальный идентификатор |
| `name` | string | название для пользователя |
| `price` | number | доплата |
| `currency` | string | валюта |
| `available` | boolean | доступность |
| `image` | string | фото сиропа |
| `icecreamImage` | string | фото мороженого с сиропом |
| `sort` | number | порядок вывода |

## 5. Правило добавления нового сиропа

При добавлении нового сиропа нужно создать:

1. запись в каталоге;
2. изображение сиропа;
3. изображение мороженого с сиропом;
4. изображения собранных комбинаций с топпингами;
5. alt-описания;
6. тестовый сценарий выбора.

## 6. Analytics events

- `SyrupSelected`;
- `SyrupUnavailableShown`;
- `SyrupChanged`.

## 7. Связанные документы

- `docs/domain/PRODUCT_CATALOG.md`
- `docs/domain/TOPPING_CATALOG.md`
- `docs/domain/PRODUCT_IMAGE_MODEL.md`
- `docs/design/PHOTO_STANDARD.md`

## 8. Runtime status

В каноническом display v1 пользовательский выбор разделён на `SPRINKLE` и `TOPPING`. Исторический Syrup Catalog остаётся доменным справочником для будущего расширения, но не является отдельным источником цены и не публикуется в текущий machine catalog без нового согласованного значения `CatalogCategory`.
