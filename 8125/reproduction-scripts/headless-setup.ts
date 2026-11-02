import { spawn } from "node:child_process";
import { createWriteStream } from "node:fs";
import net from "node:net";
import path from "node:path";
import { waitForMetro } from "../../packages/app/e2e/support/global-setup";
import { warmMetro } from "../../packages/app/e2e/support/metro-warmup.mjs";
import { killProcessTree } from "../../packages/app/e2e/support/helpers/spawn-node";

export default async function setup() {
  const port = await new Promise<number>((resolve, reject) => {
    const socket = net.createServer();
    socket.on("error", reject);
    socket.listen(0, "127.0.0.1", () => {
      const address = socket.address();
      if (!address || typeof address === "string") return reject(new Error("No port"));
      socket.close(() => resolve(address.port));
    });
  });
  const child = spawn(process.execPath, [require.resolve("expo/bin/cli"), "start", "--port", String(port)], {
    cwd: path.resolve(__dirname, "../../packages/app"),
    env: { ...process.env, BROWSER: "none", CI: "1", EXPO_UNSTABLE_HEADLESS: "1" },
    stdio: ["ignore", "pipe", "pipe"],
  });
  const log = createWriteStream(path.resolve(__dirname, "metro.log"));
  child.stdout.pipe(log);
  child.stderr.pipe(log);
  try {
    await waitForMetro(port, { label: "Headless-only Metro", timeoutMs: 120_000, childProcess: child });
    await warmMetro(port);
    process.env.E2E_METRO_PORT = String(port);
    console.log(`Metro PID ${child.pid}, port ${port}; Expo start without --web`);
    return async () => { await killProcessTree(child); log.end(); console.log("Metro stopped"); };
  } catch (error) { await killProcessTree(child); log.end(); throw error; }
}
