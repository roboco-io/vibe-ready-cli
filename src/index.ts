#!/usr/bin/env node

import { Command } from "commander";
import { resolve } from "node:path";
import { existsSync, writeFileSync, unlinkSync } from "node:fs";
import { execSync } from "node:child_process";
import { analyzeRepository } from "./analyzer.js";
import { computeResult } from "./scorer.js";
import { printReport, printVerboseFindings, printMarkdownReport, buildMarkdownReport, buildPdfMarkdown } from "./reporter.js";
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
      const outputFile = typeof opts.output === "string" ? opts.output : null;
      const markdown = opts.markdown === true || (outputFile?.endsWith(".md") ?? false);

      if (outputFile) {
        const content = buildMarkdownReport(result, verbose, repoPath);
        const outPath = resolve(outputFile);
        writeFileSync(outPath, content, "utf-8");
        console.log(`리포트가 ${outPath}에 저장되었습니다.`);
      }

      const pdfFile = typeof opts.pdf === "string" ? opts.pdf : null;

      if (pdfFile) {
        const content = buildPdfMarkdown(result, verbose, repoPath);
        const tmpMd = resolve(`.vibe-ready-tmp-${Date.now()}.md`);
        const pdfPath = resolve(pdfFile);
        try {
          writeFileSync(tmpMd, content, "utf-8");
          execSync(
            `pandoc "${tmpMd}" -o "${pdfPath}" --pdf-engine=xelatex -V mainfont="Apple SD Gothic Neo" -V geometry:margin=2cm`,
            { stdio: "pipe" },
          );
          console.log(`PDF 리포트가 ${pdfPath}에 저장되었습니다.`);
        } catch (e) {
          console.error("PDF 생성 실패. pandoc과 xelatex가 설치되어 있는지 확인하세요.");
          console.error("설치: brew install pandoc && brew install --cask mactex");
          if (e instanceof Error) console.error(e.message);
          process.exit(1);
        } finally {
          try { unlinkSync(tmpMd); } catch {}
        }
      }

      if (markdown && !outputFile && !pdfFile) {
        printMarkdownReport(result, verbose, repoPath);
      } else if (!outputFile && !pdfFile) {
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
