# Issue 6028: neutral-name browser QA

This replaces the previous evidence set. Browser web was exercised on 2026-10-13 using
installed Google Chrome 155.0.8059.40 (`channel: "chrome"`, headless, en-US, 1360x900).
The accepted eight-line fix and regression test remain unchanged and uncommitted.

| Run | Result after cutting direct | Fresh workspace during outage | Reloads |
| --- | --- | --- | --- |
| Before: baseline host-runtime.ts from 337e81a9 | Still Error / localhost:53495 at 60.371 s | Never appeared | 0 |
| After: accepted guard | Online / Relay first observed at 6.467 s, still online at 60.394 s | Appeared | 0 |

Recovery timing is the first UI observation, sampled every 500 ms. Before, the dead direct
probe still displayed a cached 600 microseconds while relay displayed 72 ms. After, direct
displayed Timeout and relay 71 ms. Both recorded runs began online on direct with one host
profile containing direct and hosted relay connections. The real daemon stayed alive through
both outages. One document was loaded in each recording; subsequent navigation used UI buttons.

## Neutral name and publication checks

There is no supported daemon display-name override: `packages/server/src/server/host-name.ts:9`
reads the system computer name on this OS. `PASEO_HOSTNAMES` controls allowed request hosts,
not display naming. The app's normal Overview rename dialog was used to save **QA host**
before recording. Pairing and its confirmation were completed off-camera, and the resulting
saved browser profile was used by both recorded contexts. No product code or OS name was changed.

All eight screenshots and video samples at 1, 21, 30, 60 and 83 seconds from each recording
were inspected visually. They show QA host or neutral workspace content, with no private
computer name, pairing offer, key or token. The recorded page text was checked throughout
the outage. The raw pairing offer and browser storage state were never copied into evidence.

Published logs are sanitized: original computer names and daemon log hostname fields are
neutralized; the checkout root is `<worktree>`, user-home paths use `~`, and OS temporary
paths use `<tmp>`. Known pairing/credential values and credential URL/token patterns are
redacted. Unit red/green logs retain their assertions and summaries, with path scrubbing.
The two requested recursive name/path scans produced no output (exit 1: no matches).
See privacy-validation.json for visual review and scan results.

## Checks and cleanup

Earlier full-root format:check, lint and typecheck logs are retained; each exited 0 on the
same accepted code. No full suite was run. Browser runs both exited 0. Source hashes and
`git diff --check` were verified after restoring the exact fix. The final diff still contains
only the original two files and 52 insertions (8 production, 44 test).

All started daemon, Metro, forwarder and browser processes stopped. The isolated ports
52448, 52449 and 53495 are clear, owned PIDs/process groups were checked, and scratch state
was removed. The installed daemon on 6767 and default home were not operated on.
No commit, push or GitHub comment was made. Coverage remains browser web; native/Electron
flows and live provider agent sessions were not exercised.

## Evidence file list

- [README.md](README.md)
- [accepted-code-sha256.txt](accepted-code-sha256.txt)
- [after-app-excerpt.log](after-app-excerpt.log)
- [after-app.log](after-app.log)
- [after-connection-probes.png](after-connection-probes.png)
- [after-created-workspace.json](after-created-workspace.json)
- [after-daemon-excerpt.log](after-daemon-excerpt.log)
- [after-direct-online.png](after-direct-online.png)
- [after-events.json](after-events.json)
- [after-recovered.png](after-recovered.png)
- [after-video-frame-01s.png](after-video-frame-01s.png)
- [after-video-frame-21s.png](after-video-frame-21s.png)
- [after-video-frame-30s.png](after-video-frame-30s.png)
- [after-video-frame-60s.png](after-video-frame-60s.png)
- [after-video-frame-83s.png](after-video-frame-83s.png)
- [after-video-metadata.json](after-video-metadata.json)
- [after-workspaces.png](after-workspaces.png)
- [after.webm](after.webm)
- [before-app-excerpt.log](before-app-excerpt.log)
- [before-app.log](before-app.log)
- [before-connection-probes.png](before-connection-probes.png)
- [before-created-workspace.json](before-created-workspace.json)
- [before-daemon-excerpt.log](before-daemon-excerpt.log)
- [before-direct-online.png](before-direct-online.png)
- [before-events.json](before-events.json)
- [before-stuck.png](before-stuck.png)
- [before-video-frame-01s.png](before-video-frame-01s.png)
- [before-video-frame-21s.png](before-video-frame-21s.png)
- [before-video-frame-30s.png](before-video-frame-30s.png)
- [before-video-frame-60s.png](before-video-frame-60s.png)
- [before-video-frame-83s.png](before-video-frame-83s.png)
- [before-video-metadata.json](before-video-metadata.json)
- [before-workspaces.png](before-workspaces.png)
- [before.webm](before.webm)
- [checks.json](checks.json)
- [cleanup.json](cleanup.json)
- [commands.md](commands.md)
- [daemon-launch.log](daemon-launch.log)
- [daemon-stop.log](daemon-stop.log)
- [evidence-sha256.txt](evidence-sha256.txt)
- [final-git-diff-stat.txt](final-git-diff-stat.txt)
- [fix.patch](fix.patch)
- [format-check.log](format-check.log)
- [forwarder-after.log](forwarder-after.log)
- [forwarder-before.log](forwarder-before.log)
- [forwarder.mjs](forwarder.mjs)
- [isolated-ports-after.txt](isolated-ports-after.txt)
- [lint.log](lint.log)
- [listeners-after.txt](listeners-after.txt)
- [listeners-before.txt](listeners-before.txt)
- [metro-after.log](metro-after.log)
- [metro-before.log](metro-before.log)
- [observations.json](observations.json)
- [prepare-before.log](prepare-before.log)
- [prepare-private-qa.mjs](prepare-private-qa.mjs)
- [privacy-validation.json](privacy-validation.json)
- [qa-browser-private.mjs](qa-browser-private.mjs)
- [relay-preflight.json](relay-preflight.json)
- [served-after-bundle-excerpt.txt](served-after-bundle-excerpt.txt)
- [served-before-bundle-excerpt.txt](served-before-bundle-excerpt.txt)
- [start-qa-metro.mjs](start-qa-metro.mjs)
- [typecheck.log](typecheck.log)
- [unit-vitest-green.log](unit-vitest-green.log)
- [unit-vitest-red.log](unit-vitest-red.log)
- [warm-after.log](warm-after.log)
- [warm-before.log](warm-before.log)
- [warm-private-qa.mjs](warm-private-qa.mjs)
