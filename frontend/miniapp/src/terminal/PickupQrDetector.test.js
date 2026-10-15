import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const matrix = JSON.parse(fs.readFileSync(new URL('./qr-test-matrix.json', import.meta.url)));
const vendor = fs.readFileSync(new URL('../../public/vendor/jsQR-1.4.0.js', import.meta.url), 'utf8');
const wrapper = fs.readFileSync(new URL('../../public/pickup-qr-detector.js', import.meta.url), 'utf8');
function setup({ rotate = false, invert = false, blank = false, native } = {}) {
  const size = matrix.length * 5, data = new Uint8ClampedArray(size * size * 4);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const row = Math.floor(y / 5), col = Math.floor(x / 5);
    const dark = !blank && (rotate ? matrix[matrix.length - 1 - col][row] : matrix[row][col]);
    const value = (invert ? !dark : dark) ? 0 : 255;
    data.set([value, value, value, 255], (y * size + x) * 4);
  }
  const context = { module: { exports: {} }, exports: {} };
  vm.runInNewContext(vendor, context);
  const window = { jsQR: context.module.exports, BarcodeDetector: native };
  const document = { createElement: () => ({ getContext: () => ({ drawImage() {}, getImageData: () => ({ data, width: size, height: size }) }) }) };
  vm.runInNewContext(wrapper, { window, document });
  return { detector: new window.SoftIceQrDetector(), video: { videoWidth: size, videoHeight: size, readyState: 2 } };
}
for (const [name, options] of [['обычный QR', {}], ['повёрнутый QR', { rotate: true }], ['инвертированный QR', { invert: true }], ['ошибка встроенного сканера', { native: class { detect() { throw new Error('unsupported'); } } }]]) {
  test(name, async () => {
    const { detector, video } = setup(options);
    const result = await detector.detect(video);
    assert.equal(result[0].rawValue, 'UTP1:local-decoder-test');
  });
}
test('пустой кадр и неподготовленное видео не создают код', async () => {
  const { detector, video } = setup({ blank: true });
  assert.equal((await detector.detect(video)).length, 0);
  assert.equal((await detector.detect({ ...video, readyState: 0 })).length, 0);
});
