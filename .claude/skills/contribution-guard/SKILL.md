---
name: contribution-guard
description: 기여자가 코드를 작성하거나 PR을 준비할 때 자동으로 CONTRIBUTING.md 가이드라인을 검증합니다. 코딩 컨벤션, 테스트 작성, 커밋 메시지, 아키텍처 규칙을 확인합니다.
---

# Contribution Guard

기여 코드가 CONTRIBUTING.md 가이드라인을 준수하는지 자동으로 검증합니다.

## 실행 시점

이 스킬은 다음 상황에서 실행합니다:
- 코드 변경 후 커밋 전
- PR 준비 시
- 사용자가 `/contribution-guard` 를 명시적으로 호출할 때

## 검증 절차

### Step 1: CONTRIBUTING.md 읽기

프로젝트 루트의 `CONTRIBUTING.md`를 읽고 가이드라인을 파악합니다.

### Step 2: 변경 사항 수집

`git diff --staged`와 `git diff`를 실행하여 현재 변경된 파일 목록과 내용을 확인합니다.

### Step 3: 가이드라인 검증

변경된 파일에 대해 다음을 검증합니다:

**코딩 컨벤션**
- [ ] 들여쓰기가 2 spaces인지
- [ ] ESM import에 `.js` 확장자가 있는지
- [ ] 파일명이 kebab-case인지
- [ ] 에러 메시지가 한국어인지

**아키텍처 규칙**
- [ ] 데이터 플로우(index → analyzer → scorer → reporter) 방향을 따르는지
- [ ] LLM 의존 로직이 `analyzer.ts`에만 있는지
- [ ] 새 카테고리 추가 시 `CATEGORY_WEIGHTS`와 프롬프트가 함께 수정되었는지
- [ ] SDK 도구가 `Read`, `Glob`, `Grep`으로 제한되어 있는지

**테스트**
- [ ] 코드 변경에 대응하는 테스트가 존재하는지
- [ ] 테스트 파일이 `tests/` 디렉토리에 `*.test.ts` 네이밍으로 있는지
- [ ] `npm test`가 통과하는지 (`npm test` 실행)

**커밋 메시지** (staged 변경이 있는 경우)
- [ ] Conventional Commits 형식인지 (feat/fix/docs/test/refactor/chore)

**금지 파일**
- [ ] `.omc/`, `.omx/`, `node_modules/`, `dist/`, `.env`가 staged에 포함되지 않았는지

### Step 4: 결과 보고

검증 결과를 다음 형식으로 출력합니다:

```
Contribution Guard 검증 결과
────────────────────────────
✓ 코딩 컨벤션: 통과
✓ 아키텍처 규칙: 통과
✗ 테스트: 누락 — src/checks/new-check.ts에 대응하는 테스트가 없습니다
  → tests/checks/new-check.test.ts를 추가하세요
✓ 커밋 메시지: N/A (아직 커밋 전)
✓ 금지 파일: 통과

결과: 1개 항목 수정 필요
```

위반 항목이 있으면 구체적인 수정 방법을 제안합니다.

### Step 5: 자동 수정 제안

사소한 위반(들여쓰기, import 확장자 누락 등)은 사용자 동의 하에 자동으로 수정할 수 있습니다.
심각한 위반(테스트 누락, 아키텍처 위반)은 수정 방법만 제안하고 사용자에게 맡깁니다.
