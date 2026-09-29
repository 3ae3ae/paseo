import path from "node:path";
import { defineConfig } from "@playwright/test";
import config from "../playwright.config";
const appRoot = path.resolve(__dirname, "..");
export default defineConfig({
  ...config, preserveOutput: "always",
  use: { ...config.use, video: "on", screenshot: "on", trace: "on" },
  testDir: path.join(appRoot, "e2e/browser"),
  globalSetup: path.join(appRoot, "e2e/support/global-setup.ts"),
  outputDir: path.join(appRoot, "test-results"),
  projects: config.projects?.map(project => ({
    ...project, use: { ...project.use, channel: "chrome" }
  })),
});
