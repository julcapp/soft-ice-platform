class VideoSurveillanceRuntime { constructor({ service }) { this.service = service; } }
for (const method of ['listCameras','getCamera','registerCamera','updateCamera','check','motion','confirmMotion','startOrExtend','complete','handlePlatformEvent','listFragments','listIncidents','getIncident','createIncident','updateIncident','legalHold','extendRetention','purgeExpired','auditLog']) VideoSurveillanceRuntime.prototype[method] = function (...args) { return this.service[method](...args); };
module.exports = { VideoSurveillanceRuntime };
