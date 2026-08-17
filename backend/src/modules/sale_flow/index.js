const { SaleFlowService } = require('./SaleFlowService');
const { InMemorySaleFlowRepository } = require('./SaleFlowRepository');
const { PaymentAdapter, SimulatorPaymentAdapter, MachineAdapter, SimulatorMachineAdapter } = require('./SaleFlowAdapters');
const { FLOW_STATE, TRANSITIONS } = require('./SaleFlowModels');
const { presentSaleFlow } = require('./SaleFlowAdminPresenter');
module.exports = { SaleFlowService, InMemorySaleFlowRepository, PaymentAdapter, SimulatorPaymentAdapter, MachineAdapter, SimulatorMachineAdapter, FLOW_STATE, TRANSITIONS, presentSaleFlow, status: 'FOUNDATION_ONLY' };
