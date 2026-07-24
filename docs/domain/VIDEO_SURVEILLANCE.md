# Видеонаблюдение автоматов

Статус: Foundation v1  
Дата: 2026-07-24

## Цель

Контур фиксирует технические и инцидентные события у автомата: принимает сигналы RTSP-камер, PIR/аналитики и Platform Event Bus, управляет предзаписью и постзаписью, локальным циклическим архивом и выборочной выгрузкой. Он не выполняет распознавание лиц, биометрическую идентификацию или автоматическое установление личности.

## Модель

Домен `backend/src/modules/video_surveillance` содержит `VideoCamera`, `CameraConnectionProfile`, `MotionSensor`, `VideoRecordingPolicy`, `VideoRecordingSession`, `VideoFragment`, `VideoIncident`, `VideoIncidentLink`, `VideoRetentionPolicy`, `CameraHealthSnapshot`, `VideoAccessAudit`, Repository, Service и Runtime.

RTSP-адрес и учётные данные хранятся вне прикладной БД. Камера содержит только `rtspUrlSecretRef`; API маскирует и эту ссылку. Прямой эфир предоставит будущий media proxy.

## Детерминированная политика движения v1

1. PIR будит камеру и публикует `MOTION_DETECTED`, но не создаёт инцидент.
2. `CAMERA_ANALYTICS` подтверждает движение в разрешённой зоне.
3. Событие автомата запускает запись независимо от PIR.
4. `HYBRID` объединяет оба источника.
5. Повторный сигнал продлевает активную сессию до `maximumRecordingSeconds`.
6. `cooldownSeconds` подавляет файловую дробность.

Зона задаётся полигоном, флагами `enabled`, `triggerRecording` и чувствительностью. Аналитика изображений и реальные зоны имеют статус `FOUNDATION_ONLY`.

## Запись и здоровье

Поддерживаются `preBufferSeconds`, `postBufferSeconds`, максимальная длительность и продление по движению/событию автомата. V1 использует mock RTSP, in-memory recorder и local-metadata storage. Реальные RTSP/NVR/FFmpeg/S3/edge-agent — `BLOCKED_EXTERNAL`.

«Камера работает» означает: сеть и RTSP-порт доступны, авторизация успешна, приходят изменяющиеся кадры, время синхронизировано, накопитель доступен и места достаточно. Ping без кадров недостаточен.

## Хранение и приватность

Стандартный срок — 72 часа. После достижения цели и `retentionUntil` фрагмент автоматически удаляется с аудируемым результатом. `legalHold` блокирует удаление и доступен `PLATFORM_OWNER` либо `ADMIN` с `video:legal_hold`. Продление хранения всегда журналируется. Публичные ссылки запрещены.
