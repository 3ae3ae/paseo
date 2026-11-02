for (const key of Object.keys(process.env)) if (key.startsWith('PASEO_')) delete process.env[key];
const { connectToDaemon } = await import('../packages/cli/dist/utils/client.js');
const { fetchAgentTimelineItems } = await import('../packages/cli/dist/commands/agent/logs.js');
const client = await connectToDaemon({target:{kind:'instance',home:new URL('./qa-8210-home',import.meta.url).pathname}});
try {
  const agent = await client.fetchAgent({agentId:process.argv[2]});
  const timeline = await fetchAgentTimelineItems(client,process.argv[2],{timeoutMs:15000});
  console.log(JSON.stringify({agentId:agent.agent.id,workspaceId:agent.agent.workspaceId,timeline},null,2));
} finally { await client.close(); }
