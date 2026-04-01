import { describe, it, expect } from "vitest";
import {
  DEFAULT_MAX_TURNS,
  DEFAULT_MAX_BUDGET_USD,
  DEFAULT_TIMEOUT_MS,
} from "../src/analyzer.js";

describe("analyzer default constants", () => {
  it("DEFAULT_MAX_TURNS should be 200", () => {
    expect(DEFAULT_MAX_TURNS).toBe(200);
  });

  it("DEFAULT_MAX_BUDGET_USD should be 0.50", () => {
    expect(DEFAULT_MAX_BUDGET_USD).toBe(0.50);
  });

  it("DEFAULT_TIMEOUT_MS should be 120000", () => {
    expect(DEFAULT_TIMEOUT_MS).toBe(120_000);
  });
});
