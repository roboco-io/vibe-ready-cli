import { describe, it, expect } from "vitest";
import { normalizeAgent, buildAgentFocusNote, AGENT_PROFILES, SUPPORTED_AGENTS } from "../src/agents.js";
import { buildAnalysisPrompt } from "../src/prompts/analyze.js";
import { getEffectiveAgent } from "../src/config.js";

describe("normalizeAgent", () => {
  it("표준 ID는 그대로 반환한다", () => {
    expect(normalizeAgent("claude")).toBe("claude");
    expect(normalizeAgent("codex")).toBe("codex");
    expect(normalizeAgent("cursor")).toBe("cursor");
    expect(normalizeAgent("copilot")).toBe("copilot");
  });

  it("별칭과 대소문자/공백을 정규화한다", () => {
    expect(normalizeAgent("Claude-Code")).toBe("claude");
    expect(normalizeAgent("  CC ")).toBe("claude");
    expect(normalizeAgent("github-copilot")).toBe("copilot");
    expect(normalizeAgent("openai")).toBe("codex");
  });

  it("알 수 없는 값은 null을 반환한다", () => {
    expect(normalizeAgent("gemini")).toBeNull();
    expect(normalizeAgent("")).toBeNull();
  });
});

describe("buildAgentFocusNote", () => {
  it("선택한 에이전트만 평가하도록 지시하고 다른 도구 부재를 감점하지 않게 한다", () => {
    const note = buildAgentFocusNote("claude");
    expect(note).toContain("Claude Code");
    expect(note).toContain("절대 감점하거나");
    // 다른 에이전트 파일은 감점 대상에서 제외하라고 명시
    expect(note).toContain("AGENTS.md");
    expect(note).toContain(".cursorrules");
  });

  it("모든 지원 에이전트에 프로필이 존재한다", () => {
    for (const id of SUPPORTED_AGENTS) {
      expect(AGENT_PROFILES[id]).toBeDefined();
      expect(AGENT_PROFILES[id].label.length).toBeGreaterThan(0);
    }
  });
});

describe("buildAnalysisPrompt — agent focus", () => {
  it("agent 미지정 시 AGENT FOCUS 문구가 없다", () => {
    const prompt = buildAnalysisPrompt();
    expect(prompt).not.toContain("AGENT FOCUS");
  });

  it("agent 지정 시 해당 에이전트로 한정하는 문구를 포함한다", () => {
    const prompt = buildAnalysisPrompt(undefined, undefined, null, "claude");
    expect(prompt).toContain("AGENT FOCUS");
    expect(prompt).toContain("Claude Code");
  });

  it("auto 모드에서도 단일 에이전트 자동 감지 지침을 포함한다", () => {
    const prompt = buildAnalysisPrompt();
    expect(prompt).toContain("실제로 구성된 에이전트");
    expect(prompt).toContain("감점 사유가 아닙니다");
  });
});

describe("getEffectiveAgent — CLI가 config보다 우선", () => {
  it("CLI 지정이 config를 덮어쓴다", () => {
    expect(getEffectiveAgent({ categories: [], agent: "codex" }, "claude")).toBe("claude");
  });

  it("CLI 미지정 시 config 값을 사용한다", () => {
    expect(getEffectiveAgent({ categories: [], agent: "cursor" }, null)).toBe("cursor");
  });

  it("둘 다 없으면 undefined(자동 감지)", () => {
    expect(getEffectiveAgent(null, null)).toBeUndefined();
    expect(getEffectiveAgent({ categories: [] }, undefined)).toBeUndefined();
  });
});
