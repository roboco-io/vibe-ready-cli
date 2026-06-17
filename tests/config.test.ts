import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadConfig, getEffectiveWeights } from "../src/config.js";

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
