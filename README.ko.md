> 🇺🇸 [English](README.md)

# vibe-ready

[![npm version](https://img.shields.io/npm/v/vibe-ready.svg)](https://www.npmjs.com/package/vibe-ready)
[![CI](https://github.com/roboco-io/vibe-ready-cli/actions/workflows/ci.yml/badge.svg)](https://github.com/roboco-io/vibe-ready-cli/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/node/v/vibe-ready.svg)](https://nodejs.org)
[![npm downloads](https://img.shields.io/npm/dm/vibe-ready.svg)](https://www.npmjs.com/package/vibe-ready)

리포지토리가 바이브 코딩(AI 에이전트 기반 개발)에 얼마나 준비되어 있는지를 분석하는 CLI 도구입니다.

Claude Agent SDK를 사용하여 LLM이 직접 리포지토리를 탐색하고, 6개 카테고리를 점수화하여 종합 등급과 구체적 개선 권고를 제공합니다.

## 설치 및 실행

### 바로 사용 (npm)

```bash
# 설치 없이 바로 실행
npx vibe-ready .

# 또는 전역 설치
npm install -g vibe-ready

# 어디서든 사용
vibe-ready /path/to/repo
vibe-ready . --verbose
vibe-ready . --markdown
vibe-ready . --pdf report.pdf
vibe-ready . --category "하네스 엔지니어링"
```

> **사전 조건**: [Claude Code](https://claude.ai/code)가 설치 및 인증되어 있어야 합니다. Claude Agent SDK는 Claude Code 구독 인증을 사용하며, 별도 API 키가 필요 없습니다.

### 개발자용 (소스에서 빌드)

```bash
git clone https://github.com/roboco-io/vibe-ready-cli.git
cd vibe-ready-cli
npm install
npm run build

# 소스에서 실행
node dist/index.js /path/to/repo
node dist/index.js . --verbose --markdown
node dist/index.js . --pdf report.pdf --verbose

# 테스트
npm test
```

### CLI 옵션

| 옵션 | 기본값 | 설명 |
|------|--------|------|
| `[path]` | `.` | 분석할 리포지토리 경로 |
| `-v, --verbose` | - | 상세 분석 결과 표시 |
| `-m, --markdown` | - | 마크다운 형식 출력 |
| `-c, --category <names>` | 전체 | 특정 카테고리만 분석 (쉼표 구분) |
| `-b, --branch <branches>` | 현재 | 브랜치별 분석 및 비교 리포트 (쉼표 구분) |
| `-o, --output <file>` | - | 리포트 파일 저장 (.md 확장자 자동 감지) |
| `--pdf <file>` | - | PDF 내보내기 (pandoc + xelatex 필요) |
| `--no-cache` | - | 캐시 무시, 새 분석 강제 |
| `--max-turns <n>` | `200` | LLM 에이전트 최대 턴 수 |
| `--max-budget <n>` | `0.50` | 분석 1회당 최대 비용 (USD) |
| `--timeout <n>` | `120` | 타임아웃 (초) |

## 분석 카테고리

### 필수 (Must-Have) — 검증력 우선
| 카테고리 | 가중치 | 분석 대상 |
|----------|--------|----------|
| 테스트 커버리지 | 20% | 테스트 설정, 테스트 파일, 커버리지 설정, 테스트 스크립트 |
| CI/CD | 20% | GitHub Actions, GitLab CI 등 파이프라인 설정 및 내용 |
| 훅 기반 검증 | 20% | husky, lint-staged, pre-commit, commitlint 등 |

### 권장 (Nice-to-Have)
| 카테고리 | 가중치 | 분석 대상 |
|----------|--------|----------|
| 리포지토리 구조 | 13.3% | 디렉토리 구성, 의존성 관리, 설정 분리 |
| 문서화 수준 | 13.3% | README, CONTRIBUTING, API 문서, 아키텍처 문서 |
| 하네스 엔지니어링 | 13.4% | CLAUDE.md, AGENTS.md, .claude/settings.json, 스킬, 커맨드, 다중 AI 도구 지원 |

## 설정 파일

리포 루트에 `.vibeready.json`을 생성하여 평가 항목을 커스터마이징할 수 있습니다:

```json
{
  "categories": [
    { "name": "테스트 커버리지", "tier": "must", "weight": 0.25 },
    { "name": "CI/CD", "tier": "must", "weight": 0.25 },
    { "name": "보안 설정", "tier": "must", "weight": 0.20,
      "description": "리포지토리 보안 관련 설정 평가",
      "checkpoints": [
        ".env가 .gitignore에 포함되어 있는가",
        "시크릿이 소스코드에 하드코딩되어 있지 않은가",
        "의존성 취약점 스캔 설정 여부"
      ]
    },
    { "name": "문서화 수준", "tier": "nice", "weight": 0.15 },
    { "name": "하네스 엔지니어링", "tier": "nice", "weight": 0.15 }
  ],
  "penaltyRule": {
    "enabled": true,
    "maxGrade": "C",
    "condition": "any must-have category F"
  }
}
```

- 기본 카테고리의 가중치/tier 변경 가능
- `description` + `checkpoints`로 커스텀 카테고리 추가 가능
- 가중치 합계가 1.0이 아니면 자동 정규화
- 지원 파일명: `.vibeready.json`, `.vibeready.config.json`, `vibeready.config.json`
- 전체 예시: [.vibeready.example.json](.vibeready.example.json)

## 출력 예시

```
═══════════════════════════════════════════════════
  🎵 Vibe Ready Score
═══════════════════════════════════════════════════

  종합 점수: 72 / 100  등급: C

  카테고리별 결과
  ─────────────────────────────────────────────────
  카테고리             구분     점수     등급
  ─────────────────────────────────────────────────
  테스트 커버리지       필수     85       B
  CI/CD               필수     90       A
  훅 기반 검증         필수     45       F
  리포지토리 구조       권장     80       B
  문서화 수준          권장     70       C
  하네스 엔지니어링      권장     60       D
  ─────────────────────────────────────────────────

  ⚠ 필수 카테고리 F 등급: 훅 기반 검증 → 전체 등급 최대 C로 제한

  개선 권고
  ✖ [훅 기반 검증] pre-commit 훅이 설정되지 않았습니다
    → husky를 설치하고 lint-staged를 설정하세요
```

## 스코어링 모델

- 각 카테고리: 0~100점
- 종합 점수: 가중 평균 (필수 60%, 권장 40%)
- 등급: A(90+), B(80+), C(70+), D(50+), F(<50)
- **페널티**: 필수 카테고리 중 하나라도 F이면 전체 등급을 C로 캡핑

## CLI 옵션

| 옵션 | 기본값 | 설명 |
|------|--------|------|
| `[path]` | `.` | 분석할 리포지토리 경로 |
| `-v, --verbose` | - | 상세 분석 결과 (rawFindings) 표시 |
| `--max-turns <n>` | `200` | LLM 에이전트 최대 턴 수 |
| `--max-budget <n>` | `0.50` | 분석 1회당 최대 비용 (USD) |
| `--timeout <n>` | `120` | 타임아웃 (초) |

## Known Limitations

- **LLM 비결정론성**: 동일 리포를 반복 분석하면 ±5~10점 변동이 있을 수 있습니다
- **예상 비용**: 분석 1회당 약 $0.10~0.50 (리포 크기에 따라 다름)
- **Read-Only 분석**: 대상 리포지토리를 절대 수정하지 않습니다
- **MVP 제한**: 현재 단일 리포 + 터미널 출력만 지원. JSON/HTML 출력, 일괄 점검은 후속 버전 예정

## 개발

```bash
npm install
npm run build
npm test
```

## Tutorial

이 프로젝트를 만들어가는 전체 과정을 바이브 코딩 튜토리얼로 정리했습니다:

**[Vibe Coding Tutorial](docs/vibe-coding-tutorial/README.md)** — 5챕터, 아이디어 → 심층인터뷰 → 구현 → 하네스 엔지니어링 → 기여 체계

| 챕터 | 소요 시간 | 핵심 내용 |
|-------|----------|----------|
| 01. 아이디어와 초기화 | ~10분 | ideation 문서, /init |
| 02. 심층 인터뷰 | ~25분 | 10라운드 Q&A, 모호도 100%→19% |
| 03. MVP 구현 | ~40분 | Claude Agent SDK 기반 5개 모듈 |
| 04. 하네스 엔지니어링 | ~15분 | CLAUDE.md, AGENTS.md, settings.json |
| 05. 기여 가이드 + 스킬 | ~10분 | CONTRIBUTING.md, contribution-guard 스킬 |

## 하네스 엔지니어링 (Harness Engineering)

이 프로젝트는 AI 에이전트(Claude Code 등)가 코드베이스를 효과적으로 이해하고 작업할 수 있도록 **하네스 엔지니어링**을 적용하고 있습니다.

### 구성 요소

| 파일 | 역할 |
|------|------|
| `CLAUDE.md` | 에이전트가 프로젝트를 이해하기 위한 핵심 컨텍스트 — 기술 스택, 빌드 명령어, 아키텍처, 데이터 플로우, 스코어링 규칙, 코딩 컨벤션 |
| `AGENTS.md` | 에이전트의 작업 가이드라인 — 모듈 구조, 테스트/커밋 규칙, 확장 포인트, 금지 사항 |
| `.claude/settings.json` | 에이전트 권한 및 훅 설정 — 허용 도구, PreCommit 자동 검증(빌드+테스트) |

### 설계 원칙

- **즉시 파악 가능한 컨텍스트**: 에이전트가 첫 턴에 프로젝트 구조, 빌드 방법, 아키텍처를 이해할 수 있도록 `CLAUDE.md`에 집중 기술
- **안전한 자율 작업**: `.claude/settings.json`에서 읽기 도구와 빌드/테스트 명령어만 자동 허용하여, 에이전트가 파괴적 동작 없이 자율적으로 탐색·검증 가능
- **커밋 전 자동 검증**: PreCommit 훅으로 `npm run build && npm test`를 강제하여, 에이전트가 깨진 코드를 커밋하는 것을 방지
- **확장 가이드 내장**: `AGENTS.md`에 새 체크 모듈, 출력 포맷, CI 게이트 모드 등의 확장 방법을 명시하여 에이전트가 일관된 패턴으로 기능을 추가할 수 있도록 안내

### 심층인터뷰 기반 컨텍스트 수집

프로젝트 초기 단계에서 요구사항의 모호성을 줄이기 위해 **심층인터뷰**(deep interview)를 수행했습니다. 10라운드의 구조화된 Q&A를 통해 목표, 제약조건, 수용 기준을 구체화하고, 그 결과를 `.omc/specs/deep-interview-*.md`에 보존하여 이후 작업의 컨텍스트로 활용합니다.

## License

MIT
