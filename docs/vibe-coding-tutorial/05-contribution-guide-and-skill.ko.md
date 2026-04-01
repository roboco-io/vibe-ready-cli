> 🇺🇸 [English](05-contribution-guide-and-skill.md)

# Chapter 5: 컨트리뷰션 가이드와 자동 검증 스킬

> **소요 시간**: ~10분
> **Key Insight**: 기여 규칙을 문서로만 남기면 잊혀진다. 스킬로 만들면 에이전트가 자동으로 지킨다.

## Context

하네스 엔지니어링(Chapter 4)까지 완료하면 혼자 작업하기엔 충분합니다. 하지만 다른 기여자(사람이든 AI든)가 참여할 때는 **어떻게 기여해야 하는지**를 알려주는 가이드가 필요합니다.

단순히 CONTRIBUTING.md를 작성하는 것에서 한 걸음 더 나아가, Claude Code **스킬**로 만들어서 기여자가 코드를 작성할 때 가이드라인 준수 여부를 자동으로 검증하도록 합니다.

## The Prompt

```
컨트리뷰션 가이드 만들고 이를 클로드 공식 문서에 따라 스킬화해서
기여자가 자동으로 컨트리뷰션 가이드를 지킬 수 있게 해줘.
```

한 문장에 세 가지 요청이 담겨 있습니다:
1. CONTRIBUTING.md 생성
2. Claude Code 스킬로 변환
3. 자동 검증 메커니즘 구축

## What Happened

### 1. CONTRIBUTING.md 작성

AI가 기존 CLAUDE.md와 AGENTS.md에서 코딩 컨벤션, 아키텍처 규칙을 추출하여 기여자 관점으로 재구성했습니다:

```markdown
# Contributing to vibe-ready-cli

## 개발 워크플로우
1. 이슈 확인
2. 브랜치 생성 (feat/, fix/, docs/)
3. 코드 작성 (코딩 컨벤션 준수)
4. 테스트 작성
5. 빌드 확인
6. 커밋 (Conventional Commits)
7. Pull Request

## 코딩 컨벤션
- 들여쓰기: 2 spaces
- ESM import에 .js 확장자 필수
- 파일명: kebab-case
- 에러 메시지: 한국어

## 아키텍처 규칙
- 데이터 플로우: index → analyzer → scorer → reporter
- LLM 의존 로직은 analyzer.ts에만
- SDK 도구: Read, Glob, Grep만 허용
```

CONTRIBUTING.md의 핵심은 **"왜 이 규칙인가"를 설명하지 않는 것**입니다. 이유는 CLAUDE.md와 AGENTS.md에 이미 있습니다. CONTRIBUTING.md는 "무엇을 해야 하는가"에만 집중합니다.

### 2. contribution-guard 스킬 생성

`.claude/skills/contribution-guard/SKILL.md`를 생성합니다:

```yaml
---
name: contribution-guard
description: 기여자가 코드를 작성하거나 PR을 준비할 때 자동으로
  CONTRIBUTING.md 가이드라인을 검증합니다.
---
```

스킬의 검증 체크리스트:

| 영역 | 검증 항목 |
|------|----------|
| 코딩 컨벤션 | 들여쓰기, ESM .js 확장자, kebab-case, 한국어 에러 |
| 아키텍처 | 데이터 플로우 방향, LLM 의존성 분리, SDK 도구 제한 |
| 테스트 | 변경에 대응하는 테스트 존재, `npm test` 통과 |
| 커밋 | Conventional Commits 형식 |
| 금지 파일 | .omc/, .omx/, node_modules/, dist/, .env 미포함 |

### 3. 스킬의 동작 방식

스킬이 등록되면 기여자(또는 AI 에이전트)가 `/contribution-guard`를 실행하거나, 에이전트가 커밋 전에 자동으로 호출할 수 있습니다:

```
Contribution Guard 검증 결과
────────────────────────────
✓ 코딩 컨벤션: 통과
✓ 아키텍처 규칙: 통과
✗ 테스트: 누락 — src/checks/new-check.ts에 대응하는 테스트 없음
  → tests/checks/new-check.test.ts를 추가하세요
✓ 커밋 메시지: N/A (아직 커밋 전)
✓ 금지 파일: 통과

결과: 1개 항목 수정 필요
```

## The Result

```
692d282 docs: 바이브 코딩 튜토리얼, 컨트리뷰션 가이드, contribution-guard 스킬 추가
 10 files changed, 985 insertions(+)
```

생성된 파일:
- `CONTRIBUTING.md` — 기여자용 가이드
- `.claude/skills/contribution-guard/SKILL.md` — 자동 검증 스킬

## 하네스 엔지니어링과의 관계

Chapter 4에서 만든 3계층에 이번 작업이 추가됩니다:

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
├─────────────────────────────────────────────┤
│  Layer 4: 기여 가이드 (CONTRIBUTING.md)  ← NEW
│  "외부 기여자가 어떻게 참여해야 하는가"       │
├─────────────────────────────────────────────┤
│  Layer 5: 자동 검증 (contribution-guard) ← NEW
│  "기여 규칙을 에이전트가 자동으로 지키게"     │
└─────────────────────────────────────────────┘
```

Layer 1~3은 **나 혼자** 작업할 때의 하네스, Layer 4~5는 **팀/커뮤니티**가 참여할 때의 하네스입니다.

## Lessons Learned

1. **문서 → 스킬 변환이 핵심**: CONTRIBUTING.md만 있으면 사람이 읽고 기억해야 한다. 스킬로 만들면 에이전트가 자동으로 검증한다. 규칙의 "실행 가능성"이 달라진다.

2. **기존 하네스에서 추출하라**: CONTRIBUTING.md의 내용은 새로 작성한 것이 아니라 CLAUDE.md와 AGENTS.md에서 기여자 관점으로 재구성한 것이다. 중복이 아닌 "관점 변환"이다.

3. **스킬은 체크리스트가 아닌 검증기**: 단순 체크리스트는 사람이 확인해야 하지만, 스킬은 `git diff`를 분석하고 실제 테스트를 실행한다. "확인했습니다" 대신 "통과/실패" 증거를 제시한다.

4. **사소한 위반은 자동 수정, 심각한 위반은 안내만**: 들여쓰기 같은 사소한 문제는 자동 수정을 제안하고, 테스트 누락 같은 심각한 문제는 해결 방법만 안내하여 기여자의 학습을 돕는다.

## Try It Yourself

```bash
# 1. 자신의 프로젝트에 CONTRIBUTING.md 생성
claude
> CLAUDE.md와 AGENTS.md를 기반으로 CONTRIBUTING.md를 작성해줘

# 2. contribution-guard 스킬 생성
> 이 CONTRIBUTING.md를 Claude Code 스킬로 만들어서
> 기여자가 자동으로 가이드라인을 지킬 수 있게 해줘

# 3. 스킬 실행해보기
> /contribution-guard
```

**팁**: 스킬은 `.claude/skills/<name>/SKILL.md` 경로에 마크다운으로 작성합니다. frontmatter에 `name`과 `description`을 넣으면 Claude Code가 자동으로 인식합니다.

---

**이전 챕터**: [04 - 하네스 엔지니어링](04-harness-engineering.md)

---

## 전체 여정 최종 요약

| 단계 | 시간 | 핵심 산출물 |
|------|------|------------|
| 아이디어 | ~5분 | `docs/ideation.md` (18줄) |
| 프로젝트 초기화 | ~5분 | CLAUDE.md (초기 버전) |
| 심층 인터뷰 | ~25분 | 요구사항 스펙 (모호도 19%) |
| MVP 구현 | ~40분 | 5개 모듈 + 12개 테스트 |
| 하네스 엔지니어링 | ~15분 | CLAUDE.md + AGENTS.md + settings.json |
| 기여 가이드 + 스킬 | ~10분 | CONTRIBUTING.md + contribution-guard 스킬 |
| **합계** | **~1시간 40분** | **동작하는 CLI + 완전한 하네스 + 기여 체계** |
