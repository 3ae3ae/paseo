import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { mkdir, realpath, writeFile } from "node:fs/promises";
import { startIsolatedHostDaemon } from "../../packages/app/e2e/support/helpers/isolated-host-daemon";
import { connectDaemonClient } from "../../packages/app/e2e/support/helpers/daemon-client-loader";
import { createTempGitRepo } from "../../packages/app/e2e/support/helpers/workspace";
import type { DaemonClient } from "../../packages/client/src/daemon-client";

async function main() {
  for (const key of Object.keys(process.env)) if (key.startsWith("PASEO_")) delete process.env[key];
  process.env.E2E_METRO_PORT = "49999";
  const home = path.resolve(".dev/qa8125/probe-home");
  await mkdir(home, { recursive: true });
  const repo = await createTempGitRepo("changes-scope-", { files: [{ path: "project/inside.txt", content: "inside\n" }, { path: "sibling/outside.txt", content: "sibling\n" }] });
  const host = await startIsolatedHostDaemon("srv_scope_probe", { paseoHome: home, preserveHome: true });
  let client: DaemonClient | undefined;
  try {
    client = await connectDaemonClient<DaemonClient>({ clientIdPrefix: "scope-probe", port: host.port });
    const cwd = path.join(repo.path, "project");
    const absolute = path.join(repo.path, "sibling/outside.txt");
    const status = await client.getCheckoutStatus(cwd);
    assert.equal(status.repoRoot, await realpath(repo.path));
    console.log("status.repoRoot resolves current worktree root:", status.repoRoot);
    await assert.rejects(client.readFile(cwd, absolute), /Access outside of workspace is not allowed/);
    const rejectedToken = await client.requestDownloadToken(cwd, absolute);
    assert.equal(rejectedToken.error, "Access outside of workspace is not allowed");
    console.log("cwd=project rejects sibling read/download:", rejectedToken.error);
    const file = await client.readFile(repo.path, absolute);
    assert.equal(new TextDecoder().decode(file.bytes), "sibling\n");
    const token = await client.requestDownloadToken(repo.path, absolute);
    assert.equal(token.error, null);
    assert.equal(token.fileName, "outside.txt");
    assert.equal(typeof token.token, "string");
    console.log("cwd=repoRoot accepts sibling read/download; file content and filename match (token omitted)");
    const observation = await client.subscribeFile({ cwd: "/", path: absolute }, () => {});
    assert.equal(observation.initial.status, "ready");
    await observation.unsubscribe();
    console.log("existing absolute-file preview target cwd=/ accepts sibling observation");
    const linkedRoot = path.join(repo.path, "linked-worktree");
    execFileSync("git", ["worktree", "add", "-b", "linked-fixture", linkedRoot], { cwd: repo.path, stdio: "ignore" });
    await writeFile(path.join(linkedRoot, "project/inside.txt"), "linked worktree content\n");
    const linkedStatus = await client.getCheckoutStatus(path.join(linkedRoot, "project"));
    assert.equal(linkedStatus.repoRoot, await realpath(linkedRoot));
    assert.equal(linkedStatus.mainRepoRoot, await realpath(repo.path));
    const linkedFile = await client.readFile(linkedStatus.repoRoot!, path.join(linkedRoot, "project/inside.txt"));
    assert.equal(new TextDecoder().decode(linkedFile.bytes), "linked worktree content\n");
    const mainFile = await client.readFile(repo.path, "project/inside.txt");
    assert.equal(new TextDecoder().decode(mainFile.bytes), "inside\n");
    console.log("linked worktree status.repoRoot differs from mainRepoRoot; repoRoot reads linked contents, main root reads original contents");
  } finally {
    await client?.close();
    await host.close();
    await repo.cleanup();
  }
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
