import { chromium } from 'playwright';
import { readFile, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
const root = '<worktree>';
const evidence = '<evidence>';
const target = JSON.parse(await readFile(`${root}/.dev/qa-8210-case.json`,'utf8'));
const metroPort = (await readFile(`${root}/.dev/qa-8210-metro.port`,'utf8')).trim();
const browser = await chromium.launch({headless:true});
try {
  const page = await browser.newPage({viewport:{width:1400,height:1000},deviceScaleFactor:1});
  await page.addInitScript(({endpoint,serverId})=>{
    const connection = {id:`direct:${endpoint}`,type:'directTcp',endpoint};
    localStorage.setItem('@paseo:daemon-registry',JSON.stringify([{serverId,label:'Codex QA',connections:[connection],preferredConnectionId:connection.id,createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()}]));
    localStorage.setItem('@paseo:app-settings',JSON.stringify({chatDisplay:'full'}));
  },target);
  await page.goto(`http://localhost:${metroPort}/h/${target.serverId}/workspace/${target.workspaceId}?open=agent:${target.agentId}`,{timeout:120000});
  const search = page.getByTestId('tool-call-badge').filter({hasText:"rg -n 'a_string_not_present' existing.txt ."}).last();
  await search.waitFor({timeout:60000});
  await search.click();
  const message = 'Command exited with code 1';
  await page.getByText(message,{exact:false}).first().waitFor({timeout:30000});
  await page.getByText('Updating messages',{exact:true}).waitFor({state:'hidden',timeout:30000});
  await page.screenshot({path:`${evidence}/after.png`,fullPage:true});
  const body = await page.locator('body').innerText();
  assert(body.includes(message));
  assert(!body.includes('Command exited with code -1'));
  await writeFile(`${evidence}/after-visible.txt`,body);
  console.log(JSON.stringify({browser:browser.version(),url:page.url(),agentId:target.agentId,expected:message}));
} finally { await browser.close(); }
