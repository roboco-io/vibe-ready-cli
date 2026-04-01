# Repository Guidelines

## Project Structure & Module Organization

```
src/
  index.ts           # CLI 엔트리포인트 (commander)
  analyzer.ts        # Claude Agent SDK 기반 리포 분석
  scorer.ts          # 가중 평균 스코어링 + 페널티 로직
  reporter.ts        # 터미널 리포트 출력 (chalk)
  types.ts           # 타입, 스코어링 모델, JSON 스키마
  prompts/
    analyze.ts       # LLM 분석 프롬프트
tests/
  fixtures/          # 샘플 리포지토리 (pass/fail 시나리오)
docs/
  ideation.md        # 초기 기획 문서
```

새 체크 모듈을 추가할 때는 `src/checks/` 디렉토리에 단일 책임 파일로 생성한다. `.omc/`, `.omx/`는 로컬 도구 상태이므로 편집/커밋하지 않는다.

## Build, Test, and Development Commands

```bash
npm install          # 의존성 설치
npm run build        # tsc → dist/ 컴파일
npm test             # vitest run (단위/통합 테스트)
npm run test:watch   # vitest watch 모드
```

실행: `npx tsx src/index.ts [path] [-v]` (개발), `node dist/index.js [path]` (빌드 후)

인증: Claude Code 구독 인증 사용 (별도 API 키 불필요).

명령어 이름은 한번 게시되면 변경하지 않는다.

## Coding Style & Naming Conventions

- 2 spaces 들여쓰기 (TS, JSON, YAML, MD)
- ESM 모듈 (`"type": "module"`, import 시 `.js` 확장자 필수)
- 파일명은 책임 기반 kebab-case: `docs-check.ts`, `ci-check.ts`, `hooks-check.ts`
- 체크 모듈은 단일 책임 — 큰 범용 분석기 대신 작고 집중된 체크 선호
- CLI 출력은 결정적(deterministic), 간결, diff 가능
- 에러 메시지는 한국어
- 포매팅/린트 도구를 추가하면 `npm run lint`와 git hooks에 연결한다

## Testing Guidelines

- 디렉토리: `tests/` (소스 구조 미러링)
- 네이밍: `*.test.ts` 또는 `*.spec.ts`
- 프레임워크: vitest
- 첫 코드 스캐폴드와 함께 테스트를 추가한다
- pass/fail 시나리오 모두 커버 — 특히 missing-docs, missing-CI, weak-hook 케이스
- fixture: `tests/fixtures/`에 샘플 리포 구성. 스냅샷은 출력이 의도적으로 안정적일 때만 사용
- `scorer.ts`의 순수 함수들은 LLM 없이 단위 테스트 가능

## Commit & Pull Request Guidelines

- Conventional Commits: `feat: add ci readiness check`, `docs: refine contributor guide`
- PR에는 사용자 관점 변경사항, 새 명령어/설정 파일, 관련 이슈 링크, 동작 변경 시 CLI 출력 샘플을 포함
- `.omc/`, `.omx/` 디렉토리는 커밋하지 않는다

## Architecture Notes

### 데이터 플로우

```
CLI args → index.ts → analyzer.ts (Claude SDK query) → LLMAnalysisOutput
  → scorer.ts (computeResult) → AnalysisResult
  → reporter.ts (printReport) → 터미널 출력
```

### 핵심 타입

- `LLMAnalysisOutput`: LLM이 반환하는 raw JSON (categories + summary)
- `AnalysisResult`: 스코어링 후 최종 결과 (등급, 페널티 포함)
- `CATEGORY_WEIGHTS`: 6개 카테고리의 티어와 가중치 정의 (types.ts)
- `ANALYSIS_JSON_SCHEMA`: LLM 출력 강제를 위한 JSON Schema (types.ts)

### 확장 포인트

- 새 분석 카테고리: `CATEGORY_WEIGHTS`에 추가 + 프롬프트에 섹션 추가
- 출력 포맷 추가 (JSON, HTML): `reporter.ts`에 새 함수 추가
- CI 게이트 모드: exit code 반환 로직 추가

## Repository-Specific Notes

- 모든 체크는 `docs/ideation.md`의 평가 기준에 정렬한다
- 명확한 근거 없이 광범위한 "품질 점수" 로직을 만들지 않는다 — 각 체크는 무엇을 검사했고 왜 pass/fail인지 설명해야 한다
- Claude Agent SDK의 `query()` 함수에는 `Read`, `Glob`, `Grep` 도구만 허용한다
- 대상 리포지토리는 읽기 전용으로 취급한다 (수정 금지)
