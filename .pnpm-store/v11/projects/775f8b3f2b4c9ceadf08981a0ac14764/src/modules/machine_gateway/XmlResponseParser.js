class XmlResponseParser {
  parse(xml) {
    if (typeof xml !== 'string' || !xml.trim()) throw protocolError('Empty Huaxin response.');
    if (/<!DOCTYPE|<!ENTITY/i.test(xml)) throw protocolError('Unsafe XML declaration.');
    const response = xml.match(/<response\b([^>]*)>([\s\S]*?)<\/response>/i);
    const heartbeat = xml.match(/<heartbeat\b([^>]*)\/?\s*>/i);
    const telemetry = xml.match(/<telemetry\b([^>]*)>([\s\S]*?)<\/telemetry>/i);
    if (!response && !heartbeat && !telemetry) throw protocolError('Unsupported Huaxin response root.');
    if (response) {
      const attributes = parseAttributes(response[1]);
      return { kind: 'response', commandId: attributes.command_id || attributes.id || null, status: normalizeStatus(attributes.status), code: attributes.code || null, message: childText(response[2], 'message'), data: parseChildren(response[2], ['message']) };
    }
    if (heartbeat) {
      const attributes = parseAttributes(heartbeat[1]);
      return { kind: 'heartbeat', machineId: attributes.machine_id || null, status: normalizeStatus(attributes.status || 'ok'), timestamp: attributes.timestamp || null };
    }
    const attributes = parseAttributes(telemetry[1]);
    return { kind: 'telemetry', machineId: attributes.machine_id || null, timestamp: attributes.timestamp || null, values: parseChildren(telemetry[2]) };
  }
}

function parseAttributes(input) { const result = {}; const regex = /([A-Za-z_][\w.-]*)\s*=\s*(["'])(.*?)\2/g; let match; while ((match = regex.exec(input))) result[match[1]] = decodeXml(match[3]); return result; }
function parseChildren(input, excluded = []) { const result = {}; const regex = /<([A-Za-z_][\w.-]*)>([^<]*)<\/\1>/g; let match; while ((match = regex.exec(input))) if (!excluded.includes(match[1])) result[match[1]] = coerce(decodeXml(match[2].trim())); return result; }
function childText(input, name) { const match = input.match(new RegExp(`<${name}>([^<]*)<\\/${name}>`, 'i')); return match ? decodeXml(match[1].trim()) : null; }
function normalizeStatus(status) { return String(status || 'unknown').trim().toLowerCase(); }
function coerce(value) { if (/^-?\d+(\.\d+)?$/.test(value)) return Number(value); if (value === 'true') return true; if (value === 'false') return false; return value; }
function decodeXml(value) { return value.replace(/&(amp|lt|gt|quot|apos);/g, (_, entity) => ({ amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" }[entity])); }
function protocolError(message) { const error = new Error(message); error.code = 'MACHINE_PROTOCOL_INVALID_RESPONSE'; return error; }

module.exports = { XmlResponseParser };
