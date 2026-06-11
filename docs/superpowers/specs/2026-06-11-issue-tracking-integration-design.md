# 설계: 이슈 트래킹 연동 분석 카테고리

- **날짜**: 2026-06-11
- **상태**: 승인됨
- **목적**: vibe-ready-cli에 7번째 분석 카테고리 "이슈 트래킹 연동"을 추가하여, 분석 대상 리포지토리의 커밋 로그가 GitHub/Jira 등 이슈 트래커와 잘 연동되어 있는지 평가한다.

## 배경

바이브 코딩(AI 에이전트 기반 개발)에서 작업 추적성은 에이전트가 변경 의도를 파악하고 안전하게 작업하는 데 중요하다. 커밋 메시지의 이슈 참조, PR 기반 워크플로, 이슈/PR 템플릿, 강제 장치(commitlint 등)는 이를 뒷받침하는 신호다.

## 결정 사항

| 항목 | 결정 |
|---|---|
| 카테고리 위치 | 신규 `nice` 카테고리 (7번째) |
| 데이터 확보 | Node에서 `git log` 사전 추출 후 프롬프트 주입 (SDK 도구 권한 변경 없음) |
| 주입 방식 | 하이브리드: 결정적 통계 + 커밋 제목 원문 샘플 |
| 평가 신호 | 커밋 이슈 참조율, PR 워크플로, 이슈/PR 템플릿, 트래커 설정/강제 장치 (4종 모두) |

## 1. 스코어링 모델 변경 (`src/types.ts`)

`CATEGORY_WEIGHTS`에 **"이슈 트래킹 연동"** (tier: `nice`, weight: `0.10`) 추가. nice 카테고리 4개의 가중치를 균등 재분배:

| 카테고리 | Tier | 기존 | 변경 |
|---|---|---|---|
| 테스트 커버리지 | must | 0.20 | 0.20 |
| CI/CD | must | 0.20 | 0.20 |
| 훅 기반 검증 | must | 0.20 | 0.20 |
| 리포지토리 구조 | nice | 0.133 | 0.10 |
| 문서화 수준 | nice | 0.133 | 0.10 |
| 하네스 엔지니어링 | nice | 0.134 | 0.10 |
| **이슈 트래킹 연동** | nice | — | **0.10** |

가중치 합계 1.0, must:nice = 60:40 비율 유지. 페널티 규칙(must F → 전체 C 캡)은 변경 없음.

## 2. 신규 모듈 `src/git-log.ts`

읽기 전용 `git log` 실행(`child_process.execFileSync`)으로 대상 리포 무변경 원칙을 유지한다.

### 인터페이스

```ts
export interface GitLogContext {
  totalCommits: number;            // 수집된 커밋 수 (최대 200)
  issueRefRate: number;            // 이슈 참조 커밋 비율 (0~100, 소수점 반올림)
  refBreakdown: {
    github: number;                // #123, GH-123 참조 커밋 수
    jira: number;                  // ABC-123 패턴 참조 커밋 수
    keywords: number;              // closes/fixes/resolves 키워드 커밋 수
  };
  mergeCommitCount: number;        // "Merge pull request #N" 패턴 수
  prWorkflowDetected: boolean;     // 머지/squash 패턴 기반 PR 워크플로 추정
  sampleSubjects: string[];        // 최근 커밋 제목 원문 (최대 50개)
}

export function collectGitLogContext(repoPath: string, verbose?: boolean): GitLogContext | null;
```

### 동작

- `git log --no-merges` 가 아닌 전체 로그에서 최근 **200개** 커밋 제목(`%s`) 수집
- 통계 계산:
  - **GitHub 참조**: `#\d+`, `GH-\d+`
  - **Jira 참조**: `\b[A-Z][A-Z0-9]+-\d+\b` (단, `GH-` 제외)
  - **키워드**: `closes|fixes|resolves` (대소문자 무시)가 이슈 참조와 함께 등장하는 커밋만 카운트 (키워드 단독은 제외)
  - 참조율 = (위 중 하나라도 포함된 커밋 수) / 전체 × 100
  - **머지 커밋**: `Merge pull request #N`, `Merge branch` 패턴 카운트
  - **PR 워크플로**: 머지 커밋 존재 또는 squash 흔적(`(#N)` 접미사 커밋 비율)으로 추정
- 최근 **50개** 커밋 제목 원문을 `sampleSubjects`로 제공 (LLM이 Linear, Asana 등 비표준 트래커 참조를 보정 판단)

### 실패 처리

git 미설치, 비 git 디렉토리, 빈 리포지토리(커밋 0개) 모두 `null` 반환. 분석은 계속 진행하며, `-v` 모드에서만 stderr로 사유를 한국어로 출력한다.

## 3. 프롬프트 확장 (`src/prompts/analyze.ts`)

- `ALL_CATEGORIES`에 `"이슈 트래킹 연동"` 추가
- 시그니처 확장: `buildAnalysisPrompt(categories?, customCategories?, gitLogContext?: GitLogContext | null)`
- `gitLogContext`가 있으면 `## Git Log Context` 섹션으로 통계 + 샘플 주입. `null`이면 "커밋 히스토리를 확인할 수 없음 — 커밋 신호 없이 템플릿/설정 신호만으로 평가하라"고 명시
- 7번째 카테고리 섹션 추가 (nice 티어):

### 평가 신호

1. **커밋 메시지 이슈 참조율** — 주입된 통계 기반. 샘플에서 비표준 트래커(Linear, Asana 등) 참조 발견 시 보정 가능
2. **PR 기반 워크플로** — 머지/squash 패턴 통계 기반
3. **이슈/PR 템플릿** — `.github/ISSUE_TEMPLATE/`, `PULL_REQUEST_TEMPLATE.md` 등을 기존 `Glob`/`Read` 도구로 확인
4. **트래커 설정/강제 장치** — commitlint 이슈 참조 규칙, GitHub Actions 이슈 자동화 워크플로, Jira 설정 파일 등을 `Grep`/`Read`로 확인

### 스코어링 단계

- 0 = 이슈 연동 흔적 없음
- 20 = 템플릿만 존재, 커밋 참조 없음
- 40 = 커밋 이슈 참조율 낮음(<30%) 또는 PR 워크플로만 존재
- 60 = 참조율 보통(30~60%) + PR 워크플로
- 80 = 참조율 높음(60% 이상) + PR 워크플로 + 템플릿
- 100 = 참조율 높음 + 템플릿 + 강제 장치(commitlint 규칙, 자동화 워크플로 등)

## 4. 데이터 플로우 변경

```
index.ts → git-log.ts (collectGitLogContext) ─┐
                                              ├→ analyzer.ts → LLM → scorer.ts → reporter.ts
CLI args / .vibeready.json ───────────────────┘
```

- `index.ts`: 분석 시작 전 `collectGitLogContext(repoPath)` 호출, `AnalyzerOptions`로 전달
- `analyzer.ts`: `AnalyzerOptions.gitLogContext` 추가, `buildAnalysisPrompt`에 전달. SDK 도구 권한(`Read`/`Glob`/`Grep`, `permissionMode: "dontAsk"`)은 변경 없음
- 브랜치 비교 모드: 브랜치별 분석 시 해당 체크아웃 상태의 로그를 수집 (기존 브랜치 비교 흐름에 자연 편입)

## 5. 테스트 (`tests/`)

- `tests/git-log.test.ts`
  - GitHub/Jira/키워드 참조 패턴 통계 계산 (fixture 커밋 제목 배열로 순수 함수 검증 — 통계 계산부를 git 실행부와 분리해 테스트 가능하게 설계)
  - 머지/squash 패턴 감지
  - 비 git 디렉토리 → `null` 반환
- `tests/scorer.test.ts` (기존 확장): 7카테고리 가중치 합 1.0 검증, 신규 카테고리 포함 가중 평균 계산
- `tests/prompts.test.ts` (기존 확장): `gitLogContext` 주입 시 프롬프트에 통계 섹션 포함, `null` 시 폴백 문구 포함

## 6. 문서 갱신

- `CLAUDE.md`: 카테고리 표(7개), 아키텍처(git-log.ts), 데이터 플로우 갱신
- `README.md`: 분석 카테고리 표/SVG 시각화 갱신

## 범위 제외 (YAGNI)

- 이슈 트래커 API 호출(GitHub/Jira API로 실제 이슈 존재 검증) — 하지 않음. 커밋 로그와 리포 파일 신호만 사용
- 커밋 본문(body) 분석 — 제목(subject)만 사용
- 이슈 번호 유효성 검증 — 패턴 존재 여부만 판단
