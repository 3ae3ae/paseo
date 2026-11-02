import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { acquireNpm } from "/Users/3ae/Github/paseo-worktrees/7794/packages/server/src/server/plugins/managed-source/npm.ts";

const evidence = "/Users/3ae/Github/paseo-qa/7794";
const [label, expected] = process.argv.slice(2);
assert(label && ["success", "refused"].includes(expected));
const root = await mkdtemp(path.join(tmpdir(), "paseo-7794-real-"));
await writeFile(path.join(root, "user.npmrc"), "");
await writeFile(path.join(root, "global.npmrc"), "");
Object.assign(process.env, {
  npm_config_userconfig: path.join(root, "user.npmrc"),
  npm_config_globalconfig: path.join(root, "global.npmrc"),
  npm_config_cache: path.join(root, "cache"),
  npm_config_registry: "https://registry.npmjs.org/",
  npm_config_loglevel: "verbose",
});
console.log("label:", label, "node:", process.version);
console.log("npm:", execFileSync("npm", ["--version"], { encoding: "utf8" }).trim());
const response = await fetch("https://registry.npmjs.org/paseo-cafe/1.1.0");
assert.equal(response.status, 200);
const metadata = await response.json();
assert.equal(metadata.name, "paseo-cafe");
assert.equal(metadata.version, "1.1.0");
const target = {
  version: metadata.version,
  resolved: metadata.dist.tarball,
  integrity: metadata.dist.integrity,
};
assert.equal(typeof target.resolved, "string");
assert.equal(typeof target.integrity, "string");
await writeFile(path.join(evidence, `${label}-registry-pin.json`), JSON.stringify(target, null, 2) + "\n");
console.log("registry target:", target);
const installRoot = path.join(root, "installation");
await mkdir(installRoot);
try {
  if (expected === "refused") {
    await assert.rejects(
      acquireNpm("npm:paseo-cafe@1.1.0", installRoot, target),
      (error) => {
        console.log(String(error));
        assert.match(String(error), /EALLOWREMOTE/);
        return true;
      },
    );
    console.log("PASS: old acquireNpm refused the reviewed root URL with EALLOWREMOTE");
  } else {
    const installed = await acquireNpm("npm:paseo-cafe@1.1.0", installRoot, target);
    assert.deepEqual(installed, { packageName: "paseo-cafe", ...target });
    const staged = JSON.parse(await readFile(path.join(installRoot, "package.json"), "utf8"));
    assert.deepEqual(staged.dependencies, { "paseo-cafe": target.resolved });
    console.log("installed artifact:", installed);
    console.log("PASS: real acquireNpm installed the unchanged reviewed URL and matched version/resolved/integrity");
  }
} finally {
  const logRoot = path.join(root, "cache", "_logs");
  const files = (await readdir(logRoot)).sort();
  const logs = await Promise.all(files.map((file) => readFile(path.join(logRoot, file), "utf8")));
  await writeFile(path.join(evidence, `${label}-npm-debug.txt`), logs.join("\n"));
  console.log("npm warning lines:", logs.flatMap((log) => log.split("\n").filter((line) => /\bwarn\b/i.test(line))));
  await rm(root, { recursive: true, force: true });
}
