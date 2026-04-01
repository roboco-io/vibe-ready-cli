#!/usr/bin/env node

import { Command } from "commander";
import { resolve } from "node:path";
import { existsSync, writeFileSync, unlinkSync } from "node:fs";
import { execSync } from "node:child_process";
import { analyzeRepository } from "./analyzer.js";
import { computeResult } from "./scorer.js";
import {
  printReport,
  printVerboseFindings,
  printMarkdownReport,
  buildMarkdownReport,
  buildPdfMarkdown,
  buildMultiBranchMarkdown,
  buildMultiBranchPdf,
} from "./reporter.js";
import { getCachedResult, setCachedResult } from "./cache.js";
import { ALL_CATEGORIES } from "./prompts/analyze.js";
import type { BranchResult } from "./types.js";

const program = new Command();

program
  .name("vibe-ready")
  .description("Analyze how ready your repository is for vibe coding")
  .version("0.1.0")
  .argument("[path]", "Path to the repository to analyze", ".")
  .option("-v, --verbose", "Show detailed analysis findings")
  .option("-m, --markdown", "Output in Markdown format")
  .option("-c, --category <names>", "Analyze specific categories only (comma-separated)")
  .option("-b, --branch <branches>", "Analyze specific branches (comma-separated)")
  .option("--no-cache", "Skip cache and force fresh analysis")
  .option("-o, --output <file>", "Save report to file (auto-detects markdown from .md extension)")
  .option("--pdf <file>", "Export report as PDF (requires pandoc + xelatex)")
  .option("--max-turns <number>", "Max LLM agent turns", "20")
  .option("--max-budget <number>", "Max budget in USD per analysis", "0.50")
  .option("--timeout <number>", "Timeout in seconds", "120")
  .action(async (path: string, opts: Record<string, string | boolean | undefined>) => {
    const repoPath = resolve(path);

    if (!existsSync(repoPath)) {
      console.error(`Error: 경로를 찾을 수 없습니다: ${repoPath}`);
      process.exit(1);
    }

    const verbose = opts.verbose === true;
    const useCache = opts.cache !== false;
    const categories = typeof opts.category === "string"
      ? opts.category.split(",").map((c) => c.trim())
      : undefined;
    const branches = typeof opts.branch === "string"
      ? opts.branch.split(",").map((b) => b.trim())
      : undefined;

    // 카테고리 유효성 검증
    if (categories) {
      for (const cat of categories) {
        if (!ALL_CATEGORIES.includes(cat)) {
          console.error(`Error: 알 수 없는 카테고리: "${cat}"`);
          console.error(`사용 가능한 카테고리: ${ALL_CATEGORIES.join(", ")}`);
          process.exit(1);
        }
      }
    }

    const analyzerOpts = {
      maxTurns: Number(opts.maxTurns),
      maxBudgetUsd: Number(opts.maxBudget),
      timeoutMs: Number(opts.timeout) * 1000,
      verbose,
      categories,
    };

    try {
      if (branches && branches.length > 0) {
        await handleMultiBranch(repoPath, branches, analyzerOpts, useCache, opts);
      } else {
        await handleSingleBranch(repoPath, analyzerOpts, useCache, opts);
      }
    } catch (error) {
      if (error instanceof Error) {
        if (error.name === "AbortError") {
          console.error("Error: 분석 시간이 초과되었습니다. --timeout 값을 늘려보세요.");
        } else {
          console.error(`Error: ${error.message}`);
        }
      } else {
        console.error("알 수 없는 오류가 발생했습니다.");
      }
      process.exit(1);
    }
  });

async function handleSingleBranch(
  repoPath: string,
  analyzerOpts: { maxTurns: number; maxBudgetUsd: number; timeoutMs: number; verbose: boolean; categories?: string[] },
  useCache: boolean,
  opts: Record<string, string | boolean | undefined>,
) {
  const verbose = analyzerOpts.verbose;

  if (verbose) process.stderr.write("분석 중");

  let llmOutput = useCache ? getCachedResult(repoPath) : null;

  if (llmOutput) {
    if (verbose) process.stderr.write("캐시된 결과를 사용합니다.\n");
  } else {
    llmOutput = await analyzeRepository(repoPath, analyzerOpts);
    if (useCache) setCachedResult(repoPath, llmOutput);
  }

  const result = computeResult(llmOutput);
  outputResult(result, null, repoPath, verbose, opts);
}

async function handleMultiBranch(
  repoPath: string,
  branches: string[],
  analyzerOpts: { maxTurns: number; maxBudgetUsd: number; timeoutMs: number; verbose: boolean; categories?: string[] },
  useCache: boolean,
  opts: Record<string, string | boolean | undefined>,
) {
  const verbose = analyzerOpts.verbose;

  // 현재 브랜치 저장
  let originalBranch: string;
  try {
    originalBranch = execSync("git rev-parse --abbrev-ref HEAD", { cwd: repoPath }).toString().trim();
  } catch {
    console.error("Error: git 리포지토리가 아니거나 git을 사용할 수 없습니다.");
    process.exit(1);
  }

  const branchResults: BranchResult[] = [];

  try {
    for (const branch of branches) {
      if (verbose) process.stderr.write(`\n[브랜치: ${branch}] `);

      // 브랜치 전환
      try {
        execSync(`git checkout ${branch}`, { cwd: repoPath, stdio: "pipe" });
      } catch {
        console.error(`Error: 브랜치 "${branch}"로 전환할 수 없습니다.`);
        continue;
      }

      if (verbose) process.stderr.write("분석 중");

      let llmOutput = useCache ? getCachedResult(repoPath) : null;

      if (llmOutput) {
        if (verbose) process.stderr.write("캐시된 결과를 사용합니다.\n");
      } else {
        llmOutput = await analyzeRepository(repoPath, analyzerOpts);
        if (useCache) setCachedResult(repoPath, llmOutput);
      }

      branchResults.push({
        branch,
        result: computeResult(llmOutput),
      });
    }
  } finally {
    // 원래 브랜치로 복원
    try {
      execSync(`git checkout ${originalBranch}`, { cwd: repoPath, stdio: "pipe" });
    } catch {
      console.error(`Warning: 원래 브랜치(${originalBranch})로 복원하지 못했습니다.`);
    }
  }

  if (branchResults.length === 0) {
    console.error("Error: 분석할 수 있는 브랜치가 없습니다.");
    process.exit(1);
  }

  outputResult(null, branchResults, repoPath, verbose, opts);
}

function outputResult(
  singleResult: import("./types.js").AnalysisResult | null,
  branchResults: BranchResult[] | null,
  repoPath: string,
  verbose: boolean,
  opts: Record<string, string | boolean | undefined>,
) {
  const outputFile = typeof opts.output === "string" ? opts.output : null;
  const pdfFile = typeof opts.pdf === "string" ? opts.pdf : null;
  const markdown = opts.markdown === true || (outputFile?.endsWith(".md") ?? false);
  const isMultiBranch = branchResults !== null && branchResults.length > 0;

  // 마크다운 콘텐츠 생성
  const mdContent = isMultiBranch
    ? buildMultiBranchMarkdown(branchResults, verbose, repoPath)
    : buildMarkdownReport(singleResult!, verbose, repoPath);

  // 파일 출력
  if (outputFile) {
    writeFileSync(resolve(outputFile), mdContent, "utf-8");
    console.log(`리포트가 ${resolve(outputFile)}에 저장되었습니다.`);
  }

  // PDF 출력
  if (pdfFile) {
    const pdfContent = isMultiBranch
      ? buildMultiBranchPdf(branchResults, verbose, repoPath)
      : buildPdfMarkdown(singleResult!, verbose, repoPath);
    const tmpMd = resolve(`.vibe-ready-tmp-${Date.now()}.md`);
    const pdfPath = resolve(pdfFile);
    try {
      writeFileSync(tmpMd, pdfContent, "utf-8");
      execSync(
        `pandoc "${tmpMd}" -o "${pdfPath}" --pdf-engine=xelatex -V mainfont="Apple SD Gothic Neo" -V geometry:margin=2cm`,
        { stdio: "pipe" },
      );
      console.log(`PDF 리포트가 ${pdfPath}에 저장되었습니다.`);
    } catch (e) {
      console.error("PDF 생성 실패. pandoc과 xelatex가 설치되어 있는지 확인하세요.");
      if (e instanceof Error) console.error(e.message);
      process.exit(1);
    } finally {
      try { unlinkSync(tmpMd); } catch {}
    }
  }

  // 터미널 출력
  if (!outputFile && !pdfFile) {
    if (isMultiBranch || markdown) {
      console.log(mdContent);
    } else {
      printReport(singleResult!);
      if (verbose) printVerboseFindings(singleResult!);
    }
  }
}

program.parse();
