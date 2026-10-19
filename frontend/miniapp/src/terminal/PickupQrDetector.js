import jsQR from '../vendor/jsQR-1.4.0.cjs';

// Local frame decoding is bundled: no CDN/global script or native-only dependency.
export class PickupQrDetector {
  constructor({ NativeDetector = globalThis.BarcodeDetector, document = globalThis.document } = {}) {
    this.document = document;
    this.canvas = null;
    try { this.native = NativeDetector ? new NativeDetector({ formats: ['qr_code'] }) : null; } catch { this.native = null; }
  }
  async detect(video) {
    if (this.native) {
      try { const found = await this.native.detect(video); if (found.length) return found; }
      catch { this.native = null; }
    }
    if (!video.videoWidth || !video.videoHeight || video.readyState < 2) return [];
    this.canvas ||= this.document.createElement('canvas');
    const scale = Math.min(1, 960 / Math.max(video.videoWidth, video.videoHeight));
    this.canvas.width = Math.max(1, Math.round(video.videoWidth * scale));
    this.canvas.height = Math.max(1, Math.round(video.videoHeight * scale));
    const context = this.canvas.getContext('2d', { willReadFrequently: true });
    if (!context) throw new Error('QR_CANVAS_UNAVAILABLE');
    context.drawImage(video, 0, 0, this.canvas.width, this.canvas.height);
    const pixels = context.getImageData(0, 0, this.canvas.width, this.canvas.height);
    const result = jsQR(pixels.data, pixels.width, pixels.height, { inversionAttempts: 'attemptBoth' });
    return result?.data ? [{ rawValue: result.data, format: 'qr_code' }] : [];
  }
}
export function isPickupQr(value) { return /^UTP1:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}:\d{6}$/i.test(String(value || '').trim()); }
