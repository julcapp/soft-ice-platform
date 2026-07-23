const express = require('express');

const {
  toMachineDto,
  toMachineRegistrationDto,
} = require('../../modules/machine/machineDto');
const { asyncHandler, sendData } = require('../../platform/http/apiResponse');
const { createCustomerAuthenticator } = require('../../platform/security/authenticateCustomer');

function createMachineRouter({ authCoreService, machineRuntime }) {
  const router = express.Router();
  const authenticateCustomer = createCustomerAuthenticator(authCoreService);

  router.post(
    '/register',
    authenticateCustomer,
    asyncHandler(async (req, res) => {
      const result = await machineRuntime.registerMachine(
        normalizeMachineRegistrationRequest(req.body),
        {
          correlationId: req.correlationId,
          idempotencyKey: req.get('Idempotency-Key') || null,
          authMethod: req.securityContext.auth_method,
          sourceChannel: 'api_v1',
          actorType: 'user',
          actorId: req.securityContext.subject_id,
        },
      );

      sendData(
        res,
        req,
        toMachineRegistrationDto(result),
        result.created ? 201 : 200,
      );
    }),
  );

  router.get(
    '/:id',
    authenticateCustomer,
    asyncHandler(async (req, res) => {
      const machine = await machineRuntime.getMachine(req.params.id);

      sendData(res, req, toMachineDto(machine));
    }),
  );

  return router;
}

function normalizeMachineRegistrationRequest(body) {
  return {
    machineCode: body && (body.machine_code || body.machineCode),
    name: body && body.name,
    location: body && body.location,
    status: body && body.status,
  };
}

module.exports = {
  createMachineRouter,
  normalizeMachineRegistrationRequest,
};
