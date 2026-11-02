import { createRequire } from 'node:module';
import http from 'node:http';
import assert from 'node:assert/strict';
const require = createRequire('<worktree>/package.json');
const { chromium } = require('playwright');
const { withPreviewCsp } = await import('<worktree>/packages/app/src/file-panels/html-preview-csp.ts');
const html = withPreviewCsp(`<a href="#section">Jump to section</a><div style="height:1200px"></div><h2 id="section">Target section</h2><div style="height:600px"></div><style>:target {color:rgb(255,0,0)}</style><script>window.addEventListener('hashchange', () => document.body.dataset.hashchange = location.hash);</script>`);
const server = http.createServer((req,res) => res.end(`<iframe sandbox="allow-scripts" style="height:400px" srcdoc="${html.replaceAll('&','&amp;').replaceAll('"','&quot;')}"></iframe>`));
await new Promise(resolve => server.listen(0,'127.0.0.1',resolve));
const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  await page.goto(`http://127.0.0.1:${server.address().port}/preview`);
  const frame = page.frames()[1];
  console.log('Chromium',browser.version());
  console.log('before',await frame.evaluate(() => ({url:location.href,base:document.baseURI,href:document.querySelector('a').href})));
  await frame.locator('a').evaluate(a => a.addEventListener('click', event => { event.preventDefault(); location.hash = a.getAttribute('href'); }));
  await frame.locator('a').click();
  await frame.waitForFunction(() => document.body.dataset.hashchange === '#section');
  const actual = await frame.evaluate(() => ({url:location.href,hashchange:document.body.dataset.hashchange,scrollY,top:document.getElementById('section').getBoundingClientRect().top,color:getComputedStyle(document.getElementById('section')).color}));
  console.log('after',actual);
  assert.equal(actual.url,'about:srcdoc#section');
  assert.ok(actual.scrollY > 1000);
  assert.equal(actual.color,'rgb(255, 0, 0)');
  console.log('PASS: location.hash preserves srcdoc, scrolling, :target and hashchange');
} finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
