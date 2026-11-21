'use strict';
const express = require('express');
const { asyncHandler } = require('../../platform/http/apiResponse');
const { SESSION_TTL_MS } = require('../../modules/seller_auth/PrismaSellerMaxAuthRepository');

const COOKIE_NAME = '__Host-timopos_seller';
const COOKIE_OPTIONS = Object.freeze({
  httpOnly: true, secure: true, sameSite: 'strict', path: '/', maxAge: SESSION_TTL_MS
});
function sessionCookie(req) {
  const header = String(req.get('cookie') || '');
  const match = header.match(/(?:^|;\s*)__Host-timopos_seller=([A-Za-z0-9_-]+)/);
  return match ? match[1] : '';
}
/**
 * This router is OPT-IN: only mount after wiring durable MAX sender, verified
 * PostgreSQL seller repository, an edge/distributed rate limiter, trusted TLS
 * proxy configuration and an explicit HTTPS allowedOrigin.
 */
function createTimoPosSellerAuthRouter({
  sellerMaxAuthService, sellerMaxAuthRepository, rateLimiter, allowedOrigin,
  allowInsecureTestTransport = false,
} = {}) {
  if (!sellerMaxAuthService || !sellerMaxAuthRepository?.resolveSession
    || typeof rateLimiter?.check !== 'function'
    || !/^https:\/\/[a-z0-9.-]+(?::\d+)?$/i.test(String(allowedOrigin || '')))
    throw new Error('TimoPOS seller auth secure dependencies required');
  const router = express.Router();
  router.use((req, res, next) => {
    res.set('Cache-Control','no-store');
    if (!req.secure && !allowInsecureTestTransport)
      return res.status(403).json({error:'HTTPS_REQUIRED'});
    if (req.method !== 'GET' && req.get('origin') !== allowedOrigin)
      return res.status(403).json({error:'ORIGIN_REQUIRED'});
    return next();
  });
  const limited = kind => asyncHandler(async (req,res,next) => {
    const okay = await rateLimiter.check({
      kind, ip: req.ip, terminalId: String(req.body?.terminalId || ''),
    });
    if (!okay) return res.status(429).json({error:'TOO_MANY_ATTEMPTS'});
    return next();
  });
  router.post('/challenges',limited('challenge'),asyncHandler(async (req,res) => {
    try {
      const result = await sellerMaxAuthService.request({
        phone:req.body?.phone,terminalId:req.body?.terminalId
      });
      return res.status(202).json({accepted:true,
        challengeId:result.challengeId,expiresAt:result.expiresAt});
    } catch {
      return res.status(400).json({error:'REQUEST_REJECTED'});
    }
  }));
  router.post('/sessions',limited('verify'),asyncHandler(async (req,res) => {
    try {
      const result = await sellerMaxAuthService.verify({
        challengeId:req.body?.challengeId,code:req.body?.code,
        terminalId:req.body?.terminalId,
      });
      res.cookie(COOKIE_NAME,result.sessionToken,COOKIE_OPTIONS);
      return res.status(201).json({authenticated:true,seller:result.seller});
    } catch {
      return res.status(401).json({error:'AUTHENTICATION_FAILED'});
    }
  }));
  router.get('/session',asyncHandler(async(req,res) => {
    const token=sessionCookie(req);
    const seller=token ? await sellerMaxAuthRepository.resolveSession(token) : null;
    if (!seller)return res.status(401).json({authenticated:false});
    return res.json({authenticated:true,seller});
  }));
  router.delete('/session',asyncHandler(async(req,res)=>{
    const token=sessionCookie(req);
    if (token)await sellerMaxAuthService.logout(token);
    res.clearCookie(COOKIE_NAME,{httpOnly:true,secure:true,sameSite:'strict',path:'/'});
    return res.status(204).end();
  }));
  return router;
}
module.exports={createTimoPosSellerAuthRouter,COOKIE_NAME,sessionCookie};
