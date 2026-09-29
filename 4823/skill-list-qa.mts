import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import { syncSkills } from '../packages/server/src/server/orchestration-skills/internal/sync.ts';
import { syncSkills as syncLegacySkills } from '../../../paseo-work/packages/server/src/server/orchestration-skills/internal/sync.ts';
const root=await mkdtemp(path.join(tmpdir(),'paseo-skill-list-qa-'));
const home=path.join(root,'home');
const options={sourceDir:path.join(root,'bundle'),agentsDir:path.join(home,'.agents/skills'),claudeDir:path.join(home,'.claude/skills'),codexDir:path.join(home,'.codex/skills'),skillNames:['paseo-qa-skill']};
const content='---\nname: paseo-qa-skill\ndescription: Disposable installation verification skill.\n---\nReturn a greeting.\n';
await mkdir(path.join(options.sourceDir,'paseo-qa-skill'),{recursive:true});
await writeFile(path.join(options.sourceDir,'paseo-qa-skill/SKILL.md'),content);
async function listSkills(){
 const child=spawn('codex',['app-server','--listen','stdio://'],{cwd:home,env:{...process.env,HOME:home,CODEX_HOME:path.join(home,'.codex')},stdio:['pipe','pipe','pipe']});
 const lines=createInterface({input:child.stdout});
 let sequence=0;
 const pending=new Map();
 lines.on('line',line=>{try{const value=JSON.parse(line);if(value.id!==undefined){const call=pending.get(value.id);if(call){pending.delete(value.id);value.error?call.reject(value.error):call.resolve(value.result);}}}catch{}});
 child.stderr.on('data',()=>{});
 async function call(method,params){const id=++sequence;const outcome=Promise.withResolvers();pending.set(id,outcome);child.stdin.write(JSON.stringify({id,method,params})+'\n');return outcome.promise;}
 const timer=setTimeout(()=>{child.kill();for(const p of pending.values())p.reject(new Error('Codex timeout'));},15000);
 try {
  await call('initialize',{clientInfo:{name:'paseo_skills_qa',version:'0.1.0'},capabilities:{experimentalApi:true}});
  child.stdin.write(JSON.stringify({method:'initialized'})+'\n');
  const result=await call('skills/list',{cwds:[home],forceReload:true});
  return result.data.flatMap(entry=>entry.skills).filter(skill=>skill.name==='paseo-qa-skill').map(skill=>({name:skill.name,path:skill.path,scope:skill.scope,enabled:skill.enabled}));
 } finally {clearTimeout(timer);lines.close();child.kill();}
}
try {
 await syncLegacySkills(options);
 const before=await listSkills();console.log('Native Codex before:',JSON.stringify(before));assert.equal(before.length,2);
 await syncSkills(options);
 const after=await listSkills();console.log('Native Codex after:',JSON.stringify(after));assert.equal(after.length,1);assert(after[0].path.includes('.agents/skills'));
} finally {await rm(root,{recursive:true,force:true});}
