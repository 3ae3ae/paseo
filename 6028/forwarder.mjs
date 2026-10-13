import net from 'node:net';
import fs from 'node:fs';

const targetPort = Number(process.argv[2]);
const listenPort = Number(process.argv[3] ?? 0);
if (!Number.isInteger(targetPort) || targetPort < 1 || targetPort > 65535) {
  throw new Error('Expected the isolated daemon TCP port');
}
const sockets = new Set();
const server = net.createServer((incoming) => {
  const outgoing = net.connect(targetPort, '127.0.0.1');
  for (const socket of [incoming, outgoing]) {
    sockets.add(socket);
    socket.on('close', () => sockets.delete(socket));
    socket.on('error', () => { incoming.destroy(); outgoing.destroy(); });
  }
  incoming.on('close', () => outgoing.destroy());
  outgoing.on('close', () => incoming.destroy());
  incoming.pipe(outgoing);
  outgoing.pipe(incoming);
});
server.listen(listenPort, '127.0.0.1', () => {
  const info = { pid: process.pid, port: server.address().port, targetPort };
  fs.writeFileSync('/tmp/qa-6028/forwarder.json', JSON.stringify(info));
  console.log(JSON.stringify({ at: new Date().toISOString(), event: 'listening', ...info }));
});
for (const signal of ['SIGTERM', 'SIGINT']) {
  process.on(signal, () => {
    console.log(JSON.stringify({ at: new Date().toISOString(), event: 'direct-cut', sockets: sockets.size }));
    for (const socket of sockets) socket.destroy();
    server.close(() => process.exit(0));
  });
}
