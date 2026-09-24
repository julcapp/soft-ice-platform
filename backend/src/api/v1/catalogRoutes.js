'use strict';

const express = require('express');
const { asyncHandler, sendData } = require('../../platform/http/apiResponse');
const { createAdminAuthenticator } = require('../../platform/security/authenticateAdmin');
const { getPrismaClient } = require('../../common/database');
const { CatalogRepository, CatalogService } = require('../../modules/catalog');

function resolveCatalogService(dependencies = {}) {
  return dependencies.catalogService || new CatalogService({
    repository: new CatalogRepository(dependencies.prisma || getPrismaClient()),
  });
}

function context(req) {
  return {
    actorId: req.securityContext?.subject_id || null,
    authMethod: req.securityContext?.auth_method || null,
    correlationId: req.correlationId,
  };
}

function requireCatalogMutation(req, res, next) {
  const roles = req.securityContext?.roles || [];
  if (!roles.some((role) => ['PLATFORM_OWNER', 'ADMIN', 'ADMINISTRATOR'].includes(role))) {
    const error = Object.assign(new Error('Catalog mutation requires an administrator role.'), {
      code: 'CATALOG_MUTATION_FORBIDDEN', statusCode: 403, source: 'catalog',
    });
    return next(error);
  }
  return next();
}

function createCatalogRouter(dependencies = {}) {
  const router = express.Router();
  const service = resolveCatalogService(dependencies);
  router.get('/machines/:machineId', asyncHandler(async (req, res) => sendData(res, req, await service.getMachineCatalog(req.params.machineId))));
  return router;
}

function createAdminCatalogRouter(dependencies = {}) {
  const router = express.Router();
  const service = resolveCatalogService(dependencies);
  router.use(createAdminAuthenticator(dependencies.adminAuth || {}));
  router.get('/items', asyncHandler(async (req, res) => sendData(res, req, await service.listAll())));
  router.post('/items', requireCatalogMutation, asyncHandler(async (req, res) => sendData(res, req, await service.createItem(req.body, context(req)), 201)));
  router.patch('/items/:itemId', requireCatalogMutation, asyncHandler(async (req, res) => sendData(res, req, await service.updateItem(req.params.itemId, req.body, context(req)))));
  router.patch('/items/:itemId/price', requireCatalogMutation, asyncHandler(async (req, res) => sendData(res, req, await service.updatePrice(req.params.itemId, req.body, context(req)))));
  router.put('/machines/:machineId/items/:itemId', requireCatalogMutation, asyncHandler(async (req, res) => sendData(res, req, await service.setAvailability(req.params.machineId, req.params.itemId, req.body?.available, context(req)))));
  router.put('/machines/:machineId/current-flavor', requireCatalogMutation, asyncHandler(async (req, res) => sendData(res, req, await service.setCurrentFlavor(req.params.machineId, req.body?.catalogItemId, context(req)))));
  router.get('/machines/:machineId', asyncHandler(async (req, res) => sendData(res, req, await service.getMachineCatalog(req.params.machineId))));
  return router;
}

module.exports = { createCatalogRouter, createAdminCatalogRouter, resolveCatalogService, requireCatalogMutation };
