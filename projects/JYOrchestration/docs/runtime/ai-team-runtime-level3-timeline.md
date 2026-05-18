# AI Team Execution Runtime Level 3 Timeline

## 목적

- Runtime 실행 흐름을 사용자에게 가시화한다.
- Level 2 실행 연결(PR #13)에서 Level 3 운영 가능 Runtime으로 진입한다.

## 데이터 소스

- `TaskExecutionRun` (`teamExecutionStatus`, `prStatus`, `evaluationReviewerSteps`, `evaluationReason`, `runError`, branch/commit/files)
- `ExecutionSetup.requireApprovalBeforeApply` (승인 단계 표시)
- `Task.executionWorkflowStatus`, `lastEvalResult`, `lastEvalSummary` — execution-runs API에서 batch 조회 후 timeline에 전달

## Timeline 단계 (고정 순서)

1. AI개발자 실행
2. Git 변경 감지
3. AI검수자 검토
4. AI보안관 점검
5. 사용자 승인
6. SCM 처리
7. 완료/차단

구현: `apps/web/src/lib/ai-team-runtime/timeline.ts` — `buildAiTeamRuntimeTimeline`

## API / UI

- `GET /api/projects/[projectId]/execution-runs` — `teamRuntime.timeline[]`
- `AiTeamExecutionLatestRunPanel` — 「AI팀 실행 타임라인」 섹션

## Run Log 확장 검토

| 항목 | 현재 상태 |
|------|-----------|
| Runtime 상태 전이가 TaskHistory에 남는가 | **부분적** — `persist.ts` / `workflow-approve` 시 `appendTaskHistory` (MANUAL_APPROVED, team status 변경 요약) |
| `appendTaskProgressLog` UI 조회 | **미통합** — NDJSON 파일/로그 스트림; Timeline 1차는 Run 필드만 사용 |
| TaskHistory + Run을 timeline에 함께 | **후속** — 별도 조회 API·병합 ViewModel 필요 |
| 별도 RunLog 테이블 | **불필요(1차)** — Run + History로 충분; Role Run 분리 시 재검토 |
| Role Run 분리 전 정리 | `teamExecutionStatus` 단일 축 → 향후 Role별 Run ID/타임스탬프 |

## 2차 보정 사항

- API에서 Task context를 함께 조회하여 approval/merge 상태 판정에 반영
- Git compare 실패(`github_compare_failed`)와 SCM hold 사유를 분리
- Timeline DTO(`TeamRuntimeTimelineItemDto`)와 ViewModel 필드 정합성 보정 (`startedAt`, `completedAt`)
- 긴 `blockReason` UI 표시 제한(500자, API 원본 유지)
- `buildAiTeamRuntimeTimelineSafe` 실패 시 `console.warn` 로깅

## 현재 한계

- Role Run은 아직 독립 DB 모델이 아니다.
- TaskHistory·ProgressLog 조회 통합은 후속 과제다.
- Retry/Cancel/Resume 정책은 후속 과제다.
- 수동 E2E는 운영 환경에서 별도 수행한다.

## 다음 작업

1. PR #14 병합 및 main 기준 Timeline post-merge 검증
2. 수동 E2E (approval → merge resume, ENV_TEST 회귀 없음 확인)
3. Role Run 분리 설계
4. Retry / Cancel / Resume 정책 설계
5. Queue/Worker 구조
6. Runtime Timeline UI — TaskHistory 이벤트 병합
