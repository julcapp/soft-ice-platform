const crypto = require('node:crypto');
const express = require('express');
const { asyncHandler, sendData } = require('../platform/http/apiResponse');
const { ApiError } = require('../platform/errors/ApiError');

const PURPOSE = 'softice.legacy-tma-identity-bridge.v1';
const MAX_SKEW_SECONDS = 60;

function createLegacyTmaIdentityBridgeRouter({ legacyTmaIdentityBridgeService }, { logger } = {}) {
  const router = express.Router();

  router.use((req, _res, next) => {
    try {
      assertLoopback(req);
      verifySignature(req);
      next();
    } catch (error) {
      logger?.warn?.('legacy.tma.identity.bridge.denied', { code: error.code || 'IDENTITY_BRIDGE_AUTH_FAILED' });
      next(error);
    }
  });

  router.post('/identity-bridge', asyncHandler(async (req, res) => {
    const result = await legacyTmaIdentityBridgeService.resolve(req.body || {}, {
      correlationId: req.correlationId,
    });
    sendData(res, req, result);
  }));

  return router;
}

function verifySignature(req) {
  const root = process.env.MAX_BOT_TOKEN || '';
  if (!root) {
    throw new ApiError({ statusCode: 503, code: 'IDENTITY_BRIDGE_NOT_CONFIGURED', message: 'Identity bridge is not configured.', source: 'platform_service' });
  }

  const timestamp = String(req.get('X-TMA-Bridge-Timestamp') || '');
  const signature = String(req.get('X-TMA-Bridge-Signature') || '').toLowerCase();
  if (!/^\d{10,13}$/.test(timestamp) || !/^[0-9a-f]{64}$/.test(signature)) {
    throw authError('IDENTITY_BRIDGE_SIGNATURE_REQUIRED');
  }

  const seconds = timestamp.length > 10 ? Math.floor(Number(timestamp) / 1000) : Number(timestamp);
  const now = Math.floor(Date.now() / 1000);
  if (!Number.isFinite(seconds) || Math.abs(now - seconds) > MAX_SKEW_SECONDS) {
    throw authError('IDENTITY_BRIDGE_SIGNATURE_EXPIRED');
  }

  const derived = crypto.createHmac('sha256', Buffer.from(root, 'utf8')).update(PURPOSE, 'utf8').digest();
  const raw = req.rawBody || Buffer.from(JSON.stringify(req.body || {}), 'utf8');
  const expected = crypto.createHmac('sha256', derived).update(timestamp + '\n', 'utf8').update(raw).digest('hex');

  const a = Buffer.from(signature, 'hex');
  const b = Buffer.from(expected, 'hex');
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    throw authError('IDENTITY_BRIDGE_SIGNATURE_INVALID');
  }
}

function assertLoopback(req) {
  const remote = String(req.socket?.remoteAddress || '');
  if (!['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(remote)) {
    throw new ApiError({ statusCode: 403, code: 'IDENTITY_BRIDGE_LOCAL_ONLY', message: 'Identity bridge is local-only.', source: 'api' });
  }
}

function authError(code) {
  return new ApiError({ statusCode: 401, code, message: 'Identity bridge authentication failed.', source: 'api' });
}

module.exports = { createLegacyTmaIdentityBridgeRouter, PURPOSE };
