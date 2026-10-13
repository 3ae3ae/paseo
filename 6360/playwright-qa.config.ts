import { devices } from "@playwright/test";
import base from "../playwright.config";

// Local QA only: run the committed browser project against the installed Google Chrome.
export default {
  ...base,
  testDir: "../e2e/browser",
  globalSetup: "../e2e/support/global-setup.ts",
  projects: [
    {
      name: "browser",
      testIgnore: ["**/*.real.spec.ts"],
      use: { ...devices["Desktop Chrome"], channel: "chrome", screenshot: "on" },
    },
  ],
};
