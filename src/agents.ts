// 하네스 엔지니어링 평가 대상이 되는 코딩 에이전트 정의.
// --agent 옵션 또는 config의 agent 필드로 특정 에이전트 하나에 한정해 평가할 수 있다.
// 미지정 시(auto) 레포에 실제 구성된 에이전트를 자동 감지해 평가한다.

export type AgentId = "claude" | "codex" | "cursor" | "copilot";

export interface AgentProfile {
  id: AgentId;
  label: string;
  /** 프롬프트에 주입할, 이 에이전트의 하네스 신호 설명 */
  signals: string;
}

export const AGENT_PROFILES: Record<AgentId, AgentProfile> = {
  claude: {
    id: "claude",
    label: "Claude Code",
    signals:
      "CLAUDE.md(컨텍스트), .claude/settings.json(권한/안전), .claude/{skills,commands,agents}/(확장), PreCommit 등 .claude 훅",
  },
  codex: {
    id: "codex",
    label: "OpenAI Codex",
    signals: "AGENTS.md(컨텍스트), .codex/ 설정, .codex/skills/(확장)",
  },
  cursor: {
    id: "cursor",
    label: "Cursor",
    signals: ".cursor/rules/ 또는 .cursorrules(컨텍스트/규칙), .cursor/ 설정",
  },
  copilot: {
    id: "copilot",
    label: "GitHub Copilot",
    signals: ".github/copilot-instructions.md(컨텍스트), .github/instructions/",
  },
};

const ALIASES: Record<string, AgentId> = {
  claude: "claude",
  "claude-code": "claude",
  claudecode: "claude",
  cc: "claude",
  codex: "codex",
  openai: "codex",
  cursor: "cursor",
  copilot: "copilot",
  "github-copilot": "copilot",
  "gh-copilot": "copilot",
};

/** 입력 문자열을 표준 AgentId로 정규화. 알 수 없으면 null. */
export function normalizeAgent(input: string): AgentId | null {
  return ALIASES[input.trim().toLowerCase()] ?? null;
}

/** 사용자에게 안내할 수 있는 허용 에이전트 표기 목록 */
export const SUPPORTED_AGENTS: AgentId[] = ["claude", "codex", "cursor", "copilot"];

/**
 * 특정 에이전트로 하네스 평가를 한정하는 프롬프트 주입 문구.
 * 다른 에이전트의 설정 파일 부재를 감점/권고하지 않도록 강하게 지시한다.
 */
export function buildAgentFocusNote(agent: AgentId): string {
  const profile = AGENT_PROFILES[agent];
  const others = SUPPORTED_AGENTS.filter((a) => a !== agent)
    .map((a) => AGENT_PROFILES[a].label)
    .join(", ");
  return `\n\n**AGENT FOCUS: "하네스 엔지니어링" 카테고리는 오직 "${profile.label}" 코딩 에이전트 기준으로만 평가합니다.**
- 평가에 사용할 신호: ${profile.signals}
- 다른 에이전트(${others})의 설정 파일(예: AGENTS.md, .cursorrules, .github/copilot-instructions.md 등)이 없더라도 **절대 감점하거나 추가하라고 권고하지 마세요.** 해당 항목은 rawFindings에서도 제외합니다.
- 점수는 위 "${profile.label}" 신호의 컨텍스트·안전·확장 완성도만으로 산정합니다. 다중 에이전트 지원은 가산점도 아닙니다.\n`;
}
