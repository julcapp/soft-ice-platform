const models = require('./EventCenterModels');
const adapters = require('./EventCenterAdapters');
const services = require('./EventCenterService');
const { EventCenterRepository, PostgreSQLEventCenterRepository } = require('./EventCenterRepository');
const { EventCenterRuntime } = require('./EventCenterRuntime');
const { createEventTypeRegistry } = require('./EventTypeRegistry');
module.exports = { name: 'event_center', version: '1.0.0-foundation', status: 'FOUNDATION_ONLY', ...models, ...adapters, ...services, EventCenterRepository, PostgreSQLEventCenterRepository, EventCenterRuntime, createEventTypeRegistry };
