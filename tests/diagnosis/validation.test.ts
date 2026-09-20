import { describe, it, expect } from "vitest";
import { mkdtempSync, writeFileSync, rmSync, symlinkSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { validateDiagnosisOutput } from "../../src/diagnosis/validation.js";
import { getChecks } from "../../src/diagnosis/rubric.js";

function output() {
  return { summary: "근거 부족", questions: [], findings: getChecks("general").map(c => ({ checkId: c.id, title: c.title,
    status: "unknown", observation: "근거 부족", hypothesis: "", impact: "", action: "", doneWhen: "", measure: "",
    confidence: "low", evidenceIds: [], codeEvidence: [] })) };
}
describe("grounded output validation", () => {
  it("rejects missing checks instead of silently declaring a complete assessment", () => {
    const input = output(); input.findings.pop();
    expect(() => validateDiagnosisOutput(input, [], "general", process.cwd())).toThrow(/항목/);
  });
  it("rejects nonexistent evidence even when the response is syntactically valid JSON", () => {
    const input = output(); input.findings[0].evidenceIds = ["pr:invented"] as never[];
    expect(() => validateDiagnosisOutput(input, [], "general", process.cwd())).toThrow(/근거/);
  });
  it("requires actual evidence for asserted gaps and supported capabilities", () => {
    const input = output(); input.findings[0].status = "supported";
    expect(() => validateDiagnosisOutput(input, [], "general", process.cwd())).toThrow(/근거/);
  });
  it("verifies repository citations and refuses symlinks escaping the repository", () => {
    const root = mkdtempSync(join(tmpdir(), "diagnosis-citation-"));
    const outside = mkdtempSync(join(tmpdir(), "diagnosis-outside-"));
    try {
      writeFileSync(join(root, "README.md"), "setup\nnpm test\n");
      writeFileSync(join(outside, "secret.txt"), "secret\n");
      symlinkSync(join(outside, "secret.txt"), join(root, "escape"));
      const input = output();
      input.findings[0].status = "supported";
      input.findings[0].codeEvidence = [{ path: "README.md", line: 2, excerpt: "npm test" }] as never[];
      expect(validateDiagnosisOutput(input, [], "general", root).findings[0].status).toBe("supported");
      input.findings[0].codeEvidence = [{ path: "escape", line: 1, excerpt: "secret" }] as never[];
      expect(() => validateDiagnosisOutput(input, [], "general", root)).toThrow(/근거/);
      input.findings[0].codeEvidence = [{ path: "README.md", line: 2, excerpt: "invented" }] as never[];
      expect(() => validateDiagnosisOutput(input, [], "general", root)).toThrow(/근거/);
    } finally { rmSync(root, { recursive: true, force: true }); rmSync(outside, { recursive: true, force: true }); }
  });
});
