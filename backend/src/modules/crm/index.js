const { CRMRepository } = require('./CRMRepository');
const { CRMRuntime } = require('./CRMRuntime');
const { CRMService } = require('./CRMService');

module.exports = {
  name: 'crm',
  status: 'bounded-context-v1',
  owns: ['CRM customer profiles', 'campaigns', 'notification delivery queue'],
  CRMRepository,
  CRMRuntime,
  CRMService,
};
