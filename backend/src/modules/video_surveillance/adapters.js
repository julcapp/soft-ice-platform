class RtspCameraAdapter { async wake() { throw new Error('Not implemented'); } async healthCheck() { throw new Error('Not implemented'); } }
class MotionSensorAdapter { async read() { throw new Error('Not implemented'); } }
class VideoRecorderAdapter { async start() { throw new Error('Not implemented'); } async extend() { throw new Error('Not implemented'); } async stop() { throw new Error('Not implemented'); } }
class VideoStorageAdapter { async saveMetadata() { throw new Error('Not implemented'); } async delete() { throw new Error('Not implemented'); } }
class VideoTranscodingAdapter { async transcode() { throw Object.assign(new Error('FFmpeg integration is not configured.'), { code: 'BLOCKED_EXTERNAL' }); } }
class MockRtspCameraAdapter extends RtspCameraAdapter {
  constructor({ result } = {}) { super(); this.result = result || { networkReachable: true, rtspPortReachable: true, authorizationSuccessful: true, framesReceived: true, imageFrozen: false, cameraTimeSynchronized: true, localStorageAvailable: true, sufficientFreeSpace: true }; this.wakeCalls = []; }
  async wake(camera) { this.wakeCalls.push(camera.id); return { accepted: true, adapterStatus: 'FOUNDATION_ONLY' }; }
  async healthCheck() { return { ...this.result }; }
}
class MockMotionSensorAdapter extends MotionSensorAdapter { constructor() { super(); this.events = []; } emit(value) { this.events.push(value); return value; } async read() { return this.events.shift() || null; } }
class InMemoryVideoRecorderAdapter extends VideoRecorderAdapter {
  constructor() { super(); this.sessions = new Map(); }
  async start(session) { this.sessions.set(session.id, session); return { recorderRef: `memory://${session.id}`, adapterStatus: 'FOUNDATION_ONLY' }; }
  async extend(session) { this.sessions.set(session.id, session); return { extended: true }; }
  async stop(session) { this.sessions.delete(session.id); return { stopped: true }; }
}
class LocalMetadataVideoStorageAdapter extends VideoStorageAdapter {
  constructor() { super(); this.entries = new Map(); }
  async saveMetadata(fragment) { this.entries.set(fragment.id, fragment); return { storageLocation: `local-metadata://${fragment.id}`, localOnly: true, adapterStatus: 'FOUNDATION_ONLY' }; }
  async delete(fragment) { return { deleted: this.entries.delete(fragment.id), storageLocation: fragment.storageLocation }; }
}
module.exports = { RtspCameraAdapter, MotionSensorAdapter, VideoRecorderAdapter, VideoStorageAdapter, VideoTranscodingAdapter, MockRtspCameraAdapter, MockMotionSensorAdapter, InMemoryVideoRecorderAdapter, LocalMetadataVideoStorageAdapter };
