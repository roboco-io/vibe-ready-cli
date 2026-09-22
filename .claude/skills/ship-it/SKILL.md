---
name: ship-it
description: >-
  완료된 코드 변경을 GitHub 이슈 생성 → 브랜치 → 커밋 → PR → PR 리뷰 → 리뷰 반영 → 머지 → 릴리즈까지
  한 번에 순차 자동화한다. 사용자가 "이슈 만들고 커밋, PR, 리뷰, 머지, 릴리즈까지 진행해", "전체 출시
  진행", "이슈부터 릴리즈까지", "PR 리뷰 후 머지하고 릴리즈해", "ship it" 처럼 여러 출시 단계를 묶어
  요청할 때 반드시 사용한다. "이슈 만들고 커밋, PR 진행" 또는 "PR 리뷰 후 머지" 같이 일부 구간만
  요청해도 해당 구간에 이 스킬을 사용한다. 미커밋 변경을 정식으로 배포/출시하려는 모든 상황에서 적극 사용.
---

# Ship It — 이슈부터 릴리즈까지 순차 출시

작업 트리에 이미 완료된(또는 직전 대화에서 만든) 코드 변경을, 추적 가능한 단일 흐름으로 출시한다.
각 단계는 앞 단계의 산출물(이슈 번호, 브랜치, PR 번호)에 의존하므로 **순서대로** 진행한다.

## 핵심 원칙

- **사용자가 요청한 구간만 수행한다.** "이슈 만들고 커밋, PR까지"면 5단계에서 멈춘다. "리뷰 후 머지, 릴리즈"면 이미 열린 PR부터 이어서 한다. 요청에 없는 단계로 넘어가기 전에는 멈춘다.
- **되돌리기 어려운 외향 작업은 확인 후 진행한다.** 머지·릴리즈·게시(npm publish 등)는 결과가 공개·영구적이다. 사용자가 이미 그 단계를 명시 요청했으면 진행하고, 아니면 확인한다. 버전 번호처럼 한 번 정하면 영구적인 값은 `AskUserQuestion`으로 확인한다.
- **작업과 무관한 변경은 커밋·릴리즈에서 제외한다.** 세션 중 자동 생성/수정된 파일(`.claude/settings.json`, `.claude/worktrees/` 등)은 이번 변경과 무관하면 스테이징하지 않는다. 의심되면 `git diff <file>`로 내용을 확인하고, 사용자가 만들지 않았거나 설명과 모순되면 건드리지 말고 보고한다.
- **증거 기반으로 보고한다.** 각 단계의 명령 결과(테스트 통과 수, CI 상태, 머지 여부)를 실제로 확인하고 전한다. 실패는 그대로 드러낸다.
- **저장소 관례를 따른다.** 커밋 메시지 언어/형식, PR 본문, 브랜치 네이밍은 `git log`와 기존 PR에서 관찰한 패턴을 그대로 따른다. 아래 규칙은 그 관례가 없을 때의 기본값이다.

## 사전 점검

먼저 한 번에 상태를 파악한다:

```bash
git status --short
git branch --show-current
gh repo view --json nameWithOwner,defaultBranchRef -q '.nameWithOwner, .defaultBranchRef.name'
git log --oneline -5   # 커밋 메시지 관례(언어, conventional prefix, 이슈 참조) 파악
```

- 변경 파일 중 이번 작업에 속하는 것과 무관한 것을 구분한다.
- `gh issue view`/`gh pr view`는 항상 `--json <fields>`로 호출한다. 기본 출력은 "Projects (classic) is being deprecated" GraphQL 오류로 실패할 수 있다.

## 단계별 워크플로

### 1. 이슈 생성

`gh issue create`로 만든다. 본문은 저장소 언어 관례(이 저장소는 한국어)를 따르고, **배경 + 체크리스트** 구조로 작성한다. 변경이 여러 주제를 담으면 섹션으로 나눈다.

```bash
gh issue create --repo <owner/repo> --title "<요약>" --body "$(cat <<'EOF'
## 배경
<왜 이 변경이 필요한가>

## <주제 1>
- [ ] 구체적 작업 항목
...
EOF
)"
```

반환된 이슈 번호(#N)를 이후 단계에서 사용한다.

### 2. 브랜치 생성

기본 브랜치(main 등)에 있으면 먼저 분기한다. 네이밍은 `feat/issue-<N>-<짧은-슬러그>` 기본.

```bash
git checkout -b feat/issue-<N>-<slug>
```

### 3. 논리 단위 커밋

큰 diff는 **논리 단위로 나눠** 커밋한다. 단, 같은 파일·같은 주제의 변경은 한 커밋으로 묶는 편이 깔끔하다(서로 다른 파일 경계로 나누는 것이 가장 단순하다). `git add -p` 같은 인터랙티브 분할은 이 환경에서 막히므로 파일 단위로 스테이징한다.

- 메시지는 conventional commit + 저장소 언어. 본문에 이슈 번호(`(#N)`)를 참조한다.
- 커밋 푸터에 협업 서명을 붙인다 (저장소 관례를 따르되, 기본):
  ```
  Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
  ```
- 커밋 시 pre-commit 훅이 build/test를 돌리는 저장소가 많다. 훅 출력에서 **테스트 통과를 확인**하고, 실패하면 멈추고 고친다.

작업 무관 파일을 빼고 명시적으로 스테이징:
```bash
git add <관련 파일들>
git commit -m "$(cat <<'EOF'
<type>: <요약> (#N)

<본문>

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

### 4. push & PR 생성

```bash
git push -u origin <branch>
gh pr create --repo <owner/repo> --base <default> --head <branch> \
  --title "<제목>" --body "$(cat <<'EOF'
Closes #N

## 변경 요약
...

## 테스트
- <통과 결과>

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- 본문 첫 줄에 `Closes #N`을 넣어 머지 시 이슈가 자동 종료되게 한다.
- PR 본문 푸터는 저장소 관례를 따르되 기본은 위 "Generated with Claude Code" 라인.

### 5. PR 리뷰

`pr-review-toolkit:code-reviewer` 에이전트(Agent 툴)로 변경을 리뷰한다. 에이전트에 PR 번호·브랜치·리포 경로와 함께 `git diff <default>...HEAD`로 diff를 볼 수 있음을 알리고, 저장소 컨벤션(CLAUDE.md 등)을 기준으로 정확성·엣지케이스·일관성 위주 검토를 요청한다. "실제 결함만 보고하고 사소한 취향은 제외"하도록 지시한다.

### 6. 리뷰 반영

리뷰가 **실질적 결함**을 찾으면:
1. 결함을 수정하고, 필요하면 회귀 테스트를 추가한다.
2. 리뷰 반영 커밋을 만든다 (`fix: 코드 리뷰 반영 - <요약> (#N)`).
3. push하고, PR에 반영 내용을 코멘트로 남긴다 (`gh pr comment <PR> --body ...`).

리뷰가 사용자 의도와 어긋난다고 판단하면 맹목적으로 따르지 말고, 근거를 들어 설명하고 사용자 의도에 맞는 해법을 택한다.

### 7. 머지

머지 전 CI 통과를 확인한다:
```bash
gh pr checks <PR> --repo <owner/repo> --watch
```
통과하면 머지한다. 머지 방식은 저장소 관례를 따른다(직전 PR들이 squash면 squash). 기본:
```bash
gh pr merge <PR> --repo <owner/repo> --squash --delete-branch
```
머지·이슈 종료 상태를 확인한다:
```bash
gh pr view <PR> --repo <owner/repo> --json state,mergedAt -q '{state:.state, mergedAt:.mergedAt}'
gh issue view <N> --repo <owner/repo> --json state -q '.state'
```

### 8. 로컬 동기화

작업 무관 변경(예: `.claude/settings.json`)을 **보존한 채** 기본 브랜치를 동기화한다:
```bash
git stash push -- .claude/settings.json        # 무관 변경이 있으면
git checkout <default> && git pull --ff-only
git stash pop                                  # 보존분 복원
git branch -d <merged-branch>
```

### 9. 릴리즈 (요청 시)

릴리즈가 요청 범위에 포함될 때만 수행한다.

1. **릴리즈 방식 감지**: 매니페스트로 생태계를 파악한다 — `package.json`(npm), `pyproject.toml`/`setup.py`(PyPI), `Cargo.toml`(crates), `go.mod`(go), 기타. 게시(publish) 워크플로(`.github/workflows/`)나 자동 publish 트리거가 있는지도 확인한다.
2. **버전 결정**: 기존 태그(`git tag --sort=-v:refname`)와 변경 성격으로 semver를 정한다 — breaking=major, 기능 추가=minor, 버그/문서/루브릭 조정=patch. 버전은 영구적이므로 `AskUserQuestion`으로 확인한다.
3. **버전 범프 + 커밋**: 생태계별 버전 파일을 올리고(npm은 `npm version <v> --no-git-tag-version`이 package.json + lock 갱신) `chore: release v<X.Y.Z>` 커밋 후 push.
4. **태그 + GitHub 릴리즈**: `gh release create v<X.Y.Z> --target <default> --title ... --notes ...`. 릴리즈 노트는 이전 태그 이후 변경을 Features/Changes/Fixes로 정리하고 `compare/v<old>...v<new>` 링크를 단다.
5. **게시(publish)**: 자동 publish 워크플로가 있으면 태그 push로 트리거되므로 `gh run watch <id> --exit-status`로 성공을 확인한다. 없거나 수동이면, 외향 작업이므로 사용자 확인 후 진행하고 게시 결과를 검증한다(예: `npm view <pkg>@<v> version`).

CDN 전파 지연으로 `latest` 조회가 옛 버전을 보일 수 있으니, 특정 버전을 직접 조회해 확인한다.

## 이 저장소 메모 (vibe-ready-cli)

- 커밋·릴리즈에서 `.claude/settings.json`, `.claude/worktrees/`는 작업 무관이면 제외한다.
- pre-commit 훅이 `npm run build && npm test`를 돌린다 — 커밋 시 통과를 확인.
- 태그 push 시 **"Publish to npm" 워크플로가 자동 publish**한다(저장소 secret `NPM_TOKEN` 사용). 따라서 릴리즈는 수동 `npm publish` 없이 태그/릴리즈 생성만으로 게시되며, `gh run watch`로 성공을 확인한다.
- 머지는 squash, 머지 후 브랜치 삭제가 관례.
- npm/GitHub 인증 토큰은 `~/.zshrc`(`NPM_ACCESS_TOKENS` 등)에서 로드될 수 있다 — 인터랙티브 로그인이 필요하면 사용자에게 `! <명령>` 실행을 안내한다.
