import chalk from "chalk";
import type { AnalysisResult, CategoryResult, Grade } from "./types.js";

const GRADE_COLORS: Record<Grade, (text: string) => string> = {
  A: chalk.green,
  B: chalk.blue,
  C: chalk.yellow,
  D: chalk.hex("#FF8C00"),
  F: chalk.red,
};

function colorGrade(grade: Grade): string {
  return GRADE_COLORS[grade](grade);
}

function colorScore(score: number, grade: Grade): string {
  return GRADE_COLORS[grade](String(score));
}

function tierLabel(tier: string): string {
  return tier === "must" ? chalk.red("필수") : chalk.gray("권장");
}

function pad(str: string, len: number): string {
  const stripped = str.replace(/\x1b\[[0-9;]*m/g, "");
  return str + " ".repeat(Math.max(0, len - stripped.length));
}

export function printReport(result: AnalysisResult): void {
  const { totalScore, totalGrade, categories, summary, penaltyApplied, penaltyReason } = result;

  // Header
  console.log();
  console.log(chalk.bold("═══════════════════════════════════════════════════"));
  console.log(chalk.bold("  🎵 Vibe Ready Score"));
  console.log(chalk.bold("═══════════════════════════════════════════════════"));
  console.log();

  // Total score
  const gradeColor = GRADE_COLORS[totalGrade];
  console.log(
    `  종합 점수: ${gradeColor(chalk.bold(String(Math.round(totalScore))))} / 100  등급: ${gradeColor(chalk.bold(totalGrade))}`,
  );

  if (penaltyApplied && penaltyReason) {
    console.log(`  ${chalk.red("⚠ " + penaltyReason)}`);
  }

  console.log();

  // Category table
  console.log(chalk.bold("  카테고리별 결과"));
  console.log(chalk.gray("  ─────────────────────────────────────────────────"));
  console.log(
    `  ${pad("카테고리", 20)} ${pad("구분", 8)} ${pad("점수", 8)} ${pad("등급", 6)}`,
  );
  console.log(chalk.gray("  ─────────────────────────────────────────────────"));

  const mustCategories = categories.filter((c) => c.tier === "must");
  const niceCategories = categories.filter((c) => c.tier === "nice");

  for (const cat of [...mustCategories, ...niceCategories]) {
    const line = `  ${pad(cat.name, 20)} ${pad(tierLabel(cat.tier), 8)} ${pad(colorScore(cat.score, cat.grade), 8)} ${colorGrade(cat.grade)}`;
    console.log(line);
  }

  console.log(chalk.gray("  ─────────────────────────────────────────────────"));
  console.log();

  // Recommendations
  const allRecs = categories.flatMap((c) =>
    c.recommendations.map((r) => ({ ...r, category: c.name })),
  );

  const critical = allRecs.filter((r) => r.severity === "critical");
  const warnings = allRecs.filter((r) => r.severity === "warning");
  const infos = allRecs.filter((r) => r.severity === "info");

  if (allRecs.length > 0) {
    console.log(chalk.bold("  개선 권고"));
    console.log();

    for (const rec of critical) {
      console.log(`  ${chalk.red("✖")} [${rec.category}] ${rec.message}`);
      console.log(`    ${chalk.gray("→")} ${rec.action}`);
    }
    for (const rec of warnings) {
      console.log(`  ${chalk.yellow("⚠")} [${rec.category}] ${rec.message}`);
      console.log(`    ${chalk.gray("→")} ${rec.action}`);
    }
    for (const rec of infos) {
      console.log(`  ${chalk.blue("ℹ")} [${rec.category}] ${rec.message}`);
      console.log(`    ${chalk.gray("→")} ${rec.action}`);
    }

    console.log();
  }

  // Summary
  console.log(chalk.bold("  요약"));
  console.log(`  ${summary}`);
  console.log();
  console.log(chalk.gray("  ─────────────────────────────────────────────────"));
  console.log(chalk.gray("  Powered by Claude Agent SDK | vibe-ready"));
  console.log();
}

export function buildMarkdownReport(result: AnalysisResult, verbose: boolean, repoPath?: string): string {
  const { totalScore, totalGrade, categories, summary, penaltyApplied, penaltyReason } = result;

  const lines: string[] = [];
  lines.push("# 🎵 Vibe Ready Score");
  lines.push("");
  if (repoPath) {
    lines.push(`**대상 리포지토리**: \`${repoPath}\``);
    lines.push(`**분석 일시**: ${new Date().toISOString().replace("T", " ").slice(0, 19)}`);
    lines.push("");
  }
  lines.push(`**종합 점수: ${Math.round(totalScore)} / 100  등급: ${totalGrade}**`);

  if (penaltyApplied && penaltyReason) {
    lines.push("");
    lines.push(`> ⚠️ ${penaltyReason}`);
  }

  lines.push("");
  lines.push("## 카테고리별 결과");
  lines.push("");
  lines.push("| 카테고리 | 구분 | 점수 | 등급 |");
  lines.push("|----------|------|------|------|");

  const mustCategories = categories.filter((c) => c.tier === "must");
  const niceCategories = categories.filter((c) => c.tier === "nice");

  for (const cat of [...mustCategories, ...niceCategories]) {
    const tier = cat.tier === "must" ? "필수" : "권장";
    lines.push(`| ${cat.name} | ${tier} | ${cat.score} | ${cat.grade} |`);
  }

  const allRecs = categories.flatMap((c) =>
    c.recommendations.map((r) => ({ ...r, category: c.name })),
  );

  if (allRecs.length > 0) {
    lines.push("");
    lines.push("## 개선 권고");
    lines.push("");

    const critical = allRecs.filter((r) => r.severity === "critical");
    const warnings = allRecs.filter((r) => r.severity === "warning");
    const infos = allRecs.filter((r) => r.severity === "info");

    for (const rec of critical) {
      lines.push(`- ❌ **[${rec.category}]** ${rec.message}`);
      lines.push(`  - → ${rec.action}`);
    }
    for (const rec of warnings) {
      lines.push(`- ⚠️ **[${rec.category}]** ${rec.message}`);
      lines.push(`  - → ${rec.action}`);
    }
    for (const rec of infos) {
      lines.push(`- ℹ️ **[${rec.category}]** ${rec.message}`);
      lines.push(`  - → ${rec.action}`);
    }
  }

  lines.push("");
  lines.push("## 요약");
  lines.push("");
  lines.push(summary);

  if (verbose) {
    lines.push("");
    lines.push("## 상세 분석 결과");
    lines.push("");

    for (const cat of categories) {
      lines.push(`### ${cat.name}`);
      lines.push("");
      for (const finding of cat.rawFindings) {
        const icon = finding.found ? "✅" : "❌";
        lines.push(`- ${icon} **${finding.item}**: ${finding.details}`);
      }
      lines.push("");
    }
  }

  lines.push("---");
  lines.push("*Powered by Claude Agent SDK | vibe-ready*");

  return lines.join("\n");
}

export function printMarkdownReport(result: AnalysisResult, verbose: boolean, repoPath?: string): void {
  console.log(buildMarkdownReport(result, verbose, repoPath));
}

const PDF_EMOJI_MAP: [RegExp, string][] = [
  [/🎵/g, "[Vibe]"],
  [/❌/g, "[X]"],
  [/✅/g, "[O]"],
  [/⚠️/g, "[!]"],
  [/ℹ️/g, "[i]"],
  [/⚠/g, "[!]"],
  [/ℹ/g, "[i]"],
];

export function buildPdfMarkdown(result: AnalysisResult, verbose: boolean, repoPath?: string): string {
  let md = buildMarkdownReport(result, verbose, repoPath);
  for (const [pattern, replacement] of PDF_EMOJI_MAP) {
    md = md.replace(pattern, replacement);
  }
  return md;
}

export function printVerboseFindings(result: AnalysisResult): void {
  console.log();
  console.log(chalk.bold("  상세 분석 결과"));
  console.log();

  for (const cat of result.categories) {
    console.log(chalk.bold(`  [${cat.name}]`));
    for (const finding of cat.rawFindings) {
      const icon = finding.found ? chalk.green("✓") : chalk.red("✗");
      console.log(`    ${icon} ${finding.item}: ${chalk.gray(finding.details)}`);
    }
    console.log();
  }
}
