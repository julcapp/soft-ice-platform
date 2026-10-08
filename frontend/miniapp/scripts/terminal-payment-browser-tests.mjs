import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE_URL || 'playwright');
const browser = await chromium.launch({ headless: true, ...(process.env.CHROMIUM_EXECUTABLE ? { executablePath: process.env.CHROMIUM_EXECUTABLE, args: ['--no-sandbox'] } : {}) });
const output = path.resolve('../../.tmp/terminal-payment');
await fs.mkdir(output, { recursive: true });
const quote = { id: 'quote-browser', finalAmount: 165, baseAmount: 165, giftAmount: 0, promotionDiscountAmount: 0, currency: 'RUB', createdAt: new Date().toISOString(), lockedUntil: new Date(Date.now()+300000).toISOString() };
const items = [{ sku: 'ice', nameRu: 'Сливочное мороженое' }, { sku: 'topping_chocolate', nameRu: 'Шоколадный топпинг' }, { sku: 'sprinkle_wafer', nameRu: 'Вафельная крошка' }];
const results = [];
async function setup(width, height, mode='pending') {
 const page = await browser.newPage({ viewport: { width, height } });
 const errors=[]; page.on('pageerror', e=>errors.push(e.message));
 await page.addInitScript(({ quote, items }) => {
  if (!sessionStorage.getItem('soft_ice_terminal_checkout:TEST-MACHINE-001')) sessionStorage.setItem('soft_ice_terminal_checkout:TEST-MACHINE-001', JSON.stringify({ quote, items }));
 }, { quote, items });
 await page.route('**/api/v1/catalog/**', route=>route.fulfill({ json:{ data:{ currentFlavor:{ sku:'ice',nameRu:items[0].nameRu,basePrice:95 }, items:[],sprinkles:[],toppings:[] } } }));
 await page.route('**/api/v1/pricing/quote', route=>route.fulfill({ json:{data:quote} }));
 await page.route('https://geocoding-api.open-meteo.com/**', route=>route.fulfill({json:{}}));
 let current=mode, fail=false, requests=0;
 await page.route('**/api/v1/payments/terminal/**', route=>{
  if (route.request().method()==='POST') {
   requests++; assert.equal(route.request().postDataJSON().quote_id,quote.id);
   assert.equal(route.request().headers()['idempotency-key'],`terminal:TEST-MACHINE-001:${quote.id}`);
   if(current==='unknown') return route.abort('failed');
   if(current==='unavailable') return route.fulfill({status:503,json:{error:{code:'PAYMENT_CHECKOUT_NOT_AVAILABLE'}}});
  } else if(fail) return route.abort('failed');
  return route.fulfill({json:{data:{id:'payment-browser',attributes:{fulfillment_state:current==='complete'?'COMPLETED':current==='attention'?'ATTENTION_REQUIRED':'WAITING',order_id:'order-browser',machine_id:'TEST-MACHINE-001',amount:'165.00',currency:'RUB',confirmation_url:'https://qr.nspk.ru/TEST-NOT-A-REAL-PAYMENT',status:['success','complete','attention'].includes(current)?'SUCCEEDED':current==='error'?'CANCELED':'PENDING',user_state:['success','complete','attention'].includes(current)?'SUCCESS':current==='error'?'ERROR':'PENDING'}}}});
 });
 await page.goto('http://127.0.0.1:5173/?mode=terminal&machineId=TEST-MACHINE-001');
 await page.getByTestId(`terminal-payment-${mode}`).waitFor();
 return {page,errors,setMode:v=>{current=v;},failPoll:v=>{fail=v;},requests:()=>requests};
}
try {
 for(const [width,height] of [[1920,1080],[1280,720],[1080,1920],[768,1024],[390,844]]) {
  const {page,errors}=await setup(width,height);
  const qr=page.getByAltText('QR-код для оплаты через СБП'); await qr.waitFor();
  assert.ok((await qr.getAttribute('src')).startsWith('data:image/gif'));
  const layout=await page.evaluate(()=>({overflow:document.documentElement.scrollWidth>innerWidth,qr:document.querySelector('.display-payment-qr img').getBoundingClientRect().toJSON()}));
  assert.equal(layout.overflow,false);
  if(width>=768) assert.ok(layout.qr.y+layout.qr.height<=height,'QR must fit terminal viewport');
  await page.screenshot({path:path.join(output,`${width}x${height}-pending.png`),fullPage:true});
  assert.deepEqual(errors,[]); results.push({viewport:`${width}x${height}`,passed:true}); await page.close();
 }
 const flow=await setup(1920,1080); await flow.page.clock.install();
 await flow.page.clock.fastForward(121000); await flow.page.getByTestId('terminal-payment-pending').waitFor();
 assert.equal(await flow.page.getByRole('button',{name:'Вернуться к заказу'}).count(),0);
 flow.failPoll(true); await flow.page.clock.fastForward(3000);
 await flow.page.getByText('Связь прервалась. Проверяем оплату — повторно платить не нужно.').waitFor();
 flow.failPoll(false); await flow.page.reload(); await flow.page.getByTestId('terminal-payment-pending').waitFor();
 assert.ok(flow.requests()>=2); flow.setMode('success'); await flow.page.clock.fastForward(3000);
 await flow.page.getByTestId('terminal-payment-success').waitFor();
 assert.equal(await flow.page.getByRole('button',{name:'Завершить'}).count(),0);
 assert.equal(await flow.page.getByText('Готовим ваше мороженое').count(),0);
 await flow.page.screenshot({path:path.join(output,'1920x1080-success.png'),fullPage:true});
 flow.setMode('complete'); await flow.page.clock.fastForward(3000);
 await flow.page.getByText('Ваше мороженое готово',{exact:true}).waitFor();
 await flow.page.getByRole('button',{name:'Завершить',exact:true}).click();
 await flow.page.getByTestId('display-idle').waitFor();
 assert.equal(await flow.page.evaluate(()=>sessionStorage.getItem('soft_ice_terminal_checkout:TEST-MACHINE-001')),null);
 assert.deepEqual(flow.errors,[]); await flow.page.close();
 const unknown=await setup(1280,720,'unknown');
 assert.equal(await unknown.page.getByRole('button',{name:'Вернуться к заказу'}).count(),0);
 unknown.setMode('pending'); await unknown.page.getByRole('button',{name:'Проверить оплату'}).click();
 await unknown.page.getByTestId('terminal-payment-pending').waitFor(); await unknown.page.close();
 for(const mode of ['error','unavailable']) {
  const {page,errors}=await setup(1080,1920,mode);
  await page.getByRole('button',{name:'Вернуться к заказу'}).waitFor();
  await page.screenshot({path:path.join(output,`1080x1920-${mode}.png`),fullPage:true});
  assert.deepEqual(errors,[]); await page.close();
 }
 results.push({behavior:'idle suppression, network recovery, same-quote reload/retry, verified success, cancellation, disabled checkout',passed:true});
 await fs.writeFile(path.join(output,'results.json'),JSON.stringify(results,null,2)); console.log(JSON.stringify(results,null,2));
} finally {await browser.close();}
