const {
  DISPENSE_REQUEST_STATE,
  DISPENSE_REQUEST_STATES,
  DispenseRequestEntity,
  MACHINE_STATUS,
  MACHINE_STATUSES,
  MachineEntity,
} = require('./MachineEntity');
const { MachineRepository } = require('./MachineRepository');
const { MachineRuntime } = require('./MachineRuntime');
const { MachineService } = require('./MachineService');

module.exports = {
  name: 'machine',
  status: 'runtime',
  owns: [
    'machine identity boundary',
    'dispense request state',
    'machine dispense commands',
    'future telemetry',
  ],
  DISPENSE_REQUEST_STATE,
  DISPENSE_REQUEST_STATES,
  DispenseRequestEntity,
  MACHINE_STATUS,
  MACHINE_STATUSES,
  MachineEntity,
  MachineRepository,
  MachineRuntime,
  MachineService,
};
