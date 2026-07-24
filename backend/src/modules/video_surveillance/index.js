const models = require('./VideoSurveillanceModels');
const adapters = require('./adapters');
const { VideoSurveillanceRepository } = require('./VideoSurveillanceRepository');
const { VideoSurveillanceService } = require('./VideoSurveillanceService');
const { VideoSurveillanceRuntime } = require('./VideoSurveillanceRuntime');
module.exports = { name: 'video_surveillance', status: 'FOUNDATION_ONLY', ...models, ...adapters, VideoSurveillanceRepository, VideoSurveillanceService, VideoSurveillanceRuntime };
