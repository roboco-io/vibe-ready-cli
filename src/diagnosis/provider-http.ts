import type { CollectRemoteOptions, RemoteCollection } from "./types.js";
export type Row = Record<string, unknown>;
export const row = (v: unknown): v is Row => typeof v === "object" && v !== null && !Array.isArray(v);
export const str = (v: unknown): string => typeof v === "string" ? v : "";
export const time = (v: unknown): string | undefined => typeof v === "string" && v.length <= 64 && Number.isFinite(Date.parse(v)) ? (v.length > 40 ? new Date(v).toISOString() : v) : undefined;
export const number = (v: unknown): number | undefined => typeof v === "number" && Number.isSafeInteger(v) && v > 0 ? v : undefined;

export function createClient(base: string, options: CollectRemoteOptions, result: RemoteCollection) {
  const env = options.env ?? process.env;
  const secrets = [env.GH_TOKEN, env.GITHUB_TOKEN, env.GITLAB_TOKEN].filter((v): v is string => Boolean(v));
  const clean = (value: unknown, max = 3000): string => {
    let text = str(value);
    for (const secret of secrets) text = text.split(secret).join("[REDACTED]");
    text = text.replace(/\b(?:github_pat_[A-Za-z0-9_]{10,}|gh[pousr]_[A-Za-z0-9]{10,}|glpat-[A-Za-z0-9_-]{10,})\b/g, "[REDACTED]");
    text = text.replace(/https?:\/\/[^\s<>"']+/g, match => {
      try { const url = new URL(match); url.username = ""; url.password = ""; url.search = ""; url.hash = ""; return url.toString(); } catch { return "[URL]"; }
    });
    return text.slice(0, max);
  };
  const gap = (label: string, reason: string) => { const message = `${label}: ${reason}`; if (!result.gaps.includes(message)) result.gaps.push(message); };
  let requests = 0;
  const deadline = Date.now() + 60_000;
  const headers: Record<string, string> = { Accept: "application/json" };
  const token = result.provider === "github" ? env.GH_TOKEN || env.GITHUB_TOKEN : env.GITLAB_TOKEN;
  if (token) headers[result.provider === "github" ? "Authorization" : "PRIVATE-TOKEN"] = result.provider === "github" ? `Bearer ${token}` : token;
  async function get(path: string, label: string): Promise<{ data: unknown; headers: Headers } | null> {
    if (++requests > 160 || Date.now() >= deadline || options.signal?.aborted) { result.truncated = true; gap(label, "요청 수 또는 시간 제한으로 수집이 중단되었습니다."); return null; }
    const signal = AbortSignal.any([AbortSignal.timeout(Math.max(1, Math.min(8000, deadline - Date.now()))), ...(options.signal ? [options.signal] : [])]);
    try {
      const response = await (options.fetch ?? globalThis.fetch)(`${base}${path}`, { method: "GET", headers, redirect: "error", signal });
      if (!response.ok) { gap(label, `API 응답 HTTP ${response.status}; 해당 근거를 확인할 수 없습니다.`); return null; }
      // Bound streamed response bodies as well as advertised lengths.
      if (Number(response.headers.get("content-length")) > 2_000_000) throw new Error();
      const reader = response.body?.getReader();
      if (!reader) throw new Error();
      const chunks: Uint8Array[] = []; let size = 0;
      while (true) { const { done, value } = await reader.read(); if (done) break; size += value.length; if (size > 2_000_000) { await reader.cancel(); throw new Error(); } chunks.push(value); }
      return { data: JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown, headers: response.headers };
    } catch { gap(label, "응답 형식, 네트워크, 리디렉션 또는 시간 제한으로 근거를 수집하지 못했습니다."); return null; }
  }
  async function list(path: string, label: string, cap: number, key?: string, dateField?: string, since?: number, until?: number): Promise<Row[]> {
    const items: Row[] = []; const perPage = Math.min(100, cap + 1);
    for (let page = 1; page <= 5; page++) {
      const response = await get(`${path}${path.includes("?") ? "&" : "?"}per_page=${perPage}&page=${page}`, label);
      if (!response) break;
      const values = key && row(response.data) ? response.data[key] : response.data;
      if (!Array.isArray(values)) { gap(label, "API 목록 형식이 올바르지 않습니다."); break; }
      let crossedWindow = false;
      for (const value of values) {
        if (!row(value)) { gap(label, "일부 API 레코드 형식이 올바르지 않습니다."); continue; }
        if (dateField) {
          const date = time(value[dateField]);
          if (!date) { gap(label, "일부 레코드의 날짜가 없어 제외했습니다."); continue; }
          if (since !== undefined && Date.parse(date) < since) { crossedWindow = true; continue; }
          if (until !== undefined && Date.parse(date) > until) continue;
        }
        if (items.length === cap) { result.truncated = true; gap(label, "표본 제한으로 일부 근거가 생략되었습니다."); return items; }
        items.push(value);
      }
      const next = response.headers.get("x-next-page");
      const linkNext = /rel="next"/.test(response.headers.get("link") ?? "");
      if (crossedWindow || (next === "" && !linkNext) || (values.length < perPage && !next && !linkNext)) break;
      if (page === 5) { result.truncated = true; gap(label, "페이지 제한으로 일부 근거가 생략되었습니다."); }
    }
    return items;
  }
  return { clean, gap, get, list };
}
