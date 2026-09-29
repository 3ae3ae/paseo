import assert from 'node:assert/strict';
import { once } from 'node:events';
import { setTimeout as delay } from 'node:timers/promises';
import pino from 'pino';
import { WebSocketServer } from 'ws';
import { createClientChannel, type Transport } from '@getpaseo/relay/e2ee';
import { generateKeyPair, exportPublicKey } from '@getpaseo/relay';
const modulePath = process.argv[2] === 'before'
  ? '../../../paseo-work/packages/server/src/server/relay-transport.ts'
  : '../packages/server/src/server/relay-transport.ts';
const { startRelayTransport } = await import(modulePath);
const key = generateKeyPair();
const server = new WebSocketServer({ port: 0, host: '127.0.0.1' });
await once(server, 'listening');
const address = server.address();
assert(address && typeof address !== 'string');
let control: import('ws').WebSocket | undefined;
let dataCount = 0;
let firstClosed = false;
let attached = 0;
const received = Promise.withResolvers<string>();
server.on('connection', (socket, request) => {
  const url = new URL(request.url!, 'http://localhost');
  if (!url.searchParams.has('connectionId')) {
    control = socket;
    socket.send(JSON.stringify({ type: 'connected', connectionId: 'same-client' }));
    return;
  }
  dataCount++;
  if (dataCount === 1) {
    socket.once('close', () => { firstClosed = true; });
    console.log('Real data WebSocket open; withholding E2EE hello');
    return;
  }
  const transport: Transport = {
    send: data => socket.send(data), close: (code, reason) => socket.close(code, reason),
    onmessage: null, onclose: null, onerror: null,
  };
  socket.on('message', (data, isBinary) => {
    const bytes = Buffer.concat(Array.isArray(data) ? data : [Buffer.from(data)]);
    transport.onmessage?.({ data: isBinary ? bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) : bytes.toString(), isBinary });
  });
  void createClientChannel(transport, exportPublicKey(key.publicKey)).then(channel => {
    channel.send('encrypted reconnect succeeded');
  });
});
const controller = startRelayTransport({
  logger: pino({ level: 'warn' }), relayEndpoint: `127.0.0.1:${address.port}`,
  relayUseTls: false, serverId: 'qa', daemonKeyPair: key,
  attachSocket: async socket => {
    attached++;
    socket.on('message', data => received.resolve(String(data)));
  },
});
try {
  await delay(15_500);
  console.log(JSON.stringify({ firstClosed, dataCount, attached, controlOpen: control?.readyState === 1 }));
  assert.equal(firstClosed, true, 'stalled E2EE handshake must release its real socket');
  assert(control);
  control.send(JSON.stringify({ type: 'connected', connectionId: 'same-client' }));
  const message = await Promise.race([received.promise, delay(5000).then(() => { throw new Error('reconnect timed out'); })]);
  assert.equal(message, 'encrypted reconnect succeeded');
  assert.equal(attached, 1);
  assert.equal(dataCount, 2);
  console.log('Same-ID reconnect completed encryption and delivered:', message);
} finally {
  await controller.stop();
  for (const client of server.clients) client.terminate();
  await new Promise<void>(resolve => server.close(() => resolve()));
}
