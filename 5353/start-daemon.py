#!/usr/bin/env python3
import os
from pathlib import Path
root=Path('<worktree>')
os.chdir(root)
env={k:v for k,v in os.environ.items() if not k.startswith('PASEO_')}
env.update(PASEO_HOME=str(root/'.dev/qa5353/paseo-home'),PASEO_SERVER_ID='qa-5353',PASEO_NODE_INSPECT='0')
os.execvpe('node',['node','packages/server/dist/scripts/supervisor-entrypoint.js'],env)
