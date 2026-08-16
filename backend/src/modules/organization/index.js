const { OrganizationRepository } = require('./OrganizationRepository');
const { OrganizationService } = require('./OrganizationService');
const { OrganizationRuntime } = require('./OrganizationRuntime');
module.exports = { name: 'organization_360', version: '1.0.0', status: 'IMPLEMENTED', OrganizationRepository, OrganizationService, OrganizationRuntime };
