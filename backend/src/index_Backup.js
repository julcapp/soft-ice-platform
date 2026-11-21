  const express = require('express');

  const app = express();
  const PORT = process.env.PORT || 3000;

  app.use(express.json());

 app.get('/', (req, res) => {
    res.json({
        project: 'г вшьюјш CRM',
        status: 'online',
        version: '0.1.0',
        serverTime: new Date().toISOString()
    });
});

  app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        database: 'connected',
        timestamp: new Date().toISOString()
    });
});

 app.get('/api/info', (req, res) => {
    res.json({
        project: 'г вшьюјш',
        cashback: '7%',
        clubDeposit: 300,
        minimumBalance: 150,
        birthdayGift: true
    });
});

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Roylty backend running on port ${PORT}`);
});