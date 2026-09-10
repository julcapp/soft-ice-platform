class MachineProviderAdapter {
  async sendDispenseCommand() { throw blocked(); }
  async getCommandStatus() { throw blocked(); }
  async cancelCommand() { throw blocked(); }
  async healthCheck() { return { status: 'UNKNOWN' }; }
  async reconcileCommand() { throw blocked(); }
  async verifyCallback() { throw blocked('MACHINE_CALLBACK_AUTH_BLOCKED_EXTERNAL'); }
}
class BlockedExternalMachineProviderAdapter extends MachineProviderAdapter {}
function blocked(code = 'MACHINE_PROVIDER_BLOCKED_EXTERNAL') { return Object.assign(new Error('Production Machine Provider не подключён.'), { code, statusCode: 503 }); }
module.exports = { MachineProviderAdapter, BlockedExternalMachineProviderAdapter };
