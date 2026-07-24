# Связь и SIM-карта автомата

Статус: реализовано, версия 1.

Machine Domain владеет `MachineConnectivityProfile`, `MachineSimCard`, `MachineMobilePlan` и событиями. Digital Twin читает `MachineConnectivitySnapshot` как проекцию. Данные оператора и ручные данные разделены полями `source` и `verificationStatus`.

Ручные записи всегда имеют `source=MANUAL`, `verificationStatus=MANUAL`, автора, причину и даты аудита. Реальные адаптеры МТС, МегаФон, Билайн и Tele2/T2 имеют статус `BLOCKED_EXTERNAL`. Доступны `ManualMobileCarrierAdapter` и `MockMobileCarrierAdapter`.

Телефон маскируется как `+7 *** ***-12-34`. ICCID и IMSI доступны только владельцу платформы либо администратору с техническим разрешением.
# Видеопоток

Состояние мобильной связи может инициировать `CONNECTIVITY_LOST`, однако доступность RTSP и поступление кадров проверяются отдельным Camera Health contract. Секреты и технические адреса не входят в проекцию connectivity.
