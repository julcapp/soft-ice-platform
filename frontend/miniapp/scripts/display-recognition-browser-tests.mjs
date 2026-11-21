import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE_URL || 'playwright');
const browser = await chromium.launch({ headless: true, ...(process.env.CHROMIUM_EXECUTABLE ? { executablePath: process.env.CHROMIUM_EXECUTABLE } : {}) });
const output = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../.tmp/issue-24-acceptance');
await fs.mkdir(output, { recursive: true });
const results = process.env.BEHAVIOR_ONLY ? JSON.parse(await fs.readFile(path.join(output, 'results.json'), 'utf8')).filter(result => result.viewport) : [];
async function open(page, mode = 'normal') {
  await page.goto(`http://127.0.0.1:4180/?mode=terminal&machineId=recognition-${mode}`);
  await page.getByTestId('display-idle').click(); await page.locator('.display-club').click();
  await page.getByLabel('Номер телефона').waitFor();
}
async function enter(page, phone = '9130000002') { for (const digit of phone) await page.locator('.display-keys').getByRole('button', { name: digit, exact: true }).click(); }
const submit = page => page.getByRole('button', { name: 'Продолжить', exact: true }).click();
async function skip(page) { await page.getByRole('button', { name: 'Продолжить без скидки', exact: true }).click(); await page.getByTestId('display-screen-choice').waitFor(); }
try {
  for (const [width, height] of (process.env.BEHAVIOR_ONLY ? [] : [[1920,1080],[1280,720],[1080,1920],[768,1024]])) {
    const page = await browser.newPage({ viewport: { width, height } }); const errors = [], warnings = [];
    page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); if (m.type() === 'warning') warnings.push(m.text()); });
    const prefix = `${width}x${height}`;
    async function capture(name) {
      const layout = await page.evaluate(() => ({ overflow: Math.max(0, document.documentElement.scrollWidth - innerWidth), buttons: [...document.querySelectorAll('button')].filter(b => b.getBoundingClientRect().width).map(b => ({ text: b.textContent, width: b.getBoundingClientRect().width, height: b.getBoundingClientRect().height })) }));
      assert.equal(layout.overflow, 0, `${prefix}/${name} overflow`);
      assert.ok(layout.buttons.every(b => b.height >= 72 && b.width >= 72), `${prefix}/${name} touch targets: ${JSON.stringify(layout.buttons)}`);
      await page.screenshot({ path: path.join(output, `${prefix}-${name}.png`), fullPage: true });
      results.push({ viewport: prefix, state: name, horizontalOverflow: layout.overflow, minTouchHeight: Math.min(...layout.buttons.map(b => b.height)) });
    }
    await open(page); await enter(page, '9130000001'); assert.equal(await page.getByLabel('Номер телефона').textContent(), '+7 (913) 000-00-01'); await capture('01-phone');
    const skipBounds = await page.getByRole('button', { name: 'Продолжить без скидки', exact: true }).boundingBox(); assert.ok(skipBounds.y + skipBounds.height <= height, 'Phone skip CTA must fit viewport');
    await submit(page); await page.getByTestId('recognition-loading').waitFor(); await capture('02-loading');
    await page.getByRole('heading', { name: 'С возвращением', exact: true }).waitFor(); await capture('03-returning');
    await skip(page); await capture('06-without-discount');
    await open(page); await enter(page); await submit(page); await page.getByTestId('recognition-new').waitFor(); await capture('04-new'); await skip(page);
    await open(page, 'provider'); await enter(page); await submit(page); await page.getByTestId('verification-unavailable').waitFor(); await capture('05-provider-unavailable'); await skip(page);
    await open(page, 'unavailable'); await enter(page, '9130000001'); await submit(page); await page.getByTestId('recognition-unavailable').waitFor(); await capture('07-unavailable'); await skip(page);
    assert.deepEqual(errors, []); assert.deepEqual(warnings, []); results.push({ viewport: prefix, consoleErrors: errors.length, consoleWarnings: warnings.length }); await page.close();
  }
  const page = await browser.newPage(); await page.clock.install();
  await open(page); await enter(page); await page.clock.fastForward(120001); await page.getByTestId('display-idle').waitFor();
  async function reopenEmpty() { await page.getByTestId('display-idle').click(); await page.locator('.display-club').click(); assert.equal(await page.getByLabel('Номер телефона').textContent(), '+7 (___) ___-__-__'); assert.equal(await page.locator('[data-testid^="recognition-"]').count(), 0); }
  await reopenEmpty(); await enter(page); await submit(page); await page.getByTestId('recognition-new').waitFor(); await page.clock.fastForward(120001); await page.getByTestId('display-idle').waitFor(); await reopenEmpty();
  let release, responseReady; const heldResponse = new Promise(resolve => { responseReady = resolve; }); await page.route('**/auth/display-phone/recognition', async route => { const response = await route.fetch(); await new Promise(r => { release = r; responseReady(); }); await route.fulfill({ response }).catch(() => {}); });
  await enter(page); await submit(page); await page.getByTestId('recognition-loading').waitFor(); await heldResponse; await skip(page); await page.clock.fastForward(120001); await page.getByTestId('display-idle').waitFor();
  release(); await reopenEmpty();
  results.push({ behavior: 'keypad, skip in all states, idle phone/challenge reset, late response cancellation', passed: true }); await page.close();
  await fs.writeFile(path.join(output, 'results.json'), JSON.stringify(results, null, 2)); console.log(JSON.stringify(results, null, 2));
} finally { await browser.close(); }
