# Browser QA commands for the neutral-name rerun

All repository commands run from `<worktree>`. Ports were allocated with OS port 0 probes.
The check logs are preserved from the accepted, unchanged patch; only paths are scrubbed.

```sh
git diff -- packages/app/src/runtime/host-runtime.ts > /tmp/qa-6028/fix.patch
lsof -iTCP -sTCP:LISTEN -P | grep node > /tmp/qa-6028/listeners-before.txt
PASEO_HOME=/tmp/qa-6028/home PASEO_LISTEN=127.0.0.1:52448 PASEO_RELAY_ENABLED=true PASEO_CORS_ORIGINS=http://127.0.0.1:52449,http://localhost:52449 PASEO_LOG_LEVEL=debug PASEO_DICTATION_ENABLED=0 PASEO_VOICE_MODE_ENABLED=0 PASEO_DICTATION_STT_PROVIDER=openai PASEO_VOICE_TURN_DETECTION_PROVIDER=openai PASEO_VOICE_STT_PROVIDER=openai PASEO_VOICE_TTS_PROVIDER=openai node packages/cli/dist/index.js daemon run --home /tmp/qa-6028/home > /tmp/qa-6028/daemon-launch.log 2>&1
PASEO_HOME=/tmp/qa-6028/home node packages/cli/dist/index.js daemon pair --relay --json --home /tmp/qa-6028/home > /tmp/qa-6028/pairing.json
node /tmp/qa-6028/forwarder.mjs 52448 0 > /tmp/qa-6028/forwarder-before.log 2>&1
git checkout -- packages/app/src/runtime/host-runtime.ts
git diff --stat
mkdir -p /tmp/qa-6028/project
PASEO_HOME=/tmp/qa-6028/home node packages/cli/dist/index.js project create /tmp/qa-6028/project --home /tmp/qa-6028/home --json > /tmp/qa-6028/project.json
PASEO_HOME=/tmp/qa-6028/home node packages/cli/dist/index.js workspace create --isolation local --path /tmp/qa-6028/project --title 'QA 6028 initial workspace' --home /tmp/qa-6028/home --json > /tmp/qa-6028/workspace-initial.json
node .dev/issue-6028/start-qa-metro.mjs 52449 > /tmp/qa-6028/metro-before.log 2>&1
node .dev/issue-6028/warm-private-qa.mjs before > /tmp/qa-6028/warm-before.log 2>&1
node .dev/issue-6028/prepare-private-qa.mjs > /tmp/qa-6028/prepare-before.log 2>&1
node .dev/issue-6028/qa-browser-private.mjs before > /tmp/qa-6028/before-app.log 2>&1
kill -TERM 74886
git apply /tmp/qa-6028/fix.patch
git diff --stat
node /tmp/qa-6028/forwarder.mjs 52448 53495 > /tmp/qa-6028/forwarder-after.log 2>&1
node .dev/issue-6028/start-qa-metro.mjs 52449 > /tmp/qa-6028/metro-after.log 2>&1
node .dev/issue-6028/warm-private-qa.mjs after > /tmp/qa-6028/warm-after.log 2>&1
node .dev/issue-6028/qa-browser-private.mjs after > /tmp/qa-6028/after-app.log 2>&1
kill -TERM 88108
PASEO_HOME=/tmp/qa-6028/home node packages/cli/dist/index.js daemon stop --home /tmp/qa-6028/home > /tmp/qa-6028/daemon-stop.log 2>&1
lsof -iTCP -sTCP:LISTEN -P | grep node > /tmp/qa-6028/listeners-after.txt
lsof -nP -iTCP:52448 -iTCP:52449 -iTCP:53495 -sTCP:LISTEN > /tmp/qa-6028/isolated-ports-after.txt
git diff --check
```

`start-qa-metro.mjs` launches Node with `expo/bin/cli start --web --port 52449` from
`<worktree>/packages/app`; environment includes `CI=1`, `BROWSER=none`,
`EXPO_NO_TELEMETRY=1`, `EXPO_PUBLIC_LOCAL_DAEMON=localhost:53495`, and the scratch home.
Metro status is checked and the existing `warmMetro` helper compiles the web bundle.
The served probe code is checked for the guard's absence/presence in each run.

Before recording, `prepare-private-qa.mjs` launches installed Chrome without video,
opens the host Overview, uses its normal rename dialog to save `QA host`, imports the
pairing offer and confirms it, and verifies one saved host with both connections.
Its browser storage state is kept only in private scratch. Each recorded context uses
that state, so no rename or pairing UI is recorded. Recording uses Playwright
`channel: "chrome"`, en-US, headless mode, a 1360x900 viewport and matching video size.
Only the initial document is loaded; the outage workflow uses ordinary UI navigation.
The browser script terminates the forwarder using SIGTERM and logs the exact CLI command
used to create a fresh workspace during each outage.

A real encrypted DaemonClient relay preflight fetched the empty agent directory and
measured 72.4 ms RTT. No transport mocks or product-code instrumentation were used.
Speech setup is disabled with the existing browser E2E environment settings.

Video samples were extracted with these exact arguments for each phase/time combination:

```sh
ffmpeg -hide_banner -loglevel error -ss <seconds> -i /tmp/qa-6028/staged/<phase>.webm -frames:v 1 /tmp/qa-6028/staged/<phase>-video-frame-<seconds>s.png
```

Phases: before, after. Seconds: 1, 21, 30, 60, 83. All ten samples and all eight screenshots
were visually inspected before copying to the evidence directory. The page's visible
text was also checked for the private name throughout the recorded outage.

Python preparation/sanitization verified the accepted source hashes, retained the earlier
unit/static-check logs, scrubbed structured and plain text, and checked known credential
values and credential URL/token patterns. The old evidence directory was deleted before
copying the verified replacement. Private pairing/browser state and all runtime scratch
were removed during cleanup; neither is an evidence artifact.

Preserved check commands were `npm run format:check`, `npm run lint`, and
`npm run typecheck` from `<worktree>`, all exit 0. Preserved regression commands were
`npx vitest run src/runtime/host-runtime.test.ts --bail=1` from `<worktree>/packages/app`,
old code exit 1, accepted fix exit 0. They were not rerun for this media/privacy task.
