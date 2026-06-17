import chalk from "chalk";
import type { AnalysisResult, BranchResult, CategoryResult, Grade } from "./types.js";

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
  if (tier === "must") return chalk.red("필수");
  if (tier === "optional") return chalk.cyan("선택");
  return chalk.gray("권장");
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
  const optionalCategories = categories.filter((c) => c.tier === "optional");

  for (const cat of [...mustCategories, ...niceCategories, ...optionalCategories]) {
    const line = `  ${pad(cat.name, 20)} ${pad(tierLabel(cat.tier), 8)} ${pad(colorScore(cat.score, cat.grade), 8)} ${colorGrade(cat.grade)}`;
    console.log(line);
  }

  if (optionalCategories.length > 0) {
    console.log(chalk.gray("  선택 항목은 등급에 영향을 주지 않으며 점수에 비례해 가산점만 더합니다."));
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
  const optionalCategories = categories.filter((c) => c.tier === "optional");

  for (const cat of [...mustCategories, ...niceCategories, ...optionalCategories]) {
    const tier = cat.tier === "must" ? "필수" : cat.tier === "optional" ? "선택" : "권장";
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

export function buildMultiBranchMarkdown(branches: BranchResult[], verbose: boolean, repoPath?: string): string {
  const lines: string[] = [];
  lines.push("# 🎵 Vibe Ready Score — 브랜치별 비교");
  lines.push("");
  if (repoPath) {
    lines.push(`**대상 리포지토리**: \`${repoPath}\``);
    lines.push(`**분석 일시**: ${new Date().toISOString().replace("T", " ").slice(0, 19)}`);
    lines.push(`**분석 브랜치**: ${branches.map((b) => b.branch).join(", ")}`);
    lines.push("");
  }

  // 비교 테이블
  lines.push("## 종합 비교");
  lines.push("");
  const header = ["| 카테고리 | 구분", ...branches.map((b) => `| ${b.branch}`), "|"].join(" ");
  const divider = ["|----------|------", ...branches.map(() => "|------"), "|"].join("");
  lines.push(header);
  lines.push(divider);

  // 모든 카테고리 이름 수집 (첫 번째 브랜치 기준)
  const allCats = branches[0].result.categories;
  const mustCats = allCats.filter((c) => c.tier === "must");
  const niceCats = allCats.filter((c) => c.tier === "nice");
  const optionalCats = allCats.filter((c) => c.tier === "optional");

  for (const cat of [...mustCats, ...niceCats, ...optionalCats]) {
    const tier = cat.tier === "must" ? "필수" : cat.tier === "optional" ? "선택" : "권장";
    const scores = branches.map((b) => {
      const found = b.result.categories.find((c) => c.name === cat.name);
      return found ? `| ${found.score} (${found.grade})` : "| -";
    });
    lines.push(`| ${cat.name} | ${tier} ${scores.join(" ")} |`);
  }

  const totals = branches.map((b) => `| **${Math.round(b.result.totalScore)} (${b.result.totalGrade})**`);
  lines.push(`| **종합** | ${totals.join(" ")} |`);
  lines.push("");

  // 브랜치별 상세
  for (const br of branches) {
    lines.push(`---`);
    lines.push("");
    lines.push(`## 브랜치: ${br.branch}`);
    lines.push("");
    lines.push(`**종합 점수: ${Math.round(br.result.totalScore)} / 100  등급: ${br.result.totalGrade}**`);

    if (br.result.penaltyApplied && br.result.penaltyReason) {
      lines.push("");
      lines.push(`> ⚠️ ${br.result.penaltyReason}`);
    }
    lines.push("");

    // 권고사항
    const allRecs = br.result.categories.flatMap((c) =>
      c.recommendations.map((r) => ({ ...r, category: c.name })),
    );
    if (allRecs.length > 0) {
      lines.push("### 개선 권고");
      lines.push("");
      for (const rec of allRecs.filter((r) => r.severity === "critical")) {
        lines.push(`- ❌ **[${rec.category}]** ${rec.message}`);
        lines.push(`  - → ${rec.action}`);
      }
      for (const rec of allRecs.filter((r) => r.severity === "warning")) {
        lines.push(`- ⚠️ **[${rec.category}]** ${rec.message}`);
        lines.push(`  - → ${rec.action}`);
      }
      for (const rec of allRecs.filter((r) => r.severity === "info")) {
        lines.push(`- ℹ️ **[${rec.category}]** ${rec.message}`);
        lines.push(`  - → ${rec.action}`);
      }
      lines.push("");
    }

    if (verbose) {
      lines.push("### 상세 분석 결과");
      lines.push("");
      for (const cat of br.result.categories) {
        lines.push(`#### ${cat.name}`);
        lines.push("");
        for (const f of cat.rawFindings) {
          const icon = f.found ? "✅" : "❌";
          lines.push(`- ${icon} **${f.item}**: ${f.details}`);
        }
        lines.push("");
      }
    }
  }

  lines.push("---");
  lines.push("*Powered by Claude Agent SDK | vibe-ready*");

  return lines.join("\n");
}

export function buildMultiBranchPdf(branches: BranchResult[], verbose: boolean, repoPath?: string): string {
  let md = buildMultiBranchMarkdown(branches, verbose, repoPath);
  for (const [pattern, replacement] of PDF_EMOJI_MAP) {
    md = md.replace(pattern, replacement);
  }
  return md;
}
