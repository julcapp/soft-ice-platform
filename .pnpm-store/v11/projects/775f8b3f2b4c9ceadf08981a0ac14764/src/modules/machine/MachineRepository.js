class MachineRepository {
  constructor(prisma) {
    this.prisma = prisma;
  }

  async createMachine({ machineCode, name, location, status }) {
    return this.prisma.machine.create({
      data: {
        machineCode,
        name,
        location,
        status,
      },
    });
  }

  async findById(machineId) {
    return this.prisma.machine.findUnique({
      where: { id: machineId },
    });
  }

  async findByMachineCode(machineCode) {
    return this.prisma.machine.findUnique({
      where: { machineCode },
    });
  }

  async findFirstOnlineMachine() {
    return this.prisma.machine.findFirst({
      where: { status: 'ONLINE' },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    });
  }

  async createDispenseRequest({
    id,
    orderId,
    machineId,
    state,
    commandId,
    commandType,
    commandPayload,
    requestedAt,
  }) {
    const existing = await this.findDispenseByOrderId(orderId);

    if (existing) {
      return {
        dispenseRequest: existing,
        created: false,
      };
    }

    const dispenseRequest = await this.prisma.dispenseRequest.create({
      data: {
        id,
        orderId,
        machineId,
        state,
        commandId,
        commandType,
        commandPayload,
        requestedAt,
      },
      include: {
        machine: true,
        order: true,
      },
    });

    return {
      dispenseRequest,
      created: true,
    };
  }

  async findDispenseById(dispenseRequestId) {
    return this.prisma.dispenseRequest.findUnique({
      where: { id: dispenseRequestId },
      include: {
        machine: true,
        order: true,
      },
    });
  }

  async findDispenseByOrderId(orderId) {
    return this.prisma.dispenseRequest.findUnique({
      where: { orderId },
      include: {
        machine: true,
        order: true,
      },
    });
  }

  async findDispenseByOrderIdForCustomer(orderId, customerId) {
    return this.prisma.dispenseRequest.findFirst({
      where: {
        orderId,
        order: {
          customerId,
        },
      },
      include: {
        machine: true,
        order: true,
      },
    });
  }

  async updateDispenseState(dispenseRequestId, state, updates = {}) {
    return this.prisma.dispenseRequest.update({
      where: { id: dispenseRequestId },
      data: {
        state,
        startedAt: updates.startedAt,
        completedAt: updates.completedAt,
        failedAt: updates.failedAt,
        failureReason: updates.failureReason,
      },
      include: {
        machine: true,
        order: true,
      },
    });
  }
}

module.exports = {
  MachineRepository,
};
