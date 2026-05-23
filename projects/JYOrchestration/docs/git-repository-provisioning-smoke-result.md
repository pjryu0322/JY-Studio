# Git Repository Provisioning Smoke Result

## 환경
- Date: 2026-05-22T09:58:38.699Z
- Branch: main
- Commit: 529c2eeec0f6
- Base URL: http://127.0.0.1:3000
- Project ID: cmouzqrti0001un5chw5gyr6p
- Owner: (not set)
- New repo: jyo-provision-smoke-20260522095838
- DB migration applied: (run `npm run db:migrate` before smoke — not auto-verified here)
- GitHub token source: ExecutionSetup or peer (value not recorded)
- Live API: partial/blocked

## 결과 요약

| Metric | Count |
|--------|------:|
| PASS | 5 |
| FAIL | 0 |
| BLOCKED | 4 |

| No | Scenario | Result | Evidence | Notes |
|---:|---|---|---|---|
| 1 | invalid Korean repo | PASS | {"status":200,"success":false,"data":{"ok":false,"projectName":"Web Meeting MVP","repoName":"","exists":false,"lookupStatus":"invalid_chars","nextActions":[],"message":"Repository name cannot contain spaces."}} |  |
| 2 | invalid owner/repo | PASS | {"status":200,"success":false,"data":{"ok":false,"projectName":"Web Meeting MVP","repoName":"","exists":false,"lookupStatus":"owner_repo_format","nextActions":[],"message":"Enter repository name only, not owner/repo."}} |  |
| 3 | invalid URL repo | PASS | {"status":200,"success":false,"data":{"ok":false,"projectName":"Web Meeting MVP","repoName":"","exists":false,"lookupStatus":"url_format","nextActions":[],"message":"Enter repository name only, not a URL."}} |  |
| 4 | GitHub scenario 4 | BLOCKED | {} | missing JYO_GITHUB_OWNER |
| 5 | GitHub scenario 5 | BLOCKED | {} | missing JYO_GITHUB_OWNER |
| 6 | GitHub scenario 6 | BLOCKED | {} | missing JYO_GITHUB_OWNER |
| 7 | GitHub scenario 7 | BLOCKED | {} | missing JYO_GITHUB_OWNER |
| 9 | branch policy (unit proxy) | PASS | {"note":"run: npm run test:api -- branchPolicy repoNamePolicy"} | orch/{repoSlug}/t-* ; Korean task → task slug |
| 10 | RuntimeEvent (unit proxy) | PASS | {"note":"run: npm run test:api -- runtimeEvent"} | schema + repository tests |

## BLOCKED / prerequisites
- JYO_GITHUB_OWNER not set — GitHub prepare/create skipped

## 발견 이슈
- (none)

## 수정 필요 여부
- Cursor fix needed: no
- User/UI test can proceed: partial

## 후속 제안
- UI: wire `ProjectExecutionEnvironmentPanel` to provision API
- Org repo creation: not in MVP
- Created smoke repos: manual delete on GitHub if no longer needed
