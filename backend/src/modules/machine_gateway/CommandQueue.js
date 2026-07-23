class CommandQueue {
  constructor({ maxSize = 100, execute, onChange } = {}) { this.maxSize = maxSize; this.execute = execute; this.onChange = onChange; this.items = []; this.processing = false; }
  enqueue(command) {
    if (this.items.length >= this.maxSize) return Promise.reject(withCode('Machine command queue is full.', 'MACHINE_QUEUE_FULL'));
    return new Promise((resolve, reject) => { this.items.push({ command, resolve, reject }); this.onChange?.(this.items.length); this.drain(); });
  }
  async drain() { if (this.processing) return; this.processing = true; while (this.items.length) { const item = this.items[0]; try { item.resolve(await this.execute(item.command)); } catch (error) { item.reject(error); } finally { this.items.shift(); this.onChange?.(this.items.length); } } this.processing = false; }
  get size() { return this.items.length; }
  clear(error = withCode('Command queue stopped.', 'MACHINE_CONNECTION_UNAVAILABLE')) { for (const item of this.items.splice(0)) item.reject(error); this.onChange?.(0); }
}
function withCode(message, code) { const error = new Error(message); error.code = code; return error; }
module.exports = { CommandQueue, withCode };
