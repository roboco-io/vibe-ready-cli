import { boundRemoteCollection } from "./provider-budget.js";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { CollectRemoteOptions, RemoteCollection, Provider, PullRequestRecord } from "./types.js";
import { createClient, number, row, str, time } from "./provider-http.js";

function identify(remote: string, choice: CollectRemoteOptions["provider"]): { provider: Provider; repository: string; base: string } | null {
  try {
    if (remote.length > 512) return null;
    const scp = remote.match(/^[^@\s]+@([^:/\s]+):(.+)$/);
    const url = new URL(scp ? `https://${scp[1]}/${scp[2]}` : remote);
    if (!["https:", "ssh:"].includes(url.protocol) || url.search || url.hash) return null;
    const path = url.pathname.replace(/^\/+|\/+$/g, "").replace(/\.git$/, "");
    const parts = path.split("/");
    if (parts.length < 2 || parts.some(p => !/^[\w.-]+$/.test(p) || p === "." || p === "..")) return null;
    const provider = choice === "github" || choice === "gitlab" ? choice : url.hostname === "github.com" ? "github" : url.hostname === "gitlab.com" ? "gitlab" : "none";
    if (provider === "none" || (provider === "github" && (url.hostname !== "github.com" || parts.length !== 2 || url.port))) return null;
    const repository = `https://${url.host}/${path}`;
    return { provider, repository, base: provider === "github" ? `https://api.github.com/repos/${path}` : `https://${url.host}/api/v4/projects/${encodeURIComponent(path)}` };
  } catch { return null; }
}

export async function collectRemoteEvidence(repoPath: string, options: CollectRemoteOptions): Promise<RemoteCollection> {
  if (!Number.isSafeInteger(options.days) || options.days < 1 || options.days > 3650 || !Number.isSafeInteger(options.limit) || options.limit < 1 || options.limit > 100 || (options.provider && !["auto", "github", "gitlab", "none"].includes(options.provider))) throw new Error("원격 수집 기간(1–3650일), 표본 수(1–100), 공급자를 확인하세요.");
  const until = (options.now ?? new Date()).getTime();
  if (!Number.isFinite(until)) throw new Error("원격 수집 기준 날짜가 올바르지 않습니다.");
  const since = until - options.days * 86400000;
  const result: RemoteCollection = { provider: "none", repository: null, pullRequests: [], ciRuns: [], evidence: [], gaps: [], truncated: false };
  if (options.provider === "none") { result.gaps.push("원격 수집이 비활성화되어 PR/MR, 리뷰 및 CI 근거가 없습니다."); return result; }
  let remote = options.remoteUrl;
  if (remote === undefined) {
    const env = { ...(options.env ?? process.env) };
    for (const key of Object.keys(env)) if (key.startsWith("GIT_")) delete env[key];
    try { remote = (await promisify(execFile)("git", ["-C", repoPath, "remote", "get-url", "origin"], { env, timeout: 5000, maxBuffer: 8192 })).stdout.trim(); } catch { result.gaps.push("origin 원격 저장소를 확인하지 못해 원격 근거가 없습니다."); return result; }
  }
  const identity = identify(remote, options.provider);
  if (!identity) { result.gaps.push("지원되는 원격 저장소를 확인할 수 없습니다. GitLab 자체 호스팅은 공급자를 명시하세요."); return result; }
  result.provider = identity.provider; result.repository = identity.repository;
  const { clean, gap, get, list } = createClient(identity.base, options, result);
  const gh = identity.provider === "github";
  const from = new Date(since).toISOString(); const to = new Date(until).toISOString();
  const pulls = await list(gh ? "/pulls?state=all&sort=updated&direction=desc" : `/merge_requests?state=all&scope=all&order_by=updated_at&sort=desc&updated_after=${encodeURIComponent(from)}&updated_before=${encodeURIComponent(to)}`, "PR/MR", options.limit, undefined, "updated_at", since, until);
  const runs = await list(gh ? `/actions/runs?created=${encodeURIComponent(`${from}..${to}`)}` : `/pipelines?updated_after=${encodeURIComponent(from)}&updated_before=${encodeURIComponent(to)}&order_by=updated_at&sort=desc`, "CI", options.limit, gh ? "workflow_runs" : undefined, gh ? "created_at" : "updated_at", since, until);
  for (const p of pulls) {
    const id = number(gh ? p.number : p.iid);
    if (!id || !time(p.created_at) || !str(p.title) || !str(p.state)) { gap("PR/MR", "필수 필드가 없는 레코드를 제외했습니다."); continue; }
    const url = `${identity.repository}/${gh ? "pull" : "-/merge_requests"}/${id}`;
    const record: PullRequestRecord = { id: String(id), url, title: clean(p.title, 300), body: clean(gh ? p.body : p.description), createdAt: time(p.created_at)!, updatedAt: time(p.updated_at)!, mergedAt: time(p.merged_at) ?? null, state: clean(p.state, 40), draft: p.draft === true || p.work_in_progress === true, headSha: clean(gh && row(p.head) ? p.head.sha : p.sha, 100) || undefined, reviews: [] };
    result.pullRequests.push(record);
    result.evidence.push({ id: `pr:${id}`, source: "pull-request", locator: url, timestamp: record.updatedAt, summary: `${record.title}\n상태: ${record.state}; 초안: ${record.draft}; SHA: ${record.headSha ?? "알 수 없음"}\n${record.body}` });
    const files = await list(gh ? `/pulls/${id}/files` : `/merge_requests/${id}/diffs`, `PR/MR ${id} 변경 파일`, 10);
    for (const [fileIndex, file] of files.entries()) {
      const filename = str(gh ? file.filename : file.new_path);
      if (!filename) { gap(`PR/MR ${id} 변경 파일`, "파일 경로가 없는 레코드를 제외했습니다."); continue; }
      const patch = str(gh ? file.patch : file.diff);
      if (!patch) gap(`PR/MR ${id} 변경 파일`, "일부 파일의 패치가 제공되지 않았습니다(바이너리 또는 API 생략 가능).");
      if (patch.length > 3000 || file.collapsed === true || file.too_large === true) {
        result.truncated = true;
        gap(`PR/MR ${id} 변경 파일`, "패치 크기 제한 또는 API 생략으로 변경 내용 일부만 수집했습니다.");
      }
      result.evidence.push({ id: `pr-file:${id}:${fileIndex}`, source: "pull-request", locator: url, timestamp: record.updatedAt, summary: `PR/MR #${id} 변경 파일: ${clean(filename, 500)}\n${clean(patch, 3000) || "패치 없음"}` });
    }
    const endpoints = gh ? [`/pulls/${id}/reviews`, `/issues/${id}/comments`, `/pulls/${id}/comments`] : [`/merge_requests/${id}/notes?sort=asc&order_by=created_at`];
    for (const [index, path] of endpoints.entries()) {
      const reviews = await list(path, `PR/MR ${id} 리뷰/댓글`, 30);
      for (const r of reviews) {
        if (!number(r.id) || (gh && index === 0 ? !str(r.state) : typeof r.body !== "string")) { gap(`PR/MR ${id} 리뷰/댓글`, "필수 필드가 없는 레코드를 제외했습니다."); continue; }
        if (!gh && r.system === true) continue;
        const submittedAt = time(r.submitted_at) ?? time(r.created_at);
        if (gh && index === 0 && submittedAt && str(r.state)) record.reviews.push({ submittedAt, state: clean(r.state, 50) });
        if (!str(r.body).trim() && !(gh && index === 0 && str(r.state))) continue;
        const rid = number(r.id);
        if (!rid) { gap(`PR/MR ${id} 리뷰/댓글`, "식별자가 없는 레코드를 제외했습니다."); continue; }
        result.evidence.push({ id: `review:${id}:${index}:${rid}`, source: "review", locator: `${url}#${gh ? index === 0 ? "pullrequestreview-" : index === 1 ? "issuecomment-" : "discussion_r" : "note_"}${rid}`, timestamp: submittedAt, summary: `PR/MR #${id} ${clean(r.state, 50)}\n${clean(r.body)}` });
      }
    }
  }

  for (let run of runs) {
    const id = number(run.id);
    if (!id || !time(run.created_at) || !str(run.status)) { gap("CI", "필수 필드가 없는 레코드를 제외했습니다."); continue; }
    let attempt = gh ? number(run.run_attempt) : undefined;
    let jobs: import("./provider-http.js").Row[] = [];
    if (!gh) {
      const detail = await get(`/pipelines/${id}`, `CI ${id} 상세`);
      if (detail && row(detail.data)) run = { ...run, ...detail.data };
      else if (detail) gap(`CI ${id}`, "상세 응답 형식이 올바르지 않습니다.");
      jobs = await list(`/pipelines/${id}/jobs?include_retried=true`, `CI ${id} 재시도`, 100);
      // Job retries do not establish a pipeline attempt count. Count observed
      // attempts of the most frequently repeated job as a retry signal only.
      const counts = new Map<string, number>();
      for (const job of jobs) { const key = `${str(job.stage)}:${str(job.name)}`; if (str(job.name)) counts.set(key, (counts.get(key) ?? 0) + 1); }
      if (counts.size) attempt = Math.max(...counts.values());
    }
    if (gh && ["failure", "timed_out", "action_required", "cancelled"].includes(str(run.conclusion))) jobs = await list(`/actions/runs/${id}/jobs?filter=latest`, `CI ${id} 작업`, 20, "jobs");
    for (const job of jobs) {
      const failedStates = ["failure", "failed", "timed_out", "action_required", "cancelled", "canceled"];
      const jobStatus = str(gh ? job.conclusion : job.status);
      if (!failedStates.includes(jobStatus)) continue;
      const jobId = number(job.id);
      if (!jobId || !str(job.name)) { gap(`CI ${id} 작업`, "실패 작업의 필수 필드가 없습니다."); continue; }
      const steps = Array.isArray(job.steps) ? job.steps.filter(row).filter(step => failedStates.includes(str(step.conclusion))) : [];
      if (steps.length > 20) { result.truncated = true; gap(`CI ${id} 작업`, "실패 단계 표본 제한으로 일부 단계가 생략되었습니다."); }
      const details = steps.slice(0, 20).map(step => `${clean(step.name, 150)}: ${clean(step.conclusion, 50)}`).join("\n");
      result.evidence.push({ id: `ci-job:${id}:${jobId}`, source: "ci", locator: `${identity.repository}/${gh ? `actions/runs/${id}/job` : "-/jobs"}/${jobId}`, timestamp: time(job.started_at) ?? time(run.created_at), summary: `CI #${id} 실패 작업: ${clean(job.name, 300)}; 상태: ${clean(jobStatus, 60)}; 실패 사유: ${clean(job.failure_reason, 300) || "제공되지 않음"}\n${details}\n작업 로그는 수집하지 않았으며 단계 이름과 API 상태만으로 결함 원인을 확정할 수 없습니다.` });
    }
    const status = clean(gh ? run.conclusion || run.status : run.status, 60);
    const url = `${identity.repository}/${gh ? "actions/runs" : "-/pipelines"}/${id}`;
    const ci = { id: String(id), url, name: clean(run.name, 300) || `Pipeline ${id}`, status, createdAt: time(run.created_at)!, startedAt: time(gh ? run.run_started_at : run.started_at), completedAt: time(gh ? run.status === "completed" ? run.updated_at : undefined : run.finished_at), headSha: clean(gh ? run.head_sha : run.sha, 100), attempt };
    result.ciRuns.push(ci);
    result.evidence.push({ id: `ci:${id}`, source: "ci", locator: url, timestamp: ci.createdAt, summary: `${ci.name}: ${ci.status}; SHA: ${ci.headSha || "알 수 없음"}; ${gh ? "실행 시도" : "작업별 최대 관측 실행 수"}: ${attempt ?? "알 수 없음"}. 재시도는 불안정 테스트의 확정 근거가 아닙니다.` });
  }
  if (!gh) gap("리뷰 지표", "GitLab 댓글은 리뷰 제출/승인 시각을 확정하지 못하므로 최초 리뷰 지연 지표에 포함하지 않습니다.");
  return boundRemoteCollection(result);
}
