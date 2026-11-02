import { readFileSync, writeFileSync } from "node:fs";
import { execFileSync, spawn } from "node:child_process";
const productionPath = "packages/app/src/git/diff-pane.tsx";
const production = readFileSync(productionPath, "utf8");
try {
  writeFileSync(productionPath, execFileSync("git", ["show", "HEAD:" + productionPath], { encoding: "utf8" }));
  const code = await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [".dev/qa8125/run-test.mjs", "--grep", "changes file actions resolve"], { stdio: "inherit", env: process.env });
    child.on("error", reject);
    child.on("exit", resolve);
  });
  process.exitCode = code ?? 1;
} finally {
  writeFileSync(productionPath, production);
  console.log("Restored final production source after original-code red check");
}
