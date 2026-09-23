import type { HookCallback } from "@anthropic-ai/claude-agent-sdk";
import type { ClaudeQuery, EngineRunner } from "../engines/types.js";
import { runAnalysisEngine } from "../engines/run.js";
import { assertEngineLimits, DEFAULT_MAX_BUDGET_USD, resolveEngine } from "../engines/selection.js";
import { execFileSync } from "node:child_process";
import { readdirSync, realpathSync } from "node:fs";
import { relative, resolve, isAbsolute, sep } from "node:path";
import { pathToFileURL } from "node:url";
import { collectRemoteEvidence } from "./providers.js";
import { computeDiagnosisMetrics } from "./metrics.js";
import { detectProfile, PROFILES, readRepositoryFile, RUBRIC_VERSION } from "./rubric.js";
import { buildDiagnosisPrompt, DIAGNOSIS_SCHEMA } from "./prompt.js";
import { object, validateAnswers, validateDiagnosisOutput, validateSnapshot } from "./validation.js";
import { redactValue } from "./redact.js";
import type { DiagnosisOptions, DiagnosisOutput, DiagnosisSnapshot, Evidence, RemoteCollection } from "./types.js";

export type QueryRunner = ClaudeQuery;
interface Dependencies { query?: QueryRunner; codexRun?: EngineRunner; collect?: typeof collectRemoteEvidence; now?: () => Date; resume?: DiagnosisSnapshot; }

function git(repoPath: string, args: string[]): string | null {
  const env = { ...process.env };
  for (const key of Object.keys(env)) if (key.startsWith("GIT_")) delete env[key];
  try { return execFileSync("git", ["-C", repoPath, ...args], { encoding: "utf8", timeout: 3000, maxBuffer: 100_000, stdio: ["ignore", "pipe", "pipe"], env }).trim(); }
  catch { return null; }
}
function repositoryEvidence(repoPath: string): Evidence[] {
  const excluded = new Set([".git", "node_modules", ".omc", ".omx", ".env"]);
  const files = readdirSync(repoPath).filter(f => !excluded.has(f) && !f.startsWith(".env.")).sort();
  const result: Evidence[] = [{ id: "repo:inventory", source: "repository", locator: ".", summary: `루트 경로 목록(최대 100개, 하위 파일 부재를 입증하지 않음): ${files.slice(0, 100).join(", ")}` }];
  for (const file of ["README.md", "AGENTS.md", "CLAUDE.md", "package.json", "pyproject.toml", "go.mod", "Cargo.toml"]) {
    try { result.push({ id: `repo:${file}`, source: "repository", locator: file, summary: readRepositoryFile(repoPath, file).slice(0, 4000) }); }
    catch { /* Agent can investigate relevant missing/alternative documentation. */ }
  }
  return result;
}

function restrictTools(repoPath: string): HookCallback {
  return async input => {
    if (input.hook_event_name !== "PreToolUse") return {};
    const deny = () => ({ hookSpecificOutput: { hookEventName: "PreToolUse" as const, permissionDecision: "deny" as const, permissionDecisionReason: "진단은 저장소 내부의 읽기 전용 도구만 허용합니다." } });
    // The SDK injects this virtual response tool for outputFormat; it has no I/O.
    if (input.tool_name === "StructuredOutput") return {};
    if (!["Read", "Glob", "Grep"].includes(input.tool_name)) return deny();
    try {
      const args = object(input.tool_input, "도구 입력");
      const path = args.file_path ?? args.path ?? repoPath;
      if (typeof path !== "string") return deny();
      const full = realpathSync(resolve(repoPath, path));
      const rel = relative(repoPath, full);
      if (isAbsolute(rel) || rel === ".." || rel.startsWith(`..${sep}`)) return deny();
      if (rel.split(sep).some(p => [".git", "node_modules", ".omc", ".omx", "worktrees", ".worktrees"].includes(p))) return deny();
      // Directory-wide Grep cannot reliably exclude all secret files with one
      // SDK glob. Require an explicitly selected, validated regular file.
      if (input.tool_name === "Read" || input.tool_name === "Grep") readRepositoryFile(repoPath, path);
      if (input.tool_name === "Glob" && typeof args.pattern === "string" && (isAbsolute(args.pattern) || args.pattern.split(/[\\/]/).includes(".."))) return deny();
      return {};
    } catch { return deny(); }
  };
}

function selectEvidence(evidence: Evidence[], remote: RemoteCollection): Evidence[] {
  // Round-robin across sources keeps a large review thread from hiding all CI.
  const groups = ["repository", "pull-request", "review", "ci", "interview"].map(source => evidence.filter(e => e.source === source));
  const selected: Evidence[] = []; let size = 0;
  for (let i = 0; groups.some(g => i < g.length); i++) {
    for (const group of groups) {
      if (!group[i]) continue;
      const e = { ...group[i], summary: group[i].summary.slice(0, 2000) };
      size += JSON.stringify(e).length;
      if (size > 60_000) {
        remote.truncated = true;
        remote.gaps.push("진단 입력의 60,000자 제한으로 일부 근거가 에이전트 조사에서 생략되었습니다.");
        return selected;
      }
      selected.push(e);
    }
  }
  return selected;
}

export async function diagnoseRepository(repoPath: string, options: DiagnosisOptions = {}, dependencies: Dependencies = {}): Promise<DiagnosisSnapshot> {
  const root = realpathSync(repoPath);
  const previous = dependencies.resume;
  const engine = resolveEngine(options.engine, previous?.engine);
  assertEngineLimits(engine, { maxBudget: options.maxBudgetUsd !== undefined, maxTurns: options.maxTurns !== undefined });
  if (!previous && Object.keys(options.answers ?? {}).length) throw new Error("파일 답변은 저장한 진단 스냅샷과 함께 재개해야 합니다");
  const days = previous?.window.days ?? options.days ?? 30; const limit = previous?.window.limit ?? options.limit ?? 30;
  let turns = options.maxTurns ?? 200; let budget = options.maxBudgetUsd ?? DEFAULT_MAX_BUDGET_USD; const totalBudget = budget;
  const timeoutMs = options.timeoutMs ?? 120_000;
  if (!Number.isInteger(days) || days < 1 || days > 3650 || !Number.isInteger(limit) || limit < 1 || limit > 100 || !Number.isInteger(turns) || turns <= 0 || Number.isNaN(budget) || budget <= 0 || !Number.isFinite(timeoutMs) || timeoutMs <= 0 || timeoutMs > 2_147_483_647) throw new Error("진단 기간, 표본 수, 턴 수, 예산, 타임아웃은 유효한 양수여야 합니다");
  const profile = previous?.profile ?? (options.profile && options.profile !== "auto" ? options.profile : detectProfile(root));
  if (!PROFILES.includes(profile)) throw new Error("지원하지 않는 저장소 유형입니다");
  const goal = previous?.goal ?? (options.goal?.trim() || "AI 개발 도입 준비와 개선 전후 확인");
  if (goal.length > 2000) throw new Error("진단 목표는 2,000자 이하여야 합니다");
  const now = (dependencies.now ?? (() => new Date()))();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const checkAbort = () => controller.signal.throwIfAborted();
  try {
    const remote = structuredClone(previous?.remote ?? await (dependencies.collect ?? collectRemoteEvidence)(root, { provider: options.provider, remoteUrl: options.remoteUrl, days, limit, now, signal: controller.signal }));
    checkAbort();
    const allEvidence = redactValue(previous ? structuredClone(previous.evidence) : [...repositoryEvidence(root), ...remote.evidence]);
    const evidence = selectEvidence(allEvidence, remote);
    const metrics = computeDiagnosisMetrics(remote);
    const investigate = async (previous?: DiagnosisOutput): Promise<DiagnosisOutput> => {
      checkAbort();
      const result = await runAnalysisEngine(engine, {
        repoPath: root, prompt: buildDiagnosisPrompt(profile, goal, evidence, metrics, remote.gaps, previous),
        schema: DIAGNOSIS_SCHEMA, abortController: controller, verbose: options.verbose,
        claudeHooks: { PreToolUse: [{ hooks: [restrictTools(root)] }] },
        maxTurns: engine === "claude" ? turns : undefined,
        maxBudgetUsd: engine === "claude" ? budget : undefined,
        budgetTotalUsd: engine === "claude" ? totalBudget : undefined,
        budgetSpentUsd: engine === "claude" && Number.isFinite(totalBudget) ? totalBudget - budget : undefined,
      }, { claudeQuery: dependencies.query, codexRun: dependencies.codexRun });
      checkAbort();
      const output = validateDiagnosisOutput(result.output, evidence, profile, root);
      if (engine === "claude") {
        // Unknown cost exhausts a finite budget, but --no-max-budget (Infinity) stays unlimited.
        budget = budget === Number.POSITIVE_INFINITY ? budget : result.costUsd === undefined ? 0 : Math.max(0, budget - result.costUsd);
        turns = result.turns === undefined ? 0 : Math.max(0, turns - result.turns);
      }
      return output;
    };
    let diagnosis = previous ? structuredClone(previous.diagnosis) : await investigate();
    let answers = validateAnswers({ ...previous?.answers, ...options.answers });
    if (previous && Object.keys(answers).some(id => !previous.diagnosis.questions.some(q => q.id === id))) throw new Error("저장된 인터뷰에 없는 답변 ID입니다");
    const pending = diagnosis.questions.filter(q => !answers[q.id]?.trim());
    if (options.interview && pending.length && budget > 0 && turns > 0) {
      answers = { ...answers, ...validateAnswers(await options.interview(pending, controller.signal)) };
      checkAbort();
    }
    const asked = diagnosis.questions;
    if (asked.length && (budget <= 0 || turns <= 0)) remote.gaps.push("남은 예산 또는 턴 수가 없어 인터뷰를 진행하지 못했습니다. 스냅샷을 저장한 후 재개할 수 있습니다.");
    const usedAnswers: Record<string, string> = {};
    for (const q of asked) {
      if (!answers[q.id]?.trim()) continue;
      usedAnswers[q.id] = answers[q.id];
      const answerEvidence: Evidence = { id: `interview:${q.id}`, source: "interview", locator: q.id, summary: redactValue(`질문: ${q.question}\n팀 답변(자기 보고): ${answers[q.id]}`) };
      for (const list of [allEvidence, evidence]) {
        const index = list.findIndex(e => e.id === answerEvidence.id);
        if (index >= 0) list.splice(index, 1);
      }
      allEvidence.push(answerEvidence); evidence.push(answerEvidence);
    }
    if (Object.keys(answers).some(id => !asked.some(q => q.id === id))) remote.gaps.push("현재 인터뷰 질문에 대응하지 않는 답변 ID는 반영하지 않았습니다.");
    if (Object.keys(usedAnswers).length) {
      if (budget > 0 && turns > 0) {
        try {
          diagnosis = await investigate(diagnosis);
          diagnosis.questions = asked;
        } catch (error) {
          const reason = controller.signal.aborted ? "시간 초과" : error instanceof Error ? error.message : "합성 실패";
          remote.gaps.push(`인터뷰 합성을 완료하지 못해 최초 진단을 유지했습니다. 답변은 저장되지만 진단에 반영되지 않았습니다: ${reason}`);
        }
      } else remote.gaps.push("남은 예산 또는 턴 수를 확인할 수 없거나 소진되어 인터뷰 답변을 재진단에 반영하지 못했습니다.");
    }
    const snapshot: DiagnosisSnapshot = {
      engine, schemaVersion: 1, rubricVersion: RUBRIC_VERSION, createdAt: now.toISOString(), repository: remote.repository ?? pathToFileURL(root).href,
      repoPath: root, commit: git(root, ["rev-parse", "HEAD"]), profile, goal,
      window: previous?.window ?? { since: new Date(now.getTime() - days * 86_400_000).toISOString(), until: now.toISOString(), days, limit },
      remote, evidence: allEvidence, metrics, answers: usedAnswers, diagnosis,
    };
    return redactValue(snapshot);
  } catch (error) {
    if (controller.signal.aborted) throw new Error("진단 시간이 초과되었습니다. --timeout 값을 늘려보세요.");
    throw error;
  } finally { clearTimeout(timer); }
}

export async function resumeDiagnosis(repoPath: string, raw: DiagnosisSnapshot, options: DiagnosisOptions = {}, dependencies: Dependencies = {}): Promise<DiagnosisSnapshot> {
  const previous = validateSnapshot(raw);
  if (options.engine && options.engine !== (previous.engine ?? "claude")) throw new Error("인터뷰 재개 중에는 분석 엔진을 변경할 수 없습니다. 새 진단을 실행하세요.");
  const root = realpathSync(repoPath);
  if (previous.rubricVersion !== RUBRIC_VERSION) throw new Error("평가 기준이 변경되어 진단을 새로 실행해야 합니다");
  if (root !== previous.repoPath || git(root, ["rev-parse", "HEAD"]) !== previous.commit) throw new Error("저장소 경로 또는 커밋이 변경되었습니다. 새 진단을 실행하세요.");
  if (options.goal && options.goal !== previous.goal || options.profile && options.profile !== "auto" && options.profile !== previous.profile) throw new Error("인터뷰 재개 중에는 목표 또는 프로필을 변경할 수 없습니다");
  const current = redactValue(repositoryEvidence(root));
  for (const evidence of previous.evidence.filter(e => e.source === "repository")) {
    if (current.find(e => e.id === evidence.id)?.summary !== evidence.summary) throw new Error("저장소 근거가 변경되었습니다. 새 진단을 실행하세요.");
  }
  validateDiagnosisOutput(previous.diagnosis, previous.evidence, previous.profile, root, true);
  return diagnoseRepository(root, options, { ...dependencies, resume: previous });
}
