import type { EngineId } from "../engines/types.js";

export type Provider = "github" | "gitlab" | "none";
export type Profile = "service" | "library" | "cli" | "data" | "general";
export type FindingStatus = "supported" | "partial" | "gap" | "unknown" | "not-applicable";
export type EvidenceSource = "repository" | "pull-request" | "review" | "ci" | "interview";

export interface Evidence {
  id: string;
  source: EvidenceSource;
  locator: string;
  summary: string;
  timestamp?: string;
}

export interface ReviewRecord { submittedAt: string; state: string; }
export interface PullRequestRecord {
  id: string;
  url: string;
  title: string;
  body: string;
  createdAt: string;
  updatedAt: string;
  mergedAt: string | null;
  state: string;
  draft: boolean;
  headSha?: string;
  reviews: ReviewRecord[];
}
export interface CiRun {
  id: string;
  url: string;
  name: string;
  status: string;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  headSha: string;
  attempt?: number;
}
export interface RemoteCollection {
  provider: Provider;
  repository: string | null;
  pullRequests: PullRequestRecord[];
  ciRuns: CiRun[];
  evidence: Evidence[];
  gaps: string[];
  truncated: boolean;
}
export interface CollectRemoteOptions {
  provider?: Provider | "auto";
  remoteUrl?: string;
  days: number;
  limit: number;
  now?: Date;
  fetch?: typeof globalThis.fetch;
  env?: NodeJS.ProcessEnv;
  signal?: AbortSignal;
}
export interface CodeEvidence { path: string; line: number; excerpt: string; }
export interface Finding {
  checkId: string;
  status: FindingStatus;
  title: string;
  observation: string;
  hypothesis: string;
  impact: string;
  action: string;
  doneWhen: string;
  measure: string;
  confidence: "high" | "medium" | "low";
  evidenceIds: string[];
  codeEvidence: CodeEvidence[];
}
export interface InterviewQuestion {
  id: string;
  question: string;
  reason: string;
  evidenceIds: string[];
}
export interface DiagnosisOutput {
  summary: string;
  findings: Finding[];
  questions: InterviewQuestion[];
}
export interface DiagnosisMetrics {
  pullRequests: number;
  mergedPullRequests: number;
  leadTimeHours: { median: number | null; samples: number };
  firstReviewHours: { median: number | null; samples: number };
  ciRuns: number;
  failedCiRuns: number;
  completedCiRuns: number;
  retriedCiRuns: number;
}
export interface DiagnosisSnapshot {
  /** Snapshots created before engine selection implicitly used Claude. */
  engine?: EngineId;
  schemaVersion: 1;
  rubricVersion: string;
  createdAt: string;
  repository: string;
  repoPath: string;
  commit: string | null;
  profile: Profile;
  goal: string;
  window: { since: string; until: string; days: number; limit: number };
  remote: RemoteCollection;
  evidence: Evidence[];
  metrics: DiagnosisMetrics;
  answers: Record<string, string>;
  diagnosis: DiagnosisOutput;
}
export interface DiagnosisComparison {
  resolved: string[];
  persisting: string[];
  introduced: string[];
  unconfirmed: string[];
  notes: string[];
}

export interface DiagnosisOptions {
  engine?: EngineId;
  provider?: Provider | "auto";
  remoteUrl?: string;
  days?: number;
  limit?: number;
  profile?: Profile | "auto";
  goal?: string;
  maxTurns?: number;
  maxBudgetUsd?: number;
  timeoutMs?: number;
  verbose?: boolean;
  answers?: Record<string, string>;
  interview?: (questions: InterviewQuestion[], signal: AbortSignal) => Promise<Record<string, string>>;
}
