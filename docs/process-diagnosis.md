# Development-process diagnosis / 개발 프로세스 진단

Diagnosis assesses acceptance criteria, reproducible development, behavioral verification, feedback gates, changeability/context, traceability, and profile-specific delivery. It reports observations, separate hypotheses, proposed experiments, completion criteria, and success measures. It does not assign a global quality score or evaluate individuals.

진단은 인수 조건, 재현 가능한 개발, 동작 검증, 피드백 게이트, 변경 용이성과 맥락, 추적 가능성, 프로필별 전달 역량을 살펴봅니다. 관찰과 가설을 분리하고 실행·완료 기준·효과 측정을 제시합니다. 종합 품질 점수나 개인 평가는 제공하지 않습니다.

## Options / 옵션

| Option | Default | Meaning / 의미 |
| --- | --- | --- |
| `--diagnose` | off | Run process diagnosis / 프로세스 진단 실행 |
| `--engine <engine>` | `claude` | `claude` or `codex`; CLI overrides config / CLI가 설정보다 우선 |
| `--provider <value>` | `auto` | `auto`, `github`, `gitlab`, `none` |
| `--remote-url <url>` | Git origin | Override remote / 원격 주소 지정 |
| `--days <number>` | `30` | 1–3650 days / 관찰 일수 |
| `--limit <number>` | `30` | 1–100 records per PR/MR and CI collection / 각각 표본 상한 |
| `--profile <value>` | `auto` | `auto`, `service`, `library`, `cli`, `data`, `general` |
| `--goal <text>` | Engine default | Improvement objective; keep identical for comparisons / 비교 시 동일 목표 유지 |
| `--answers <file>` | none | Answers to original questions; requires `--diagnosis-file` / 원본 질문별 답변, 스냅샷 필수 |
| `--interview` | off | Ask up to three questions on a TTY / 대화형 입력에서 최대 3개 질문 |
| `--json` | off | JSON snapshot, plus comparison when requested / JSON 스냅샷 및 선택적 비교 |
| `--save-diagnosis <file>` | none | Explicit reusable snapshot / 재사용할 스냅샷 저장 |
| `--baseline <file>` | none | Previous snapshot for comparison / 비교할 이전 스냅샷 |
| `--diagnosis-file <file>` | none | Offline replay, or resume saved questions with answers/interview / 오프라인 재생 또는 원본 질문 재개 |
| `--output <file>` | stdout | Save report (JSON with `--json`, otherwise Markdown) / 보고서 저장 |
| `--markdown` | off | Diagnosis output is already readable Markdown / 진단은 기본적으로 Markdown 출력 |
| `--max-turns <number>` | `200` | Claude-only positive integer turn limit / Claude 전용 양의 정수 턴 제한 |
| `--max-budget <number>` | `0.50` | Claude-only total budget in USD / Claude 전용 전체 분석 예산 |
| `--timeout <number>` | `120` | Positive total deadline in seconds / 전체 제한 시간(초) |
| `--verbose` | off | Diagnostic progress / 상세 진행 정보 |

`--category`, `--branch`, `--pdf`, and `--agent` are incompatible with diagnosis mode. Diagnosis-specific flags require `--diagnose` or `--diagnosis-file`. The legacy command without either retains its scoring behavior and cache. Diagnosis does not read or write that cache.

진단 모드에서는 `--category`, `--branch`, `--pdf`, `--agent`를 사용할 수 없습니다. 진단 전용 옵션에는 `--diagnose` 또는 `--diagnosis-file`이 필요합니다. 두 옵션을 생략하면 기존 점수화 동작과 캐시를 유지합니다. 진단은 해당 캐시를 읽거나 쓰지 않습니다.

## Run and follow up / 실행과 후속 확인

```bash
# Initial diagnosis / 최초 진단
vibe-ready . --diagnose --goal "Faster feedback" --save-diagnosis ../baseline.json

# Repository evidence only; still calls the model / 저장소 근거만 수집, 모델 호출 있음
vibe-ready . --diagnose --provider none --profile library

# Answer the saved questions on the same repository and commit / 동일 저장소·커밋의 원본 질문에 답변
vibe-ready . --diagnosis-file ../baseline.json --answers ../answers.json \
  --save-diagnosis ../answered.json

# Follow-up after an improvement / 개선 후 후속 비교
vibe-ready . --diagnose --goal "Faster feedback" \
  --baseline ../baseline.json --save-diagnosis ../follow-up.json --output ../follow-up.md

# Replay saved observations with no SDK or network calls / SDK·네트워크 없는 재생
vibe-ready . --diagnosis-file ../follow-up.json --baseline ../baseline.json --json
```

Use a new external filename each time. Outputs must be outside the real target repository, including when a parent directory is a symlink. Existing files are never overwritten, output parents must already exist, and report/snapshot destinations must differ. Reads of snapshots, baselines, and answers accept regular JSON files up to 5 MB.

매번 저장소 밖의 새 파일명을 사용하세요. 심볼릭 링크의 실제 경로까지 확인하여 대상 저장소 내부 저장을 차단합니다. 기존 파일을 덮어쓰지 않으며 상위 폴더가 존재해야 하고 보고서·스냅샷 경로는 달라야 합니다. 스냅샷·비교 기준·답변 입력은 최대 5MB의 일반 JSON 파일만 허용합니다.

## Analysis engines / 분석 엔진

```bash
# Install/update Codex, then sign in using ChatGPT / Codex 설치·갱신 후 ChatGPT 로그인
npm install -g @openai/codex@latest
codex login
vibe-ready . --diagnose --engine codex --provider none --save-diagnosis ../codex-baseline.json
```

Engine choice is CLI `--engine` → config `engine` → Claude. Diagnosis reads only the engine preference from the config; scoring categories and `agent` are not used. `--engine` is independent of the harness focus (`--agent`) and forge (`--provider`). The Codex integration uses the installed CLI (tested: 0.155.1), its saved login, read-only execution, and isolated configuration. No new npm dependency or API key is required. See the [official Codex authentication guide](https://learn.chatgpt.com/docs/auth).

Codex rejects explicit `--max-budget` and `--max-turns` because it cannot enforce those Claude limits. The shared `--timeout` still applies; unreported Codex dollar cost is not treated as zero. Bare snapshot replay loads neither config nor an engine runtime. Resume defaults to the saved engine (missing means Claude), ignores the current config engine, and rejects a conflicting explicit override. Baselines must use the same engine.

엔진 우선순위는 CLI `--engine` → 설정 `engine` → Claude입니다. 진단은 설정에서 엔진만 읽고 점수화 항목과 `agent`는 사용하지 않습니다. `--engine`은 평가 대상 하네스(`--agent`) 및 원격 제공자(`--provider`)와 독립적입니다. Codex는 설치된 CLI(검증 버전: 0.155.1)의 기존 인증으로 설정을 격리하여 읽기 전용으로 실행합니다. 새 npm 의존성이나 API 키가 필요하지 않습니다.

Codex는 Claude의 달러 예산·턴 제한을 보장할 수 없으므로 명시한 `--max-budget`과 `--max-turns`를 거부합니다. 공통 `--timeout`은 적용하며 보고되지 않은 Codex 비용을 0으로 취급하지 않습니다. 단순 재생에서는 설정과 엔진 런타임을 읽지 않습니다. 재개 시 현재 설정 대신 저장된 엔진을 사용하고(정보가 없으면 Claude), 명시적으로 다른 엔진을 지정하면 거부합니다. 비교 기준도 같은 엔진이어야 합니다.

## Interview / 인터뷰

Run once to obtain question IDs. Save answers as an object, for example:

먼저 실행하여 질문 ID를 확인하고 다음과 같은 답변 객체를 준비하세요.

```json
{
  "q1": "We review failed pipelines each morning.",
  "q2": "Release acceptance is recorded in the linked issue."
}
```

Use the actual IDs shown in your saved report. File answers require that snapshot: `--diagnosis-file ../baseline.json --answers ../answers.json` resumes its original questions, rather than generating fresh questions with potentially reused IDs. Resumption calls the model and requires the same real repository path and commit. `--diagnosis-file ../baseline.json --interview` also resumes interactively. Without answers or an interactive interview, snapshot replay stays offline. `--interview` prompts only when stdin is a terminal; otherwise outstanding questions remain visible without blocking. Initial live interviews share the original time and budget limits; a later resume uses the new invocation's limits. Avoid putting credentials in answers. Known credentials are redacted from serialized output.

저장된 보고서에 나온 ID를 사용하세요. 파일 답변에는 원본 스냅샷이 필수입니다. `--diagnosis-file ../baseline.json --answers ../answers.json`은 같은 ID의 새 질문을 생성하지 않고 원래 질문을 재개합니다. 재개에는 모델 호출과 동일한 실제 저장소 경로·커밋이 필요합니다. `--diagnosis-file ../baseline.json --interview`로 대화형 재개도 가능합니다. 답변이나 대화형 인터뷰가 없으면 오프라인 재생을 유지합니다. `--interview`는 표준 입력이 터미널일 때만 질문하며 그 외에는 미응답 질문을 출력하고 대기하지 않습니다. 최초 실행의 인터뷰는 해당 시간·예산 제한을 공유하며, 나중에 재개할 때는 새 실행의 제한을 사용합니다. 답변에는 인증 정보를 넣지 마세요. 인식 가능한 인증 정보는 직렬화 출력에서 숨깁니다.

## Evidence and interpretation / 근거와 해석

- Remote access uses read-only GET requests with bounded pagination. GitHub accepts `GH_TOKEN` or `GITHUB_TOKEN`; GitLab accepts `GITLAB_TOKEN`. Missing credentials, permissions, and unavailable endpoints produce collection gaps; they are not proof of zero activity. `--provider none` skips remote APIs. Authentication uses the selected engine’s existing Claude Code or Codex login.
- PR/MR sampling uses update timestamps within the selected window. CI sampling and pagination are bounded. The report shows truncation, observed counts, and missing data; conclusions concern this sample.
- GitHub CI uses creation timestamps; GitLab CI uses update timestamps. Failed job/step details and bounded PR/MR patches are sampled, but full CI logs are not downloaded. GitLab comments do not establish review-submission timestamps. Total remote evidence is capped at 500KB, with the complete remote collection below 1MB.
- Auto profile detection recognizes common Node service dependencies, Node CLI/library manifests and dbt projects; otherwise it selects `general`. Use `--profile` for other stacks. Claude's hooks restrict Read/Grep to validated individual files. Codex uses an OS read-only sandbox and instructions to inspect only relevant files without executing target code; it does not have equivalent path-scoped Read/Grep hooks.
- If interview synthesis runs out of budget or fails, the first validated diagnosis and answers remain available with an explicit warning that the answers were not incorporated. Reopen the saved snapshot to retry.
- PR creation-to-merge median uses only merged records with valid timestamps, with its sample count shown. It is not deployment lead time. Creation-to-first-review includes possible draft time and excludes unobserved reviews. CI failures use completed-run denominators; retries indicate observed attempts, not proven flakiness. CI does not establish deployment or incident outcomes.
- Comparison requires the same schema, rubric, repository identity, profile, goal, and window duration. It matches stable capability IDs. A previous gap/partial is resolved only when the new finding is explicitly supported; missing, unknown, or not-applicable becomes unconfirmed. Window/sample changes are displayed. Before/after differences do not establish causality.

- 원격 수집은 GET 요청과 제한된 페이지 탐색만 사용합니다. GitHub는 `GH_TOKEN` 또는 `GITHUB_TOKEN`, GitLab은 `GITLAB_TOKEN`을 받습니다. 인증·권한·엔드포인트 문제는 활동 0건의 증거가 아닌 수집 공백입니다. `--provider none`은 원격 API를 생략합니다. 모델 인증은 선택한 엔진의 기존 Claude Code 또는 Codex 로그인을 사용합니다.
- PR/MR은 선택 기간의 갱신 시각을 기준으로 표본을 수집합니다. CI와 페이지 탐색에도 상한이 있습니다. 보고서에 잘림, 관찰 건수, 누락 자료를 표시하며 진단 범위는 해당 표본입니다.
- GitHub CI는 생성 시각, GitLab CI는 갱신 시각 기준입니다. 실패 작업·단계와 제한된 PR/MR 패치를 수집하지만 CI 로그 전체는 다운로드하지 않습니다. GitLab 댓글만으로 리뷰 제출 시각을 확정하지 않습니다. 원격 근거는 500KB, 전체 원격 수집 결과는 1MB 이내로 제한합니다.
- 자동 유형 감지는 일반적인 Node 서비스 의존성, Node CLI·라이브러리 설정과 dbt를 인식하며 나머지는 `general`을 사용합니다. 다른 기술 스택은 `--profile`로 지정하세요. Claude는 훅으로 Read/Grep을 검증된 개별 파일로 제한합니다. Codex는 OS 읽기 전용 샌드박스와 관련 파일만 조사하고 대상 코드를 실행하지 말라는 지시를 사용하며, Claude와 동일한 경로별 Read/Grep 훅은 없습니다.
- 인터뷰 합성이 예산 소진 등으로 실패하면 최초 검증된 진단과 답변을 보존하고, 답변 미반영 사실을 수집 공백에 표시합니다. 저장한 스냅샷을 다시 열어 재시도할 수 있습니다.
- 생성→병합 중앙값은 유효한 시각이 있는 병합 표본을 사용하고 분모를 표시합니다. 배포 리드타임이 아닙니다. 생성→첫 리뷰에는 초안 시간이 포함될 수 있고 관찰되지 않은 리뷰는 제외됩니다. CI 실패의 분모는 종료 실행이며 재시도는 불안정성을 확정하지 않습니다. CI만으로 배포나 장애 결과를 판단하지 않습니다.
- 비교하려면 스키마·평가 기준·저장소 식별자·프로필·목표·기간 길이가 같아야 합니다. 안정적인 역량 ID로 대응시키며 기존 개선 필요/부분 충족이 새 진단에서 명시적으로 충족된 경우만 해결로 표시합니다. 누락·판단 불가·해당 없음은 해결 미확인입니다. 기간·표본 변화를 함께 표시하고 전후 차이를 인과관계로 단정하지 않습니다.
