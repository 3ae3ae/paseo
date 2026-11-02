import json, os, pathlib, signal, subprocess, sys, time, shlex
root = pathlib.Path('<worktree>')
evidence = pathlib.Path('<evidence>')
phase = sys.argv[1]
home = root / '.dev' / ('qa-7664-' + phase)
home.mkdir(parents=True, exist_ok=True)
work = root / '.dev/qa-7664/work'
work.mkdir(parents=True, exist_ok=True)
env = {k:v for k,v in os.environ.items() if not k.startswith('PASEO_')}
env.update(PASEO_HOME=str(home), PASEO_LISTEN='127.0.0.1:0', PASEO_NODE_INSPECT='0')
providers = {name:{'enabled':False} for name in ['claude','codex','opencode','copilot','cursor','kimi','kiro','gemini','pi','omp','acp']}
providers['fake-acp'] = {'extends':'acp','label':'fake acp','command':['node',str(root / '.dev/qa-7664/fake-acp-agent.mjs')]}
config = {'version':1,'daemon':{'listen':'127.0.0.1:0','relay':{'enabled':False},'mcp':{'enabled':False,'injectIntoAgents':False},'usage':{'enabled':False},'browserTools':{'enabled':False}}, 'agents':{'providers':providers}, 'pluginsEnabled':False}
(home / 'config.json').write_text(json.dumps(config))
launch=['node','--import','tsx','packages/server/scripts/supervisor-entrypoint.ts','--dev']
cli=['node',str(root / 'packages/cli/dist/index.js'),'--home',str(home)]
with (home / 'console.log').open('w') as console, (evidence / (phase+'.txt')).open('w') as transcript:
    transcript.write('Reporter-provided SDK stub from issue #7664; no real Hermes Agent ran.\n')
    transcript.write('Inherited PASEO_* variables removed. PASEO_HOME='+str(home)+'; PASEO_LISTEN=127.0.0.1:0\n')
    transcript.write('$ '+shlex.join(launch)+'\n'); transcript.flush()
    daemon=subprocess.Popen(launch,cwd=root,env=env,stdout=console,stderr=subprocess.STDOUT,start_new_session=True)
    def run(args):
        command=cli+args
        transcript.write('\n$ '+shlex.join(command)+'\n'); transcript.flush()
        result=subprocess.run(command,cwd=work,env=env,text=True,stdout=subprocess.PIPE,stderr=subprocess.STDOUT,timeout=45)
        transcript.write(result.stdout+'\nexit='+str(result.returncode)+'\n'); transcript.flush()
        if result.returncode: raise RuntimeError('CLI command failed: '+args[0])
        return result.stdout
    try:
        for _ in range(240):
            if daemon.poll() is not None: raise RuntimeError('Daemon exited before readiness')
            try:
                lock=json.loads((home/'paseo.pid').read_text())
                if lock.get('listen'): break
            except (FileNotFoundError,json.JSONDecodeError): pass
            time.sleep(.25)
        else: raise RuntimeError('Daemon readiness timeout')
        transcript.write('Allocated listener: '+lock['listen']+'\n')
        output=run(['run','--provider','fake-acp','--cwd',str(work),'--no-wait','--json','PERM_ABANDON'])
        agent=json.loads(output[output.index('{'):])['agentId']
        time.sleep(5)
        run(['inspect',agent])
        run(['inspect',agent,'--json'])
        run(['permit','ls','--json'])
        run(['send',agent,'next turn','--json'])
        run(['inspect',agent,'--json'])
        run(['permit','ls','--json'])
    finally:
        daemon.send_signal(signal.SIGTERM)
        try: daemon.wait(timeout=20)
        except subprocess.TimeoutExpired:
            os.killpg(daemon.pid,signal.SIGKILL); daemon.wait(timeout=5)
        transcript.write('\nSupervisor stopped; exit='+str(daemon.returncode)+'\n')
print('Saved '+str(evidence/(phase+'.txt')))
