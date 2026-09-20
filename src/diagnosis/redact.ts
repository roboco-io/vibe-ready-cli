export function redactText(text: string, env: NodeJS.ProcessEnv = process.env): string {
  for (const token of [env.GH_TOKEN, env.GITHUB_TOKEN, env.GITLAB_TOKEN, env.ANTHROPIC_API_KEY].filter((s): s is string => Boolean(s))) {
    text = text.split(token).join("[REDACTED]");
  }
  return text
    .replace(/\b(?:github_pat_[A-Za-z0-9_]+|gh[pousr]_[A-Za-z0-9_]+|glpat-[A-Za-z0-9_-]+|sk-ant-[A-Za-z0-9_-]+)\b/g, "[REDACTED]")
    .replace(/((?:api[_-]?key|access[_-]?token|password|secret|authorization)\s*[:=]\s*["']?)(?:Bearer\s+)?[^\s"',;]+/gi, "$1[REDACTED]")
    .replace(/https?:\/\/[^\s<>"']+/g, match => {
      try { const url = new URL(match); url.username = ""; url.password = ""; url.search = ""; return url.toString(); }
      catch { return "[URL]"; }
    });
}
export function redactValue<T>(value: T, env: NodeJS.ProcessEnv = process.env): T {
  if (typeof value === "string") return redactText(value, env) as T;
  if (Array.isArray(value)) return value.map(v => redactValue(v, env)) as T;
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, redactValue(v, env)])) as T;
  return value;
}
