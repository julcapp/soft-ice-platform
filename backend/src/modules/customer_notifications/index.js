const { CustomerNotificationService, EVENT_TYPE, KIND } = require('./CustomerNotificationService');
const { CustomerNotificationPublisher } = require('./CustomerNotificationPublisher');

module.exports = {
  CustomerNotificationService,
  CustomerNotificationPublisher,
  CUSTOMER_NOTIFICATION_EVENT_TYPE: EVENT_TYPE,
  CUSTOMER_NOTIFICATION_KIND: KIND,
};
