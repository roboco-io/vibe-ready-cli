# Vibe Coding Tutorial: vibe-ready-cli

> 아이디어 한 줄에서 동작하는 CLI 도구까지 — AI 에이전트와 함께한 전체 여정

이 튜토리얼은 `vibe-ready-cli` 프로젝트를 Claude Code로 만들어가는 실제 과정을 기록한 바이브 코딩 실습서입니다. 대화 로그에서 추출한 실제 프롬프트, 의사결정, 실패, 인사이트를 그대로 담았습니다.

## 대상 독자

- Claude Code를 처음 접하는 개발자
- 바이브 코딩(AI 에이전트 기반 개발)에 관심이 있는 사람
- 하네스 엔지니어링 개념을 실제 프로젝트에 적용하고 싶은 사람

## 사전 준비

- Node.js >= 18
- Claude Code CLI 설치 (`npm install -g @anthropic-ai/claude-code`)
- Claude Code 구독 (Agent SDK 사용을 위해)

## 목차

| 챕터 | 제목 | 핵심 내용 |
|-------|------|----------|
| [01](01-ideation-and-init.md) | 아이디어와 프로젝트 초기화 | ideation 문서 작성, `/init`으로 CLAUDE.md 생성 |
| [02](02-deep-interview.md) | 심층 인터뷰로 요구사항 구체화 | 10라운드 Q&A로 모호도 100% → 19%까지 감소 |
| [03](03-implementation.md) | MVP 구현 | Claude Agent SDK 기반 분석기, 스코어러, 리포터 구현 |
| [04](04-harness-engineering.md) | 하네스 엔지니어링 | CLAUDE.md 보강, AGENTS.md, settings.json, 훅 설정 |
| [05](05-contribution-guide-and-skill.md) | 컨트리뷰션 가이드와 자동 검증 스킬 | CONTRIBUTING.md 작성, contribution-guard 스킬로 자동 검증 |

## 전체 타임라인

```
05:17 — 프로젝트 시작, ideation 문서 작성
05:25 — /init으로 CLAUDE.md 초기 생성
05:28 — 심층 인터뷰 시작 (Round 1, 모호도 100%)
05:49 — 심층 인터뷰 완료 (Round 10, 모호도 19%)
05:50 — MVP 구현 시작 (CLI + 분석 엔진 + 스코어러 + 리포터)
06:30 — 하네스 엔지니어링 시작
06:41 — 하네스 엔지니어링 커밋 완료
06:45 — 컨트리뷰션 가이드 + contribution-guard 스킬 생성
06:55 — 전체 커밋 및 푸시 완료
```

## 총 소요 시간

약 **1시간 40분** (아이디어 → 동작하는 CLI + 하네스 엔지니어링 + 기여 체계)

---

_last_generated: 2026-04-01T06:55:00Z_
_last_log_session: ee266d92-9f23-48c9-9576-dc19f987f463_
