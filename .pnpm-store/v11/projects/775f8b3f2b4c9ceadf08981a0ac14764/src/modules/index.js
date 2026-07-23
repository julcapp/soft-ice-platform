const bonus = require('./bonus');
const clubAccount = require('./club_account');
const customer = require('./customer');
const consent = require('./consent');
const machine = require('./machine');
const machineOperations = require('./machine_operations');
const machineGateway = require('./machine_gateway');
const machineSimulator = require('./machine_simulator');
const order = require('./order');
const payment = require('./payment');
const segmentation = require('./segmentation');

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
];

module.exports = {
  moduleManifests,
};
