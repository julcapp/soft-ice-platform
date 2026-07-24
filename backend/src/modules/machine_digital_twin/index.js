const models = require('./MachineTwinModels');
const { ComponentHealthService } = require('./ComponentHealthService');
const { MachineTwinProjectionService } = require('./MachineTwinProjectionService');
const { MachineTwinRepository } = require('./MachineTwinRepository');
const { createDemoMachineTwinSources } = require('./DemoMachineTwinSources');
module.exports = {
  name: 'machine-digital-twin', status: 'foundation-v1',
  ...models, ComponentHealthService, MachineTwinProjectionService,
  MachineTwinRepository, createDemoMachineTwinSources,
};
