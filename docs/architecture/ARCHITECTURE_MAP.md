# Карта архитектуры

## Event Center foundation v1

`Domain Event → Platform Event Bus → ExistingEventBusSubscriber → EventNormalizationService → EventCenterRepository → Admin API → Admin Console/EventFeed`

Platform Event Bus отвечает за доставку. Event Center отвечает за долговременную нормализованную историю. Доменные модели отвечают за текущее состояние, observability — за application logs.
