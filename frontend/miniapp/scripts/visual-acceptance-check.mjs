import fs from 'node:fs/promises';

const origin = process.env.VISUAL_ACCEPTANCE_ORIGIN || 'http://127.0.0.1:4178';
const catalogResponse = await fetch(`${origin}/api/v1/catalog/machines/visual-machine`);
if (!catalogResponse.ok) throw new Error(`catalog fixture failed: ${catalogResponse.status}`);
const catalog = (await catalogResponse.json()).data;
if (catalog.currentFlavor?.sku !== 'flavor_vanilla') throw new Error('current flavor fixture is not canonical');
if (catalog.currentFlavor?.mediaPath !== '/media/ice/UT-ICE-Hero-001.png') throw new Error('hero mapping is not canonical');
const heroResponse = await fetch(`${origin}${catalog.currentFlavor.mediaPath}`);
if (!heroResponse.ok || heroResponse.headers.get('content-type') !== 'image/png') throw new Error('canonical hero is not served as image/png');
const heroBytes = new Uint8Array(await heroResponse.arrayBuffer());
const pngSignature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
if (heroBytes.length < 8 || pngSignature.some((byte, index) => heroBytes[index] !== byte)) throw new Error('canonical hero response is not a PNG asset');

const quoteResponse = await fetch(`${origin}/api/v1/pricing/quote`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ machineId: 'visual-machine', channel: 'TERMINAL', items: [
    { productId: 'flavor_vanilla', quantity: 1 },
    { productId: 'sprinkle_confetti', quantity: 1 },
    { productId: 'topping_caramel', quantity: 1 },
  ] }),
});
if (!quoteResponse.ok) throw new Error(`quote fixture failed: ${quoteResponse.status}`);
const quote = (await quoteResponse.json()).data;
if (quote.finalAmount !== 175 || quote.paymentRequired !== true) throw new Error('quote fixture did not preserve server pricing boundary');

const [page, styles] = await Promise.all([
  fs.readFile(new URL('../src/terminal/SalesTerminalPage.jsx', import.meta.url), 'utf8'),
  fs.readFile(new URL('../src/styles/terminal.css', import.meta.url), 'utf8'),
]);
for (const hook of ['data-testid="display-idle"', 'data-testid={`display-screen-${step}`}']) {
  if (!page.includes(hook)) throw new Error(`missing visual hook: ${hook}`);
}
for (const hook of ['data-testid="display-prepaid-entry"', "STEPS.PREPAID", '<PrepaidBoundary']) {
  if (!page.includes(hook)) throw new Error(`missing prepaid boundary: ${hook}`);
}
for (const token of ['display-payment-placeholder', 'QR-код появится после создания платёжной сессии', 'Платёж создаёт и подтверждает Payment Runtime', 'Ожидаем подтверждение сервера', 'Вернуться к заказу']) {
  if (!page.includes(token)) throw new Error(`missing payment boundary: ${token}`);
}
for (const forbidden of ['display-qr', 'repeating-conic-gradient']) {
  if (page.includes(forbidden) || styles.includes(forbidden)) throw new Error(`unsafe pseudo QR pattern remains: ${forbidden}`);
}
for (const forbidden of ['/media/ice/', 'UT-ICE-Hero-001.png']) {
  if (page.includes(forbidden)) throw new Error(`production React contains forbidden commercial media mapping: ${forbidden}`);
}
for (const token of ['env(safe-area-inset-top)', 'touch-action:manipulation', '@media (orientation:portrait)', 'grid-template-rows:auto auto', '@media (orientation:landscape) and (max-height:800px)']) {
  if (!styles.includes(token)) throw new Error(`missing responsive token: ${token}`);
}
console.log('visual acceptance checks passed: canonical PNG, fixture, quote, safe payment boundary, prepaid boundary, hooks, safe-area, touch, orientation');
