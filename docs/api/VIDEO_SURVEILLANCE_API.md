# API видеонаблюдения v1

Базовый путь: `/api/v1/admin`. Доступ: `PLATFORM_OWNER`, `ADMIN`, `SECURITY_OFFICER`. Для legal hold `ADMIN` дополнительно требуется `video:legal_hold`. Operator Workspace видит только статус камеры назначенного автомата при отдельном разрешении; архив недоступен по умолчанию.

GET:

- `/machines/:machineId/cameras`
- `/machines/:machineId/cameras/:cameraId`
- `/machines/:machineId/cameras/:cameraId/health`
- `/machines/:machineId/video-fragments`
- `/machines/:machineId/video-incidents`
- `/video-incidents/:incidentId`
- `/video-audit`

Изменения:

- `POST /machines/:machineId/cameras/manual`
- `PATCH /machines/:machineId/cameras/:cameraId/manual`
- `POST /machines/:machineId/cameras/:cameraId/check`
- `POST /machines/:machineId/cameras/:cameraId/control-recording`
- `POST /video-incidents`
- `PATCH /video-incidents/:incidentId`
- `POST|DELETE /video-fragments/:fragmentId/legal-hold`
- `POST /video-fragments/:fragmentId/retention`

Регистрация требует `rtspUrlSecretRef`. Ответ не содержит RTSP URL или secret reference; `liveView.transport=MEDIA_PROXY`, URL отсутствует до внешней интеграции.
