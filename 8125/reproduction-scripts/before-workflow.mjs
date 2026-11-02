import { readFileSync, writeFileSync } from "node:fs";
import { execFileSync, spawn } from "node:child_process";
const productionPath = "packages/app/src/git/diff-pane.tsx";
const specPath = "packages/app/e2e/browser/changes-pane.spec.ts";
const production = readFileSync(productionPath, "utf8");
const spec = readFileSync(specPath, "utf8");
const start = spec.indexOf("for (const { workspaceSubdirectory, filePath, content, visibleContent }");
const end = spec.indexOf('test("canvas file headers select', start);
if (start < 0 || end < 0) throw new Error("Cannot locate regression test");
const diagnostic = `test("changes file actions resolve before workflow from project src", async ({ page, context }, testInfo) => {
  const workspace = await createWorkspaceWithMountedTabDiff({ workspaceSubdirectory: "src", includeRootFileSortingFirst: true });
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await openWorkspaceChanges(page, workspace);
  for (const filePath of ["src/use-mounted-tab-set.ts", "a-root-note.txt"]) {
    await changesTree(page).getByText(path.basename(filePath), { exact: true }).click();
    await expectExpandedMountedTabDiff(page);
    const panel = page.getByTestId("working-diff-panel").filter({ visible: true });
    const header = diffHeaderForPath(panel, filePath).getByTestId(/^diff-file-\\d+-toggle$/);
    await header.click({ button: "right" });
    await testInfo.attach("file-menu-" + path.basename(filePath), { body: await page.screenshot(), contentType: "image/png" });
    await page.getByRole("menuitem", { name: "Copy path", exact: true }).click();
    const copied = await page.evaluate(() => navigator.clipboard.readText());
    expect(copied).toBe(path.join(workspace.repoPath, "src", filePath));
    console.log("OLD Copy path for " + filePath + ": " + copied);
    await header.click({ button: "right" });
    await page.getByRole("menuitem", { name: "Open file", exact: true }).click();
    const editor = page.getByTestId("workspace-file-pane").filter({ visible: true });
    await expect(editor).toContainText("File not found");
    console.log("OLD Open file for " + filePath + ": File not found with Retry");
    await testInfo.attach("open-file-missing-" + path.basename(filePath), { body: await page.screenshot(), contentType: "image/png" });
    await changesTree(page).getByText(path.basename(filePath), { exact: true }).click();
    await expectExpandedMountedTabDiff(page);
    await header.click({ button: "right" });
    await page.getByRole("menuitem", { name: "Download", exact: true }).click();
    await expect(page.getByText(/ENOENT: no such file or directory/)).toBeVisible();
    console.log("OLD Download for " + filePath + ": visible ENOENT error toast");
    await testInfo.attach("download-failed-" + path.basename(filePath), { body: await page.screenshot(), contentType: "image/png" });
  }
});

`;
try {
  writeFileSync(productionPath, execFileSync("git", ["show", "HEAD:" + productionPath], { encoding: "utf8" }));
  writeFileSync(specPath, spec.slice(0, start) + diagnostic + spec.slice(end));
  const code = await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [".dev/qa8125/run-test.mjs", "--grep", "before workflow"], { stdio: "inherit", env: process.env });
    child.on("error", reject);
    child.on("exit", resolve);
  });
  process.exitCode = code ?? 1;
} finally {
  writeFileSync(productionPath, production);
  writeFileSync(specPath, spec);
  console.log("Restored final source and regression spec");
}
