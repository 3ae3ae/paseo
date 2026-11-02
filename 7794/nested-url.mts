import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { createServer } from "node:http";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { acquireNpm } from "/Users/3ae/Github/paseo-worktrees/7794/packages/server/src/server/plugins/managed-source/npm.ts";

const exec = promisify(execFile);
const root = await mkdtemp(path.join(tmpdir(), "paseo-7794-nested-"));
await writeFile(path.join(root, "user.npmrc"), "");
await writeFile(path.join(root, "global.npmrc"), "");
Object.assign(process.env, {
  npm_config_userconfig: path.join(root, "user.npmrc"),
  npm_config_globalconfig: path.join(root, "global.npmrc"),
  npm_config_cache: path.join(root, "cache"),
});
console.log("node:", process.version, "npm:", (await exec("npm", ["--version"])).stdout.trim());
const artifacts = new Map<string, Buffer>();
const requests: string[] = [];
const server = createServer((request, response) => {
  const url = request.url ?? "";
  requests.push(url);
  const artifact = artifacts.get(url);
  response.writeHead(artifact ? 200 : 404, { "content-type": "application/octet-stream" });
  response.end(artifact);
});
await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
const address = server.address();
assert(address && typeof address !== "string");
const url = `http://127.0.0.1:${address.port}`;
try {
  for (const name of ["paseo-nested-url-child", "paseo-nested-url-parent"]) {
    const directory = path.join(root, name);
    await mkdir(directory);
    const manifest = {
      name,
      version: "1.0.0",
      ...(name.endsWith("parent") ? { dependencies: { "paseo-nested-url-child": `${url}/child.tgz` } } : {}),
    };
    await writeFile(path.join(directory, "package.json"), JSON.stringify(manifest));
    const packed = await exec("npm", ["pack", "--ignore-scripts", directory], { cwd: root });
    const artifact = await readFile(path.join(root, packed.stdout.trim()));
    artifacts.set(name.endsWith("parent") ? "/parent.tgz" : "/child.tgz", artifact);
  }
  const parent = artifacts.get("/parent.tgz");
  assert(parent);
  const target = {
    version: "1.0.0",
    resolved: `${url}/parent.tgz`,
    integrity: `sha512-${createHash("sha512").update(parent).digest("base64")}`,
  };
  const installation = path.join(root, "installation");
  await mkdir(installation);
  await assert.rejects(
    acquireNpm("npm:paseo-nested-url-parent@1.0.0", installation, target),
    (error) => {
      console.log(String(error));
      assert.match(String(error), /EALLOWREMOTE/);
      assert.match(String(error), /non-root packages of type "remote"/);
      assert.match(String(error), /paseo-nested-url-child@http/);
      return true;
    },
  );
  assert(requests.includes("/parent.tgz"));
  assert(!requests.includes("/child.tgz"));
  console.log("PASS: real acquireNpm fetched the reviewed root URL and refused its nested URL before fetching it");
  console.log("requests with --allow-remote=root:", [...requests]);

  const control = path.join(root, "allow-all-control");
  await mkdir(control);
  await writeFile(path.join(control, "package.json"), JSON.stringify({
    name: "fixture-control", version: "1.0.0", private: true,
    dependencies: { "paseo-nested-url-parent": target.resolved },
  }));
  const installed = await exec("npm", ["install", "--ignore-scripts", "--allow-remote=all", "--no-audit", "--no-fund"], { cwd: control });
  console.log("allow-all control stdout:", installed.stdout);
  console.log("allow-all control stderr:", installed.stderr);
  assert(requests.includes("/child.tgz"));
  const child = JSON.parse(await readFile(path.join(control, "node_modules/paseo-nested-url-child/package.json"), "utf8"));
  assert.equal(child.name, "paseo-nested-url-child");
  assert.equal(child.version, "1.0.0");
  console.log("PASS: the identical nested URL installs with allow-remote=all; no fixture code was loaded");
} finally {
  server.closeAllConnections();
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await rm(root, { recursive: true, force: true });
}
