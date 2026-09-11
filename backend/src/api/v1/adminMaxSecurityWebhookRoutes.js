const express = require('express');

function createAdminMaxSecurityWebhookRouter({ adminMaxSecurityService }) {
  const router = express.Router();

  router.post('/', async (req, res, next) => {
    try {
      const secret = req.get('x-max-bot-api-secret') || '';
      if (!adminMaxSecurityService.verifyWebhookSecret(secret)) {
        return res.status(401).json({ error: { code: 'ADMIN_MAX_WEBHOOK_UNAUTHORIZED', message: 'Недействительный секрет Webhook MAX.' } });
      }
      await adminMaxSecurityService.handleUpdate(req.body || {});
      return res.status(200).json({ success: true });
    } catch (error) {
      return next(error);
    }
  });

  return router;
}

module.exports = { createAdminMaxSecurityWebhookRouter };
