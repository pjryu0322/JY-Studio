# Git Repository Provisioning — 사용자 테스트 가이드

## 전제

- GitHub Personal Access Token이 `ExecutionSetup` 또는 동일 소유자 peer 프로젝트에 저장되어 있어야 합니다.
- **Personal repo 생성만 지원** (`POST /user/repos`). Organization 소유 저장소 **생성**은 MVP에서 미지원합니다.
- Org/타 사용자 소유 **기존 repo**는 토큰 권한이 있으면 `analyze_existing` / `bind_existing` 가능합니다.
- 기존 repo **삭제·초기화·force-push** 기능은 없습니다.
- 플랫폼 `Project.name`(한글 가능)은 GitHub **repo명·branch slug**에 사용되지 않습니다. repo명은 **영문으로 직접 입력**합니다.

## API

`POST /api/projects/{projectId}/git-repository/provision`

| action | 설명 |
|--------|------|
| `prepare` | `owner` + `repo` 필수, 존재 여부·분석·`nextActions` |
| `create_and_bind` | 없으면 personal 계정에 생성 후 `ExecutionSetup` bind |
| `analyze_existing` | 분석만 (DB 변경 없음) |
| `bind_existing` | `confirmExistingRepo` (+ high-risk 시 `confirmHighRiskExistingRepo`) |

응답에 **plain GitHub token은 포함되지 않습니다.**

---

## 체크리스트

1. [ ] 플랫폼 프로젝트 생성 (이름은 한글 가능)
2. [ ] GitHub `owner` + 영문 `repo` 입력 (예: `meeting-summary-service`)
3. [ ] `prepare` — repo 없음 → `nextActions`에 `create_repo`
4. [ ] `create_and_bind` — 생성·bind 성공, `executionSetupUpdated: true`
5. [ ] `ExecutionSetup`: `gitRepoName`, `gitRepoUrl`, `baseBranch`, `branchStrategy: feature-per-task`, `branchPrefix: orch`
6. [ ] 기존 repo가 있으면 `analyze_existing` → `analysis`만 반환, DB 미변경
7. [ ] high-risk repo → `manual_review` 시 `confirmHighRiskExistingRepo: true` 후 `bind_existing`
8. [ ] 일반 Task 실행 → working branch가 `orch/{repoSlug}/t-...` 형태 (한글 미포함)
9. [ ] PR target / base branch가 `main`(또는 repo default)인지 확인
10. [ ] RuntimeEvent timeline (`runtime_events` 테이블)에 이벤트 적재 확인

---

## Smoke 요청 예시

### prepare — repo 없음

```http
POST /api/projects/{projectId}/git-repository/provision
Content-Type: application/json

{
  "action": "prepare",
  "owner": "pjryu0322",
  "repo": "meeting-summary-service"
}
```

기대: `success: true`, `data.exists: false`, `data.nextActions`에 `create_repo`

### prepare — repo invalid (한글)

```json
{
  "action": "prepare",
  "owner": "pjryu0322",
  "repo": "회의록 자동화"
}
```

기대: `success: false`, `data.lookupStatus: "not_ascii"`

### analyze_existing

```json
{
  "action": "analyze_existing",
  "owner": "pjryu0322",
  "repo": "existing-repo"
}
```

기대: `analysis` 반환, `ExecutionSetup` 변경 없음

### bind_existing (high-risk)

```json
{
  "action": "bind_existing",
  "owner": "pjryu0322",
  "repo": "existing-repo",
  "confirmExistingRepo": true,
  "confirmHighRiskExistingRepo": true
}
```

기대: high-risk 확인 후 bind, `executionSetupUpdated: true`

### create_and_bind

```json
{
  "action": "create_and_bind",
  "owner": "pjryu0322",
  "repo": "meeting-summary-service",
  "private": true
}
```

기대: `owner`가 토큰 `/user` login과 일치할 때만 신규 생성. 불일치 시 `reason: owner_mismatch`.

---

## Branch 정책 확인

`ExecutionSetup.gitRepoName = "pjryu0322/meeting-summary-service"` 일 때:

```text
feature-per-task → orch/meeting-summary-service/t-{shortTaskId}-{titleSlug}
```

- Task 제목이 한글-only이면 title slug는 `task` fallback.
- `manual` 기본값은 `main` 직접 체크아웃하지 않음 (`orch/manual/t-...`).

---

## RuntimeEvent

- Schema: `packages/db/schema.prisma` — `model RuntimeEvent`
- Migration: `packages/db/migrations/20260519180000_runtime_events`
- 배포 DB: `npm run db:migrate` (프로젝트 루트/웹 앱 스크립트 기준)

---

## 사용자테스트 가능 여부 (판정)

다음이 모두 OK이면 **사용자테스트 진행**:

- [ ] `npm run db:migrate` 적용됨
- [ ] Git Provisioning API 4 action smoke 통과
- [ ] 일반 Task 1회 이상 worker path 실행
- [ ] branchName이 repo slug 기반
- [ ] ENV_TEST task는 기존 `envcheck/t-hello-world-*` 유지

## 후속 (MVP 이후)

- Organization repo creation (`POST /orgs/{org}/repos`)
- Execution Setup UI에서 provision API 직접 연동 (현재 API·service·테스트 중심)
