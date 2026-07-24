# ADR-033 — Единый Центр событий

Статус: Accepted

Создать отдельный `event_center`, подписанный на Platform Event Bus. Event Bus доставляет integration events; Event Center сохраняет нормализованную историю. Application logs остаются в observability. Решение не меняет владельцев текущего доменного состояния.
