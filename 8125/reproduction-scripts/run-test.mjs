import { spawn } from "node:child_process";
import path from "node:path";
for (const key of Object.keys(process.env)) if (key.startsWith("PASEO_")) delete process.env[key];
process.env.BROWSER = "none";
process.env.EXPO_UNSTABLE_HEADLESS = "1";
process.env.E2E_PASEO_HOME = path.resolve(".dev/qa8125/test-home");
const child = spawn(process.execPath, ["node_modules/@playwright/test/cli.js", "test", "--config", ".dev/qa8125/playwright.config.ts", "--project=browser", "e2e/browser/changes-pane.spec.ts", "--workers=1", ...process.argv.slice(2)], { stdio: "inherit", env: process.env });
child.on("exit", (code) => { process.exitCode = code ?? 1; });
