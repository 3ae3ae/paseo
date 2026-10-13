import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { chromium, expect } from '@playwright/test';

const phase = process.argv[2];
assert(['before', 'after'].includes(phase));
const root = process.cwd();
const evidence = '/tmp/qa-6028/staged';
const scratch = '/tmp/qa-6028';
const metro = JSON.parse(await fs.readFile(`${scratch}/metro.json`, 'utf8'));
const forwarder = JSON.parse(await fs.readFile(`${scratch}/forwarder.json`, 'utf8'));
const sensitiveNames = JSON.parse(await fs.readFile(`${scratch}/private-host-names.json`, 'utf8'));
const meta = JSON.parse(await fs.readFile(`${scratch}/meta.json`, 'utf8'));
const run = promisify(execFile);
const events = [];
const log = (event, details = {}) => {
  const record = { at: new Date().toISOString(), event, ...details };
  events.push(record);
  console.log(JSON.stringify(record));
};
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const context = await browser.newContext({ storageState: `${scratch}/neutral-browser-state.json`, locale: 'en-US', viewport: { width: 1360, height: 900 },
  recordVideo: { dir: `${scratch}/videos-${phase}`, size: { width: 1360, height: 900 } } });
const page = await context.newPage();
const video = page.video();
const sockets = [];
let documentLoads = 0;
let cutAt = null;
let recoveryMs = null;
let createdWorkspace = null;
let outcome = 'setup';

page.on('console', (message) => log('console', { level: message.type(), text: message.text() }));
page.on('pageerror', (error) => log('pageerror', { message: error.message }));
page.on('request', (request) => {
  if (request.resourceType() === 'document') { documentLoads += 1; log('document-load', { url: request.url() }); }
});
page.on('websocket', (socket) => {
  const state = { url: socket.url(), openedAt: Date.now(), closed: false, pongs: 0 };
  sockets.push(state);
  log('websocket-created', { url: state.url });
  socket.on('close', () => { state.closed = true; log('websocket-closed', { url: state.url }); });
  socket.on('socketerror', (message) => log('websocket-error', { url: state.url, message }));
  socket.on('framereceived', ({ payload }) => {
    if (typeof payload !== 'string') return;
    try {
      const message = JSON.parse(payload);
      const type = message.type;
      if (type === 'pong') { state.pongs += 1; log('pong', { url: state.url, count: state.pongs }); }
      if (type === 'server_info' || type === 'session') log('websocket-message', { url: state.url, type, sessionType: message.message?.type });
    } catch {}
  });
});

async function assertNeutralUi() {
  const body = await page.locator('body').innerText();
  for (const name of sensitiveNames) assert(!body.includes(name), 'Private host name appeared in UI');
  assert(!body.includes('#offer='), 'Pairing offer appeared in UI');
}

async function snapshot(label) {
  await assertNeutralUi();
  const identity = page.getByTestId('host-page-identity');
  const state = { label, elapsedMs: cutAt === null ? null : Date.now() - cutAt, url: page.url(),
    identity: await identity.innerText(), documentLoads };
  log('ui-state', state);
  return state;
}

try {
  log('browser-start', { phase, version: browser.version(), channel: 'chrome', metro, forwarder });
  await page.route(/:(6767)\b/, (route) => route.abort());
  await page.routeWebSocket(/:(6767)\b/, (socket) => socket.close({ code: 1008, reason: 'Protected production daemon' }));
  await page.goto(`http://127.0.0.1:${metro.port}`);
  await expect(page.getByTestId('sidebar-settings')).toBeVisible({ timeout: 45000 });
  await expect(page.getByText('QA 6028 initial workspace', { exact: true })).toBeVisible();
  await page.getByTestId('sidebar-settings').click();
  await page.getByTestId('settings-host-section-host').click();
  await expect(page.getByTestId('host-page-identity')).toContainText('Online');
  await expect(page.getByTestId('host-page-identity')).toContainText(`localhost:${forwarder.port}`);
  await snapshot('direct-online-at-recording-start');

  const registry = await page.evaluate(() => JSON.parse(localStorage.getItem('@paseo:daemon-registry')));
  assert.equal(registry.length, 1);
  assert.equal(registry[0].label, 'QA host');
  assert.equal(registry[0].serverId, meta.serverId);
  assert.deepEqual(registry[0].connections.map(({ type }) => type), ['directTcp', 'relay']);
  log('saved-profile', { label: 'QA host', connections: registry[0].connections.map(({ id, type }) => ({ id, type })) });

  await page.getByTestId('settings-host-section-connections').click();
  await expect(page.getByTestId('host-page-connections-card')).toContainText(meta.relay);
  await page.waitForTimeout(22000);
  log('probes-before-cut', { text: await page.getByTestId('host-page-connections-card').innerText() });
  assert(sockets.some((socket) => socket.url.includes(`:${forwarder.port}/ws`) && !socket.closed && socket.pongs > 0));
  await page.getByTestId('settings-host-section-host').click();
  await expect(page.getByTestId('host-page-identity')).toContainText('Online');
  await expect(page.getByTestId('host-page-identity')).toContainText(`localhost:${forwarder.port}`);
  await snapshot('direct-online-immediately-before-cut');
  await page.screenshot({ path: `${evidence}/${phase}-direct-online.png` });

  cutAt = Date.now();
  log('kill-forwarder', { pid: forwarder.pid });
  process.kill(forwarder.pid, 'SIGTERM');
  await page.waitForTimeout(2000);
  const args = ['packages/cli/dist/index.js', 'workspace', 'create', '--isolation', 'local', '--path', `${scratch}/project`,
    '--title', `QA 6028 created during ${phase} outage`, '--home', `${scratch}/home`, '--json'];
  log('command', { command: [process.execPath, ...args], cwd: root, env: { PASEO_HOME: `${scratch}/home` } });
  const result = await run(process.execPath, args, { cwd: root, env: { ...process.env, PASEO_HOME: `${scratch}/home` } });
  createdWorkspace = JSON.parse(result.stdout);
  await fs.writeFile(`${evidence}/${phase}-created-workspace.json`, result.stdout);
  log('workspace-created-during-outage', { elapsedMs: Date.now() - cutAt, ...createdWorkspace });
  let lastIdentity = '';
  while (Date.now() - cutAt < 60000) {
    await assertNeutralUi();
    const identity = await page.getByTestId('host-page-identity').innerText();
    if (identity !== lastIdentity) { await snapshot('connection-transition'); lastIdentity = identity; }
    if (recoveryMs === null && identity.includes('Online') && identity.includes('Relay')) recoveryMs = Date.now() - cutAt;
    await page.waitForTimeout(500);
  }
  const final = await snapshot('after-60-seconds');
  if (phase === 'before') {
    assert(!final.identity.includes('Online'));
    assert(final.identity.includes(`localhost:${forwarder.port}`));
    assert.equal(recoveryMs, null);
    outcome = 'stuck-on-direct';
  } else {
    assert(final.identity.includes('Online'));
    assert(final.identity.includes('Relay'));
    assert.notEqual(recoveryMs, null);
    outcome = 'recovered-over-relay';
  }
  await page.screenshot({ path: `${evidence}/${phase}-${phase === 'before' ? 'stuck' : 'recovered'}.png` });
  await page.getByTestId('settings-host-section-connections').click();
  log('probes-after-cut', { elapsedMs: Date.now() - cutAt, text: await page.getByTestId('host-page-connections-card').innerText() });
  await page.screenshot({ path: `${evidence}/${phase}-connection-probes.png` });
  await page.getByTestId('settings-back-to-workspace').click();
  const newRow = page.getByTestId(`sidebar-workspace-row-${meta.serverId}:${createdWorkspace.workspaceId}`);
  if (phase === 'after') await expect(newRow).toBeVisible({ timeout: 10000 });
  const freshWorkspaceLoaded = await newRow.count() === 1 && await newRow.isVisible();
  assert.equal(freshWorkspaceLoaded, phase === 'after');
  log('workspace-ui', { freshWorkspaceLoaded, body: await page.locator('body').innerText() });
  await assertNeutralUi();
  await page.screenshot({ path: `${evidence}/${phase}-workspaces.png` });
  assert.equal(documentLoads, 1);
  log('result', { phase, outcome, recoveryMs, observationMs: final.elapsedMs, freshWorkspaceLoaded, documentLoads });
} catch (error) {
  log('failure', { message: error.message, stack: error.stack, body: await page.locator('body').innerText() });
  await page.screenshot({ path: `${evidence}/${phase}-failure.png` }).catch(() => {});
  process.exitCode = 1;
} finally {
  await fs.writeFile(`${evidence}/${phase}-events.json`, JSON.stringify(events, null, 2));
  await context.close();
  await video.saveAs(`${evidence}/${phase}.webm`);
  await browser.close();
}
