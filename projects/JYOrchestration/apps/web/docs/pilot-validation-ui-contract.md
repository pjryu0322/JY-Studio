# Pilot Validation UI Contract

## Phase 3 completion milestone (orchestration)

Phase 3 is the **first completion line** for read-only orchestration validation request draft metadata. Phase 4+ (simulator contract, etc.) are optional extensions—not required for this milestone. There is still no actual adapter/sandbox/runner invocation. Users open `/pilot-validation?projectId=` to review readiness. See `pilot-validation-phase3-completion.md`.

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

## Phase 3 (Validation Request Draft & Operator Approval UI Contract)

- `runtimePilotValidationRequestDraft`·operator approval snapshot·audit trace·rollback plan candidate metadata.
- 승인 정보는 snapshot이며 actual approval enforcement가 아니다.
- audit/rollback은 candidate metadata이며 실행되지 않는다.
- `validationRequestIdCandidate`는 deterministic string이다.

## Phase 2 (Safe Echo Adapter Contract)

- `runtimeSafeEchoAdapterContractSummary`·input/output·`runtimeSandboxDryRunBoundary` metadata only.
- 아직 actual adapter/sandbox/runner invocation 없음.
- 사용자 UI는 「파일럿 검증 계약 준비됨」 등 contract-only 문구를 표시한다.
- Phase 3에서 validation request draft·operator approval UI contract 검토.

## Phase 1.5 (UI wiring & action policy)

- `GET /pilot-validation?projectId=` 화면에서 `PilotValidationReviewPanel`을 표시한다.
- VM은 `GET /api/diagnostics/overlay-runtime?projectId=&audienceMode=user` 응답을 `buildPilotValidationUserSummaryVmFromDiagnosticData`로 변환한다.
- `primaryActionEnabled`·`secondaryActionEnabled`는 상태와 무관하게 true(실제 execution 미연결).
- secondary action은 상태별 callback/no-op·안내문만 수행한다.
- Phase 2 Safe Echo Adapter Contract는 별도 설계한다.

## Phase 4 (Safe Echo Invocation Simulator Contract)

- `runtimeSafeEchoInvocationSimulatorSummary`·input·output·boundary metadata only.
- simulator는 actual adapter/sandbox/runner invocation 없음.
- 사용자 UI: 시뮬레이터 계약 상태·mode·no-invocation notice (`simulatorContractStatusKo`, `simulatorModeKo`, `simulatorNoInvocationNoticeKo`).
- 금지 문구: 「시뮬레이터 실행됨」「Dry-run 실행됨」「Sandbox 실행됨」「Adapter 호출됨」.
