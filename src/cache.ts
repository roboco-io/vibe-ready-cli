import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { createHash } from "node:crypto";
import type { LLMAnalysisOutput } from "./types.js";

const CACHE_DIR = ".vibe-ready";
const CACHE_FILE = "cache.json";
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24시간

interface CacheEntry {
  repoPath: string;
  repoHash: string;
  timestamp: number;
  llmOutput: LLMAnalysisOutput;
}

interface CacheStore {
  version: 1;
  entries: Record<string, CacheEntry>;
}

function getCachePath(repoPath: string): string {
  return join(repoPath, CACHE_DIR, CACHE_FILE);
}

function computeRepoHash(repoPath: string): string {
  const hash = createHash("sha256");
  // 핵심 설정 파일들의 존재 여부와 수정 시간을 해시에 포함
  const filesToCheck = [
    "package.json", "pyproject.toml", "go.mod", "Cargo.toml",
    "tsconfig.json", "jest.config.ts", "vitest.config.ts",
    ".github/workflows", ".gitlab-ci.yml",
    ".husky", ".lintstagedrc",
    "CLAUDE.md", "AGENTS.md", ".cursorrules",
    "README.md", "CONTRIBUTING.md",
  ];

  for (const file of filesToCheck) {
    const fullPath = join(repoPath, file);
    try {
      const stat = readFileSync(fullPath);
      hash.update(`${file}:${stat.length}`);
    } catch {
      hash.update(`${file}:missing`);
    }
  }

  return hash.digest("hex").slice(0, 16);
}

function loadCache(repoPath: string): CacheStore {
  const cachePath = getCachePath(repoPath);
  try {
    const data = readFileSync(cachePath, "utf-8");
    return JSON.parse(data) as CacheStore;
  } catch {
    return { version: 1, entries: {} };
  }
}

function saveCache(repoPath: string, store: CacheStore): void {
  const cacheDir = join(repoPath, CACHE_DIR);
  if (!existsSync(cacheDir)) {
    mkdirSync(cacheDir, { recursive: true });
  }
  writeFileSync(getCachePath(repoPath), JSON.stringify(store, null, 2));
}

export function getCachedResult(repoPath: string): LLMAnalysisOutput | null {
  const store = loadCache(repoPath);
  const repoHash = computeRepoHash(repoPath);
  const entry = store.entries[repoHash];

  if (!entry) return null;

  const age = Date.now() - entry.timestamp;
  if (age > CACHE_TTL_MS) return null;

  return entry.llmOutput;
}

export function setCachedResult(repoPath: string, llmOutput: LLMAnalysisOutput): void {
  const store = loadCache(repoPath);
  const repoHash = computeRepoHash(repoPath);

  // 오래된 엔트리 정리
  const now = Date.now();
  for (const [key, entry] of Object.entries(store.entries)) {
    if (now - entry.timestamp > CACHE_TTL_MS) {
      delete store.entries[key];
    }
  }

  store.entries[repoHash] = {
    repoPath,
    repoHash,
    timestamp: now,
    llmOutput,
  };

  saveCache(repoPath, store);
}
