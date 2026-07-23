const { DeterministicRandom } = require('./DeterministicRandom');
const { DEFAULT_INGREDIENTS, SimulatedMachineGateway } = require('./SimulatedMachineGateway');
const { SIMULATOR_STATE, SIMULATOR_STATES } = require('./SimulatorState');

module.exports = {
  name: 'machine_simulator',
  status: 'runtime',
  owns: ['deterministic simulated machine lifecycle', 'simulated telemetry and inventory'],
  DEFAULT_INGREDIENTS,
  DeterministicRandom,
  SIMULATOR_STATE,
  SIMULATOR_STATES,
  SimulatedMachineGateway,
};
