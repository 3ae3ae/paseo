import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { chromium, expect } from '@playwright/test';

const scratch = '/tmp/qa-6028';
const { port } = JSON.parse(await fs.readFile(`${scratch}/metro.json`, 'utf8'));
const pairing = JSON.parse(await fs.readFile(`${scratch}/pairing.json`, 'utf8'));
const meta = JSON.parse(await fs.readFile(`${scratch}/meta.json`, 'utf8'));
const browser = await chromium.launch({ channel: 'chrome', headless: true });
try {
  const context = await browser.newContext({ locale: 'en-US', viewport: { width: 1360, height: 900 } });
  const page = await context.newPage();
  await page.route(/:(6767)\b/, (route) => route.abort());
  await page.routeWebSocket(/:(6767)\b/, (socket) => socket.close({ code: 1008, reason: 'Protected production daemon' }));
  await page.goto(`http://127.0.0.1:${port}`);
  await expect(page.getByTestId('sidebar-settings')).toBeVisible({ timeout: 45000 });
  await page.getByTestId('sidebar-settings').click();
  await page.getByTestId('settings-host-section-host').click();
  await expect(page.getByTestId('host-page-identity')).toContainText('Online');
  await page.getByTestId('host-page-label-edit-button').click();
  await page.getByTestId('host-page-rename-modal-input').fill('QA host');
  await page.getByTestId('host-page-rename-modal-submit').click();
  await expect(page.getByTestId('host-page-rename-modal')).toHaveCount(0);
  await page.getByTestId('settings-host-picker').click();
  await page.getByTestId('settings-add-host').click();
  await page.getByTestId('add-host-method-pair-link').click();
  await page.getByTestId('pair-link-input').fill(pairing.url);
  await page.getByTestId('pair-link-submit').click();
  await expect(page.getByTestId('host-confirmation-server-id')).toHaveText(meta.serverId);
  await expect(page.getByTestId('host-confirmation-relay')).toHaveText(meta.relay);
  await page.getByTestId('host-confirmation-connect').click();
  await expect(page.getByTestId('pair-link-modal')).toHaveCount(0, { timeout: 20000 });
  const registry = await page.evaluate(() => JSON.parse(localStorage.getItem('@paseo:daemon-registry')));
  assert.equal(registry.length, 1);
  assert.equal(registry[0].label, 'QA host');
  assert.equal(registry[0].serverId, meta.serverId);
  assert.deepEqual(registry[0].connections.map(({ type }) => type), ['directTcp', 'relay']);
  await context.storageState({ path: `${scratch}/neutral-browser-state.json` });
  console.log(JSON.stringify({ event: 'normal-ui-setup', label: registry[0].label, connections: registry[0].connections.map(({ type }) => type), recording: false }));
  await context.close();
} finally {
  await browser.close();
}
