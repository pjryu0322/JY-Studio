# JYOrchestration — Feature Detail Editing v2 (구현 메모)

> Downloads의 `cursor_feature_detail_editing_prompt_v2.md`는 본문이 비어 있어(29B), v1 스펙 + 아래 v2 보강 항목을 코드에 반영했습니다.

## v2 보강 (v1 대비)

1. **Canvas 인라인 액션** — 목록에서 편집 / 부분 저장 / 확정 / 폐기 (`FeatureDetailCanvasOverlay`)
2. **`focusFeatureId`** — `featureDetailSlotsV1`에 현재 focus 기능 ID 저장
3. **`API_DEFINE_START` fast-path** — 확정 기능 1개 이상 시 API 정의 진입, 낮은 확정률 경고
4. **Drawer 이전/다음 기능** — `FeatureDetailEditDrawer` 네비게이션
5. **빌드 수정** — `RequirementsWorkspace` 중복 import 제거

## SoT

- `featureDetailSlotsV1` (채팅/Canvas 로컬만 저장 금지)

## 테스트

- `tests/api/featureDetailSlots.unit.test.ts` (focus, API gating, mutation lifecycle)

## v1 전체 스펙

- `cursor_feature_detail_editing_prompt.md` (Downloads 또는 동일 내용 참고)
