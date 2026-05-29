# 구현단계 Target Repo 실제 소스 생성 테스트

## 사전 조건

- ExecutionSetup.gitRepoName 또는 gitRepoUrl 설정
- baseBranch 설정
- workspacePath가 해당 Git 저장소 clone 경로와 일치 (origin이 gitRepoName과 동일한 owner/repo)
- GitHub token 설정
- Cursor API/Bridge 설정
- autoCommit=true
- autoPush=true 또는 false 의도 확인

## 테스트 절차

1. Quick Design 확정
2. 구현단계 진입
3. 생성요청
4. WIP 초안 확인
5. Cursor 실행 요청 — 차단 시 메시지에 **실제 소스 생성 대상** 진단 확인
6. target repo branch 확인
7. target repo changedFiles 확인 (플랫폼 경로 prefix 불필요, 예: `src/App.tsx`)
8. commitSha 확인 (wip-stub 아님)
9. push 상태 확인 (성공 / 미수행 / 실패)
10. 구현 결과 승인
11. 검수자/보안관 점검 기준에 저장소·브랜치·Commit·변경 파일 건수 표시 확인

## 실패 시 기록

- projectId
- gitRepoName/gitRepoUrl
- workspacePath
- branchName
- selectedTaskId
- bridge status (`bridge_requested` / `bridge_running` / `bridge_completed` / `failed`)
- error message

## 수동 시나리오

### 정상 설정

- gitRepoName = `pjryu0322/aiproject`
- workspacePath = 해당 repo clone 경로
- 기대: Cursor 실행 → commitSha → push(설정에 따름) → bridge_completed

### workspacePath mismatch

- gitRepoName과 다른 저장소의 clone을 workspacePath로 지정
- 기대: 실행 차단, origin mismatch 메시지

### allowedPathGlobs

- `allowedPathGlobs = ["src/**"]` 인데 README만 변경
- 기대: bridge_failed, 허용 경로 밖 변경 사유

### push off

- autoPush = false
- 기대: commit 성공, Push 미수행 표시, bridge_completed 가능
