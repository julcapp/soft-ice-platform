const { BonusRewardEngine } = require('./BonusRewardEngine');

module.exports = {
  name: 'bonus',
  status: 'foundation',
  owns: [
    'bonus account boundary',
    'bonus transactions',
    'future bonus rights',
    'idempotent photo reward grants',
  ],
  BonusRewardEngine,
};
