import { closeSync, constants, fstatSync, lstatSync, openSync, readFileSync, realpathSync, statSync, writeFileSync } from "node:fs";
import { basename, dirname, isAbsolute, relative, resolve, sep } from "node:path";
import { createInterface } from "node:readline/promises";
import { stdin, stderr } from "node:process";
import { validateAnswers, validateSnapshot } from "./validation.js";
import { buildDiagnosisReport } from "./report.js";
import { compareDiagnoses } from "./compare.js";
import { redactValue } from "./redact.js";
import { loadEngineConfig } from "../config.js";
import { assertEngineLimits, DEFAULT_MAX_BUDGET_USD, parseEngine, resolveEngine } from "../engines/selection.js";
import type { EngineId } from "../engines/types.js";
import type { DiagnosisOptions, DiagnosisSnapshot } from "./types.js";

type CliOptions = Record<string, string | boolean | undefined>;
const MAX_JSON_BYTES = 5 * 1024 * 1024;

function readJson(path: string): unknown {
  let fd: number;
  try { fd = openSync(resolve(path), constants.O_RDONLY | constants.O_NONBLOCK); }
  catch { throw new Error("JSON 입력 파일을 열 수 없습니다."); }
  try {
    const stats = fstatSync(fd);
    if (!stats.isFile() || stats.size > MAX_JSON_BYTES) throw new Error("JSON 파일 형식 또는 크기가 올바르지 않습니다. 최대 5MB입니다.");
    const content = readFileSync(fd, "utf8");
    if (Buffer.byteLength(content) > MAX_JSON_BYTES) throw new Error("JSON 파일 크기는 최대 5MB입니다.");
    try { return JSON.parse(content); }
    catch { throw new Error("JSON 입력 파일을 해석할 수 없습니다."); }
  } finally { closeSync(fd); }
}

function numeric(opts: CliOptions, key: string, fallback: number, max: number, integer = true): number {
  const value = opts[key] === undefined ? fallback : Number(opts[key]);
  if (typeof opts[key] === "boolean" || !Number.isFinite(value) || value <= 0 || value > max || integer && !Number.isInteger(value)) {
    throw new Error(`진단 옵션 ${key}: 0보다 크고 ${max} 이하인 ${integer ? "정수" : "수"}가 필요합니다.`);
  }
  return value;
}

function option(opts: CliOptions, key: string): string | undefined {
  const value = opts[key];
  if (value === undefined) return undefined;
  if (typeof value !== "string" || !value.trim()) throw new Error(`진단 옵션 ${key}: 값이 필요합니다.`);
  return value;
}

function inside(root: string, target: string): boolean {
  const rel = relative(root, target);
  return rel === "" || !isAbsolute(rel) && rel !== ".." && !rel.startsWith(`..${sep}`);
}

function outputPath(path: string | undefined, repo: string): string | undefined {
  if (!path) return undefined;
  const absolute = resolve(path);
  let parent: string;
  try { parent = realpathSync(dirname(absolute)); }
  catch { throw new Error("출력 파일의 상위 폴더가 존재하지 않습니다."); }
  const target = resolve(parent, basename(absolute));
  if (inside(repo, target)) throw new Error("진단 결과는 읽기 전용 대상 저장소 밖에 저장해야 합니다.");
  try { lstatSync(target); }
  catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return target; throw new Error("출력 경로를 확인할 수 없습니다."); }
  throw new Error("기존 출력 파일을 덮어쓸 수 없습니다. 새 경로를 지정하세요.");
}

const interview: NonNullable<DiagnosisOptions["interview"]> = async (questions, signal) => {
  if (!stdin.isTTY || signal.aborted) return {};
  const readline = createInterface({ input: stdin, output: stderr });
  const answers: Record<string, string> = Object.create(null);
  try {
    for (const q of questions) {
      if (signal.aborted) break;
      try {
        // Keep prompts on stderr, leaving JSON stdout machine readable.
        const answer = await readline.question(`${q.question.replace(/[\u0000-\u001f\u007f-\u009f]/g, " ")}\n> `, { signal });
        if (answer.trim()) answers[q.id] = answer;
      } catch (error) {
        if (signal.aborted || (error as Error).name === "AbortError") break;
        throw error;
      }
    }
  } finally { readline.close(); }
  return answers;
};

export async function runDiagnosisCli(repoPath: string, opts: CliOptions): Promise<void> {
  const cliEngine = opts.engine === undefined ? undefined : parseEngine(opts.engine);
  for (const key of ["category", "branch", "pdf", "agent"]) {
    if (opts[key] !== undefined) throw new Error(`진단 모드에서는 --${key} 옵션을 사용할 수 없습니다.`);
  }
  const provider = option(opts, "provider") ?? "auto";
  const profile = option(opts, "profile") ?? "auto";
  if (!["auto", "github", "gitlab", "none"].includes(provider)) throw new Error("지원하지 않는 진단 제공자입니다.");
  if (!["auto", "service", "library", "cli", "data", "general"].includes(profile)) throw new Error("지원하지 않는 저장소 프로필입니다.");
  const options: DiagnosisOptions = {
    provider: provider as DiagnosisOptions["provider"], profile: profile as DiagnosisOptions["profile"],
    days: numeric(opts, "days", 30, 3650), limit: numeric(opts, "limit", 30, 100),
    maxTurns: numeric(opts, "maxTurns", 200, Number.MAX_SAFE_INTEGER),
    maxBudgetUsd: opts.maxBudget === false ? Number.POSITIVE_INFINITY : numeric(opts, "maxBudget", DEFAULT_MAX_BUDGET_USD, Number.MAX_VALUE, false),
    timeoutMs: numeric(opts, "timeout", 120, 2_147_483, false) * 1000,
    verbose: opts.verbose === true, goal: option(opts, "goal"), remoteUrl: option(opts, "remoteUrl"),
  };
  const selectEngine = (engine: EngineId) => {
    assertEngineLimits(engine, {
      // --no-max-budget (false) is compatible with Codex, which has no dollar cap.
      maxBudget: opts.maxBudget !== false && (opts.maxBudgetExplicit === true || opts.maxBudgetExplicit !== false && opts.maxBudget !== undefined),
      maxTurns: opts.maxTurnsExplicit === true || opts.maxTurnsExplicit !== false && opts.maxTurns !== undefined,
    });
    options.engine = engine;
    if (engine === "codex") {
      options.maxBudgetUsd = undefined;
      options.maxTurns = undefined;
    }
  };
  let repo: string;
  try { repo = realpathSync(repoPath); if (!statSync(repo).isDirectory()) throw new Error(); }
  catch { throw new Error("분석할 저장소 폴더를 찾을 수 없습니다."); }
  const output = outputPath(option(opts, "output"), repo);
  const save = outputPath(option(opts, "saveDiagnosis"), repo);
  if (output && output === save) throw new Error("보고서와 스냅샷은 같은 출력 경로를 사용할 수 없습니다.");
  const replay = option(opts, "diagnosisFile");
  const answerFile = option(opts, "answers");
  if (answerFile && !replay) throw new Error("답변을 적용하려면 최초 진단을 --save-diagnosis로 저장한 뒤 --diagnosis-file과 --answers를 함께 사용하세요.");
  if (answerFile) options.answers = validateAnswers(readJson(answerFile));
  if (opts.interview === true && stdin.isTTY) options.interview = interview;
  const baselineFile = option(opts, "baseline");
  const baseline = baselineFile ? validateSnapshot(readJson(baselineFile)) : undefined;
  let snapshot: DiagnosisSnapshot;
  if (replay) {
    snapshot = validateSnapshot(readJson(replay));
    if (answerFile || options.interview) {
      const savedEngine = snapshot.engine ?? "claude";
      const engine = resolveEngine(cliEngine, undefined, savedEngine);
      if (engine !== savedEngine) throw new Error("인터뷰 재개 시 저장된 분석 엔진을 변경할 수 없습니다.");
      selectEngine(engine);
      const { resumeDiagnosis } = await import("./agent.js");
      snapshot = validateSnapshot(await resumeDiagnosis(repo, snapshot, options));
    }
  }
  else {
    selectEngine(resolveEngine(cliEngine, cliEngine === undefined ? loadEngineConfig(repo) : undefined));
    const { diagnoseRepository } = await import("./agent.js");
    snapshot = validateSnapshot(await diagnoseRepository(repo, options));
  }
  snapshot = redactValue(snapshot);
  const comparison = baseline ? compareDiagnoses(redactValue(baseline), snapshot) : undefined;
  const serializedSnapshot = JSON.stringify(snapshot, null, 2) + "\n";
  if (Buffer.byteLength(serializedSnapshot) > MAX_JSON_BYTES) throw new Error("진단 스냅샷 크기는 최대 5MB입니다. 관찰 표본 수를 줄여 다시 실행하세요.");
  const report = opts.json === true ? JSON.stringify({ ...snapshot, ...(comparison ? { comparison } : {}) }, null, 2) + "\n" : buildDiagnosisReport(snapshot, comparison);
  if (opts.json === true && Buffer.byteLength(report) > MAX_JSON_BYTES) throw new Error("진단 JSON 출력 크기는 최대 5MB입니다. 관찰 표본 수를 줄여 다시 실행하세요.");
  // Exclusive creation also blocks a symlink or hardlink introduced after preflight.
  try {
    if (save) writeFileSync(save, serializedSnapshot, { flag: "wx", mode: 0o600 });
    if (output) writeFileSync(output, report, { flag: "wx", mode: 0o600 });
  } catch { throw new Error("진단 결과를 저장할 수 없습니다. 출력 경로와 권한을 확인하세요."); }
  if (!output) console.log(report.trimEnd());
}
