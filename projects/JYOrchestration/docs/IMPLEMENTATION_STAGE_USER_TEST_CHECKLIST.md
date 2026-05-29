# 구현단계 사용자 테스트 체크리스트

구현단계 전체 흐름이 UI·상태 저장 기준으로 끊기지 않는지 수동으로 확인할 때 사용합니다.

## 사전 조건

- Quick Design 확정
- `implementationTaskListV1` 존재
- 환경설정 정상
- Cursor API 정상
- GitHub 저장소 정상

## 테스트 시나리오

1. **구현단계 첫 진입** — 작업 보드·row·역할 컬럼·생성요청 CTA 표시, 기획성 CTA 회귀 없음
2. **생성요청** — 첫 executable developer task 선택, task-scoped WIP, metadata 저장
3. **WIP 승인** — task done, 다음 executable task 안내, 통합단계가 먼저 primary 아님
4. **검수자 점검** — `targetTaskIds` 기준, unrelated task 오염 없음
5. **보안 점검** — `targetTaskIds` 기준, unrelated task 오염 없음
6. **재작업 요청** — `reworkRequests` requested 생성, `reworkCount` 증가
7. **보완 WIP** — rework 우선, prompt 보완 지시, accepted → done 전이
8. **통합 리팩토링** — `refactor_common` done
9. **통합 검수** — `integrated_review` done
10. **통합 보안** — `integrated_security` done
11. **최종 SCM** — `final_scm` done
12. **Preview ready** — preview URL·상태 확인
13. **검토단계 이동** — `implementationReviewStageReadyV1` 저장, 진입 안내

## 실패 시 기록 항목

| 항목 | 내용 |
|------|------|
| 화면 | 예: 프로토타입 생성 실행 화면 |
| 클릭한 CTA | 예: 생성요청 |
| 기대 동작 | |
| 실제 동작 | |
| 표시 메시지 | 토스트·보드·채팅 |
| 콘솔 오류 | |
| 저장 필드 | `implementationTaskExecutionStateV1`, `implementationExecutionBoardStateV1`, `reviewStageUserTestSessionV1` 등 |

## 보드 메시지 확인 포인트

`구현단계 테스트 요약` 블록에 다음이 표시되는지 확인합니다.

- 전체/완료/실패 작업 수
- 재작업 요청 수
- 사용자 확인 필요·차단
- 통합단계 상태
- Preview 상태
- 검토단계 이동 가능 여부
