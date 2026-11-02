#!/usr/bin/env python3
import os, subprocess, sys
from pathlib import Path
root=Path('<worktree>')
env={k:v for k,v in os.environ.items() if not k.startswith('PASEO_')}
raise SystemExit(subprocess.call(['node','packages/cli/dist/index.js','--home',str(root/'.dev/qa5353/paseo-home'),*sys.argv[1:]],cwd=root,env=env))
