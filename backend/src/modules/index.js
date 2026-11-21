const bonus = require('./bonus');
const clubAccount = require('./club_account');
const customer = require('./customer');
const consent = require('./consent');
const machine = require('./machine');
const machineOperations = require('./machine_operations');
const machineGateway = require('./machine_gateway');
const machineSimulator = require('./machine_simulator');
const machineDigitalTwin = require('./machine_digital_twin');
const machineRuntime = require('./machine_runtime');
const inventory = require('./inventory');
const maintenance = require('./maintenance');
const order = require('./order');
const payment = require('./payment');
const segmentation = require('./segmentation');
const crm = require('./crm');
const customer360 = require('./customer_360');
const machineConnectivity = require('./machine_connectivity');
const videoSurveillance = require('./video_surveillance');
const eventCenter = require('./event_center');
const organization = require('./organization');
const saleFlow = require('./sale_flow');
const photoVerification = require('./photo_verification');
const promotionEngine = require('./promotion_engine');
const botCore = require('./bot_core');
const referral = require('./referral');
const welcomeBonus = require('./welcome_bonus');

const moduleManifests = [
  customer,
  segmentation,
  consent,
  clubAccount,
  bonus,
  payment,
  order,
  machine,
  machineOperations,
  machineGateway,
  machineSimulator,
  machineDigitalTwin,
  machineRuntime,
  inventory,
  maintenance,
  crm,
  customer360,
  machineConnectivity,
  videoSurveillance,
  eventCenter,
  organization,
  saleFlow,
  photoVerification,
  promotionEngine,
  botCore,
  referral,
  welcomeBonus,
];

module.exports = {
  moduleManifests,
};
