import { chromium } from '<worktree>/node_modules/playwright/index.mjs';
import { readFileSync, writeFileSync } from 'node:fs';
const evidence = '<evidence>';
const runtime = JSON.parse(readFileSync('<worktree>/.dev/qa-7225/runtime.json'));
const { phase, metroPort } = runtime;
const run = JSON.parse(readFileSync(`${evidence}/${phase}-run.json`));
const workspaces = JSON.parse(readFileSync(`${evidence}/${phase}-workspaces.json`));
const workspaceId = workspaces[0].workspaceId;
const browser = await chromium.launch({
  headless: true,
  executablePath: '~/Library/Caches/ms-playwright/chromium_headless_shell-1208/chrome-headless-shell-mac-arm64/chrome-headless-shell',
});
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  await page.addInitScript(({ daemonPort }) => {
    const endpoint = `127.0.0.1:${daemonPort}`;
    globalThis.__PASEO_INITIAL_DAEMON_CONNECTION__ = { listen: endpoint };
    const now = new Date().toISOString();
    localStorage.setItem('@paseo:daemon-registry', JSON.stringify([{
      serverId: 'qa-7225', label: 'QA 7225 isolated daemon',
      connections: [{ id: `direct:${endpoint}`, type: 'directTcp', endpoint }],
      preferredConnectionId: `direct:${endpoint}`, createdAt: now, updatedAt: now,
    }]));
  }, runtime);
  await page.goto(`http://localhost:${metroPort}/h/qa-7225/workspace/${workspaceId}?open=agent:${run.agentId}`, { timeout: 120000 });
  await page.getByRole('button', { name: /^Select thinking option/ }).filter({ visible: true }).waitFor({ timeout: 120000 });
  await page.getByRole('button', { name: /^Select thinking option/ }).filter({ visible: true }).click();
  const picker = page.getByTestId('combobox-desktop-container');
  await picker.getByRole('button', { name: 'Medium', exact: true }).waitFor();
  const options = await picker.getByRole('button').allTextContents();
  if (phase === 'before' && options.includes('Default')) throw new Error('Old picker unexpectedly has Default');
  if (phase === 'after' && options[0] !== 'Default') throw new Error('Default must be first');
  await page.screenshot({ path: `${evidence}/${phase}-thinking-picker.png` });
  writeFileSync(`${evidence}/${phase}-picker.txt`, await page.locator('body').innerText());
  console.log(JSON.stringify({ executable: 'Playwright chromium-headless-shell', version: browser.version(), phase, options }));
} finally { await browser.close(); }
