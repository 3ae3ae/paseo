import http from 'node:http';
import net from 'node:net';
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync, appendFileSync, openSync } from 'node:fs';
import path from 'node:path';

const repo = '<worktree>';
const evidence = '<evidence>';
const state = path.join(repo, '.dev/qa-7225');
const phase = process.argv[2] ?? 'before';
for (const dir of ['paseo-home', 'config', 'data', 'cache', 'state', 'project'])
  mkdirSync(path.join(state, dir), { recursive: true });
const children = [];
const env = Object.fromEntries(Object.entries(process.env).filter(([key]) =>
  ['PATH', 'HOME', 'USER', 'SHELL', 'TMPDIR', 'LANG'].includes(key)));
Object.assign(env, {
  XDG_CONFIG_HOME: path.join(state, 'config'),
  XDG_DATA_HOME: path.join(state, 'data'),
  XDG_CACHE_HOME: path.join(state, 'cache'),
  XDG_STATE_HOME: path.join(state, 'state'),
});
async function port() {
  const server = net.createServer();
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const value = server.address().port;
  await new Promise(resolve => server.close(resolve));
  return value;
}
const stub = http.createServer(async (req, res) => {
  let raw = '';
  for await (const chunk of req) raw += chunk;
  if (req.method !== 'POST') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ object: 'list', data: [{ id: 'qa-model', object: 'model' }] }));
    return;
  }
  const body = JSON.parse(raw);
  appendFileSync(path.join(evidence, `${phase}-requests.jsonl`), JSON.stringify({ path: req.url, body }) + '\n');
  const common = { id: 'chatcmpl-qa', object: 'chat.completion.chunk', created: 1, model: 'qa-model' };
  res.writeHead(200, { 'Content-Type': 'text/event-stream' });
  for (const chunk of [
    { ...common, choices: [{ index: 0, delta: { role: 'assistant', content: 'Local stub response.' }, finish_reason: null }] },
    { ...common, choices: [{ index: 0, delta: {}, finish_reason: 'stop' }], usage: { prompt_tokens: 10, completion_tokens: 4, total_tokens: 14 } },
  ]) res.write(`data: ${JSON.stringify(chunk)}\n\n`);
  res.end('data: [DONE]\n\n');
});
await new Promise(resolve => stub.listen(0, '127.0.0.1', resolve));
const stubPort = stub.address().port;
const daemonPort = await port();
const metroPort = await port();
const opencode = path.join(evidence, 'tools/node_modules/.bin/opencode');
const config = {
  model: 'qa/qa-model',
  providers: {
    qa: {
      name: 'QA local stub', package: '@ai-sdk/openai-compatible',
      settings: { baseURL: `http://127.0.0.1:${stubPort}/v1` },
      models: {
        'qa-model': {
          name: 'QA model', capabilities: { tools: true, input: ['text'], output: ['text'] },
          variants: [
            { id: 'low', body: { reasoning_effort: 'low' } },
            { id: 'medium', body: { reasoning_effort: 'medium' } },
          ],
        },
      },
    },
  },
};
writeFileSync(path.join(evidence, 'opencode-config.json'), JSON.stringify(config, null, 2));
const providerEnv = { ...env,
  OPENCODE_CONFIG_CONTENT: JSON.stringify(config),
  OPENCODE_CONFIG_DIR: path.join(state, 'config/opencode'),
  OPENCODE_DISABLE_PROJECT_CONFIG: '1', OPENCODE_DISABLE_FREE_MODELS: '1',
};
delete providerEnv.PATH;
delete providerEnv.HOME;
delete providerEnv.USER;
delete providerEnv.SHELL;
delete providerEnv.TMPDIR;
delete providerEnv.LANG;
const providers = Object.fromEntries(['claude', 'codex', 'copilot', 'pi', 'omp', 'antigravity', 'muse', 'cursor'].map(id => [id, { enabled: false }]));
providers.opencode = { enabled: true, command: [opencode], env: providerEnv };
writeFileSync(path.join(state, 'paseo-home/config.json'), JSON.stringify({
  version: 1, pluginsEnabled: false,
  agents: { providers, metadataGeneration: { providers: [] } },
}));
function start(command, args, cwd, overrides, name) {
  const log = openSync(path.join(evidence, `${phase}-${name}.log`), 'a');
  const child = spawn(command, args, { cwd, env: { ...env, ...overrides }, stdio: ['ignore', log, log], detached: true });
  children.push(child);
  return child;
}
start(process.execPath, ['dist/scripts/supervisor-entrypoint.js'], path.join(repo, 'packages/server'), {
  PASEO_HOME: path.join(state, 'paseo-home'), PASEO_SERVER_ID: 'qa-7225',
  PASEO_LISTEN: `127.0.0.1:${daemonPort}`, PASEO_RELAY_ENABLED: '0',
  PASEO_CORS_ORIGINS: `http://localhost:${metroPort}`, PASEO_MCP_ENABLED: '0',
  PASEO_DICTATION_ENABLED: '0', PASEO_VOICE_MODE_ENABLED: '0',
  PASEO_DICTATION_STT_PROVIDER: 'openai', PASEO_VOICE_TURN_DETECTION_PROVIDER: 'openai',
  PASEO_VOICE_STT_PROVIDER: 'openai', PASEO_VOICE_TTS_PROVIDER: 'openai',
}, 'daemon');
start(process.execPath, [path.join(repo, 'node_modules/expo/bin/cli'), 'start', '--port', String(metroPort)], path.join(repo, 'packages/app'), {
  BROWSER: 'none', EXPO_UNSTABLE_HEADLESS: '1', CI: '1',
}, 'metro');
writeFileSync(path.join(state, 'runtime.json'), JSON.stringify({ phase, daemonPort, metroPort, stubPort, project: path.join(state, 'project') }));
console.log(JSON.stringify({ phase, daemonPort, metroPort, stubPort }));
async function cleanup() {
  for (const child of children.reverse()) {
    try { process.kill(-child.pid, 'SIGTERM'); } catch {}
  }
  stub.close();
  setTimeout(() => {
    for (const child of children) { try { process.kill(-child.pid, 'SIGKILL'); } catch {} }
    process.exit(0);
  }, 3000);
}
process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);
