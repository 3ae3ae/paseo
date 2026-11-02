// fake-acp-agent.mjs — on a prompt containing PERM_ABANDON:
// tool_call → requestPermission (not awaited) → after 3 s tool_call_update{failed} → end_turn
import { AgentSideConnection, ndJsonStream, PROTOCOL_VERSION } from "@agentclientprotocol/sdk";
import { Readable, Writable } from "node:stream";

class FakeAgent {
  constructor(conn) { this.conn = conn; }
  async initialize() { return { protocolVersion: PROTOCOL_VERSION, agentCapabilities: { loadSession: true }, authMethods: [] }; }
  async newSession() { return { sessionId: `fake-${Date.now().toString(36)}` }; }
  async loadSession() { return {}; }
  async authenticate() { return {}; }
  async setSessionMode() { return {}; }
  async cancel() {}
  async prompt({ sessionId, prompt }) {
    const text = (prompt || []).map((b) => b.text || "").join(" ");
    if (text.includes("PERM_ABANDON")) {
      const toolCall = { toolCallId: `tc-${Date.now()}`, title: "fake edit", kind: "edit", status: "pending" };
      await this.conn.sessionUpdate({ sessionId, update: { sessionUpdate: "tool_call", ...toolCall } });
      this.conn.requestPermission({ sessionId, toolCall, options: [
        { optionId: "allow_once", name: "Allow once", kind: "allow_once" },
        { optionId: "reject_once", name: "Reject", kind: "reject_once" },
      ] }).catch(() => {});
      await new Promise((r) => setTimeout(r, 3000));
      await this.conn.sessionUpdate({ sessionId, update: { sessionUpdate: "tool_call_update", toolCallId: toolCall.toolCallId, status: "failed" } });
      return { stopReason: "end_turn" };
    }
    return { stopReason: "end_turn" };
  }
}
new AgentSideConnection((c) => new FakeAgent(c), ndJsonStream(Writable.toWeb(process.stdout), Readable.toWeb(process.stdin)));
