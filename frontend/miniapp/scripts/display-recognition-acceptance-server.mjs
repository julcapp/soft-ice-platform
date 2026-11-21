import { createRequire } from 'node:module';
import http from 'node:http';
const require = createRequire(import.meta.url);
const express = require('../../../backend/node_modules/express');
const { createAuthRouter } = require('../../../backend/src/api/v1/authRoutes');
const { attachCorrelationId, sendError } = require('../../../backend/src/platform/http/apiResponse');
const { CustomerRepository } = require('../../../backend/src/modules/customer/CustomerRepository');
const { DisplayCustomerRecognitionService, AllowDisplayRecognitionAbuseGuard, DeterministicDisplayPhoneVerificationProvider, UnavailableDisplayPhoneVerificationProvider } = require('../../../backend/src/modules/customer/DisplayCustomerRecognitionService');
if (process.env.NODE_ENV !== 'test') throw new Error('Local acceptance server requires NODE_ENV=test');
// Reuse the existing loopback-only catalog/anonymous quote fixture on port 4178.
await import('./visual-acceptance-server.mjs');
const app = express();
app.use(express.json()); app.use(attachCorrelationId);
const customerRepository = new CustomerRepository({ customer: { async findFirst({ where }) {
  return where.phone === '+79130000001' ? { id: 'test-only-customer', phone: where.phone, phoneVerifiedAt: new Date(), identities: [] } : null;
} } });
const auditRepository = { async record() {} };
const services = {
  normal: new DisplayCustomerRecognitionService({ customerRepository, auditRepository, abuseGuard: new AllowDisplayRecognitionAbuseGuard(), verificationProvider: new DeterministicDisplayPhoneVerificationProvider(), codeFactory: () => '123456' }),
  provider: new DisplayCustomerRecognitionService({ customerRepository, auditRepository, abuseGuard: new AllowDisplayRecognitionAbuseGuard(), verificationProvider: new UnavailableDisplayPhoneVerificationProvider() }),
  unavailable: new DisplayCustomerRecognitionService({ customerRepository, auditRepository }),
};
const routers = Object.fromEntries(Object.entries(services).map(([name, service]) => [name, createAuthRouter({ displayCustomerRecognitionService: service })]));
app.use('/api/v1/auth', async (req, res, next) => {
  await new Promise(resolve => setTimeout(resolve, 900));
  const mode = req.body?.machine_id === 'recognition-provider' ? 'provider' : req.body?.machine_id === 'recognition-unavailable' ? 'unavailable' : 'normal';
  routers[mode](req, res, next);
});
app.use((error, req, res, next) => sendError(res, req, error));
app.use((req, res) => {
  const upstream = http.request({ hostname: '127.0.0.1', port: 4178, path: req.originalUrl, method: req.method, headers: { 'Content-Type': 'application/json' } }, reply => { res.writeHead(reply.statusCode, reply.headers); reply.pipe(res); });
  upstream.on('error', () => res.status(503).end());
  upstream.end(req.method === 'POST' ? JSON.stringify(req.body) : undefined);
});
app.listen(4180, '127.0.0.1', () => console.log('Recognition acceptance: http://127.0.0.1:4180/?mode=terminal&machineId=recognition-normal (test fixtures only)'));
