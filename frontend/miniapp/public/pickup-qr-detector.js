/* Camera frames stay on this device; only a decoded order payload goes to the API. */
(function (scope) {
  'use strict';
  const NativeDetector = scope.BarcodeDetector;
  class PickupQrDetector {
    constructor() {
      this.canvas = null;
      this.native = null;
      try { if (NativeDetector) this.native = new NativeDetector({ formats: ['qr_code'] }); } catch {}
    }
    static async getSupportedFormats() { return ['qr_code']; }
    async detect(video) {
      if (this.native) {
        try {
          const results = await this.native.detect(video);
          if (results.length) return results;
        } catch { this.native = null; }
      }
      if (typeof scope.jsQR !== 'function') throw new Error('QR_DECODER_UNAVAILABLE');
      if (!video.videoWidth || !video.videoHeight || video.readyState < 2) return [];
      if (!this.canvas) this.canvas = document.createElement('canvas');
      const scale = Math.min(1, 960 / Math.max(video.videoWidth, video.videoHeight));
      this.canvas.width = Math.max(1, Math.round(video.videoWidth * scale));
      this.canvas.height = Math.max(1, Math.round(video.videoHeight * scale));
      const context = this.canvas.getContext('2d', { willReadFrequently: true });
      if (!context) throw new Error('QR_CANVAS_UNAVAILABLE');
      context.drawImage(video, 0, 0, this.canvas.width, this.canvas.height);
      const pixels = context.getImageData(0, 0, this.canvas.width, this.canvas.height);
      const result = scope.jsQR(pixels.data, pixels.width, pixels.height, { inversionAttempts: 'attemptBoth' });
      return result?.data ? [{ rawValue: result.data, format: 'qr_code' }] : [];
    }
  }
  scope.SoftIceQrDetector = PickupQrDetector;
})(window);
