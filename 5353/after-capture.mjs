import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {chromium} from '<worktree>/node_modules/playwright/index.mjs';
for(const key of Object.keys(process.env)) if(key.startsWith('PASEO_')) delete process.env[key];
const exec=promisify(execFile),ev='<evidence>',root='<worktree>';
const {home,fixture}=JSON.parse(await fs.readFile(`${ev}/workflow-state.json`));
const {connectToDaemon}=await import(`${root}/packages/cli/dist/utils/client.js`);
const {fetchAgentTimelineItems}=await import(`${root}/packages/cli/dist/commands/agent/logs.js`);
async function cli(name,...args){
 const result=await exec('node',[`${root}/packages/cli/dist/index.js`,'--home',home,...args],{cwd:root,env:process.env});
 await fs.writeFile(`${ev}/${name}.json`,result.stdout);console.log('$ paseo',...args,'\n',result.stdout);return JSON.parse(result.stdout);
}
const {agentId}=JSON.parse(await fs.readFile(`${ev}/after-run.json`));
const client=await connectToDaemon({target:{kind:'instance',home}});
const messages=[];const subscription=client.subscribeAgentTimeline(agentId,m=>messages.push(m));await subscription.ready;
const browser=await chromium.launch({headless:true});
try{
 const page=await browser.newPage({viewport:{width:1440,height:1000},deviceScaleFactor:1});page.setDefaultTimeout(15000);
 await page.routeWebSocket(/:(6767)\b/,ws=>ws.close());
 const {listen}=JSON.parse(await fs.readFile(`${home}/paseo.pid`));
 await page.addInitScript(({listen})=>{const now=new Date().toISOString(),id=`direct:${listen}`;localStorage.setItem('@paseo:daemon-registry',JSON.stringify([{serverId:'qa-5353',label:'OMP QA',connections:[{id,type:'directTcp',endpoint:listen}],preferredConnectionId:id,createdAt:now,updatedAt:now}]));localStorage.setItem('@paseo:app-settings',JSON.stringify({chatDisplay:'full'}));},{listen});
 await page.goto(`http://${listen}/h/qa-5353/workspace/wks_fd24c5b9a8bba10e?open=agent:${agentId}`);
 await page.getByRole('button',{name:/^Shell sleep 90/}).filter({visible:true}).last().waitFor();await page.mouse.move(900,100);
 const running=await fetchAgentTimelineItems(client,agentId);await fs.writeFile(`${ev}/after-capture-timeline.json`,JSON.stringify(running,null,2));
 assert.equal(running.find(i=>i.type==='tool_call').status,'canceled');
 await page.getByRole('button',{name:/^Shell sleep 90/}).filter({visible:true}).last().click();
 console.log('Stop already completed via CLI; see after-stop.json');
 console.log('Visible body:',await page.locator('body').innerText());
 await page.waitForTimeout(500);
 assert.equal(await page.getByText('ERROR',{exact:true}).count(),0);
 const stopped=await fetchAgentTimelineItems(client,agentId);await fs.writeFile(`${ev}/after-timeline.json`,JSON.stringify(stopped,null,2));
 assert.equal(stopped.find(i=>i.type==='tool_call').status,'canceled');assert.equal(stopped.find(i=>i.type==='tool_call').error,null);
 await page.mouse.move(900,100);await page.screenshot({path:`${ev}/after.png`});await fs.writeFile(`${ev}/browser-after.txt`,await page.locator('body').innerText());
 await cli('after-reload','agent','reload',agentId,'--json');
 const replayed=await fetchAgentTimelineItems(client,agentId);await fs.writeFile(`${ev}/after-reload-timeline.json`,JSON.stringify(replayed,null,2));
 assert.equal(replayed.find(i=>i.type==='tool_call').status,'canceled');assert.equal(replayed.find(i=>i.type==='tool_call').error,null);
 await page.reload();await page.getByRole('button',{name:/^Shell sleep 90/}).filter({visible:true}).last().click();console.log('Visible body:',await page.locator('body').innerText());
 await page.waitForTimeout(500);
 assert.equal(await page.getByText('ERROR',{exact:true}).count(),0);await page.mouse.move(900,100);await page.screenshot({path:`${ev}/after-reload.png`});
 await fs.writeFile(`${ev}/browser-after-reload.txt`,await page.locator('body').innerText());
 console.log('PASS: real OMP shell stopped via CLI, canceled live and after reload; no ERROR block. Browser',browser.version());
}finally{await fs.writeFile(`${ev}/after-live-events.json`,JSON.stringify(messages,null,2));await subscription.release();await client.close();await browser.close();}
