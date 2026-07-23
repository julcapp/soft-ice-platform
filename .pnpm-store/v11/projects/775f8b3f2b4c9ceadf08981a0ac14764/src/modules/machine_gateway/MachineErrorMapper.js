const { ApiError } = require('../../platform/errors/ApiError');

class MachineErrorMapper {
  map(error) {
    if (error instanceof ApiError) return error;
    const code = error && error.code;
    const definitions = {
      MACHINE_COMMAND_INVALID: [400, 'Machine command is invalid.', false],
      MACHINE_CONNECTION_UNAVAILABLE: [503, 'Machine connection is unavailable.', true],
      MACHINE_COMMAND_TIMEOUT: [504, 'Machine command timed out.', true],
      MACHINE_QUEUE_FULL: [429, 'Machine command queue is full.', true],
      MACHINE_PROTOCOL_INVALID_RESPONSE: [502, 'Machine returned an invalid response.', false],
      MACHINE_COMMAND_REJECTED: [422, 'Machine rejected the command.', false],
    };
    const [statusCode, message, retryable] = definitions[code] || [502, 'Machine gateway operation failed.', false];
    return new ApiError({ statusCode, code: code || 'MACHINE_GATEWAY_ERROR', message, retryable, source: 'machine_gateway', details: error?.message ? [{ reason: error.message }] : [] });
  }
}

module.exports = { MachineErrorMapper };
