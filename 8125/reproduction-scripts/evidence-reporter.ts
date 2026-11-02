import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { TestCase, TestResult } from "@playwright/test/reporter";
export default class EvidenceReporter {
  onTestEnd(test: TestCase, result: TestResult) {
    const prefix = process.env.QA_EVIDENCE_PREFIX;
    if (!prefix || !test.title.startsWith("changes file actions resolve")) return;
    const scenario = test.title.includes("a-root-note") ? "sibling" : test.title.endsWith("project .") ? "root" : "subfolder";
    const evidence = "<evidence>";
    mkdirSync(evidence, { recursive: true });
    for (const attachment of result.attachments) {
      if (attachment.contentType === "image/png" && attachment.body) {
        writeFileSync(path.join(evidence, `${prefix}-${scenario}-${attachment.name}.png`), attachment.body);
      }
    }
  }
}
