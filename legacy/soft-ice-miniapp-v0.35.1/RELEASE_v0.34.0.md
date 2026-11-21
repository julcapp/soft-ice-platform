# Soft_ICE v0.34.0

Релиз добавляет строгое разделение реферальных ссылок Telegram и MAX.

Проверки:

- Python compile: OK
- JavaScript syntax: OK
- 8 unit tests: OK
- локальный health endpoint: version 0.34.0
- страницы предупреждения Telegram/MAX: OK

Для рабочей MAX-ссылки в `/etc/soft-ice-miniapp.env` должна быть публичная
переменная `MAX_BOT_USERNAME` без символа `@`.
