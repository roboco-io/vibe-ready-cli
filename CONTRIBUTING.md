# Contributing to vibe-ready-cli

vibe-ready-cli에 기여해주셔서 감사합니다! 이 문서는 기여 과정의 일관성과 품질을 보장하기 위한 가이드입니다.

## 시작하기

```bash
git clone https://github.com/roboco-io/vibe-ready-cli.git
cd vibe-ready-cli
npm install
npm run build
npm test
```

**환경 요구사항**: Node.js >= 18

## 개발 워크플로우

### 1. 이슈 확인

작업을 시작하기 전에 관련 이슈가 있는지 확인하세요. 없다면 이슈를 먼저 생성합니다.

### 2. 브랜치 생성

```bash
git checkout -b feat/my-feature   # 새 기능
git checkout -b fix/bug-name      # 버그 수정
git checkout -b docs/topic        # 문서 변경
```

### 3. 코드 작성

#### 코딩 컨벤션

- **들여쓰기**: 2 spaces (TS, JSON, YAML, MD)
- **모듈**: ESM (`"type": "module"`, import에 `.js` 확장자 필수)
- **파일명**: 책임 기반 kebab-case (`docs-check.ts`, `ci-check.ts`)
- **에러 메시지**: 한국어
- **체크 모듈**: 단일 책임 원칙 — 체크 하나당 파일 하나

#### 아키텍처 규칙

- **데이터 플로우를 따르세요**: `index.ts → analyzer.ts → scorer.ts → reporter.ts`
- **LLM 로직과 순수 로직을 분리하세요**: `analyzer.ts`만 Claude SDK에 의존, `scorer.ts`와 `reporter.ts`는 순수 함수
- **새 분석 카테고리를 추가할 때**: `types.ts`의 `CATEGORY_WEIGHTS`에 항목 추가 + `prompts/analyze.ts`에 프롬프트 섹션 추가
- **대상 리포지토리는 읽기 전용**: 분석 대상을 절대 수정하지 않습니다
- **SDK 도구 제한**: `Read`, `Glob`, `Grep`만 사용 (`permissionMode: "dontAsk"`)

### 4. 테스트 작성

모든 코드 변경에는 테스트가 필요합니다.

- **디렉토리**: `tests/` (소스 구조 미러링)
- **네이밍**: `*.test.ts`
- **프레임워크**: vitest
- **필수 커버리지**:
  - pass/fail 시나리오 모두 커버
  - 특히 missing-docs, missing-CI, weak-hook 케이스
  - `scorer.ts`의 순수 함수는 LLM 없이 단위 테스트
- **fixture**: `tests/fixtures/`에 샘플 리포지토리 구성

```bash
npm test              # 전체 테스트
npm run test:watch    # watch 모드
```

### 5. 빌드 확인

```bash
npm run build
```

빌드 실패 시 커밋이 차단됩니다 (PreCommit 훅).

### 6. 커밋

**Conventional Commits** 형식을 따릅니다:

```
feat: add ci readiness check
fix: correct penalty calculation for edge case
docs: update scoring rules documentation
test: add fixtures for monorepo scenario
refactor: extract grade calculation to utility
```

| 접두사 | 용도 |
|--------|------|
| `feat` | 새 기능 |
| `fix` | 버그 수정 |
| `docs` | 문서 변경 |
| `test` | 테스트 추가/수정 |
| `refactor` | 동작 변경 없는 코드 개선 |
| `chore` | 빌드, 설정 변경 |

### 7. Pull Request

PR 작성 시 포함할 내용:

- **사용자 관점 변경사항** (무엇이 달라지는지)
- **새 명령어나 설정 파일** (있는 경우)
- **CLI 출력 샘플** (동작이 변경되는 경우)
- **관련 이슈 링크**

## 커밋하면 안 되는 것

| 디렉토리/파일 | 이유 |
|---------------|------|
| `.omc/` | 로컬 에이전트 도구 상태 |
| `.omx/` | 로컬 에이전트 도구 상태 |
| `node_modules/` | 의존성 (npm install로 복원) |
| `dist/` | 빌드 산출물 |
| `.env` | 환경변수 (비밀 포함 가능) |

## 새 체크 모듈 추가 가이드

1. `types.ts`의 `CATEGORY_WEIGHTS`에 새 카테고리 추가
2. `prompts/analyze.ts`에 분석 프롬프트 섹션 추가
3. 테스트 fixture 추가 (`tests/fixtures/`)
4. `docs/ideation.md`의 평가 기준과 정렬 확인

## 질문이 있으시면

이슈를 생성하거나 PR에 코멘트를 남겨주세요.
