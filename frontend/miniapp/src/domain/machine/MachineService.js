import { MachineRepository } from './MachineRepository.js';

export class MachineService {
  constructor(repository = new MachineRepository()) {
    this.repository = repository;
  }

  getMachineById(machineId) {
    return this.repository.getMachineById(machineId);
  }

  getMachineStatus(machineId) {
    return this.repository.getMachineStatus(machineId);
  }

  assignOrderToMachine(orderId, machineId) {
    return this.repository.assignOrderToMachine(orderId, machineId);
  }
}
