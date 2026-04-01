#!/usr/bin/env node

import { Command } from "commander";
import { resolve } from "node:path";
import { existsSync } from "node:fs";
import { analyzeRepository } from "./analyzer.js";
import { computeResult } from "./scorer.js";
import { printReport, printVerboseFindings, printMarkdownReport } from "./reporter.js";
import { getCachedResult, setCachedResult } from "./cache.js";

const program = new Command();

program
  .name("vibe-ready")
  .description("Analyze how ready your repository is for vibe coding")
  .version("0.1.0")
  .argument("[path]", "Path to the repository to analyze", ".")
  .option("-v, --verbose", "Show detailed analysis findings")
  .option("-m, --markdown", "Output in Markdown format")
  .option("--no-cache", "Skip cache and force fresh analysis")
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

    try {
      if (verbose) {
        process.stderr.write("분석 중");
      }

      const useCache = opts.cache !== false;
      let llmOutput = useCache ? getCachedResult(repoPath) : null;

      if (llmOutput) {
        if (verbose) {
          process.stderr.write("캐시된 결과를 사용합니다.\n");
        }
      } else {
        llmOutput = await analyzeRepository(repoPath, {
          maxTurns: Number(opts.maxTurns),
          maxBudgetUsd: Number(opts.maxBudget),
          timeoutMs: Number(opts.timeout) * 1000,
          verbose,
        });

        if (useCache) {
          setCachedResult(repoPath, llmOutput);
        }
      }

      const result = computeResult(llmOutput);
      const markdown = opts.markdown === true;

      if (markdown) {
        printMarkdownReport(result, verbose);
      } else {
        printReport(result);
        if (verbose) {
          printVerboseFindings(result);
        }
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

program.parse();
