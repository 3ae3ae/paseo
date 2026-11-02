import fs from 'node:fs/promises';
for (const key of Object.keys(process.env)) if (key.startsWith('PASEO_')) delete process.env[key];
const {connectToDaemon}=await import('<worktree>/packages/cli/dist/utils/client.js');
const {fetchAgentTimelineItems}=await import('<worktree>/packages/cli/dist/commands/agent/logs.js');
const ev='<evidence>';
const {home}=JSON.parse(await fs.readFile(`${ev}/workflow-state.json`));
const {agentId}=JSON.parse(await fs.readFile(`${ev}/${process.argv[2]}-run.json`));
const client=await connectToDaemon({target:{kind:'instance',home}});
try {
const items=await fetchAgentTimelineItems(client,agentId);
console.log(JSON.stringify(items,null,2));
}finally{await client.close();}
