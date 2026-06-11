import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { getCachedResult, setCachedResult } from "../src/cache.js";
import type { LLMAnalysisOutput } from "../src/types.js";

const FAKE_OUTPUT: LLMAnalysisOutput = {
  categories: [
    {
      name: "테스트 커버리지",
      tier: "must",
      score: 80,
      recommendations: [],
      rawFindings: [],
    },
  ],
  summary: "테스트용 결과",
};

describe("cache", () => {
  let repoPath: string;

  beforeEach(() => {
    repoPath = mkdtempSync(join(tmpdir(), "vibe-ready-cache-test-"));
  });

  afterEach(() => {
    rmSync(repoPath, { recursive: true, force: true });
  });

  it("저장한 결과를 다시 읽어온다", () => {
    setCachedResult(repoPath, FAKE_OUTPUT);
    expect(getCachedResult(repoPath)).toEqual(FAKE_OUTPUT);
  });

  it("캐시가 없으면 null을 반환한다", () => {
    expect(getCachedResult(repoPath)).toBeNull();
  });

  it("스토어 버전이 다르면 캐시를 무시하고 null을 반환한다", () => {
    setCachedResult(repoPath, FAKE_OUTPUT);

    // 저장된 캐시 파일의 버전을 구버전(1)으로 변조
    const cachePath = join(repoPath, ".vibe-ready", "cache.json");
    const store = JSON.parse(readFileSync(cachePath, "utf-8"));
    store.version = 1;
    writeFileSync(cachePath, JSON.stringify(store));

    expect(getCachedResult(repoPath)).toBeNull();
  });

  it("캐시 파일이 손상되면 null을 반환한다", () => {
    setCachedResult(repoPath, FAKE_OUTPUT);
    const cachePath = join(repoPath, ".vibe-ready", "cache.json");
    writeFileSync(cachePath, "{invalid json");

    expect(getCachedResult(repoPath)).toBeNull();
  });
});
