import { NotImplementedError } from '../../shared/errors/index.js';

export class MachineRepository {
  async getMachineById(machineId) {
    throw new NotImplementedError();
  }

  async getMachineStatus(machineId) {
    throw new NotImplementedError();
  }

  async assignOrderToMachine(orderId, machineId) {
    throw new NotImplementedError();
  }
}
