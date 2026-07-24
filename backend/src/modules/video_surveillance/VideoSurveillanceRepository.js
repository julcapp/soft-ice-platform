class VideoSurveillanceRepository {
  constructor() { this.cameras = new Map(); this.sensors = new Map(); this.policies = new Map(); this.sessions = new Map(); this.fragments = new Map(); this.incidents = new Map(); this.links = new Map(); this.health = []; this.audit = []; }
  saveCamera(v) { this.cameras.set(v.id, v); return v; } getCamera(id) { return this.cameras.get(id) || null; } listCameras(machineId) { return [...this.cameras.values()].filter((v) => !machineId || v.machineId === machineId); }
  saveSensor(v) { this.sensors.set(v.id, v); return v; } listSensors(machineId, cameraId) { return [...this.sensors.values()].filter((v) => (!machineId || v.machineId === machineId) && (!cameraId || v.cameraId === cameraId)); }
  savePolicy(v) { this.policies.set(v.cameraId, v); return v; } getPolicy(cameraId) { return this.policies.get(cameraId) || null; }
  saveSession(v) { this.sessions.set(v.id, v); return v; } activeSession(cameraId) { return [...this.sessions.values()].find((v) => v.cameraId === cameraId && v.status === 'RECORDING') || null; }
  saveFragment(v) { this.fragments.set(v.id, v); return v; } getFragment(id) { return this.fragments.get(id) || null; } listFragments(machineId) { return [...this.fragments.values()].filter((v) => !machineId || v.machineId === machineId); } deleteFragment(id) { return this.fragments.delete(id); }
  saveIncident(v) { this.incidents.set(v.id, v); return v; } getIncident(id) { return this.incidents.get(id) || null; } listIncidents(machineId) { return [...this.incidents.values()].filter((v) => !machineId || v.machineId === machineId); }
  saveLink(v) { this.links.set(v.id, v); return v; } addHealth(v) { this.health.push(v); return v; } latestHealth(cameraId) { return [...this.health].reverse().find((v) => v.cameraId === cameraId) || null; }
  addAudit(v) { this.audit.push(v); return v; } listAudit() { return [...this.audit].reverse(); }
}
module.exports = { VideoSurveillanceRepository };
