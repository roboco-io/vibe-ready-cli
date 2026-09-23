import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadConfig, loadEngineConfig, getEffectiveCategories, getEffectiveWeights } from "../src/config.js";

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "vibeready-config-"));
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

function writeConfig(obj: unknown): void {
  writeFileSync(join(dir, ".vibeready.json"), JSON.stringify(obj), "utf-8");
}

describe("분석 엔진 설정", () => {
  it("엔진만 설정하면 기본 평가 항목을 상속한다", () => {
    writeConfig({ engine: "codex" });
    expect(loadConfig(dir)?.engine).toBe("codex");
    expect(loadConfig(dir)?.categories).toEqual(getEffectiveCategories(null));
  });
  it("진단은 기존 점수화 항목을 검증하지 않고 엔진만 읽는다", () => {
    writeConfig({ engine: "codex", categories: "legacy invalid", agent: "invalid" });
    expect(loadEngineConfig(dir)).toBe("codex");
    expect(() => loadConfig(dir)).toThrow();
  });
  it.each(["auto", "CODEX", "other", null, 7])("잘못된 엔진 %j를 거부한다", engine => {
    writeConfig({ engine });
    expect(() => loadConfig(dir)).toThrow(/engine|엔진/);
    expect(() => loadEngineConfig(dir)).toThrow(/engine|엔진/);
  });
  it("설정이나 엔진이 없으면 진단 기본 선택에 위임한다", () => {
    expect(loadEngineConfig(dir)).toBeUndefined();
    writeConfig({ categories: "ignored" });
    expect(loadEngineConfig(dir)).toBeUndefined();
  });
});

describe("optional 카테고리 설정", () => {
  it("optional 카테고리는 bonusCap이 필요하다", () => {
    writeConfig({
      categories: [
        { name: "테스트 커버리지", tier: "must", weight: 1.0 },
        { name: "보안", tier: "optional" },
      ],
    });
    expect(() => loadConfig(dir)).toThrow(/bonusCap/);
  });

  it("optional은 weight 정규화에서 제외되고 must/nice만 1.0으로 정규화된다", () => {
    writeConfig({
      categories: [
        { name: "테스트 커버리지", tier: "must", weight: 0.5 },
        { name: "CI/CD", tier: "must", weight: 0.5 },
        { name: "보안", tier: "optional", bonusCap: 5 },
      ],
    });
    const config = loadConfig(dir);
    const weights = getEffectiveWeights(config);
    const scorableSum = config!.categories
      .filter((c) => c.tier !== "optional")
      .reduce((s, c) => s + c.weight, 0);
    expect(scorableSum).toBeCloseTo(1.0, 5);
    expect(weights["보안"]).toEqual({ tier: "optional", weight: 0, bonusCap: 5 });
  });

  it("must/nice 없이 optional만으로는 구성할 수 없다", () => {
    writeConfig({
      categories: [{ name: "보안", tier: "optional", bonusCap: 5 }],
    });
    expect(() => loadConfig(dir)).toThrow(/must\/nice/);
  });

  it("알 수 없는 tier는 거부된다", () => {
    writeConfig({
      categories: [{ name: "테스트", tier: "bonus", weight: 1.0 }],
    });
    expect(() => loadConfig(dir)).toThrow(/tier/);
  });
});
