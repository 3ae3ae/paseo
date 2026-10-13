import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { warmMetro } from '../../packages/app/e2e/support/metro-warmup.mjs';

const phase = process.argv[2];
assert(['before', 'after'].includes(phase));
const { port } = JSON.parse(await fs.readFile('/tmp/qa-6028/metro.json', 'utf8'));
const origin = `http://127.0.0.1:${port}`;
let ready = false;
for (let attempt = 0; attempt < 80; attempt++) {
  try { ready = (await (await fetch(`${origin}/status`, { signal: AbortSignal.timeout(1000) })).text()) === 'packager-status:running'; } catch {}
  if (ready) break;
  await new Promise((resolve) => setTimeout(resolve, 250));
}
assert(ready, 'Metro did not become ready');
await warmMetro(port);
const html = await (await fetch(origin)).text();
const source = [...html.matchAll(/<script[^>]+src=["']([^"']+)["']/g)][0][1];
const bundle = await (await fetch(new URL(source, origin))).text();
const position = bundle.indexOf('const rttMs = activeClient.getLastLivenessRttMs()');
assert(position >= 0);
const excerpt = bundle.slice(position - 420, position + 160);
const hasFix = excerpt.includes('activeClient.getConnectionState().status !== "connected"');
assert.equal(hasFix, phase === 'after');
await fs.writeFile(`/tmp/qa-6028/staged/served-${phase}-bundle-excerpt.txt`, excerpt);
console.log(JSON.stringify({ event: 'served-bundle-verified', phase, hasFix }));
