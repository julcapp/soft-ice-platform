import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'dist');
const port = Number(process.env.VISUAL_ACCEPTANCE_PORT || 4178);
const priceBySku = new Map([['flavor_vanilla', 150], ['sprinkle_none', 0], ['sprinkle_confetti', 10], ['topping_none', 0], ['topping_caramel', 15]]);
const common = { currency: 'RUB', active: true, available: true, updatedAt: '2026-09-23T00:00:00.000Z' };
const flavor = { ...common, id: 'flavor', sku: 'flavor_vanilla', category: 'ICE_CREAM', nameRu: 'Сливочная ваниль', basePrice: 150, isCurrentFlavor: true, mediaPath: '/media/ice/UT-ICE-Hero-001.png', sortOrder: 10 };
const sprinkles = [{ ...common, id: 'sprinkle-none', sku: 'sprinkle_none', category: 'SPRINKLE', nameRu: 'Без посыпки', basePrice: 0, systemItem: true, sortOrder: 0 }, { ...common, id: 'sprinkle-confetti', sku: 'sprinkle_confetti', category: 'SPRINKLE', nameRu: 'Конфетти', basePrice: 10, systemItem: false, sortOrder: 10 }];
const toppings = [{ ...common, id: 'topping-none', sku: 'topping_none', category: 'TOPPING', nameRu: 'Без топпинга', basePrice: 0, systemItem: true, sortOrder: 0 }, { ...common, id: 'topping-caramel', sku: 'topping_caramel', category: 'TOPPING', nameRu: 'Карамель', basePrice: 15, systemItem: false, sortOrder: 10 }];

const server = http.createServer(async (request, response) => {
  if (request.url?.startsWith('/api/v1/catalog/machines/')) return json(response, 200, { data: { machine: { id: 'visual-machine', name: 'Автомат VISUAL-01', location: 'Тестовый контур' }, currentFlavor: flavor, items: [flavor, ...sprinkles, ...toppings], sprinkles, toppings, currency: 'RUB' } });
  if (request.url?.startsWith('/api/v1/pricing/promotion-awareness')) return json(response, 200, { data: { active: null, upcoming: null } });
  if (request.url === '/api/v1/pricing/quote' && request.method === 'POST') {
    const body = await readJson(request);
    const requested = body.items || [];
    const unknown = requested.find((item) => !priceBySku.has(item.productId));
    if (unknown) return json(response, 409, { error: { code: 'SERVER_PRODUCT_NOT_SALEABLE', message: `Unknown fixture SKU: ${unknown.productId}` } });
    const baseAmount = requested.reduce((sum, item) => sum + priceBySku.get(item.productId), 0);
    const now = new Date(); const lockedUntil = new Date(now.getTime() + 300_000);
    return json(response, 201, { data: { id: 'quote_visual_acceptance', machineId: body.machineId, channel: body.channel, currency: 'RUB', baseAmount, giftAmount: 0, promotionDiscountAmount: 0, finalAmount: baseAmount, paymentRequired: true, createdAt: now.toISOString(), lockedUntil: lockedUntil.toISOString(), items: body.items, promotionRuntime: null } });
  }
  const urlPath = new URL(request.url || '/', 'http://localhost').pathname;
  const relative = urlPath === '/' ? 'index.html' : urlPath.replace(/^\/+/, '');
  const candidate = path.resolve(root, relative);
  const file = candidate.startsWith(root) && fs.existsSync(candidate) && fs.statSync(candidate).isFile() ? candidate : path.join(root, 'index.html');
  const type = file.endsWith('.js') ? 'text/javascript' : file.endsWith('.css') ? 'text/css' : file.endsWith('.png') ? 'image/png' : 'text/html';
  response.writeHead(200, { 'Content-Type': type }); fs.createReadStream(file).pipe(response);
});

server.listen(port, '127.0.0.1', () => console.log(`Visual acceptance server: http://127.0.0.1:${port}/?mode=terminal&machineId=visual-machine`));
function json(response, status, value) { response.writeHead(status, { 'Content-Type': 'application/json' }); response.end(JSON.stringify(value)); }
function readJson(request) { return new Promise((resolve) => { let body = ''; request.on('data', (chunk) => { body += chunk; }); request.on('end', () => resolve(body ? JSON.parse(body) : {})); }); }
