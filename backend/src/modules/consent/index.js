module.exports = {
  name: 'consent',
  status: 'active',
  owns: ['customer consent history', 'legal consent decisions'],
  ...require('./ConsentEntity'),
  ...require('./ConsentRepository'),
  ...require('./ConsentRuntime'),
  ...require('./ConsentService'),
};
