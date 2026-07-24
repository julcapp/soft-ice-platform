const MachineRuntimeSignalType = Object.freeze(Object.fromEntries(['MACHINE_CONNECTED','MACHINE_DISCONNECTED','CUP_SENSOR_CONFIRMED','CUP_SENSOR_FAILED','PRODUCT_FLOW_CONFIRMED','PRODUCT_FLOW_FAILED','TOPPING_FLOW_CONFIRMED','TOPPING_FLOW_FAILED','DOOR_OPENED','DOOR_CLOSED','DEVICE_ERROR','DEVICE_RECOVERED'].map((v) => [v, v])));
class MachineRuntimeSignalMapper {
  fromGateway(value) {
    if (!Object.values(MachineRuntimeSignalType).includes(value.signalType)) throw Object.assign(new Error('Unsupported normalized gateway signal.'), { code: 'MACHINE_RUNTIME_SIGNAL_INVALID' });
    return Object.freeze({ signalType: value.signalType, machineId: value.machineId, occurredAt: value.occurredAt || new Date(), correlationId: value.correlationId, causationId: value.causationId || null, source: value.source || 'MACHINE_GATEWAY', actorType: 'MACHINE', actorId: value.machineId, reason: value.reason || value.signalType, metadata: value.metadata || {} });
  }
}
module.exports = { MachineRuntimeSignalType, MachineRuntimeSignalMapper };
