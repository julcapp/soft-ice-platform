const express = require('express');
const { presentSaleFlow } = require('../../modules/sale_flow');
const { createAdminAuthenticator } = require('../../platform/security/authenticateAdmin');
function createSaleFlowRouter({ saleFlowService, saleFlowRepository, adminAuth = {} }) {
  const router = express.Router();
  router.use(createAdminAuthenticator(adminAuth));
  router.get('/health', async (req, res, next) => { try { const health = await saleFlowService.health(); res.status(health.status === 'UNAVAILABLE' ? 503 : 200).json({ data: health }); } catch (error) { next(error); } });
  router.get('/', async (req, res, next) => { try { const flows = await saleFlowRepository.list(); res.json({ data: flows.map((flow) => presentSaleFlow({ ...flow, persistenceMode: saleFlowRepository.persistenceMode })) }); } catch (error) { next(error); } });
  router.get('/:id', async (req, res, next) => { try { const flow = await saleFlowRepository.getById(req.params.id) || await saleFlowRepository.getByOrderId(req.params.id); if (!flow) return res.status(404).json({ error: { code: 'SALE_FLOW_NOT_FOUND', message: 'Процесс продажи не найден.' } }); return res.json({ data: presentSaleFlow({ ...flow, persistenceMode: saleFlowRepository.persistenceMode }) }); } catch (error) { return next(error); } });
  return router;
}
module.exports = { createSaleFlowRouter };
