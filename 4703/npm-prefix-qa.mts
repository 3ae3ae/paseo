import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm, realpath } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { execFile } from 'node:child_process';
import { DefaultNpmGlobalPaseoCli } from '../packages/server/src/server/session/daemon/npm-global-cli.ts';
import { resolveNpmGlobalPrefix } from '../packages/server/src/server/session/daemon/install-origin.ts';
const exec = promisify(execFile);
const directory = await mkdtemp(path.join(tmpdir(), 'paseo-prefix-qa-'));
try {
  const prefix = path.join(directory, 'custom prefix');
  const globalRoot = process.platform === 'win32' ? prefix : path.join(prefix, 'lib');
  const cliRoot = path.join(globalRoot, 'node_modules/@getpaseo/cli');
  const serverRoot = path.join(cliRoot, 'node_modules/@getpaseo/server');
  await mkdir(serverRoot, { recursive: true });
  await writeFile(path.join(cliRoot, 'package.json'), JSON.stringify({ name: '@getpaseo/cli', version: '0.10.0' }));
  const npm = new DefaultNpmGlobalPaseoCli(async (command, args, options) => {
    console.log(command, JSON.stringify(args));
    try {
      const output = await exec(command, args, { ...options, env: { ...process.env, NPM_CONFIG_PREFIX: path.join(directory, 'empty default') } });
      return { exitCode: 0, ...output };
    } catch (error) {
      if (!(error instanceof Error) || !('stdout' in error) || typeof error.stdout !== 'string') throw error;
      return { exitCode: 1, stdout: error.stdout, stderr: error.message };
    }
  });
  await assert.rejects(npm.inspect(), /not installed with npm -g/);
  console.log('Default-prefix probe cannot find the running custom install');
  const found = await npm.inspect({ prefix: resolveNpmGlobalPrefix(serverRoot) });
  assert.equal(found.packagePath, await realpath(cliRoot));
  assert.equal(found.version, '0.10.0');
  console.log('Explicit-prefix probe finds the running package:', JSON.stringify(found));
} finally { await rm(directory, { recursive: true, force: true }); }
