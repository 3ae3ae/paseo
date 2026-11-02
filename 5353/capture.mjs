import { chromium } from '<worktree>/node_modules/playwright/index.mjs';
import fs from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
const exec = promisify(execFile);
const ev='<evidence>',root='<worktree>';
const config=JSON.parse(await fs.readFile(`${ev}/workflow-state.json`));
const {listen}=JSON.parse(await fs.readFile(`${config.home}/paseo.pid`));
const browser=await chromium.launch({headless:true});
try {
const page=await browser.newPage({viewport:{width:1440,height:1000},deviceScaleFactor:1});
page.setDefaultTimeout(10000);
await page.routeWebSocket(/:(6767)\b/,ws=>ws.close());
await page.addInitScript(({listen})=>{
 const now=new Date().toISOString();const id=`direct:${listen}`;
 localStorage.setItem('@paseo:daemon-registry',JSON.stringify([{serverId:'qa-5353',label:'OMP QA',connections:[{id,type:'directTcp',endpoint:listen}],preferredConnectionId:id,createdAt:now,updatedAt:now}]));
 localStorage.setItem('@paseo:app-settings',JSON.stringify({chatDisplay:'full'}));
}, {listen});
page.on('pageerror',e=>console.log('Page error:',e.message));
await page.goto(`http://${listen}/`);
await page.getByText('fix/omp-stopped-shell-status', {exact:true}).click();
await page.mouse.move(900,100);
await page.getByText('Shell', {exact:true}).click();
await page.screenshot({path:`${ev}/expanded-debug.png`});
console.log('Expanded:',await page.locator('body').innerText());
await page.getByText('Command aborted', {exact:true}).first().waitFor();
console.log('Workspace text:',await page.locator('body').innerText());
console.log('Browser',browser.version());
console.log('URL',page.url());
console.log(await page.locator('body').innerText());
await page.screenshot({path:`${ev}/before.png`});
} finally {await browser.close();}
