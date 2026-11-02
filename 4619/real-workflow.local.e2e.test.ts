import { test, expect } from "vitest";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { appendFileSync } from "node:fs";
import pino from "pino";
import { createPaseoDaemon } from "../../../server/src/server/bootstrap.js";
import { DaemonClient } from "../../../server/src/server/test-utils/daemon-client.js";
import { BuiltinPluginLoader } from "../../../server/src/server/plugins/builtin/index.js";
import { AgentDirectoryReplica } from "@/runtime/directory-sync/agent-replica";
import { useSessionStore } from "@/stores/session-store";
import { buildAgentDirectoryState } from "./agent-directory-sync";

function record(observation: unknown): void {
  const phase = process.env.ISSUE4619_PHASE ?? "after";
  appendFileSync(
    `<evidence>/real-workflow-${phase}.jsonl`,
    JSON.stringify(observation) + "\n",
  );
}

test("real daemon placement and timeline-first catch-up", async () => {
  const devRoot = path.resolve(__dirname, "../../../../.dev");
  await mkdir(devRoot, { recursive: true });
  const root = await mkdtemp(path.join(devRoot, "issue4619-"));
  const paseoHome = path.join(root, ".paseo");
  const staticDir = path.join(root, "static");
  await mkdir(paseoHome);
  await mkdir(staticDir);
  const daemon = await createPaseoDaemon(
    {
      listen: "127.0.0.1:0",
      paseoHome,
      corsAllowedOrigins: [],
      hostnames: true,
      mcpEnabled: false,
      staticDir,
      mcpDebug: false,
      agentClients: {},
      agentStoragePath: path.join(paseoHome, "agents"),
      relayEnabled: false,
      relayEndpoint: "relay.paseo.sh:443",
      appBaseUrl: "https://app.paseo.sh",
      pluginsEnabled: false,
    },
    pino({ level: "silent" }),
    { builtinPlugins: new BuiltinPluginLoader(undefined, []) },
  );
  let client: DaemonClient | undefined;
  const serverId = "issue4619-real-daemon";
  try {
    await daemon.start();
    const target = daemon.getListenTarget();
    if (target?.type !== "tcp") throw new Error("Missing isolated TCP listener");
    client = new DaemonClient({
      url: `ws://127.0.0.1:${target.port}/ws`,
      appVersion: "0.15.0-beta.1",
    });
    await client.connect();
    await client.fetchAgents({ subscribe: {} });
    record({ daemonVersion: client.getLastServerInfoMessage()?.version, port: target.port });

    const agents = [];
    for (const suffix of ["a", "b"]) {
      const repo = path.join(root, `repo-${suffix}`);
      await mkdir(repo);
      execFileSync("git", ["init", "-b", "main"], { cwd: repo, stdio: "pipe" });
      execFileSync(
        "git",
        [
          "-c",
          "user.name=Paseo QA",
          "-c",
          "user.email=qa@example.test",
          "-c",
          "commit.gpgsign=false",
          "commit",
          "--allow-empty",
          "-m",
          "base",
        ],
        { cwd: repo, stdio: "pipe" },
      );
      const created = await client.createWorkspace({
        source: {
          kind: "worktree",
          cwd: repo,
          baseBranch: "main",
          branchName: `feature-${suffix}`,
          worktreeSlug: `feature-${suffix}`,
        },
        agent: { provider: "codex", cwd: repo, model: "gpt-5.4-mini" },
      });
      if (!created.agent || created.error) throw new Error(created.error ?? "No created agent");
      agents.push(created.agent);
    }

    const directory = await client.fetchAgents();
    const normal = buildAgentDirectoryState({ serverId, entries: directory.entries });
    const placements = agents.map((agent) => normal.agents.get(agent.id)?.projectPlacement);
    record({
      stage: "authoritative-directory",
      cwds: agents.map((agent) => agent.cwd),
      projectKeys: placements.map((placement) => placement?.projectKey),
    });
    expect(new Set(placements.map((placement) => placement?.projectKey)).size).toBe(2);
    for (const agent of agents) {
      const entry = directory.entries.find((entry) => entry.agent.id === agent.id);
      expect(normal.agents.get(agent.id)?.projectPlacement).toBe(entry?.project);
    }

    useSessionStore.getState().initializeSession(serverId, null);
    const replica = new AgentDirectoryReplica(
      serverId,
      () => undefined,
      () => undefined,
    );
    for (const agent of agents) {
      const page = await client.fetchAgentTimeline(agent.id);
      if (!page.agent) throw new Error("Timeline response has no agent");
      expect("project" in page).toBe(false);
      replica.submitTimelineAgent(replica.captureTimeline(agent.id), page.agent);
    }
    replica.commitChanges([], [], []);
    const fallbackKeys = Array.from(
      replica.snapshot().values(),
      (agent) => agent.projectPlacement?.projectKey,
    );
    record({ stage: "timeline-first-catch-up", fallbackKeys });
    expect(fallbackKeys).toEqual(agents.map((agent) => agent.cwd));
  } finally {
    useSessionStore.getState().clearSession(serverId);
    await client?.close();
    await daemon.stop();
    await rm(root, { recursive: true, force: true });
  }
}, 120_000);
