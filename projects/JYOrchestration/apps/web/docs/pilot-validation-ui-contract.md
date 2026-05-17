# Pilot Validation UI Contract

## Phase 0 (read-only chain validation)

- H20.5~H45.5 read-only metadata chain을 종합해 `runtimePilotValidationReadOnlyChainSummary`를 산출한다.
- Diagnostic API·Overlay는 운영자/개발자용 진단 표시에 사용한다.
- actual pilot activation·execution·runner·adapter·sandbox·routing·enforcement 없음.

## Phase 1 (user-visible review UI)

- 실제 execution이 아니라 사용자용 read-only 검증 화면이다.
- 사용자에게 H20.5~H45.5 등 내부 harness 계층명을 노출하지 않는다.
- 사용자는 상태·금지 작업·승인 필요 여부·보완 요청 액션만 본다.
- `PilotValidationReviewPanel`은 `PilotValidationUserSummaryVm`을 입력으로 받는다.
- `파일럿 실행 검증 준비` 버튼은 adapter 호출이 아니며, 기본 동작은 dry-run 안내 문구 표시다.
- 실제 pilot execution adapter는 Phase 2에서 별도 검토한다.
