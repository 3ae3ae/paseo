import { defineConfig, devices } from "@playwright/test";
import path from "node:path";
import base from "../../packages/app/playwright.config";
export default defineConfig(base, {
  testDir: path.resolve(__dirname, "../../packages/app/e2e/browser"),
  globalSetup: path.resolve(__dirname, "headless-setup.ts"),
  outputDir: process.env.QA_OUTPUT_DIR,
  workers: 1,
  retries: 0,
  reporter: [["list"], [path.resolve(__dirname, "evidence-reporter.ts")]],
  projects: [{ name: "browser", testIgnore: ["**/*.real.spec.ts"], use: {
    ...devices["Desktop Chrome"],
    headless: true,
    launchOptions: { executablePath: "~/Library/Caches/ms-playwright/chromium_headless_shell-1208/chrome-headless-shell-mac-arm64/chrome-headless-shell" },
  } }],
});
