import { afterEach, describe, expect, it, vi } from "vitest";
import { buildMarkdownReport, buildMultiBranchMarkdown, buildMultiBranchPdf, buildPdfMarkdown, printReport } from "../src/reporter.js";
import { computeResult } from "../src/scorer.js";
import type { AnalysisResult } from "../src/types.js";

function result(engine?: "claude" | "codex"): AnalysisResult {
  return { ...computeResult({ categories: [], summary: "검증 결과" }), ...(engine ? { engine } : {}) };
}
afterEach(() => vi.restoreAllMocks());

describe("report analysis engine attribution", () => {
  it.each(["claude", "codex", undefined] as const)("attributes terminal, Markdown and PDF to %s", engine => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    printReport(result(engine));
    const outputs = [log.mock.calls.flat().join("\n"), buildMarkdownReport(result(engine), false), buildPdfMarkdown(result(engine), false)];
    for (const output of outputs) {
      expect(output).toContain(engine === "codex" ? "Powered by Codex CLI" : "Powered by Claude Agent SDK");
      if (engine === "codex") expect(output).not.toContain("Claude Agent SDK");
    }
  });
  it.each([buildMultiBranchMarkdown, buildMultiBranchPdf])("keeps multi-branch attribution consistent and identifies mixed engines", build => {
    const allCodex = build([{ branch: "main", result: result("codex") }, { branch: "release", result: result("codex") }], false);
    expect(allCodex).toContain("Powered by Codex CLI");
    expect(allCodex).not.toContain("Claude Agent SDK");
    const mixed = build([{ branch: "main", result: result("claude") }, { branch: "release", result: result("codex") }], false);
    expect(mixed).toContain("Claude Agent SDK, Codex CLI");
  });
});
