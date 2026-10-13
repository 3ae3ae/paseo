import net from 'node:net';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';

const root = process.cwd();
const require = createRequire(path.join(root, 'packages/app/package.json'));
const server = net.createServer();
await new Promise((resolve) => server.listen(Number(process.argv[2] ?? 0), '127.0.0.1', resolve));
const port = server.address().port;
await new Promise((resolve) => server.close(resolve));
const forwarder = JSON.parse(fs.readFileSync('/tmp/qa-6028/forwarder.json', 'utf8'));
const env = { ...process.env, CI: '1', BROWSER: 'none', EXPO_NO_TELEMETRY: '1',
  EXPO_PUBLIC_LOCAL_DAEMON: `localhost:${forwarder.port}`, PASEO_HOME: '/tmp/qa-6028/home' };
delete env.PASEO_WEB_PLATFORM;
const args = [require.resolve('expo/bin/cli'), 'start', '--web', '--port', String(port)];
const child = spawn(process.execPath, args, { cwd: path.join(root, 'packages/app'), env,
  stdio: ['ignore', 'inherit', 'inherit'], detached: true });
const meta = { wrapperPid: process.pid, pid: child.pid, port, forwarderPort: forwarder.port, daemonPort: forwarder.targetPort };
fs.writeFileSync('/tmp/qa-6028/metro.json', JSON.stringify(meta, null, 2));
console.log(JSON.stringify({ event: 'metro-spawn', ...meta, command: [process.execPath, ...args] }));
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => process.kill(-child.pid, signal));
child.on('exit', (code) => process.exit(code ?? 0));
