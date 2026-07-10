const bonus = require('./bonus');
const clubAccount = require('./club_account');
const customer = require('./customer');
const machine = require('./machine');
const order = require('./order');
const payment = require('./payment');

const moduleManifests = [
  customer,
  clubAccount,
  bonus,
  payment,
  order,
  machine,
];

module.exports = {
  moduleManifests,
};
