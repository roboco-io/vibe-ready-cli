# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**vibe-ready-cli**는 리포지토리가 바이브 코딩(AI 에이전트 기반 개발)에 얼마나 준비되어 있는지를 분석하는 CLI 도구입니다. Claude Agent SDK를 통해 LLM 기반으로 리포지토리를 분석하고, 6개 카테고리별 점수(0~100) + 등급(A~F) + 개선 권고를 터미널에 출력합니다.

## Tech Stack

- **Runtime**: Node.js >= 18, TypeScript (ES2022, ESM)
- **분석 엔진**: `@anthropic-ai/claude-agent-sdk` — LLM 기반 리포 분석
- **CLI**: `commander` (argument parsing), `chalk` (터미널 포맷팅)
- **테스트**: `vitest`
- **빌드**: `tsc` (TypeScript compiler)

## Build & Development Commands

```bash
npm install          # 의존성 설치
npm run build        # TypeScript → dist/ 컴파일
npm test             # vitest 단위 테스트 실행
npm run test:watch   # vitest watch 모드
```

### 실행

```bash
# 개발 중 직접 실행
npx tsx src/index.ts [path] [-v] [--max-turns 20] [--max-budget 0.50] [--timeout 120]

# 빌드 후 실행
node dist/index.js [path]

# 배포 후
npx vibe-ready [path]
```

**환경변수**: `ANTHROPIC_API_KEY` 필수 (Claude Agent SDK 인증)

## Architecture

```
src/
  index.ts           # CLI 엔트리포인트 (commander 기반)
  analyzer.ts        # Claude Agent SDK로 리포 분석 (query → LLM 호출)
  scorer.ts          # LLM 출력 → 가중 평균 점수 + 등급 + 페널티 계산
  reporter.ts        # 터미널 리포트 출력 (chalk 포맷팅)
  types.ts           # 타입 정의, 스코어링 모델, JSON 스키마
  prompts/
    analyze.ts       # LLM 분석 프롬프트 빌더
```

### 데이터 플로우

```
CLI args → index.ts → analyzer.ts (Claude SDK query) → LLMAnalysisOutput
  → scorer.ts (computeResult) → AnalysisResult
  → reporter.ts (printReport) → 터미널 출력
```

### 분석 카테고리 (6개)

| 카테고리 | 티어 | 가중치 |
|----------|------|--------|
| 테스트 커버리지 | must | 0.20 |
| CI/CD | must | 0.20 |
| 훅 기반 검증 | must | 0.20 |
| 리포지토리 구조 | nice | 0.133 |
| 문서화 수준 | nice | 0.133 |
| 바이브 코딩 설정 | nice | 0.134 |

### 스코어링 규칙

- 각 카테고리: 0~100점, 등급 A(90+)/B(80+)/C(70+)/D(50+)/F(<50)
- 종합: 가중 평균 (100점 만점)
- **페널티**: 필수 카테고리 중 F 등급 → 전체 등급 최대 C로 제한

## Coding Conventions

- **파일명**: 책임 기반 kebab-case (`docs-check.ts`, `ci-check.ts`)
- **들여쓰기**: 2 spaces (TS, JSON, YAML, MD)
- **모듈**: ESM (`"type": "module"`, import에 `.js` 확장자 필수)
- **체크 모듈**: 단일 책임 원칙 — 체크 하나당 파일 하나
- **출력**: 결정적(deterministic), 간결, diff 가능
- **에러 메시지**: 한국어

## Testing Guidelines

- 테스트 디렉토리: `tests/` (소스 구조 미러링)
- 네이밍: `*.test.ts` 또는 `*.spec.ts`
- 프레임워크: vitest
- pass/fail 케이스 모두 커버 (특히 missing-docs, missing-CI, weak-hook 시나리오)
- fixture 리포: `tests/fixtures/`에 샘플 리포지토리 구성

## Key Constraints

- MVP 범위: 단일 리포 분석 + 터미널 출력만
- 언어 agnostic: LLM이 판단 (패턴 매칭 아님)
- 읽기 전용: 대상 리포를 수정하지 않음
- SDK 도구: `Read`, `Glob`, `Grep`만 허용 (`permissionMode: "dontAsk"`)

## Status

MVP 구현 완료. CLI + 분석 엔진 + 스코어러 + 리포터 + 유닛 테스트(12/12 pass). 빌드 성공.
