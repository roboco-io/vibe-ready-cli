> 🇺🇸 [English](04-harness-engineering.md)

# Chapter 4: 하네스 엔지니어링

> **소요 시간**: ~15분
> **Key Insight**: 코드를 만드는 것만큼, AI 에이전트가 그 코드를 잘 다룰 수 있게 만드는 것도 중요하다.

## Context

MVP가 동작합니다. 하지만 한 가지 아이러니가 있습니다: **바이브 코딩 준비도를 측정하는 도구인데, 이 도구 자체의 바이브 코딩 준비도는 어떤가?**

초기 `/init`으로 생성된 CLAUDE.md는 최소한의 내용만 담고 있었습니다. 이제 실제 구현이 완료되었으니, 에이전트가 이 프로젝트를 효과적으로 이해하고 작업할 수 있도록 **하네스 엔지니어링**을 적용합니다.

## The Prompt

```
현재 프로젝트가 에이전트로 잘 작업이 될 수 있도록 하네스 엔지니어링 구성을 해줘.
```

## What Happened

### 1. CLAUDE.md 보강

초기 CLAUDE.md (20줄, 개요만):

```markdown
## Project Overview
**vibe-ready-cli**는 리포지토리가 바이브 코딩에 얼마나 준비되어 있는지를 분석하는 CLI 판독기입니다.

## Status
프로젝트 초기 단계 (ideation). 구현 코드 없음.
```

보강 후 CLAUDE.md (105줄, 완전한 가이드):

```markdown
## Tech Stack
- Runtime: Node.js >= 18, TypeScript (ES2022, ESM)
- 분석 엔진: @anthropic-ai/claude-agent-sdk
- CLI: commander, chalk
- 테스트: vitest

## Build & Development Commands
npm install / npm run build / npm test / npm run test:watch

## Architecture
src/
  index.ts      # CLI 엔트리포인트
  analyzer.ts   # Claude Agent SDK로 리포 분석
  scorer.ts     # 가중 평균 점수 + 등급 + 페널티 계산
  reporter.ts   # 터미널 리포트 출력
  types.ts      # 타입 정의, 스코어링 모델
  prompts/
    analyze.ts  # LLM 분석 프롬프트 빌더

## 데이터 플로우
CLI args → index.ts → analyzer.ts → scorer.ts → reporter.ts → 터미널 출력

## 스코어링 규칙
- 각 카테고리: 0~100점, 등급 A/B/C/D/F
- 페널티: 필수 카테고리 F → 전체 등급 최대 C

## Coding Conventions
- 파일명: kebab-case, 2 spaces, ESM (.js 확장자 필수)
```

**Before → After**: 에이전트가 첫 턴에 프로젝트의 기술 스택, 빌드 방법, 아키텍처, 데이터 플로우, 코딩 컨벤션을 모두 파악할 수 있게 되었습니다.

### 2. AGENTS.md 업데이트

초기 AGENTS.md는 "아직 코드가 없다"는 내용이었습니다. 이를 현재 구현 상태에 맞게 업데이트:

- 모듈 구조와 각 파일의 역할
- 핵심 타입 (`LLMAnalysisOutput`, `AnalysisResult`, `CATEGORY_WEIGHTS`)
- 확장 포인트 (새 카테고리 추가, 출력 포맷, CI 게이트 모드)
- 커밋 규칙 (Conventional Commits)

### 3. `.claude/settings.json` 생성

에이전트의 권한과 자동화 훅을 설정합니다:

```json
{
  "permissions": {
    "allow": [
      "Read", "Glob", "Grep",
      "Bash(npm run build)",
      "Bash(npm test)",
      "Bash(npx tsx src/index.ts*)",
      "Bash(git *)"
    ]
  },
  "hooks": {
    "PreCommit": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "npm run build && npm test"
          }
        ]
      }
    ]
  }
}
```

**핵심 설계 결정**:

| 설정 | 이유 |
|------|------|
| 읽기 도구 자동 허용 | 에이전트가 탐색에 방해받지 않도록 |
| 빌드/테스트 자동 허용 | 검증 루프를 빠르게 돌릴 수 있도록 |
| PreCommit 훅 | 깨진 코드 커밋 방지 — 빌드 실패하면 커밋 차단 |

## The Result

```
bb084eb docs: 하네스 엔지니어링 구성 — CLAUDE.md, AGENTS.md, settings.json 보강
 4 files changed, 300 insertions(+), 61 deletions(-)
```

## 하네스 엔지니어링의 3계층

이 프로젝트에서 적용한 하네스 엔지니어링을 정리하면 3계층 구조입니다:

```
┌─────────────────────────────────────────────┐
│  Layer 1: 컨텍스트 (CLAUDE.md)              │
│  "이 프로젝트가 무엇이고, 어떻게 동작하는가" │
├─────────────────────────────────────────────┤
│  Layer 2: 가이드라인 (AGENTS.md)            │
│  "에이전트가 어떤 규칙을 따라야 하는가"       │
├─────────────────────────────────────────────┤
│  Layer 3: 가드레일 (.claude/settings.json)  │
│  "에이전트가 무엇을 할 수 있고 없는가"       │
└─────────────────────────────────────────────┘
```

- **Layer 1 (컨텍스트)**: 에이전트가 프로젝트를 빠르게 이해하도록 돕는다
- **Layer 2 (가이드라인)**: 에이전트가 일관된 패턴으로 작업하도록 안내한다
- **Layer 3 (가드레일)**: 에이전트가 위험한 동작을 하지 못하게 막는다

## Lessons Learned

1. **하네스는 코드와 함께 진화해야 한다**: `/init`으로 생성한 초기 CLAUDE.md는 출발점일 뿐이다. 구현이 진행될 때마다 하네스도 함께 업데이트해야 한다.

2. **PreCommit 훅이 안전망이다**: 에이전트는 때때로 빌드가 깨진 코드를 커밋하려 할 수 있다. `npm run build && npm test`를 PreCommit 훅으로 강제하면 이를 방지할 수 있다.

3. **권한은 최소 원칙으로**: 에이전트에게 필요한 도구(Read, Glob, Grep, 빌드/테스트)만 자동 허용하고, 나머지는 사용자 확인을 거치도록 설정한다.

4. **데이터 플로우가 가장 중요한 문서**: 에이전트에게 아키텍처를 설명할 때, 클래스 다이어그램보다 **데이터가 어떻게 흐르는지**를 보여주는 것이 더 효과적이다.

## Try It Yourself

자신의 프로젝트에 하네스 엔지니어링을 적용해보세요:

```bash
# 1. CLAUDE.md 생성/보강
claude
> /init  # 기본 생성
# 이후 기술 스택, 아키텍처, 빌드 명령어 등을 수동으로 보강

# 2. AGENTS.md 작성
# 모듈 구조, 코딩 컨벤션, 테스트 규칙, 커밋 규칙 정리

# 3. .claude/settings.json 설정
cat > .claude/settings.json << 'EOF'
{
  "permissions": {
    "allow": ["Read", "Glob", "Grep", "Bash(npm test)"]
  },
  "hooks": {
    "PreCommit": [{
      "hooks": [{
        "type": "command",
        "command": "npm run build && npm test"
      }]
    }]
  }
}
EOF
```

**체크리스트**: 하네스가 충분한지 확인하려면, 이 도구를 자신의 리포에 돌려보세요:

```bash
npx vibe-ready . --verbose
```

---

**이전 챕터**: [03 - MVP 구현](03-implementation.md)

---

## 전체 여정 요약

| 단계 | 시간 | 핵심 산출물 |
|------|------|------------|
| 아이디어 | ~5분 | `docs/ideation.md` (18줄) |
| 프로젝트 초기화 | ~5분 | CLAUDE.md (초기 버전) |
| 심층 인터뷰 | ~25분 | 요구사항 스펙 (모호도 19%) |
| MVP 구현 | ~40분 | 5개 모듈 + 12개 테스트 |
| 하네스 엔지니어링 | ~15분 | CLAUDE.md + AGENTS.md + settings.json |
| **합계** | **~1시간 30분** | **동작하는 CLI + 완전한 하네스** |

**한 줄 아이디어에서 동작하는 도구까지, 1시간 30분.** 이것이 바이브 코딩의 힘입니다.
