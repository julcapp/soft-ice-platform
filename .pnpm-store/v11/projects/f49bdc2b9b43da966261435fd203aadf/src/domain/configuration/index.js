export {
  createConfigurationEntity,
  isValidConfigurationEntity,
} from './ConfigurationEntity.js';
export { ConfigurationRepository } from './ConfigurationRepository.js';
export {
  ConfigurationService,
  ConfigurationValidationError,
} from './ConfigurationService.js';

import { ConfigurationService } from './ConfigurationService.js';

const configurationService = new ConfigurationService();

export { configurationService };
export default configurationService;

