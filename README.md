# Paseo p2 verification

Local verification from macOS 27.0 arm64, Node 24.2.0, Google Chrome 153.0.8010.54, and Codex CLI 0.158.0. Tests used isolated daemon homes and ephemeral ports.

Each numbered directory contains raw, path-redacted logs and available browser recordings/screenshots or runnable probes. Baseline: f232d23e9a7b1ab4fdeaf198f2aabd8df8fb34ed. Directory 3039 records a web non-reproduction attempt; it is not a bug-fix PR.

Browser runs used system Chrome and system ffmpeg through a temporary Playwright cache. The committed browser tests use the repository CI configuration. Screenshots are browser web, including narrow viewport checks; native mobile and packaged Electron were not tested.
