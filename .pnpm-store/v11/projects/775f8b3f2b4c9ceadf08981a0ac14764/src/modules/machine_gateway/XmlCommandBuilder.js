const XML_NAME = /^[A-Za-z_][A-Za-z0-9_.-]*$/;

class XmlCommandBuilder {
  build({ commandId, type, machineId, payload = {}, issuedAt = new Date() }) {
    required(commandId, 'commandId');
    required(type, 'type');
    required(machineId, 'machineId');
    if (!XML_NAME.test(type)) throw new TypeError('Command type is not a valid XML name.');
    const body = Object.entries(payload)
      .filter(([, value]) => value !== undefined && value !== null)
      .map(([key, value]) => {
        if (!XML_NAME.test(key)) throw new TypeError(`Payload key is not a valid XML name: ${key}`);
        return `<${key}>${escapeXml(String(value))}</${key}>`;
      }).join('');
    return `<?xml version="1.0" encoding="UTF-8"?><huaxin version="1"><command id="${escapeXml(commandId)}" type="${escapeXml(type)}" machine_id="${escapeXml(machineId)}" issued_at="${escapeXml(new Date(issuedAt).toISOString())}">${body}</command></huaxin>`;
  }

  buildHeartbeat({ commandId, machineId, issuedAt }) {
    return this.build({ commandId, machineId, type: 'heartbeat', issuedAt });
  }
}

function required(value, name) { if (typeof value !== 'string' || !value.trim()) throw new TypeError(`${name} is required.`); }
function escapeXml(value) { return value.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[char])); }

module.exports = { XmlCommandBuilder, escapeXml };
