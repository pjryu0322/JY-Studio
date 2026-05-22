# Multi-Agent Runtime Extension Plan

Stage 1 연결 지점 — 구현은 문서화·타입만, Connector Gateway / Harness / A2A 는 후속.

---

## 1. AgentDefinition 연결 지점

| 대상 | 현재 구조 | AgentDefinition 연결 방식 | 구현 필요 여부 |
|---|---|---|---|
| Workspace AI catalog | `platformAiMembers.ts` | `WORKSPACE_AI_MEMBER_TO_AGENT_ID` | Stage 1: map만 |
| ProjectMember AI | Prisma `aiOrchestrationRole` | `ORCHESTRATION_ROLE_TO_AGENT_ID` | Stage 2: invite/sync |
| Requirements dispatch | `lastRouting.agentRole` | bridge → `getAgentById` | Stage 2: persist `agentId` |
| Bootstrap slots | `ownerAgent` in slot defs | planner/analyst/architect/designer | Stage 2: capability id |
| Execution review | `aiMemberOrchestration.ts` roles | reviewer/security → ai-reviewer/ai-security | Stage 2 |

---

## 2. CapabilityRegistry 연결 지점

| 대상 | 현재 구조 | Capability 연결 방식 | 구현 필요 여부 |
|---|---|---|---|
| QuickAction registry | `requirementsQuickActionRegistry.ts` | 1:1 또는 N:1 map 테이블 (후속) | Stage 2+ |
| Intent router | `requirementsIntentRouter` | `orchestration.intent.route` | Stage 2 |
| Bootstrap capability | slot `ownerAgent` | `project.idea.structure` 등 | Stage 2 |
| Cursor plan | prototype_build path | `cursor.implementation.plan` | Stage 3 |
| PR review | execution-review | `source.review` / `security.review` | Stage 3 |

---

## 3. Timeline / Replay 연결 지점

| 항목 | 필요한 데이터 | 현재 보유 여부 | 보완 방향 |
|---|---|---|---|
| Agent 실행 행 | `agentId`, `capabilityId`, `connectorId` | △ `agentRole`, `actorId` only | timeline entry 확장 |
| Replay 재현 | input/output snapshot, capabilityId | △ before/after summary | `AgentReplayExtension` |
| Trace group | `orchestrationTraceGroup` | ○ | capability category → group map |
| Transaction | `lastTransaction` on wire | ○ Phase 4 product | Harness commit/rollback 연동 |

---

## 4. Governance 연결 지점

| 항목 | 판단 기준 | 필요한 데이터 | 향후 구현 방향 |
|---|---|---|---|
| Action allow | Registry Guard + stage | `availableActionIds`, stage | capability → allowed actions |
| Agent authority | role × action | `requirementsMultiAgentAuthority` | AgentDefinition + capability |
| Recommendation | stage governance resolver | recommendation queue | capability `governanceChecks` |
| Connector allow | agent.allowedConnectors | partial (developer) | Connector Gateway ACL |

---

## 5. Connector Gateway 경계

| Connector | 현재 사용 위치 | 향후 통제 방식 | 이번 단계 조치 |
|---|---|---|---|
| Cursor | ExecutionJob, prototype_build AI, executionAssignment | Connector Gateway에서 통제 | 문서화만 |
| GitHub | PR sync, reviewer/security, setup token | Connector Gateway에서 통제 | 문서화만 |
| Codex | 없음 | 향후 확장 후보 | `ConnectorId` 타입 예약 |
| Copilot | 없음 | 향후 확장 후보 | `ConnectorId` 타입 예약 |
| OpenAI | LLM routes, facilitators | Provider Gateway (기존) | `runtimeMode: llm` |

---

## 6. 권장 구현 순서 (Stage 2+)

1. Dispatch/timeline에 `agentId` + `capabilityId` persist  
2. Harness: `AgentDefinition` + 단일 capability 실행 스텁  
3. Connector Gateway facade (cursor/github only)  
4. ProjectMember ↔ AgentDefinition sync  
5. Agent-to-Agent orchestration (마지막)

---

## Stage 2 진입 조건

Stage 2로 진입하기 전에 다음 조건이 충족되어야 한다.

| 조건 | 현재 상태 | 필요 조치 |
|---|---|---|
| Agent Registry Public API | 완료 | `getAllAgents`, `getCapabilitiesForAgent`, `validateAgentCapabilityBinding` |
| AI멤버 ↔ Agent Bridge | 완료 | `mapAiMemberRoleToAgentId`, `mapProjectMemberToAgentId`, `mapRequirementIntentToPrimaryAgentId`, `getDefaultAgentForStage` |
| Runtime Event Contract | 완료 | `agentRuntimeEventContract.ts`, `buildAgentRuntimeEventContext` |
| Connector Descriptor | 완료 | `DEFAULT_CONNECTORS`, `isConnectorEnabledForExecution` |
| Registry/Bridge 테스트 | 완료 | `multiAgentFoundation.unit.test.ts` 16건+ |

## Stage 2 작업 후보

| 우선순위 | 작업 | 설명 | 주의사항 |
|---|---|---|---|
| 1 | agentId/capabilityId runtime metadata wire | `AgentTimelineMetadata` / wire optional fields | 기존 저장 구조 변경 최소화 |
| 2 | Connector Gateway facade | Cursor/GitHub 호출 경로를 facade로 감싸기 | 실제 실행 방식 변경 금지 |
| 3 | Harness dry-run | Agent+Capability 선택 결과만 생성 | 자동 실행 금지 |
| 4 | Governance pre-check | `validateAgentCapabilityBinding`을 dispatch 전 호출 | dry-run부터 차단 로그 |

### Stage 2 prep 모듈 (이번 보완)

```text
apps/web/src/lib/agents/agentCapabilityBinding.ts
apps/web/src/lib/agents/agentRuntimeEventContract.ts
apps/web/src/lib/agents/connectorDescriptorTypes.ts
apps/web/src/lib/agents/defaultConnectors.ts
apps/web/src/lib/agents/connectorRegistry.ts
```

---

## Stage 2-1 Dispatch Metadata Wire 결과

| 항목 | 반영 방식 | 저장 여부 | 비고 |
|---|---|---|---|
| agentId resolution | `resolveDispatchAgent` (role → intent → stage) | 저장 안 함 | optional |
| capabilityId resolution | `resolveDispatchCapability` + `validateAgentCapabilityBinding` | 저장 안 함 | optional |
| lastAgentEvent | `buildRequirementsAgentMetadata` → `AgentRuntimeEventContext` | 저장 안 함 | agentId 없으면 생략 |
| dispatch result wire | `RequirementsIntentDispatchResult.agentRuntimeMetadata` | 저장 안 함 | timeline에 agentId 문자열 포함 |

구현: `requirementsDispatchAgentMetadata.ts`, `requirementsIntentDispatch.ts` (optional field)

## Stage 2-2 점검 결과

| 항목 | 상태 | 비고 |
|---|---|---|
| Connector Facade 타입 | OK | `connectorGatewayFacadeTypes.ts` |
| Connector plan/evaluate 함수 | OK | build/evaluate/plan |
| Cursor/GitHub plan 함수 | OK | `planCursor*` / `planGithub*` |
| Agent/Capability/Connector 정합성 검증 | OK | allowedConnectors, requiredConnectors, binding |
| 실제 외부 호출 여부 | 없음 | dry-run / pass-through record only |
| 기존 실행 경로 영향 | 없음 | Cursor/GitHub/dispatch 미변경 |
| 테스트 | OK | `multiAgentConnectorGatewayFacade` 11건 |

## Stage 2-2 Connector Gateway Facade 결과

| 항목 | 반영 방식 | 실제 호출 여부 | 비고 |
|---|---|---|---|
| ConnectorInvocationRequest | facade 요청 타입 | 없음 | dry-run/pass-through 계획용 |
| ConnectorInvocationResult | facade 판단 결과 | 없음 | allowed/status/reason 포함 |
| planConnectorInvocation | connector 실행 계획 평가 | 없음 | registry + agent/capability 검증 |
| planCursorConnectorInvocation | Cursor 계획 평가 | 없음 | 기존 Cursor 실행 미변경 |
| planGithubConnectorInvocation | GitHub 계획 평가 | 없음 | 기존 GitHub 실행 미변경 |
| Agent Metadata 연계 | `buildConnectorPlanFromAgentMetadata` | 없음 | Stage 2-1 metadata 활용 |

구현: `connectorGatewayFacadeTypes.ts`, `connectorGatewayFacade.ts`, `buildConnectorPlanFromAgentMetadata` in `requirementsDispatchAgentMetadata.ts`

검증 규칙:

```text
connector 미존재 → blocked
connector disabled (codex/copilot) → skipped, allowed=false
agent.allowedConnectors 미포함 → blocked
capability.requiredConnectors 불일치 → blocked
mode=dry_run + 조건 충족 → planned, allowed=true
mode=pass_through + 조건 충족 → passed_through (외부 호출 없음)
```

## Stage 2-3 Agent Harness Dry-run 결과

| 항목 | 반영 방식 | 실제 실행 여부 | 비고 |
|---|---|---|---|
| HarnessDryRunRequest | dry-run 입력 타입 | 없음 | intent/stage/role/agent 직접 입력 지원 |
| HarnessDryRunResult | dry-run 결과 타입 | 없음 | executable/status/reason 포함 |
| Agent resolution | Stage 2-1 `resolveDispatchAgent` 재사용 | 없음 | 직접 `agentId` 우선 |
| Capability resolution | Stage 2-1 `resolveDispatchCapability` 재사용 | 없음 | 직접 `capabilityId` 우선 |
| Connector plan | Stage 2-2 `planConnectorInvocation` 재사용 | 없음 | `requiredConnectors` 기반 |
| Governance pre-check | `buildGovernancePrecheckForCapability` | 없음 | `governanceChecks` 후보만 |

구현: `agentHarnessDryRunTypes.ts`, `agentHarnessDryRun.ts`

상태 규칙:

```text
no agent → no_agent, executable=false
no capability → no_capability, executable=false
binding invalid → blocked
connector plan !allowed → blocked
warnings only → warning, executable=true
else → planned, executable=true
```

## Stage 2-3 소스 점검 보완 (Stage 2-4 전)

| 항목 | 조치 | 파일 |
|---|---|---|
| governancePrecheck 상태 일관성 | blocking 시 status=blocked 보장 | `agentHarnessDryRun.ts` |
| Harness metadata 유지 | 모든 status에 source/projectId 등 metadata | `buildHarnessDryRunMetadata` |
| 테스트 mock 안정화 | original fn + afterEach restore | `multiAgentHarnessDryRun.unit.test.ts` |
| 설명력 보강 | resolution reason, connectorPlanSummary | harness `metadata` |

## Stage 2-4 Governance Pre-check Dry-run 결과

| 항목 | 반영 방식 | 실제 차단 여부 | 비고 |
|---|---|---|---|
| GovernancePolicyDescriptor | 정책 후보 타입 | 없음 | dry-run 전용 |
| GovernancePolicyRegistry | check → policy 조회 | 없음 | unknown check warning |
| evaluateGovernancePrecheckDryRun | requiredChecks 평가 | 없음 | candidate 평가 |
| Harness 연계 | `governanceDryRun` optional field | 없음 | executable 강제 변경 없음 |

구현: `governancePrecheckDryRunTypes.ts`, `defaultGovernancePolicies.ts`, `governancePolicyRegistry.ts`, `governancePrecheckDryRun.ts`

### Stage 2-4 상태 규칙

```text
requiredChecks 없음 → not_evaluated
info 정책만 존재 → pass_candidate
warning 정책 존재 → warning_candidate
blocking_candidate 정책 존재 → blocking_candidate (Harness executable 유지)
unknown check → warning finding
```

현재 Stage 2-4 기본 정책은 info/warning 후보만 포함한다. `blocking_candidate`는 타입과 evaluator가 지원하지만, 실제 기본 정책에는 아직 포함하지 않는다. 실제 차단 후보 정책은 Runtime 단계에서 별도 승인 후 추가한다.

### Stage 2-4 소스 점검 보완 (Stage 2-5 전)

| 항목 | 조치 | 파일 |
|---|---|---|
| governance → Harness status | `warning_candidate`/`blocking_candidate` 시 Harness `warning` 승격 | `agentHarnessDryRun.ts` |
| governance summary | `governanceDryRunSummary` + `summarizeGovernanceDryRun` | `agentHarnessDryRunTypes.ts` |
| reason 보강 | `:governance_warning_candidate` / `:governance_blocking_candidate` | `deriveHarnessReasonWithGovernance` |

## Stage 2-5 Timeline/Replay Metadata Persistence Readiness 결과

| 항목 | 반영 방식 | 실제 저장 여부 | 비고 |
|---|---|---|---|
| AgentRuntimePersistenceCandidate | 저장 후보 타입 | 없음 | schemaVersion + registryVersion |
| ConnectorPlanSummary | connectorPlans 축약 | 없음 | 원문 metadata 제외 |
| GovernanceSummary | governanceDryRun 축약 | 없음 | 실제 차단과 구분 |
| Timeline candidate helper | `buildTimelineMetadataCandidateFromHarness` | 없음 | 저장 함수 호출 없음 |
| Replay candidate helper | `buildReplaySnapshotCandidateFromHarness` | 없음 | 저장 함수 호출 없음 |
| Sanitizer/Validator | 금지 키 제거·검증 | 없음 | token/prompt/diff 제외 |

구현: `agentRuntimePersistenceCandidateTypes.ts`, `buildAgentRuntimePersistenceCandidate.ts`, `agentRuntimePersistenceCandidateValidation.ts`, `agentRuntimeTimelineReplayCandidate.ts`

### Stage 2-5 Persist 후보 필드

| 필드 | 저장 후보 여부 | 사유 | 주의사항 |
|---|---|---|---|
| agentId | 후보 | 실행 주체 추적 | registry version 고려 |
| capabilityId | 후보 | 실행 능력 추적 | registry version 고려 |
| connectorPlanSummary | 후보 | connector 판단 설명 | 원문 metadata 제외 |
| governanceSummary | 후보 | 정책 후보 평가 설명 | 실제 차단 아님 |
| warnings/blockingReasons | 후보 | 운영 진단 | 개수·길이 제한 |
| rawPrompt/codeDiff/fileContent/token | 제외 | 민감/대용량 | 저장 금지 |

### Stage 2-5 소스 점검 보완 (Stage 2-6 전)

| 항목 | 조치 | 파일 |
|---|---|---|
| limitStrings 중복 | warnings/blockingReasons 한 번만 계산 | `buildAgentRuntimePersistenceCandidate.ts` |
| 금지 키 fragment | accessToken/githubToken 등 변형 탐지 | `agentRuntimePersistenceCandidateValidation.ts` |
| sanitize → validate | raw invalid, sanitize 후 valid 테스트 | persistence unit test |
| JSON 크기 제한 | `MAX_CANDIDATE_JSON_LENGTH=12000` | validation + sanitize trim |

## Stage 2-6 Connector Gateway Pass-through Integration Readiness 결과

| 항목 | 반영 방식 | 실제 실행 여부 | 비고 |
|---|---|---|---|
| ConnectorPassThroughBoundary | 실행 경계 후보 타입 | 없음 | recordOnly=true |
| Default pass-through boundaries | Cursor/GitHub 주요 경계 후보 | 없음 | 기존 실행 경로 미변경 |
| Pass-through record candidate | facade pass_through 결과 축약 | 없음 | 외부 호출 없음 |
| Harness 연계 helper | `buildConnectorPassThroughRecordFromHarness` | 없음 | metadata만 사용 |
| Persistence summary helper | `attachPassThroughSummaryToPersistenceCandidate` | 없음 | 원문 record 제외 |

구현: `connectorPassThroughBoundaryTypes.ts`, `defaultConnectorPassThroughBoundaries.ts`, `connectorPassThroughBoundaryRegistry.ts`, `buildConnectorPassThroughRecordCandidate.ts`, `connectorPassThroughPersistenceCandidate.ts`

### Stage 2-6 경계 원칙

```text
- pass-through는 기존 실행을 대체하지 않는다.
- pass-through는 실행 전후 record 후보만 만든다.
- Connector Gateway 강제 라우팅은 하지 않는다.
- 실제 Cursor/GitHub 호출 함수는 변경하지 않는다.
- 저장 여부는 Stage 2-8 이후 별도 결정한다.
```

현재 Stage 2-6 기본 pass-through boundary는 모두 `enabled=true`이다.  
`disabled` boundary 분기는 향후 운영 설정/정책화 단계에 대비한 방어 코드이며,  
현재 기본 registry에는 disabled boundary를 포함하지 않는다.

### Stage 2-6 소스 점검 보완 (Stage 2-7 전)

| 항목 | 조치 | 파일 |
|---|---|---|
| source/createdAt | pass-through record 추적 필드 | `connectorPassThroughBoundaryTypes.ts`, `buildConnectorPassThroughRecordCandidate.ts` |
| summary mode/recordOnly | persistence summary에 record-only 명시 | `agentRuntimePersistenceCandidateTypes.ts`, `connectorPassThroughPersistenceCandidate.ts` |
| disabled boundary 정책 | 기본 registry는 모두 enabled, disabled 분기는 방어 코드 | 이 문서 + registry |

## Stage 2-7 Harness/Governance Dry-run Read-only 진단 UI 결과

| 항목 | 반영 방식 | 실제 실행 여부 | 비고 |
|---|---|---|---|
| Diagnostic ViewModel | `read_only_dry_run` VM | 없음 | 실행/저장 없음 disclaimer 포함 |
| Harness section | agent/capability/connector 계획 표시 | 없음 | dry-run 결과만 |
| Governance section | policy candidate 평가 표시 | 없음 | 실제 차단 아님 |
| Persistence candidate section | 저장 후보 preview 표시 | 없음 | 실제 저장 아님 |
| Pass-through section | boundary/record 후보 표시 | 없음 | recordOnly=true |

구현: `agentRuntimeDiagnosticViewTypes.ts`, `buildAgentRuntimeDiagnosticViewModel.ts`, `buildAgentRuntimeDiagnosticSample.ts`, `components/diagnostics/AgentRuntimeDiagnosticPanel.tsx`

### Stage 2-7 UI 원칙

```text
- 내부 진단용이다.
- 사용자 실행 플로우가 아니다.
- 실행 버튼을 만들지 않는다.
- 저장 버튼을 만들지 않는다.
- Connector 호출 버튼을 만들지 않는다.
- dry-run/read-only/record-only 안내를 항상 표시한다.
- API route 추가 없음 (방식 A: 컴포넌트 + VM만, route 미연결).
- React Testing Library 미사용 → UI 단위 테스트 생략, VM 테스트로 검증.
```

## Stage 2-7 소스 동기화 검증 결과

| 항목 | 상태 | 비고 |
|---|---|---|
| Diagnostic ViewModel | 반영됨 | `read_only_dry_run` |
| Sample Builder | 반영됨 | `source: diagnostic` |
| Diagnostic Panel | 반영됨 | `components/diagnostics/AgentRuntimeDiagnosticPanel.tsx` |
| Route 연결 | 없음 | 내부 진단 컴포넌트만 |
| 실제 실행/저장 영향 | 없음 | VM/builder only |

## Stage 2-8 Timeline/Replay Persistence 적용 여부 결정 준비 결과

| 항목 | 반영 방식 | 실제 저장 여부 | 비고 |
|---|---|---|---|
| Persistence Decision 타입 | `read_only_decision` report | 없음 | 적용 여부 판단용 |
| Persistence Decision Evaluator | candidate 기반 판단 | 없음 | DB 호출 없음 |
| Diagnostic VM 연계 | `persistenceDecision` section | 없음 | 내부 진단용 |
| Schema/Migration 판단 | boolean flag | 없음 | 실제 migration 아님 |

구현: `agentRuntimePersistenceDecisionTypes.ts`, `evaluateAgentRuntimePersistenceDecision.ts`

### Stage 2-8 원칙

```text
- 아직 실제 persist를 적용하지 않는다.
- DB/Prisma schema를 바꾸지 않는다.
- Timeline/Replay 저장 함수를 호출하지 않는다.
- 저장 여부를 결정하기 위한 report만 만든다.
- 실제 저장 적용은 별도 승인 후 Stage 2-8 후속 또는 Stage 2-9에서 진행한다.
```

### Stage 2-8 Decision 규칙 요약

```text
invalid schema/registry/forbidden key → blocked
JSON size only exceed → defer
replay_snapshot kind → defer
valid timeline_metadata → ready_for_design + timeline_metadata target
valid diagnostic_metadata + governance/passThrough summary → ready_for_design + diagnostic_log target
requiresSchemaChange/requiresMigration → true (판단값만, 실제 적용 없음)
```

## Stage 2-8 소스 보완 결과

| 항목 | 결과 | 비고 |
|---|---|---|
| buildPersistenceDecisionSection | 보완 | VM builder ReferenceError 방지 |
| diagnostic source | 유지 | `HarnessDryRunSource`에 `diagnostic` |
| Persistence Decision | 유지 | read-only decision |
| 실제 persist | 없음 | DB/Timeline/Replay 미변경 |

## Stage 2-9 Connector Gateway 라우팅 전환 평가 결과

| 항목 | 반영 방식 | 실제 라우팅 여부 | 비고 |
|---|---|---|---|
| Routing Decision 타입 | `read_only_routing_decision` report | 없음 | 영향 평가용 |
| Routing Decision evaluator | boundary 기반 판단 | 없음 | 기존 실행 경로 미변경 |
| Cursor boundary | defer | 없음 | 실행 경로 변경 영향 큼 |
| GitHub boundary | defer | 없음 | Stage1/ENV_TEST 회귀 필요 |
| Rollback plan | `requiresRollbackPlan` flag | 없음 | 실제 전환 전 필수 |
| Diagnostic VM 연계 | `connectorRoutingDecision` optional | 없음 | `routingBoundaryId` 입력 시 |

구현: `connectorGatewayRoutingDecisionTypes.ts`, `evaluateConnectorGatewayRoutingDecision.ts`

### Stage 2-9 판단 원칙

```text
- 실제 Connector Gateway 라우팅 전환은 하지 않는다.
- Cursor/GitHub 기존 실행 경로를 바꾸지 않는다.
- Stage1/ENV_TEST 회귀 없이 GitHub routing을 바꾸지 않는다.
- rollback plan 없이 전환하지 않는다.
- 현재 단계의 기본 판단은 defer이다.
- unknown/disabled/non-recordOnly boundary → blocked
```

## Stage 2-9 소스 보완 결과

| 항목 | 결과 | 비고 |
|---|---|---|
| public export 중복 | 보완 | `BuildConnectorFacadePlanFromAgentMetadataInput` alias, requirements 중복 제거 |
| routing report boundaryId/operation | 보완 | report + diagnostic section + panel |
| unknown target 처리 | 보완 | `target: "unknown"` (cursor_execution fallback 제거) |
| 실제 routing 전환 | 없음 | read-only evaluator only |

## Stage 2-10 Multi-Agent Runtime 실행 전환 설계 준비 결과

| 항목 | 반영 방식 | 실제 실행 여부 | 비고 |
|---|---|---|---|
| Execution Transition 타입 | `read_only_execution_transition_decision` | 없음 | 설계 판단용 |
| Execution Transition evaluator | target 기반 판단 | 없음 | 실행 없음 |
| Harness execution | defer | 없음 | dry-run → 실행기 영향 |
| Agent execution record | ready_for_design | 없음 | 저장 영향 검토 필요 |
| Connector bridge | defer | 없음 | Cursor/GitHub 경로 영향 |
| Governance enforcement | blocked | 없음 | 정책 승인 필요 |
| Timeline/Replay persist | defer | 없음 | 저장 구조 영향 |

구현: `agentRuntimeExecutionTransitionTypes.ts`, `evaluateAgentRuntimeExecutionTransition.ts`

### Stage 2-10 원칙

```text
- 실제 Agent 실행을 구현하지 않는다.
- 실제 Connector 실행을 구현하지 않는다.
- 실제 Governance 차단을 구현하지 않는다.
- 실제 Timeline/Replay 저장을 구현하지 않는다.
- 실행 전환 가능성을 read-only report로만 평가한다.
- requiresOperatorApproval / requiresRollbackPlan은 판단값만 제공한다.
```

### Stage 2-10 Decision 규칙 요약

```text
harness_execution → defer
agent_execution_record → ready_for_design
connector_execution_bridge → defer
governance_enforcement → blocked
timeline_replay_persist → defer
unknown target → blocked
```

## Stage 2-10 소스 보완 결과

| 항목 | 결과 | 비고 |
|---|---|---|
| execution transition summary | 보완 | 모든 report에 summary 포함 |
| recommendedNextStage | 보완 | target별 Stage 2-11/2-13 안내 |
| 실제 execution | 없음 | read-only evaluator |
| 실제 connector routing | 없음 | |
| 실제 persist | 없음 | |

## Stage 2-11 Timeline/Replay Persist 실제 적용 설계 결과

| 항목 | 반영 방식 | 실제 저장 여부 | 비고 |
|---|---|---|---|
| Persist Design 타입 | `read_only_persist_design` report | 없음 | schema 설계 전 단계 |
| Persist Design evaluator | candidate + validate 기반 | 없음 | DB/Timeline 호출 없음 |
| timeline_metadata | ready_for_schema_design | 없음 | schema 설계 필요 |
| replay_snapshot | defer | 없음 | 데이터량/민감정보 검토 |
| diagnostic_log | ready_for_schema_design | 없음 | 저장 위치 결정 필요 |
| forbidden fields | excludedFields 정책 | 없음 | prompt/diff/token 제외 |

구현: `timelineReplayPersistDesignTypes.ts`, `evaluateTimelineReplayPersistDesign.ts`

### Stage 2-11 원칙

```text
- 실제 Timeline/Replay persist를 적용하지 않는다.
- DB/Prisma schema를 변경하지 않는다.
- migration을 만들지 않는다.
- persistFields / excludedFields는 설계 report로만 제공한다.
- validateAgentRuntimePersistenceCandidate를 설계 판단에 사용한다.
```

### Stage 2-11 필드 정책 요약

```text
persist 후보: schemaVersion, registryVersion, kind, agentId, capabilityId, summaries, warnings 등
제외(정책): rawPrompt, codeDiff, token, secret, apiKey, env 등 (forbidden)
replay_snapshot → defer
invalid candidate → blocked
requiresSchemaChange / requiresMigration / requiresRollbackPlan → true (판단값만)
```

## Stage 2-11 소스 보완 결과

| 항목 | 결과 | 비고 |
|---|---|---|
| invalid candidate blocking finding | 보완 | `invalid_candidate` blocking finding 보장 |
| target-kind mismatch warning | 보완 | `target_kind_mismatch` finding |
| excludedFields dedupe | 보완 | `uniqueFieldDecisions` (detected 우선) |
| 실제 persist | 없음 | read-only design evaluator |

## Stage 2-12 Governance Enforcement 적용 설계 결과

| 항목 | 반영 방식 | 실제 차단 여부 | 비고 |
|---|---|---|---|
| Governance Enforcement 타입 | `read_only_governance_enforcement_design` | 없음 | 설계 판단용 |
| Enforcement evaluator | `governanceDryRun` 기반 | 없음 | runtime 차단 없음 |
| observe_only | not_evaluated / pass_candidate | 없음 | 관찰 모드 |
| warn_only | warning_candidate | 없음 | 경고 후보 |
| block_candidate | blocking_candidate | 없음 | 실제 차단 아님 |
| policy approval | `requiresPolicyApproval` flag | 없음 | 실제 승인 아님 |
| audit/rollback | required flags | 없음 | 실제 저장 아님 |

구현: `governanceEnforcementDesignTypes.ts`, `evaluateGovernanceEnforcementDesign.ts`

### Stage 2-12 원칙

```text
- 실제 Governance 차단을 적용하지 않는다.
- Dispatch/Runtime 실행을 중단하지 않는다.
- Policy storage를 변경하지 않는다.
- Operator override, audit log, rollback은 설계 flag로만 둔다.
- blocking_candidate는 defer + block_candidate mode (승인 전 wire 금지)
```

### Stage 2-12 Decision 규칙 요약

```text
not_evaluated → defer, observe_only
pass_candidate → ready_for_policy_design, observe_only
warning_candidate → ready_for_policy_design, warn_only
blocking_candidate → defer, block_candidate + approval/audit/rollback flags
policyDecisions ← governanceDryRun.findings (info/warning/blocking_candidate 매핑)
```

## Stage 2-12 소스 보완 결과

| 항목 | 결과 | 비고 |
|---|---|---|
| blocking_candidate severity 명시 분기 | 보완 | `mapFindingToPolicyDecision` explicit branch |
| blockingCandidates 기반 decision | 보완 | `appendBlockingCandidateDecisions` |
| status/findings mismatch warning | 보완 | `status_findings_mismatch`, `blocking_candidate_without_policy_decision`, `not_evaluated_with_findings` |
| warn_only audit flag | 보완 | `requiresAuditLog=true`, approval/rollback false |
| 실제 enforcement | 없음 | read-only design evaluator |

## Stage 2-13 Connector Gateway Routing 실험 브랜치 설계 결과

| 항목 | 반영 방식 | 실제 routing 여부 | 비고 |
|---|---|---|---|
| Routing Experiment 타입 | read-only experiment design report | 없음 | 설계 판단용 |
| Routing Experiment evaluator | `boundaryIds` 기반 판단 | 없음 | 실행 경로 변경 없음 |
| experiment branch | `experimentBranchRequired` flag | 없음 | main 직접 변경 금지 |
| feature flag | `featureFlagRequired` / default `off` | 없음 | 실제 flag wire 없음 |
| direct call fallback | `directCallFallbackRequired` flag | 없음 | 기존 경로 유지 원칙 |
| Stage1 regression | github boundary 시 `stage1RegressionRequired` | 없음 | ENV_TEST 보호 |

구현: `connectorGatewayRoutingExperimentTypes.ts`, `evaluateConnectorGatewayRoutingExperiment.ts`

### Stage 2-13 원칙

```text
- 실제 routing을 구현하지 않는다.
- routing 변경은 실험 브랜치에서만 설계한다.
- feature flag default는 off다.
- direct call fallback을 유지해야 한다.
- GitHub boundary는 Stage1/ENV_TEST regression이 필수다.
- main 브랜치에서 실행 경로를 변경하지 않는다.
```

### Stage 2-13 Decision 규칙 요약

```text
boundaryIds=[] / unknown → blocked, scope=none
cursor_only → ready_for_experiment_design
github_only → defer + stage1RegressionRequired=true
cursor_and_github → defer + stage1RegressionRequired=true
experimentBranchRequired / featureFlagRequired / directCallFallback / rollbackPlan → active scope에서 true
featureFlagDefault → "off"
```

## Stage 2-13 소스 보완 결과

| 항목 | 결과 | 비고 |
|---|---|---|
| boundaryIds/connectorIds/boundaryKinds | 보완 | experiment report 추적성 |
| duplicate boundary warning | 보왴 | `duplicate_boundary_id_removed` |
| disabled boundary 방어 | 보완 | `disabled_boundary` blocking |
| blocked report flag 정책 | 보완 | experiment/flag off, fallback/rollback on |
| 실제 routing | 없음 | read-only experiment evaluator |

### Stage 2-13 blocked report flag 정책

```text
empty/unknown/disabled → blocked
experimentBranchRequired=false, featureFlagRequired=false, featureFlagDefault=off
directCallFallbackRequired=true, rollbackPlanRequired=true, stage1RegressionRequired=false
```

## Stage 2-14 Agent Execution Record 저장 설계 결과

| 항목 | 반영 방식 | 실제 저장 여부 | 비고 |
|---|---|---|---|
| Agent Execution Record 타입 | read-only record design report | 없음 | schema 설계 전 단계 |
| Record Design evaluator | target 기반 판단 | 없음 | DB 호출 없음 |
| execution_record | ready_for_schema_design | 없음 | schema/migration 설계 필요 |
| timeline_event_link | defer | 없음 | Timeline 구조 영향 |
| audit_trail_link | defer | 없음 | approval/audit 설계 연계 |
| persistFields | summary 중심 | 없음 | raw input/output 제외 |
| excludedFields | forbidden policy | 없음 | prompt/diff/token 제외 |

구현: `agentExecutionRecordDesignTypes.ts`, `evaluateAgentExecutionRecordDesign.ts`

### Stage 2-14 원칙

```text
- 실제 Agent 실행 record 저장을 적용하지 않는다.
- DB/Prisma schema를 변경하지 않는다.
- migration을 만들지 않는다.
- raw prompt/input/output/code diff/file content/token은 저장 후보에서도 제외한다.
- 실행 결과는 summary 중심으로만 설계한다.
```

### Stage 2-14 Decision 규칙 요약

```text
execution_record → ready_for_schema_design, requiresAuditLink=true, requiresTimelineLink=true
timeline_event_link → defer
audit_trail_link → defer
requiresSchemaChange / requiresMigration / requiresRollbackPlan → true (판단값만)
persistFields ← summary/status/timing/link ids
excludedFields ← rawPrompt/fullInput/fullOutput/codeDiff/token/apiKey 등 forbidden
```

## Stage 2-14 소스 보완 결과

| 항목 | 결과 | 비고 |
|---|---|---|
| unknown target handling | 보완 | `normalizeExecutionRecordTarget`, `unknown` target + blocked |
| link flags 분리 | 보완 | timeline/audit link flags per target |
| persist/excluded field dedupe | 보완 | `uniqueFieldDecisions` |
| summary-only policy | 보완 | summary field reasons 명시 |
| 실제 execution record 저장 | 없음 | read-only design evaluator |

## Stage 2-15 Operator Approval / Override / Audit 설계 결과

| 항목 | 반영 방식 | 실제 저장 여부 | 비고 |
|---|---|---|---|
| Operator Approval/Audit 타입 | read-only approval/audit design report | 없음 | schema 설계 전 단계 |
| Approval/Audit evaluator | target 기반 판단 | 없음 | 저장/승인 없음 |
| operator_approval | ready_for_schema_design | 없음 | actor/reason/audit 필요 |
| operator_override | defer | 없음 | 정책 승인/권한 모델 필요 |
| audit_event | ready_for_schema_design | 없음 | 감사 이벤트 설계 가능 |
| rollback_approval | defer | 없음 | rollback 대상 정의 필요 |
| persistFields | summary/id 중심 | 없음 | raw reason 제외 |
| excludedFields | forbidden policy | 없음 | prompt/diff/token/contact 제외 |

구현: `operatorApprovalAuditDesignTypes.ts`, `evaluateOperatorApprovalAuditDesign.ts`

### Stage 2-15 원칙

```text
- 실제 approval을 수행하지 않는다.
- 실제 override를 수행하지 않는다.
- 실제 audit event를 저장하지 않는다.
- DB/Prisma schema를 변경하지 않는다.
- raw reason/prompt/input/output/code diff/token/contact는 저장 후보에서도 제외한다.
- operator approval/audit는 read-only 설계 report로만 둔다.
```

### Stage 2-15 Decision 규칙 요약

```text
operator_approval → ready_for_schema_design
operator_override → defer
audit_event → ready_for_schema_design
rollback_approval → defer
unknown → blocked
requiresActorIdentity / requiresReason / requiresAuditTrail → true (active targets)
reasonSummary only; rawReason forbidden
```

## Stage 2-15 소스 보완 결과

| 항목 | 결과 | 비고 |
|---|---|---|
| normalizeOperatorApprovalAuditTarget export | 보완 | `index.ts` public export |
| phoneNumber/emailBody excluded | 보완 | forbidden policy |
| 실제 approval/override/audit | 없음 | read-only design evaluator |

## Stage 2-16 Connector Gateway 실험 브랜치 작업계획 결과

| 항목 | 반영 방식 | 실제 실행 여부 | 비고 |
|---|---|---|---|
| Experiment Branch Plan 타입 | read-only branch plan report | 없음 | 작업계획 전용 |
| Branch Plan evaluator | routing experiment report 기반 | 없음 | git branch 생성 없음 |
| recommendedBranchName | scope별 제안 | 없음 | 실제 생성 아님 |
| featureFlagName | scope별 제안 | 없음 | 실제 wire 아님 |
| featureFlagDefault | off | 없음 | default off 원칙 |
| direct fallback | required | 없음 | 기존 실행 경로 보호 |
| Stage1 regression | GitHub 포함 시 required | 없음 | ENV_TEST 보호 |
| rollback criteria | report field | 없음 | 실패 기준 명시 |

구현: `connectorGatewayExperimentBranchPlanTypes.ts`, `evaluateConnectorGatewayExperimentBranchPlan.ts`

### Stage 2-16 원칙

```text
- 실제 브랜치를 생성하지 않는다.
- 실제 feature flag를 연결하지 않는다.
- 실제 Connector Gateway routing을 적용하지 않는다.
- 실험 브랜치는 별도 승인 후 생성한다.
- main 브랜치의 Cursor/GitHub 실행 경로는 변경하지 않는다.
- 모든 실험은 direct call fallback과 rollback plan을 전제로 한다.
```

### Stage 2-16 Decision 규칙 요약

```text
routing blocked / scope none → branch plan blocked
cursor_only → ready_for_branch_plan + experiment/connector-gateway-cursor-routing
github_only → defer + experiment/connector-gateway-github-routing (plan only)
cursor_and_github → defer + experiment/connector-gateway-runtime-routing (plan only)
featureFlagDefault → off
requiresDirectCallFallback / requiresRollbackPlan / requiresOperatorApproval → true
requiresStage1Regression ← routing experiment (github boundary)
```

## Stage 2-16 소스 보완 결과

| 항목 | 결과 | 비고 |
|---|---|---|
| candidateConnectorIds/candidateBoundaryKinds | 보완 | routing experiment trace |
| source routing decision/scope | 보완 | `sourceRoutingDecision`, `sourceRoutingScope` |
| validationSuites/requiredRegressionSuites 분리 | 보완 | blocked 시 `requiredRegressionSuites=[]` |
| read-only findings | 보완 | `branch_plan_read_only`, `no_git_branch_creation`, etc. |
| 실제 branch/flag/routing | 없음 | read-only branch plan |

## Stage 2-17 Agent Execution Record Schema 적용 여부 결정 결과

| 항목 | 반영 방식 | 실제 schema 변경 여부 | 비고 |
|---|---|---|---|
| Schema Decision 타입 | read-only schema decision report | 없음 | migration 전 단계 |
| Schema Decision evaluator | execution record design 기반 | 없음 | Prisma/DB 호출 없음 |
| AgentExecutionRecord | ready_for_schema_proposal | 없음 | 별도 PR 필요 |
| timeline_event_link | defer | 없음 | Timeline 구조 영향 |
| audit_trail_link | defer | 없음 | Audit 구조 영향 |
| fieldProposals | table/field 후보 | 없음 | raw 필드 제외 |
| excludedFields | forbidden policy | 없음 | prompt/diff/token/contact 제외 |
| rolloutPlan | staged rollout | 없음 | feature flag/read-only first |
| rollbackPlan | migration/write path rollback | 없음 | 별도 승인 필요 |

구현: `agentExecutionRecordSchemaDecisionTypes.ts`, `evaluateAgentExecutionRecordSchemaDecision.ts`

### Stage 2-17 원칙

```text
- 실제 Prisma schema를 변경하지 않는다.
- migration을 만들지 않는다.
- DB 저장 코드를 만들지 않는다.
- Agent execution record schema는 read-only decision report로만 판단한다.
- schema 적용은 별도 승인과 별도 PR에서 진행한다.
```

### Stage 2-17 Decision 규칙 요약

```text
agent_execution_record → ready_for_schema_proposal, AgentExecutionRecord
timeline_event_link → defer, AgentExecutionTimelineLink
audit_trail_link → defer, AgentExecutionAuditLink
unknown → blocked
requiresPrismaSchemaChange / requiresMigration / requiresRollbackPlan → true (active targets)
fieldProposals ← Stage 2-14 persistFields with Prisma types
excludedFields ← forbidden policy including personalContact/phoneNumber/emailBody
```

## Stage 2-17 소스 보완 결과

| 항목 | 결과 | 비고 |
|---|---|---|
| summary-only reason | 보완 | `normalizeSchemaFieldReason` on persist proposals |
| excluded field type policy | 보완 | `type="Forbidden"`, `indexed=false` |
| forbidden field policy finding | 보완 | `forbidden_field_policy_enforced` / missing blocking |
| unknown target rollout/rollback | 보완 | empty plans + `schema_target_unknown_*` findings |
| 실제 schema/migration | 없음 | read-only decision evaluator |

## Stage 2-18 소스 보완 결과

| 항목 | 결과 | 비고 |
|---|---|---|
| forbidden field required list | 보완 | 19개 필수 forbidden 목록 |
| excludedFields dedupe | 보완 | `uniqueFieldProposals` lower-case dedupe |
| approval/audit index policy | 보완 | actorRole/related*/auditEventId indexed |
| unknown target findings | 보완 | `operator_schema_target_unknown_*` |
| 실제 schema/migration | 없음 | read-only decision evaluator |

## Stage 2-18 Operator Approval/Audit Schema 적용 여부 결정 결과

| 항목 | 반영 방식 | 실제 schema 변경 여부 | 비고 |
|---|---|---|---|
| Schema Decision 타입 | read-only schema decision report | 없음 | migration 전 단계 |
| Schema Decision evaluator | approval/audit design 기반 | 없음 | Prisma/DB 호출 없음 |
| OperatorApproval | ready_for_schema_proposal | 없음 | 권한/감사 정책 필요 |
| OperatorAuditEvent | ready_for_schema_proposal | 없음 | 감사 무결성 정책 필요 |
| OperatorOverride | defer | 없음 | 권한 모델/정책 승인 필요 |
| OperatorRollbackApproval | defer | 없음 | rollback 대상 정의 필요 |
| fieldProposals | table/field 후보 | 없음 | raw 필드 제외 |
| excludedFields | forbidden policy | 없음 | reason/prompt/diff/token/contact 제외 |
| rolloutPlan | staged rollout | 없음 | permission/audit review first |
| rollbackPlan | migration/write path rollback | 없음 | 별도 승인 필요 |

구현: `operatorApprovalAuditSchemaDecisionTypes.ts`, `evaluateOperatorApprovalAuditSchemaDecision.ts`

### Stage 2-18 원칙

```text
- 실제 Prisma schema를 변경하지 않는다.
- migration을 만들지 않는다.
- DB 저장 코드를 만들지 않는다.
- Operator Approval/Audit schema는 read-only decision report로만 판단한다.
- schema 적용은 별도 승인과 별도 PR에서 진행한다.
```

### Stage 2-18 Decision 규칙 요약

```text
operator_approval / audit_event → ready_for_schema_proposal
operator_override / rollback_approval → defer
unknown → blocked
requiresPermissionModel / requiresAuditIntegrityPolicy → true (active targets)
excludedFields type Forbidden; reasonSummary summary-only
```

## Stage 2-19 소스 보완 결과

| 항목 | 결과 | 비고 |
|---|---|---|
| source trace | 보완 | boundaries/connectors/kinds + branch/routing source |
| validationSuites preservation | 보완 | requiredRegressionSuites와 분리 노출 |
| approval checklist state policy | 보완 | blocked/defer/ready별 satisfied 정책 |
| ready condition guard | 보완 | `resolveApprovalDecision` 필수값/회귀 검사 |
| 실제 branch/flag/routing | 없음 | read-only approval evaluator |

## Stage 2-19 Connector Gateway 실험 브랜치 승인 준비 결과

| 항목 | 반영 방식 | 실제 실행 여부 | 비고 |
|---|---|---|---|
| Branch Approval 타입 | read-only approval readiness report | 없음 | 승인 준비 전용 |
| Branch Approval evaluator | branch plan 기반 판단 | 없음 | git branch 생성 없음 |
| ready_for_operator_approval | cursor_only | 없음 | 운영자 승인 필요 |
| defer | github_only / cursor_and_github | 없음 | 회귀 계획 필요 |
| blocked | unknown/invalid boundary | 없음 | 승인 불가 |
| approvalChecklist | report field | 없음 | 승인 전 점검 |
| featureFlagDefault | off | 없음 | default off 원칙 |
| direct fallback | required | 없음 | 기존 실행 경로 보호 |

구현: `connectorGatewayExperimentBranchApprovalTypes.ts`, `evaluateConnectorGatewayExperimentBranchApproval.ts`

### Stage 2-19 원칙

```text
- 실제 브랜치를 생성하지 않는다.
- 실제 feature flag를 연결하지 않는다.
- 실제 Connector Gateway routing을 적용하지 않는다.
- Stage 2-19는 승인 준비 report만 만든다.
- 실제 실험 브랜치 생성은 별도 명시 승인 후 수행한다.
```

### Stage 2-19 Decision 규칙 요약

```text
ready_for_branch_plan → ready_for_operator_approval
defer → defer
blocked → blocked
requiresOperatorApproval / requiresRegressionChecklist → true (non-blocked)
approvalChecklist: branch/flag/rollback/regression/operator + no wire items
```

## Stage 2-20 소스 보완 결과

| 항목 | 결과 | 비고 |
|---|---|---|
| schema source trace | 보완 | sourceSchemaDecision/target/table/requires* |
| unknown/blocked report policy | 보완 | empty arrays, featureFlagName="", requires*=false |
| candidate arrays dedupe | 보완 | `uniqueStrings` on entrypoints/sanitizers/guards/rollback |
| validation checklist | 보완 | schema applied / write adapter 분리 |
| 실제 DB/write path | 없음 | read-only design evaluator |

## Stage 2-20 Agent Execution Record Write Path 설계 결과

| 항목 | 반영 방식 | 실제 write 여부 | 비고 |
|---|---|---|---|
| Write Path Design 타입 | read-only write path design report | 없음 | schema 적용 전 단계 |
| Write Path evaluator | schema decision 기반 판단 | 없음 | DB/Prisma 호출 없음 |
| feature flag | JYO_AGENT_EXECUTION_RECORD_WRITE_PATH / off | 없음 | 실제 wire 없음 |
| proposed write entrypoints | report field | 없음 | 실제 연결 없음 |
| sanitizer 후보 | report field | 없음 | 실제 함수 구현 아님 |
| forbidden guard 후보 | report field | 없음 | 실제 guard wire 아님 |
| validation checklist | report field | 없음 | migration applied=false |
| rollback plan | report field | 없음 | write disable 전제 |

구현: `agentExecutionRecordWritePathDesignTypes.ts`, `evaluateAgentExecutionRecordWritePathDesign.ts`

### Stage 2-20 원칙

```text
- 실제 Agent Execution Record write path를 구현하지 않는다.
- 실제 Prisma/DB 저장을 호출하지 않는다.
- 실제 schema/migration을 만들지 않는다.
- write path는 schema/migration 적용 후 별도 승인한다.
- 이번 단계는 read-only 설계 report만 만든다.
```

### Stage 2-20 Decision 규칙 요약

```text
ready_for_schema_proposal → defer (schema/migration 미적용)
defer / timeline_event_link / audit_trail_link → defer
blocked / unknown → blocked
ready_for_write_path_design 타입 유지, 현재 단계에서는 미반환
featureFlagDefault=off; forbidden guards + sanitizers + rollback plan in report
```

## Stage 2-21 소스 보완 결과

| 항목 | 결과 | 비고 |
|---|---|---|
| unknown/blocked findings | 보완 | `approval_audit_write_path_target_unknown_no_*` |
| audit_event defer finding | 보완 | `audit_event_write_deferred` |
| runtime path unchanged checklist | 보완 | validationChecklist 항목 추가 |
| candidate arrays dedupe test | 보완 | `expectUnique` on all proposed arrays |
| 실제 approval/audit write | 없음 | read-only design evaluator |

## Stage 2-21 Operator Approval/Audit Write Path 설계 결과

| 항목 | 반영 방식 | 실제 write 여부 | 비고 |
|---|---|---|---|
| Write Path Design 타입 | read-only write path design report | 없음 | schema 적용 전 단계 |
| Write Path evaluator | operator schema decision 기반 판단 | 없음 | DB/Prisma 호출 없음 |
| feature flag | JYO_OPERATOR_APPROVAL_AUDIT_WRITE_PATH / off | 없음 | 실제 wire 없음 |
| proposed write entrypoints | report field | 없음 | 실제 연결 없음 |
| permission guards | report field | 없음 | 실제 권한검사 구현 아님 |
| audit integrity guards | report field | 없음 | 실제 감사 무결성 구현 아님 |
| forbidden guards | report field | 없음 | 실제 guard wire 아님 |
| validation checklist | report field | 없음 | schema/migration 미적용 표시 |
| rollback plan | report field | 없음 | write disable 전제 |

구현: `operatorApprovalAuditWritePathDesignTypes.ts`, `evaluateOperatorApprovalAuditWritePathDesign.ts`

### Stage 2-21 원칙

```text
- 실제 Operator Approval/Audit write path를 구현하지 않는다.
- 실제 Prisma/DB 저장을 호출하지 않는다.
- 실제 schema/migration을 만들지 않는다.
- write path는 schema/migration 적용 후 별도 승인한다.
- 이번 단계는 read-only 설계 report만 만든다.
```

### Stage 2-21 Decision 규칙 요약

```text
ready_for_schema_proposal → defer (schema/migration 미적용)
operator_override / rollback_approval → defer + target-specific warning
blocked / unknown → blocked; empty proposed arrays
ready_for_write_path_design 타입 유지, 현재 단계에서는 미반환
permission/audit integrity/forbidden guards in report only
```

## Stage 2-22 소스 보완 결과

| 항목 | 결과 | 비고 |
|---|---|---|
| source trace | 보완 | candidateBoundaries/connectors/kinds + branch/routing source |
| command candidate caution | 보완 | `caution` on every command candidate |
| branch/flag safety check | 보완 | `isSafeBranchName` / `isSafeFeatureFlagName` |
| explicit approval policy | 보완 | `requiresExplicitUserApproval = decision !== "blocked"` |
| 실제 branch/flag/routing | 없음 | read-only readiness evaluator |

## Stage 2-22 Connector Gateway Branch Creation Readiness 결과

| 항목 | 반영 방식 | 실제 실행 여부 | 비고 |
|---|---|---|---|
| Branch Creation Readiness 타입 | read-only readiness report | 없음 | 승인 패키지 |
| Branch Creation evaluator | branch approval 기반 판단 | 없음 | git 명령 미실행 |
| commandCandidates | report field | 없음 | 명시 승인 후만 사용 |
| explicit user approval | required | 없음 | 필수 |
| regressionChecklist | report field | 없음 | 실행 전 체크 |
| rollbackCriteria | report field | 없음 | 실패 기준 |
| feature flag wire | 없음 | 없음 | 별도 PR |
| routing change | 없음 | 없음 | 실험 브랜치 이후 |

구현: `connectorGatewayExperimentBranchCreationReadinessTypes.ts`, `evaluateConnectorGatewayExperimentBranchCreationReadiness.ts`

### Stage 2-22 원칙

```text
- 실제 브랜치를 생성하지 않는다.
- git 명령은 command candidate로만 제시한다.
- 사용자의 명시 승인 전에는 branch 생성 금지.
- feature flag wire와 routing 변경은 별도 PR/별도 승인 대상이다.
```

### Stage 2-22 Decision 규칙 요약

```text
ready_for_operator_approval → ready_for_explicit_user_approval + commandCandidates
defer → defer; commandCandidates=[]
blocked → blocked; commandCandidates=[]
createsBranchInThisStep / wiresFeatureFlagInThisStep / changesRoutingInThisStep = false
```

## Stage 2-23 Agent Execution Record Schema/Migration PR Readiness 결과

| 항목 | 반영 방식 | 실제 변경 여부 | 비고 |
|---|---|---|---|
| Schema PR Readiness 타입 | read-only readiness report | 없음 | 별도 PR 준비 |
| Schema PR evaluator | schema decision 기반 판단 | 없음 | schema.prisma 미수정 |
| modelCandidates | Prisma model draft 문자열 | 없음 | 적용 금지 |
| migrationChecklist | report field | 없음 | migration 미생성 |
| rollbackChecklist | report field | 없음 | rollback 준비 |
| retention/access checklist | report field | 없음 | 운영 검토 필요 |
| forbidden field checklist | report field | 없음 | raw 필드 제외 확인 |

구현: `agentExecutionRecordSchemaPrReadinessTypes.ts`, `evaluateAgentExecutionRecordSchemaPrReadiness.ts`

### Stage 2-23 원칙

```text
- 실제 schema.prisma를 변경하지 않는다.
- migration을 만들지 않는다.
- DB write를 구현하지 않는다.
- Prisma model은 report 내 draft 문자열로만 제공한다.
- schema/migration은 별도 PR과 별도 승인 후 진행한다.
```

### Stage 2-23 Decision 규칙 요약

```text
ready_for_schema_proposal → ready_for_schema_pr_plan + modelCandidates
defer / timeline_event_link / audit_trail_link → defer
blocked / unknown → blocked; empty modelCandidates
forbiddenFieldChecklist validates REQUIRED_FORBIDDEN_FIELDS in excludedFields
modelDraftContainsForbiddenField → blocked + model_candidate_contains_forbidden_field
sourceFieldProposalCount / sourceExcludedFieldCount / sourceForbiddenFieldNames source trace
```

## Stage 2-24 Operator Approval/Audit Schema/Migration PR Readiness 결과

| 항목 | 반영 방식 | 실제 변경 여부 | 비고 |
|---|---|---|---|
| Schema PR Readiness 타입 | read-only readiness report | 없음 | 별도 PR 준비 |
| Schema PR evaluator | operator schema decision 기반 판단 | 없음 | schema.prisma 미수정 |
| modelCandidates | Prisma model draft 문자열 | 없음 | 적용 금지 |
| migrationChecklist | report field | 없음 | migration 미생성 |
| rollbackChecklist | report field | 없음 | rollback 준비 |
| permission/access checklist | report field | 없음 | 권한 검토 필요 |
| audit integrity checklist | report field | 없음 | 감사 무결성 검토 필요 |
| forbidden field checklist | report field | 없음 | raw/secret/contact 필드 제외 확인 |

구현: `operatorApprovalAuditSchemaPrReadinessTypes.ts`, `evaluateOperatorApprovalAuditSchemaPrReadiness.ts`

### Stage 2-24 원칙

```text
- 실제 schema.prisma를 변경하지 않는다.
- migration을 만들지 않는다.
- DB write를 구현하지 않는다.
- Prisma model은 report 내 draft 문자열로만 제공한다.
- schema/migration은 별도 PR과 별도 승인 후 진행한다.
```

### Stage 2-24 Decision 규칙 요약

```text
ready_for_schema_proposal → ready_for_schema_pr_plan + modelCandidates
operator_override / rollback_approval → defer
blocked / unknown → blocked; empty modelCandidates
permission fields: actorId, actorRole, decision, actionType
audit integrity fields: auditEventId, actorId, targetType, targetId, reasonSummary, createdAt
19 forbidden excluded fields required; modelDraft forbidden guard
```

## Stage 2-24 소스 보완 결과

| 항목 | 결과 | 비고 |
|---|---|---|
| undefined variable fix | `missingForbidden` 수정 | evaluateOperatorApprovalAuditSchemaPrReadiness.ts |
| target별 required field set | operator_approval / audit_event 분리 | model draft 기준 검증 |
| OperatorApproval model candidate | 정적 draft 분리 | OperatorApproval |
| OperatorAuditEvent model candidate | 정적 draft 분리 | OperatorAuditEvent |
| typecheck | tsc --noEmit 통과 | 변경 파일 기준 |
| 실제 schema/migration/DB write | 없음 | read-only 유지 |

## Stage 2-25 Connector Gateway Branch Execution Package 결과

| 항목 | 반영 방식 | 실제 실행 여부 | 비고 |
|---|---|---|---|
| Execution Package 타입 | read-only package report | 없음 | 수동 실행 후보 |
| Execution Package evaluator | branch readiness 기반 판단 | 없음 | git 명령 미실행 |
| explicitUserApproval | input flag | 없음 | true여도 실행하지 않음 |
| manualCommands | report field | 없음 | 사람이 수동 실행 |
| preflightChecklist | report field | 없음 | 실행 전 체크 |
| regressionChecklist | readiness 상속 | 없음 | 회귀 검증 |
| rollbackCriteria | readiness 상속 | 없음 | 실패 기준 |

구현: `connectorGatewayExperimentBranchExecutionPackageTypes.ts`, `evaluateConnectorGatewayExperimentBranchExecutionPackage.ts`

### Stage 2-25 원칙

```text
- 실제 git 명령을 실행하지 않는다.
- explicitUserApproval=true여도 report만 만든다.
- manualCommands는 사람이 복사 실행할 수 있는 후보일 뿐이다.
- feature flag wire와 routing 변경은 별도 PR/별도 승인 대상이다.
```

### Stage 2-25 Decision 규칙 요약

```text
ready_for_explicit_user_approval + explicitUserApproval=true → ready_for_manual_execution_after_approval + manualCommands
ready_for_explicit_user_approval + explicitUserApproval=false → defer + manualCommands=[]
defer → defer
blocked → blocked
```

## Stage 2-25 소스 보완 결과

| 항목 | 결과 | 비고 |
|---|---|---|
| source trace | readiness sourceScope/candidate/routing trace 포함 | blocked/defer에서도 유지 |
| manual command safety | empty/unapproved/missing caution → blocked | manual_command_* findings |
| structured preflight checklist | item/satisfied/reason 구조 | explicit approval 항목 분리 |
| 실제 git 실행 | 없음 | manualCommands만 제공 |
| 실제 feature flag/routing | 없음 | read-only 유지 |

## Stage 2-26 Agent Execution Record Schema PR Approval Package 결과

| 항목 | 반영 방식 | 실제 변경 여부 | 비고 |
|---|---|---|---|
| Schema PR Approval Package 타입 | read-only approval report | 없음 | 최종 승인 패키지 |
| Schema PR Approval evaluator | Stage 2-23 readiness 기반 | 없음 | schema.prisma 미수정 |
| explicitUserApproval | input flag | 없음 | true여도 실제 변경 없음 |
| modelDraft | report field | 없음 | 별도 PR 입력 후보 |
| migrationChecklist | report field | 없음 | migration 미생성 |
| rollbackChecklist | report field | 없음 | rollback 검토 |
| retentionAccessChecklist | report field | 없음 | 보존/권한 검토 |
| forbiddenFieldChecklist | report field | 없음 | raw/secret 필드 제외 확인 |

구현: `agentExecutionRecordSchemaPrApprovalPackageTypes.ts`, `evaluateAgentExecutionRecordSchemaPrApprovalPackage.ts`

### Stage 2-26 원칙

```text
- 실제 schema.prisma를 변경하지 않는다.
- migration을 만들지 않는다.
- DB write를 구현하지 않는다.
- explicitUserApproval=true여도 approval package만 만든다.
- 실제 schema PR 생성은 별도 승인 후 별도 작업으로 진행한다.
```

### Stage 2-26 Decision 규칙 요약

```text
ready_for_schema_pr_plan + explicitUserApproval=true → ready_for_explicit_schema_pr_approval
ready_for_schema_pr_plan + explicitUserApproval=false → defer
defer / timeline_event_link / audit_trail_link → defer
blocked / unknown → blocked
```

## Stage 2-26 소스 보완 결과

| 항목 | 결과 | 비고 |
|---|---|---|
| explicit approval semantics | `explicit user approval confirmed` | requires vs provided 분리 |
| explicitUserApprovalProvided | report field 추가 | input과 동기화 |
| modelDraft exposure policy | `ready_for_schema_pr_plan`일 때만 노출 | blocked/defer readiness는 빈 draft |
| forbidden field recheck | approval package 단계 재검증 | forbidden draft → blocked |
| 실제 schema/migration/DB write | 없음 | read-only 유지 |

## Stage 2-27 Operator Approval/Audit Schema PR Approval Package 결과

| 항목 | 반영 방식 | 실제 변경 여부 | 비고 |
|---|---|---|---|
| Schema PR Approval Package 타입 | read-only approval report | 없음 | 최종 승인 패키지 |
| Schema PR Approval evaluator | Stage 2-24 readiness 기반 | 없음 | schema.prisma 미수정 |
| explicitUserApproval | input flag | 없음 | true여도 실제 변경 없음 |
| explicitUserApprovalProvided | report field | 없음 | 승인 상태 표시 |
| OperatorApproval modelDraft | report field | 없음 | operator_approval target |
| OperatorAuditEvent modelDraft | report field | 없음 | audit_event target |
| permissionAccessChecklist | report field | 없음 | 권한 검토 |
| auditIntegrityChecklist | report field | 없음 | 감사 무결성 검토 |
| migration/rollback checklist | report field | 없음 | migration 미생성 |
| forbiddenFieldChecklist | report field | 없음 | raw/secret/contact 필드 제외 확인 |

구현: `operatorApprovalAuditSchemaPrApprovalPackageTypes.ts`, `evaluateOperatorApprovalAuditSchemaPrApprovalPackage.ts`

### Stage 2-27 원칙

```text
- 실제 schema.prisma를 변경하지 않는다.
- migration을 만들지 않는다.
- DB write를 구현하지 않는다.
- explicitUserApproval=true여도 approval package만 만든다.
- 실제 schema PR 생성은 별도 승인 후 별도 작업으로 진행한다.
```

### Stage 2-27 Decision 규칙 요약

```text
ready_for_schema_pr_plan + explicitUserApproval=true → ready_for_explicit_schema_pr_approval
operator_approval → OperatorApproval draft / audit_event → OperatorAuditEvent draft
operator_override / rollback_approval → defer, modelDraft=""
blocked / unknown → blocked, modelDraft=""
```

## Stage 2-26 소스 보완 결과

| 항목 | 결과 | 비고 |
|---|---|---|
| explicit approval semantics | `explicit user approval confirmed` | requiresExplicitUserApproval 분리 |
| explicitUserApprovalProvided | report field | input 동기화 |
| modelDraft exposure policy | ready만 노출, defer/blocked는 `""` | review candidate 정책 |
| forbidden field recheck | approval package 단계 재검증 | model_draft_missing 정책 보정 |
| 실제 schema/migration/DB write | 없음 | read-only 유지 |

## Stage 2-28 Connector Gateway Branch Manual Verification 결과

| 항목 | 반영 방식 | 실제 실행 여부 | 비고 |
|---|---|---|---|
| Manual Verification 타입 | read-only verification report | 없음 | 수동 실행 후 검증 |
| Manual Verification evaluator | Stage 2-25 execution package 기반 | 없음 | git 미실행 |
| explicitManualExecutionConfirmed | input flag | 없음 | 수동 실행 확인값 |
| actualBranchName | input field | 없음 | 실제 git 조회 아님 |
| regressionResults | input field | 없음 | 외부 테스트 결과 입력 |
| rollbackRequired | report field | 없음 | regression 실패 시 |
| verificationChecklist | report field | 없음 | 검증 기준 |
| no-run flags | report field | 없음 | git/test/flag/routing 미실행 |

구현: `connectorGatewayExperimentBranchManualVerificationTypes.ts`, `evaluateConnectorGatewayExperimentBranchManualVerification.ts`

### Stage 2-28 원칙

```text
- 실제 git 명령을 실행하지 않는다.
- 실제 브랜치를 생성하지 않는다.
- 실제 테스트를 실행하지 않는다.
- regressionResults는 외부에서 수행된 결과를 입력받아 판단한다.
- feature flag wire와 routing 변경은 별도 PR/별도 승인 대상이다.
```

### Stage 2-28 Decision 규칙 요약

```text
execution package ready + manual confirmed + branch match + regression pass → manual_branch_verified
missing manual confirmation / branch / regression → defer
branch mismatch / regression fail / package not ready → blocked
regression failure → rollbackRequired=true
```

### Stage 2-28 보강 (소스 점검)

| 항목 | 반영 방식 | 실제 실행 여부 | 비고 |
|---|---|---|---|
| sourceBoundaryIds | execution package 입력 boundary 복사 | 없음 | 추적성 보강 |
| sourceExecutionPackageFindings | execution package finding code 목록 | 없음 | 추적성 보강 |
| sourceExecutionPackageChecklistSummary | preflightChecklist total/satisfied/unsatisfied | 없음 | 구조화 checklist 기준 |
| sanitizeRegressionResults | suite/summary 정규화 + suite dedupe | 없음 | failed 우선 |
| expectedBranchName 빈 값 | branch match false + blocked | 없음 | `expected_branch_name_missing` |

`shouldReportModelDraftMissing` 정책:

```text
- source readiness blocked: model_draft_missing 생략
- approval blocked + modelDraft 비어 있음 + source readiness blocked 아님: model_draft_missing 보고
- defer: model_draft_missing 미보고
- forbiddenDraftDetected: model_draft_missing 미보고
```

### Stage 2-29 Agent Execution Record Write Path Wire Approval Gate 결과

| 항목 | 반영 방식 | 실제 실행 여부 | 비고 |
|---|---|---|---|
| Write Path Wire Approval 타입 | read-only gate report | 없음 | 실제 wire 전 승인 |
| Write Path Wire Approval evaluator | Stage 2-20 + Stage 2-26 기반 | 없음 | DB 미호출 |
| explicitUserApproval | input flag | 없음 | 승인 확인값 |
| schemaAppliedConfirmed | input flag | 없음 | 실제 확인은 외부 |
| migrationAppliedConfirmed | input flag | 없음 | 실제 확인은 외부 |
| featureFlagWireApproved | input flag | 없음 | wire는 별도 PR |
| writeAdapterImplementedConfirmed | input flag | 없음 | adapter 구현 확인 |
| no-run flags | report field | 없음 | write/schema/migration 미실행 |

### Stage 2-29 원칙

```text
- 실제 write path를 연결하지 않는다.
- 실제 DB write를 하지 않는다.
- Prisma client를 호출하지 않는다.
- schema.prisma를 변경하지 않는다.
- migration을 생성하지 않는다.
- 모든 확인값은 외부 입력으로만 판단한다.
```

### Stage 2-29 Decision 규칙 요약

```text
writePath ready + schema approval ready + 모든 확인값 true → ready_for_write_path_wire_approval
writePath/schema approval 미준비 또는 확인값 미충족 → defer
unknown target / upstream blocked / unsafe blocking finding → blocked
```

### Stage 2-29 보강 (소스 점검)

| 항목 | 반영 방식 | 실제 실행 여부 | 비고 |
|---|---|---|---|
| sourceSchemaApprovalTarget | write path target 기준 schema target 매핑 | 없음 | agent_execution_record만 직접 연동 |
| schemaApprovalReferenceOnly | timeline/audit link는 reference only | 없음 | schema ready 미요구 |
| source rollback trace | feature flag/rollback plan/source counts | 없음 | 문자열 contains 제거 |
| sourceBlockingFindingCodes | upstream blocking code trace | 없음 | reference only schema 제외 |
| write_path_wire_approval_ready | ready 상태 info finding | 없음 | |

### Stage 2-30 Operator Approval/Audit Write Path Wire Approval Gate 결과

| 항목 | 반영 방식 | 실제 실행 여부 | 비고 |
|---|---|---|---|
| Write Path Wire Approval 타입 | read-only gate report | 없음 | 실제 wire 전 승인 |
| Write Path Wire Approval evaluator | Stage 2-21 + Stage 2-27 기반 | 없음 | DB 미호출 |
| explicitUserApproval | input flag | 없음 | 승인 확인값 |
| schemaAppliedConfirmed | input flag | 없음 | 실제 확인은 외부 |
| migrationAppliedConfirmed | input flag | 없음 | 실제 확인은 외부 |
| featureFlagWireApproved | input flag | 없음 | wire는 별도 PR |
| writeAdapterImplementedConfirmed | input flag | 없음 | adapter 구현 확인 |
| permissionModelConfirmed | input flag | 없음 | 권한 모델 확인 |
| auditTrailConfirmed | input flag | 없음 | 감사 추적 확인 |
| permissionChecklist / auditChecklist | report checklist | 없음 | operator 전용 |
| no-run flags | report field | 없음 | write/schema/migration 미실행 |

### Stage 2-30 원칙

```text
- 실제 OperatorApproval/OperatorAuditEvent write path를 연결하지 않는다.
- 실제 DB write를 하지 않는다.
- Prisma client를 호출하지 않는다.
- schema.prisma를 변경하지 않는다.
- migration을 생성하지 않는다.
- 모든 확인값은 외부 입력으로만 판단한다.
```

### Stage 2-30 Decision 규칙 요약

```text
writePath ready + schema approval ready + 모든 확인값 true → ready_for_write_path_wire_approval
미충족 → defer
unknown / upstream blocked / unsafe blocking → blocked
operator_override / rollback_approval → schemaApprovalReferenceOnly (defer)
```

### Stage 2 통합 단계 로드맵 (잔여)

```text
Stage 2-A: Connector Gateway Routing Shadowing 설계
Stage 2-B: Agent / Operator Write Adapter 설계 통합
Stage 2-C: Agent / Operator Schema/Migration PR Readiness 통합
Stage 2-D: Agent / Operator Write Path Wire 후보 검증 통합
Stage 2-E: Connector Gateway Routing Shadow 실험 검증
Stage 2-F: Stage 2 통합 종료 판정
```

### Write Path Wire Approval Gate 공통 정책 (Stage 2-29 / 2-30)

```text
- write path design이 ready가 아니면 defer 또는 blocked
- schema approval package가 ready가 아니면 defer 또는 blocked (referenceOnly target은 schema ready 미요구)
- explicit approval, schema applied, migration applied, feature flag approval, adapter implemented 확인값이 모두 true여야 ready
- Operator 계열은 permissionModelConfirmed / auditTrailConfirmed도 true여야 ready
- operator_override / rollback_approval은 schemaApprovalReferenceOnly=true이며 ready 금지
- 실제 write path wire, DB write, Prisma call, schema/migration 변경 없음
```

### Stage 2-A Connector Gateway Routing Shadowing 결과

| 항목 | 반영 방식 | 실제 실행 여부 | 비고 |
|---|---|---|---|
| Routing Shadow 타입 | read-only shadow report | 없음 | 실제 route 변경 없음 |
| Routing Shadow evaluator | routing experiment + manual verification 기반 | 없음 | connector 호출 없음 |
| actualRuntimePath | report field | 없음 | 기존 경로 유지 |
| shadowRuntimePath | report field | 없음 | 후보 경로 |
| featureFlagEnabled | input guard | 없음 | true면 blocked |
| explicitShadowApproval | input guard | 없음 | 없으면 defer |
| no-run flags | report field | 없음 | route/connector/cursor/github 미실행 |

### Stage 2-A 원칙

```text
- 실제 runtime route를 변경하지 않는다.
- Connector Gateway를 실제 실행 경로에 연결하지 않는다.
- Cursor/GitHub connector를 실제 호출하지 않는다.
- feature flag를 wire하지 않는다.
- feature flag enabled 상태는 shadowing 단계에서 blocked 처리한다.
- shadowing은 기존 경로와 후보 경로를 비교하기 위한 read-only report다.
```

### Stage 2-A Decision 규칙 요약

```text
unknown target / boundary 없음 / routing blocked / rollback required / feature flag on → blocked
explicitShadowApproval=false → defer (observe_only)
cursor_only + routing ready + explicitShadowApproval=true → shadow_ready (shadow_compare)
github/mixed scope → defer + stage1_regression_required warning
```

### Stage 2-A 보강 (소스 점검)

| 항목 | 반영 방식 | 실제 실행 여부 | 비고 |
|---|---|---|---|
| boundarySource | explicit / default / missing | 없음 | `[]` 명시 시 blocked |
| connectorSource | explicit / routing_experiment / missing | 없음 | source trace |
| manual verification trace | external result 미사용 flags | 없음 | branch/regression 미입력 |
| github/mixed scope | explicit approval + routing ready여도 defer | 없음 | Stage1 regression |
| routing_shadow_ready finding | ready 상태에만 info | 없음 | defer/blocked 제외 |

### Stage 2-B Agent / Operator Write Adapter Design Integration 결과

| 항목 | 반영 방식 | 실제 실행 여부 | 비고 |
|---|---|---|---|
| 통합 Write Adapter 설계 타입 | read-only integration report | 없음 | 실제 adapter 미구현 |
| 통합 evaluator | Agent gate + Operator gate + 각 write path design 조합 | 없음 | DB/Prisma 미호출 |
| Agent adapter target | report field | 없음 | 기본 agent_execution_record |
| Operator adapter target | report field | 없음 | 기본 operator_approval |
| adapterChecklist | report field | 없음 | boundary/sanitizer/guard 검증 |
| safetyChecklist | report field | 없음 | no-write 보장 |
| rollbackChecklist | report field | 없음 | rollback 설계 검토 |
| no-run flags | report field | 없음 | adapter/schema/migration/feature flag 미실행 |

### Stage 2-B 원칙

```text
- 실제 write adapter를 구현하거나 연결하지 않는다.
- 실제 DB write를 하지 않는다.
- Prisma client를 호출하지 않는다.
- schema.prisma를 변경하지 않는다.
- migration을 생성하지 않는다.
- feature flag를 wire하지 않는다.
- Agent / Operator 양쪽 gate가 모두 ready일 때만 adapter design ready로 본다.
```

### Stage 2-B Decision 규칙 요약

```text
Agent/Operator wire gate 또는 write path design blocked → blocked
wire gate 또는 write path 미준비 → defer
양쪽 wire gate ready + 양쪽 write path ready → ready_for_adapter_design
```

### Stage 2-B 보강 (소스 점검)

| 항목 | 반영 방식 | 실제 실행 여부 | 비고 |
|---|---|---|---|
| RoutingShadow BoundarySource/ConnectorSource export | index.ts public export | 없음 | 누락 보완 |
| WriteAdapter source trace | schema approval/blocking/checklist counts | 없음 | downstream 추적 |
| WriteAdapter target 정규화 | requested/normalized target fields | 없음 | unknown 안전 처리 |
| ready/defer finding 정책 | 테스트 고정 | 없음 | mock ready vs 실제 defer |

### Stage 2-C Agent / Operator Schema-Migration PR Readiness Integration 결과

| 항목 | 반영 방식 | 실제 실행 여부 | 비고 |
|---|---|---|---|
| 통합 Schema/Migration PR readiness 타입 | read-only integration report | 없음 | 실제 schema 변경 없음 |
| 통합 evaluator | Agent schema readiness + Operator schema readiness + Write Adapter integration 조합 | 없음 | Prisma/DB 미호출 |
| schemaChecklist | report field | 없음 | model/field/forbidden 검토 |
| migrationChecklist | report field | 없음 | migration 후보 검토 |
| rollbackChecklist | report field | 없음 | rollback/retention 검토 |
| safetyChecklist | report field | 없음 | no schema/migration/DB/PR 보장 |
| no-run flags | report field | 없음 | schema/migration/prisma/db/pr/adapter 미실행 |

### Stage 2-C 원칙

```text
- schema.prisma를 변경하지 않는다.
- migration을 생성하지 않는다.
- DB write를 하지 않는다.
- Prisma client를 호출하지 않는다.
- PR을 생성하지 않는다.
- adapter를 wire하지 않는다.
- Agent/Operator schema readiness ready_for_schema_pr_plan + writeAdapterIntegrationConfirmed=true일 때만 readiness ready.
```

### Stage 2-C Decision 규칙 요약

```text
agent/operator schema blocked 또는 write adapter integration blocked → blocked
schema readiness 미준비 또는 writeAdapterIntegrationConfirmed=false → defer
양쪽 schema ready + writeAdapterIntegrationConfirmed=true → ready_for_schema_migration_pr_readiness
```

## Stage 2-D Agent / Operator Write Path Wire Candidate Verification Integration 결과

| 항목 | 반영 방식 | 실제 실행 여부 | 비고 |
|---|---|---|---|
| 통합 Wire Candidate Verification 타입 | read-only report | 없음 | 실제 wire 없음 |
| 통합 evaluator | Agent wire gate + Operator wire gate + Stage 2-C schema readiness 조합 | 없음 | DB/Prisma 미호출 |
| candidateChecklist | report field | 없음 | 승인/스키마/마이그레이션/어댑터 확인값 검토 |
| safetyChecklist | report field | 없음 | no wire/no write 보장 |
| rollbackChecklist | report field | 없음 | 실제 wire 전 rollback 확인 |
| no-run flags | report field | 없음 | write/schema/migration/feature flag/routing 미실행 |

### Stage 2-D 원칙

```text
- write path를 실제로 wire하지 않는다.
- write adapter를 실제로 연결하지 않는다.
- DB write를 하지 않는다.
- Prisma client를 호출하지 않는다.
- schema.prisma를 변경하지 않는다.
- migration을 생성하지 않는다.
- feature flag를 wire하지 않는다.
- runtime route를 변경하지 않는다.
- 모든 조건이 충족되어도 결과는 “wire 후보 검증 ready”일 뿐이다.
```

### Stage 2-D Decision 규칙 요약

```text
agent/operator wire gate blocked 또는 schema migration readiness blocked → blocked
schemaMigrationReadinessConfirmed=false → defer
wire gate 미준비 또는 schema migration readiness 미준비 → defer
모두 충족 → ready_for_wire_candidate_verification
```

### Stage 2-C 보강 (Stage 2-D 선행)

| 항목 | 반영 방식 | 비고 |
|---|---|---|
| operator permission/audit count 분리 | report field | retention count=0 |
| source trace | schema/write-adapter upstream fields | Stage 2-D 추적 |
| writeAdapterIntegrationConfirmed | defer+confirmed 허용, blocked 우회 불가 | 테스트 고정 |
| unknown target | normalized unknown → blocked | mock ready 불가 |
| checklist reason | decision/count 기반 reason | 진단 가독성 |

### Stage 2-D 보강 (Stage 2-E 선행)

| 항목 | 반영 방식 | 비고 |
|---|---|---|
| source trace | requested/normalized target, schema migration, wire gate counts | Stage 2-E 추적 |
| confirmation 의미 분리 | schemaMigrationReadinessReviewConfirmed; schema/migration not applied in runtime | report input only |
| checklist reason | decision/confirmation/target 기반 reason | 진단 가독성 |
| ready finding | wire_candidate_requires_final_runtime_approval | 최종 runtime 승인 필요 |

## Stage 2-E Runtime Change Final Approval Package 결과

| 항목 | 반영 방식 | 실제 실행 여부 | 비고 |
|---|---|---|---|
| Runtime Change Final Approval Package 타입 | read-only report | 없음 | 실제 runtime 변경 없음 |
| 통합 evaluator | Routing Shadow + Write Path Wire Candidate 조합 | 없음 | Connector/GitHub/Cursor 미호출 |
| finalApprovalChecklist | report field | 없음 | 운영자 최종 승인 확인 |
| runtimeSafetyChecklist | report field | 없음 | no runtime/routing/write 보장 |
| rollbackChecklist | report field | 없음 | 실제 변경 전 rollback 확인 |
| operatorChecklist | report field | 없음 | approval/audit/override 검토 |
| no-run flags | report field | 없음 | runtime/routing/write/db/schema/git 미실행 |

### Stage 2-E 원칙

```text
- runtime route를 변경하지 않는다.
- Connector Gateway routing을 변경하지 않는다.
- write path를 wire하지 않는다.
- feature flag를 wire하지 않는다.
- DB write를 하지 않는다.
- Prisma client를 호출하지 않는다.
- schema.prisma를 변경하지 않는다.
- migration을 생성하지 않는다.
- git/Cursor/GitHub를 호출하지 않는다.
- 결과가 ready여도 실제 변경은 별도 Stage 2-F 또는 별도 PR/운영자 승인에서만 가능하다.
```

### Stage 2-E Decision 규칙 요약

```text
routing shadow 또는 wire candidate blocked → blocked
review/approval confirmation 미충족 → defer
Stage1 regression 또는 rollback review required 미충족 → defer
모두 충족 → ready_for_final_runtime_change_approval
```

### Stage 2-E 보강 (Stage 2-F 선행)

| 항목 | 반영 방식 | 비고 |
|---|---|---|
| source trace | routing/wire candidate upstream no-run fields | Stage 2-F 종료 판정 |
| blocking finding aggregation | wire gate + wire candidate findings dedupe | uniqueStrings |
| checklist reason | decision/confirmation 기반 reason | 운영자 승인 가독성 |
| ready finding | separate execution stage / not wired / not applied | 실제 변경 아님 명시 |

## Stage 2-F Stage 2 Integrated Closure Verdict 결과

| 항목 | 반영 방식 | 실제 실행 여부 | 비고 |
|---|---|---|---|
| Stage 2 통합 종료 판정 타입 | read-only report | 없음 | Stage 2 종료 가능 여부 |
| 통합 evaluator | Runtime Change Final Approval Package 기반 | 없음 | 실제 runtime 변경 없음 |
| closureChecklist | report field | 없음 | 종료 조건 확인 |
| noRunChecklist | report field | 없음 | Stage 2 no-run 원칙 검증 |
| handoffChecklist | report field | 없음 | 후속 PR/실험 브랜치 분리 |
| riskChecklist | report field | 없음 | Stage1/rollback/schema/routing/write risk |
| recommendedNextPhases | report field | 없음 | 후속 단계 안내 |

## Stage 2-F 보강 결과

| 항목 | 반영 방식 | 실제 실행 여부 | 비고 |
|---|---|---|---|
| Stage 2 closure summary | report field | 없음 | Stage 2 종료 의미 |
| Stage 2 scope | read_only_multi_agent_runtime_foundation | 없음 | 실제 변경 아님 |
| separate PR requirements | report field | 없음 | schema/routing/write 후속 분리 |
| risk acknowledgement | checklist reason | 없음 | risk required/review 분리 |
| recommended next phases | ordered report field | 없음 | 후속 우선순위 고정 |
| no-run reason 보강 | actual/expected/satisfied | 없음 | 오해 방지 |
| stage2HandoffReady 의미 보강 | decision 기반 | 없음 | defer 상태 handoff-ready 방지 |
| stage3Candidate 정책 | ready/defer/blocked 분리 | 없음 | read_only_hardening_required |
| feature flag next phase | recommendation 분리 | 없음 | prepare_feature_flag_wire_design |
| blocking finding source | aggregated/source 분리 | 없음 | 추적성 보강 |

## Stage 3-1 Runtime Execution Handoff Candidate 결과

| 항목 | 반영 방식 | 실제 실행 여부 | 비고 |
|---|---|---|---|
| Handoff Candidate 타입 | read-only report | 없음 | 실제 실행 아님 |
| evaluator | Stage 2-F source 기반 | 없음 | runtime 미실행 |
| runtimeHandoffChecklist | report field | 없음 | handoff 조건 |
| preExecutionSafetyChecklist | report field | 없음 | no-run 재확인 |
| prerequisite policy/approval checklist | report field | 없음 | 정책과 승인 상태 분리 |
| sourceStage2NoRunBlocking | report field | 없음 | no-run violation vs defer 구분 |
| sourceStage2PrerequisiteDeferred | report field | 없음 | prerequisite defer 추적 |

### Stage 3-1 원칙

```text
Stage 3-1은 runtime execution handoff 후보를 평가하는 read-only gate다.
ready 상태도 실제 실행 허가가 아니다.
```

## Stage 3-2 Runtime Execution Plan Builder 결과

| 항목 | 반영 방식 | 실제 실행 여부 | 비고 |
|---|---|---|---|
| Execution Plan Builder 타입 | read-only report | 없음 | 실제 실행 아님 |
| evaluator | Stage 3-1 handoff candidate 기반 | 없음 | runtime 미실행 |
| planSteps | 9단계 후보 | 없음 | executesInThisStep=false |
| noRunChecklist | report field | 없음 | runtime/DB/git/connector 호출 없음 |

### Stage 3-2 원칙

```text
Stage 3-2는 runtime execution plan 후보를 만드는 read-only 단계다.
실제 실행, routing 변경, write path wire, DB/schema/migration, Git/Cursor/GitHub 호출은 하지 않는다.
ready_for_runtime_execution_plan_review는 실행계획 리뷰 준비 상태이지 실행 허가가 아니다.
```

앞으로 Stage 3 진행 기준은 **Stage 3-A 통합 package**를 우선한다. Stage 3-2 builder는 Stage 3-A 내부 구성요소로 유지한다.

## Stage 3-A Runtime Execution Plan Package 결과

| 항목 | 반영 방식 | 실제 실행 여부 | 비고 |
|---|---|---|---|
| Runtime Execution Plan Package 타입 | read-only package report | 없음 | Stage 3-2/3-3/3-4 압축 |
| evaluator | Stage 3-2 Plan Builder 기반 | 없음 | runtime 미실행 |
| dryRunCandidate | simulated-only report field | 없음 | 실제 dry-run 실행 아님 |
| approvalReadiness | 7개 readiness 집계 | 없음 | Stage 3-B 전제 |
| executionPlanChecklist | report field | 없음 | plan/handoff/source 검토 |
| dryRunChecklist | report field | 없음 | simulated/no-run 검토 |
| approvalChecklist | report field | 없음 | 승인 준비 상태 |
| safetyChecklist | report field | 없음 | no-run 재확인 |

### Stage 3-A 원칙

```text
Stage 3-A는 기존 Stage 3-2/3-3/3-4를 압축한 Runtime Execution Plan Package 단계다.
실제 실행, routing 변경, write path wire, feature flag wire, DB/schema/migration, Git/Cursor/GitHub 호출은 하지 않는다.
ready_for_runtime_execution_approval_gate는 Stage 3-B 승인 gate로 넘길 수 있는 package 준비 상태이지 실행 허가가 아니다.
```

## Stage 3-B Runtime Execution Approval Gate 결과

| 항목 | 반영 방식 | 실제 실행 여부 | 비고 |
|---|---|---|---|
| Runtime Execution Approval Gate 타입 | read-only approval report | 없음 | Stage 3-C 전 승인 gate |
| evaluator | Stage 3-A package 기반 | 없음 | runtime 미실행 |
| approvalGateChecklist | report field | 없음 | 최종 승인 조건 |
| riskChecklist | report field | 없음 | 실행 전 위험 인지 |
| noRunChecklist | report field | 없음 | no-run 재확인 |
| handoffChecklist | report field | 없음 | Stage 3-C 인계 |

### Stage 3-B 원칙

```text
Stage 3-B는 Stage 3-A Runtime Execution Plan Package를 source로 받아 controlled runtime wire candidate로 넘길 수 있는지 판단하는 read-only approval gate다.
실제 실행, routing 변경, write path wire, feature flag wire, DB/schema/migration, Git/Cursor/GitHub 호출은 하지 않는다.
ready_for_controlled_runtime_wire_candidate는 Stage 3-C 후보 설계 가능 상태이지 실제 실행 허가가 아니다.
```

## Stage 3-C Controlled Runtime Wire Candidate 결과

| 항목 | 반영 방식 | 실제 실행 여부 | 비고 |
|---|---|---|---|
| Controlled Runtime Wire Candidate 타입 | read-only candidate report | 없음 | Stage 4-A 전 후보 |
| evaluator | Stage 3-B approval gate 기반 | 없음 | runtime 미실행 |
| wireCandidates | 5개 후보 report field | 없음 | 실제 wire 아님 |
| candidateChecklist | report field | 없음 | 후보 준비 상태 |
| safetyChecklist | report field | 없음 | no-run 재확인 |
| handoffChecklist | report field | 없음 | Stage 4-A 인계 |

### Stage 3-C 원칙

```text
Stage 3-C는 Stage 3-B Runtime Execution Approval Gate를 source로 받아 controlled runtime wire 후보를 생성하는 read-only 단계다.
실제 runtime 실행, routing 변경, write path wire, feature flag wire, DB/schema/migration, Git/Cursor/GitHub 호출은 하지 않는다.
ready_for_runtime_wire_experiment_branch는 Stage 4-A에서 실험 브랜치 계획을 검토할 수 있다는 의미이지 실제 브랜치 생성 또는 실행 허가가 아니다.
```

## Stage 4-A Runtime Wire Experiment Branch Plan

Stage 4-A는 Stage 3-C controlled runtime wire candidate를 source로 하여 실험 브랜치 생성을 위한 계획만 만든다. 실제 branch 생성, checkout, push, PR 생성은 하지 않는다.

| 항목 | 반영 방식 | 실제 실행 여부 |
|---|---|---|
| recommendedBranchName | report field | 없음 |
| recommendedFeatureFlagName | report field | 없음 |
| manualCommandCandidates | report field | 없음 |
| regressionSuites | report field | 없음 |
| branchSafetyChecklist | report field | 없음 |
| rollbackChecklist | report field | 없음 |
| handoffChecklist | report field | 없음 |

### Stage 4-A 원칙

```text
Stage 4-A는 read-only branch plan이다. recommendedBranchName과 manualCommandCandidates는 수동 승인 후에만 실행한다.
ready_for_manual_branch_creation_approval은 Stage 4-B 수동 브랜치 생성 검증으로 넘길 수 있다는 의미이지 실제 git 실행 허가가 아니다.
sourceCandidateKinds/sourceWireCandidateCount/sourceNoRunFlags는 Stage 4-B trace를 위해 report에 포함한다.
```

## Stage 4-B Manual Branch Creation Verification

Stage 4-B는 Stage 4-A Runtime Wire Experiment Branch Plan을 source로 하여, 사용자가 수동으로 브랜치를 생성하고 회귀 검증을 수행했다는 외부 입력을 read-only로 판정한다.

| 항목 | 반영 방식 | 실제 실행 여부 |
|---|---|---|
| expectedBranchName | Stage 4-A source | 없음 |
| actualBranchName | input field | 없음 |
| regressionResults | input field | 없음 |
| rollbackRequired | report field | 없음 |
| verificationChecklist | report field | 없음 |
| regressionChecklist | report field | 없음 |
| noRunChecklist | report field | 없음 |

### Stage 4-B 원칙

```text
- 실제 git 명령을 실행하지 않는다.
- 실제 브랜치를 생성하지 않는다.
- 실제 테스트를 실행하지 않는다.
- 실제 GitHub API를 호출하지 않는다.
- 실제 PR을 생성하지 않는다.
- regressionResults는 외부 실행 결과를 입력받아 판단한다.
- manual_branch_verified는 Stage 4-C Connector Gateway Shadow Routing Plan으로 넘어갈 수 있다는 의미이지 routing 변경 허가가 아니다.
```

### Stage 4-B Decision 규칙 요약

```text
source branch plan blocked → blocked
source branch plan not ready → defer
manual execution confirmation missing → defer
actual branch name missing → defer
branch mismatch → blocked
regression missing → defer
regression failed → blocked + rollbackRequired=true
all satisfied → manual_branch_verified
```

## Stage 4-C Connector Gateway Shadow Routing Plan

Stage 4-C는 Stage 4-B Manual Branch Creation Verification을 source로 하여 Connector Gateway shadow routing 계획을 만드는 read-only 단계다.

| 항목 | 반영 방식 | 실제 실행 여부 |
|---|---|---|
| sourceManualBranchDecision | Stage 4-B source | 없음 |
| shadowRouteCandidates | report field | 없음 |
| featureFlagName | report field | 없음 |
| featureFlagDefault | off | 없음 |
| shadowRoutingChecklist | report field | 없음 |
| safetyChecklist | report field | 없음 |
| rollbackChecklist | report field | 없음 |
| noRunChecklist | report field | 없음 |

### Stage 4-C 원칙

```text
- 실제 Connector Gateway routing을 변경하지 않는다.
- 실제 Connector를 호출하지 않는다.
- 실제 Cursor/GitHub를 호출하지 않는다.
- 실제 runtime을 실행하지 않는다.
- 실제 feature flag를 wire하지 않는다.
- 실제 Git/PR을 실행하지 않는다.
- ready_for_shadow_routing_review는 Stage 4-D Controlled Execution Path Candidate로 넘길 수 있다는 의미이지 routing 변경 허가가 아니다.
```

### Stage 4-C Decision 규칙 요약

```text
manual branch verification blocked → blocked
manual branch verification not verified → defer
rollbackRequired=true → blocked
shadow routing review missing → defer
connector gateway shadow mode missing → defer
Stage1 regression review missing → defer
rollback plan review missing → defer
all satisfied → ready_for_shadow_routing_review
```

## Stage 4-D Controlled Execution Path Candidate

Stage 4-D는 Stage 4-C Connector Gateway Shadow Routing Plan을 source로 하여 controlled execution path 후보를 만드는 read-only 단계다.

| 항목 | 반영 방식 | 실제 실행 여부 |
|---|---|---|
| sourceShadowRoutingDecision | Stage 4-C source | 없음 |
| executionPathCandidates | report field | 없음 |
| sourceFeatureFlagName | Stage 4-C source | 없음 |
| candidateChecklist | report field | 없음 |
| safetyChecklist | report field | 없음 |
| rollbackChecklist | report field | 없음 |
| handoffChecklist | report field | 없음 |
| noRunChecklist | report field | 없음 |

### Stage 4-D 원칙

```text
- 실제 runtime execution path를 변경하지 않는다.
- 실제 Connector Gateway routing을 변경하지 않는다.
- 실제 Connector를 호출하지 않는다.
- 실제 Cursor/GitHub를 호출하지 않는다.
- 실제 feature flag를 wire하지 않는다.
- 실제 Git/PR을 실행하지 않는다.
- ready_for_execution_path_review는 Stage 4-E Runtime Wire Experiment Review Package로 넘길 수 있다는 의미이지 execution path 변경 허가가 아니다.
```

### Stage 4-D Decision 규칙 요약

```text
shadow routing plan blocked → blocked
shadow routing plan not ready → defer
source no-run checklist mismatch → blocked
execution path review missing → defer
shadow routing review missing → defer
rollback review missing → defer
feature flag plan missing → defer
all satisfied → ready_for_execution_path_review
```

## Stage 4-E Runtime Wire Experiment Review Package

Stage 4-E는 Stage 4-D Controlled Execution Path Candidate를 source로 하여 runtime wire experiment를 실제 적용하기 전의 review package를 만드는 read-only 단계다.

| 항목 | 반영 방식 | 실제 실행 여부 |
|---|---|---|
| sourceControlledExecutionPathDecision | Stage 4-D source | 없음 |
| sourceExecutionPathCandidateCount | Stage 4-D source | 없음 |
| reviewFingerprint | deterministic report field | 없음 |
| experimentReadinessChecklist | report field | 없음 |
| connectorGatewayChecklist | report field | 없음 |
| executionPathChecklist | report field | 없음 |
| featureFlagChecklist | report field | 없음 |
| rollbackChecklist | report field | 없음 |
| noRunChecklist | report field | 없음 |

### Stage 4-E 원칙

```text
- 실제 runtime execution path를 변경하지 않는다.
- 실제 Connector Gateway routing을 변경하지 않는다.
- 실제 Connector를 호출하지 않는다.
- 실제 Cursor/GitHub를 호출하지 않는다.
- 실제 feature flag를 wire하지 않는다.
- 실제 Git/PR을 실행하지 않는다.
- 실제 schema.prisma/migration/DB를 변경하지 않는다.
- ready_for_stage4_closure_verdict는 Stage 4-F Integrated Closure Verdict로 넘길 수 있다는 의미이지 runtime 변경 허가가 아니다.
```

### Stage 4-E Decision 규칙 요약

```text
controlled execution path blocked → blocked
controlled execution path not ready → defer
source no-run checklist mismatch → blocked
runtime wire review missing → defer
connector gateway review missing → defer
execution path review missing → defer
feature flag review missing → defer
rollback review missing → defer
operator final review missing → defer
all satisfied → ready_for_stage4_closure_verdict
```

## Stage 4-F Integrated Closure Verdict

Stage 4-F는 Stage 4-E Runtime Wire Experiment Review Package를 source로 하여 Stage 4-A~E read-only 산출물이 종료 기준을 만족하는지 판정하는 최종 read-only closure gate다.

| 항목 | 반영 방식 | 실제 실행 여부 |
|---|---|---|
| sourceReviewPackageDecision | Stage 4-E source | 없음 |
| closureFingerprint | deterministic report field | 없음 |
| closureChecklist | report field | 없음 |
| handoffChecklist | report field | 없음 |
| riskChecklist | report field | 없음 |
| recommendedNextActions | report field | 없음 |
| separatedWorkItems | report field | 없음 |

### Stage 4-F 원칙

```text
- Stage 4-E를 source of truth로 사용한다 (Stage 4-A~D를 직접 재평가하지 않음).
- 실제 runtime execution path를 변경하지 않는다.
- 실제 Connector Gateway routing을 변경하지 않는다.
- 실제 Connector를 호출하지 않는다.
- 실제 Cursor/GitHub를 호출하지 않는다.
- 실제 Git/PR을 실행하지 않는다.
- 실제 feature flag를 wire하지 않는다.
- 실제 schema.prisma/migration/DB를 변경하지 않는다.
- stage4_closure_ready는 실제 runtime 실행 허가가 아니라 Stage 4 read-only 설계·검토 패키지의 종료 판정이다.
```

### Stage 4-F Decision 규칙 요약

```text
review package blocked → blocked
review package not ready → defer
source no-run checklist mismatch → blocked
Stage 4 closure confirmation missing → defer
all satisfied → stage4_closure_ready
```

### Stage 4-F 후속 분리 작업

```text
actual_git_branch_creation
actual_connector_gateway_routing_change
actual_feature_flag_wire
actual_agent_execution_record_schema_migration
actual_operator_approval_audit_schema_migration
actual_runtime_execution_write_path_wire
```

Stage 5 또는 별도 PR·승인 단계로 분리한 뒤 진행한다.

### Stage 4-F posture fields (hardening)

```text
closureIsRuntimeExecutionPermission=false — 종료 판정이 runtime 실행 허가가 아님
requiresStage5RuntimeDesign — stage4_closure_ready일 때 Stage 5 runtime 설계 필요
requiresSeparate* — schema/operator audit/connector branch/feature flag/write path는 별도 PR·승인
stage5Candidate — Stage 5 진입 시 우선 검토 후보(실행 순서 아님)
stage5EntryCandidates — Stage 5 진입 후보 전체 목록(읽기 전용 정의)
stage2Through4ClosureLocked — Stage 2~4 read-only chain이 Stage 4-F에서 닫혔는지
mvpBaselinePreserved / mvpBaselineSummary — MVP 기준선 유지 요약
actual*AllowedAfterStage4=false — Stage 4-F 이후에도 실제 변경은 별도 PR·승인 전까지 불가
stage5EntryIsCandidateOnly=true — Stage 5 진입은 후보 정의만
```

구현: `apps/web/src/lib/agents/multiAgentOrchestrationMvpBaseline.ts`

## Multi-Agent Orchestration MVP Baseline after Stage 4-F

Stage 4-F는 Stage 2~4 read-only multi-agent runtime foundation의 종료 판정이다.

### 닫힌 범위

- Stage 2: runtime/governance/readiness decision foundation
- Stage 3: runtime execution handoff/approval design foundation
- Stage 4: controlled runtime wire candidate, shadow routing, closure verdict

### 유지되는 MVP 기준선

- 역할 기반 AI 멤버 구조
- runtime/governance decision report
- connector gateway routing candidate
- operator approval gate
- stage closure verdict
- role knowledge binding readiness candidate

### 명시적 금지

Stage 4-F 종료 이후에도 아래 작업은 별도 PR/승인 전까지 수행하지 않는다.

- 실제 runtime execution
- 실제 Connector Gateway routing 변경
- 실제 Cursor/GitHub 실행 경로 변경
- 실제 write path wire
- 실제 schema.prisma/migration/DB write
- 실제 RAG indexing/embedding
- 실제 prompt injection
- 지식팩 관리 UI

## Milestone: Stage 2~4 종료 정리 및 Stage 5 진입 후보 정의

이번 마일스톤의 **주목적**은 멀티에이전트 오케스트레이션 **Stage 2~4 read-only 설계·검토·종료 정리**와 **Stage 5 진입 후보 정의**다. Stage 4-F가 종료 게이트이며, Stage 5-A Role Knowledge Binding은 그 다음 단계의 **후보 중 하나**를 read-only foundation 수준으로만 둔 것이다.

### Stage 2~4 종료 정리 (Stage 4-F)

```text
Stage 2: dispatch / connector facade / harness / governance / persist readiness / pass-through …
Stage 3: runtime execution plan / approval / controlled wire candidate (read-only)
Stage 4-A~E: wire experiment branch / manual verify / shadow routing / execution path / review package
Stage 4-F: integrated closure verdict — stage4_closure_ready = 설계·검토 패키지 종료, runtime 실행 허가 아님
```

### Stage 5 진입 후보 (실행 아님, 정의만)

| 후보 ID | 의미 | 이번 마일스톤 반영 |
|---|---|---|
| `role_knowledge_binding_foundation` | 역할별 지식팩 바인딩 **후보** — registry + readiness report | Stage 5-A read-only foundation 구현 |
| `runtime_execution_design` | 별도 승인·PR 이후 runtime write path / feature flag 설계 | Stage 4-F `requiresStage5RuntimeDesign` |
| `continue_read_only_hardening` | 추가 read-only 점검·문서·테스트 보강 | 선택 |

`stage5Candidate`는 위 후보 중 **우선 검토**를 가리킬 뿐, 다른 후보를 배제하지 않는다.

### 이번 마일스톤에서 절대 구현하지 않는 항목

```text
실제 RAG / embedding / vector 검색
지식팩 관리 UI
실제 프롬프트 주입 (prompt context wire)
runtime wire / feature flag wire / connector routing 변경
DB write / schema.prisma / migration
```

## Stage 5-A Boundary

Stage 5-A는 Role Knowledge Binding Foundation이다.

### 하는 일

- AI 역할별 필요한 지식팩 ID 후보를 정의한다.
- 기본 role → knowledge pack ID binding readiness를 평가한다.
- required/optional binding 충족 여부를 read-only report로 남긴다.
- boundary 필드(`stage5CandidateFoundationOnly`, `stage5AIsKnowledgePackImplementation`, registry read-only, MVP binding role)로 범위를 고정한다.

### 하지 않는 일

- 지식팩 등록/수정/버전관리
- 원천자료 업로드
- RAG 색인
- embedding
- prompt injection
- runtime execution 변경
- DB/schema/migration
- UI 구현

Stage 5-A는 본격 Knowledge Pack Management System 구현이 아니라, 향후 후속 단계를 위한 foundation candidate다.

### Stage 5-A Input Hygiene

Stage 5-A는 실제 지식팩 구현이 아니라 role → knowledge pack ID readiness report다.  
따라서 입력된 `availableKnowledgePackIds`는 다음 기준으로 정규화·추적한다.

- trim
- blank 제거
- dedupe
- deterministic sort
- default registry에 없는 unknown ID report
- required/optional missing binding report
- source default knowledge pack registry trace

unknown knowledgePackId는 입력 품질 경고로 남기되, required binding이 모두 충족된 경우 ready 판정을 막지 않는다.  
단, required binding 누락은 기존과 동일하게 defer다.

## Stage 5 Integrated Knowledge Foundation Package

Stage 5는 AI멤버가 역할별 지식을 참조할 수 있도록 하기 위한 read-only foundation 단계다.  
Stage 5는 실제 지식팩 시스템 구현이 아니다.

### 포함 범위

- Stage 5-A Role Knowledge Binding Closure
- Stage 5-B Knowledge Pack Metadata Registry Candidate
- Stage 5-C Role Knowledge Pack Mapping Candidate
- Stage 5-D Prompt Context Injection Design Candidate
- Stage 5-F Integrated Knowledge Foundation Closure

### 하지 않는 일

- 지식팩 CRUD
- 지식팩 버전관리
- 원천자료 업로드
- RAG/embedding/vector DB
- prompt injection runtime wire
- 지식팩 관리 UI
- DB/schema/migration
- runtime execution 변경

### Stage 5-F Closure 의미

`stage5_knowledge_foundation_ready`는 실제 지식팩 기능 구현 완료가 아니다.  
이는 역할별 지식 기반을 어떤 구조로 붙일지에 대한 read-only 설계·검증 기준선이 닫혔다는 의미다.

Stage 5-F report는 pipeline source trace(`sourceStage5*Count`, `sourceStage5AClosureFingerprint`, `sourceStage5FInputMode`)와 Stage 5-B/C/D aggregate boundary flag를 노출한다.  
Stage 5-A ready 입력은 `buildStage5AClosureConfirmedInput()` / `REQUIRED_STAGE5_A_CLOSURE_CONFIRMATIONS`로 명시한다.

### 후속 후보

- Runtime Execution Model Design
- Agent Execution Record Persistence PR
- Operator Approval/Audit Persistence PR
- Knowledge Pack Metadata Registry PR
- Prompt Context Injection Wire PR
- RAG/Embedding PR

### 구현 위치 (통합 패키지)

```text
apps/web/src/lib/agents/knowledgePackMetadataRegistryCandidateTypes.ts
apps/web/src/lib/agents/evaluateKnowledgePackMetadataRegistryCandidate.ts
apps/web/src/lib/agents/roleKnowledgePackMappingCandidateTypes.ts
apps/web/src/lib/agents/evaluateRoleKnowledgePackMappingCandidate.ts
apps/web/src/lib/agents/promptContextInjectionDesignCandidateTypes.ts
apps/web/src/lib/agents/evaluatePromptContextInjectionDesignCandidate.ts
apps/web/src/lib/agents/stage5IntegratedKnowledgeFoundationClosureTypes.ts
apps/web/src/lib/agents/evaluateStage5IntegratedKnowledgeFoundationClosure.ts
apps/web/tests/api/multiAgentKnowledgePackMetadataRegistryCandidate.unit.test.ts
apps/web/tests/api/multiAgentRoleKnowledgePackMappingCandidate.unit.test.ts
apps/web/tests/api/multiAgentPromptContextInjectionDesignCandidate.unit.test.ts
apps/web/tests/api/multiAgentStage5IntegratedKnowledgeFoundationClosure.unit.test.ts
```

## Stage 5-A Closure Package

Stage 5-A Closure Package는 Role Knowledge Binding Foundation이 다음 후보 단계로 넘어갈 수 있는지 확인하는 read-only aggregate gate다.

### 하는 일

- role별 readiness report를 aggregate한다.
- 전체 required/optional binding 현황을 요약한다.
- input hygiene 결과를 source trace로 남긴다.
- Stage 5-A가 지식팩 본구현이 아님을 다시 확인한다.
- Stage 5-B Knowledge Pack Metadata Registry는 후보로만 표시한다.

### 하지 않는 일

- 지식팩 metadata registry 실제 구현
- 지식팩 CRUD
- 지식팩 버전관리
- 원천자료 업로드
- RAG/embedding
- prompt injection
- runtime/DB/UI 변경

### Decision

```text
source blocked -> blocked
source defer -> defer
confirmation missing -> defer
all source ready + confirmations true -> stage5_a_closure_ready
```

`stage5_a_closure_ready`는 Stage 5-B 구현 허가가 아니라, Stage 5-A read-only foundation이 닫혔다는 의미다.

### 구현 위치 (closure)

```text
apps/web/src/lib/agents/roleKnowledgeBindingClosureTypes.ts
apps/web/src/lib/agents/evaluateRoleKnowledgeBindingClosure.ts
apps/web/tests/api/multiAgentRoleKnowledgeBindingClosure.unit.test.ts
```

### Decision (5-A 후보 evaluator)

```text
agentType missing/unknown -> blocked
required knowledge pack missing -> defer
required knowledge packs satisfied -> knowledge_binding_ready
```

### 구현 위치

```text
apps/web/src/lib/agents/roleKnowledgeBindingTypes.ts
apps/web/src/lib/agents/defaultRoleKnowledgeBindings.ts
apps/web/src/lib/agents/evaluateRoleKnowledgeBindingReadiness.ts
apps/web/tests/api/multiAgentRoleKnowledgeBindingReadiness.unit.test.ts
```

### Stage 5 단계 정의 (통합)

```text
Stage 5-A: Role Knowledge Binding Closure
Stage 5-B: Knowledge Pack Metadata Registry Candidate
Stage 5-C: Role Knowledge Pack Mapping Candidate
Stage 5-D: Prompt Context Injection Design Candidate
Stage 5-F: Integrated Knowledge Foundation Closure
```

Stage 5-E는 현재 별도 구현하지 않는다.  
Stage 5-F가 Stage 5 통합 closure 역할을 수행한다.  
Stage 5는 지식팩 본구현이 아니라 read-only knowledge foundation이다.  
실제 Knowledge Pack Management System은 별도 PR/단계로 분리한다.

Stage 5-F `stage5_knowledge_foundation_ready` 이후 진입 후보는 **Stage 6 Runtime Execution Model Design 후보만** 제시한다 (`stage6EntryMode=design_candidate_only`, `stage6RequiresSeparateApproval=true`).

## Stage 5 Final Closure Boundary

- Stage 5-F는 Stage 5-A~5-D read-only foundation의 통합 종료 판정이다.
- Stage 5-F는 지식팩 본구현 완료가 아니다 (`stage5ActualImplementationDisallowed=true`).
- Stage 5-F는 RAG, DB, prompt injection, runtime execution, UI 변경을 허가하지 않는다.
- Stage 5-F는 `validateStage5SourceBoundary()`로 Stage 5-B/C/D source report boundary를 검증한다. 위반 시 `blocked`.
- Stage 5-F ready 이후에도 Stage 6은 runtime execution model design 후보 단계다 (`stage6EntryMode=design_candidate_only`).
- Stage 6은 실제 실행 wire가 아니라 별도 승인·단계가 필요한 설계 후보로 시작한다 (`stage6ActualRuntimeExecutionAllowed=false`).

Stage 5-F ready 이후에도 **바로** 지식팩 구현, prompt injection wire, RAG indexing, runtime execution wire로 진행하지 않는다. 해당 항목은 `separatedWorkItems`와 `recommendedNextPhases`의 `separate_pr`/`stage6` 후보로만 안내된다.

## Stage 6 — Runtime Execution Model Design

Stage 6은 실제 runtime execution wire 구현이 아니라, runtime 실행을 안전하게 설계하기 위한 model design 단계다.

### Stage 6-A Runtime Execution Model Baseline

- Stage 5-F의 `stage6EntryMode=design_candidate_only`를 source로 사용한다.
- 실제 Cursor/GitHub/Connector/DB 실행은 하지 않는다.
- 실행 단위, 실행 경계, 승인 필요 조건, 금지 항목을 read-only report로 정의한다.

구현: `apps/web/src/lib/agents/evaluateRuntimeExecutionModelBaseline.ts`, `runtimeExecutionModelBaselineTypes.ts`, `runtimeExecutionModelBaselineSupport.ts`

### Stage 6-B Runtime Execution Request / Plan / Result Model Candidate

- RuntimeExecutionRequest, RuntimeExecutionPlan, RuntimeExecutionStep, RuntimeExecutionResult, RuntimeExecutionFinding, RuntimeExecutionApprovalState, RuntimeExecutionRollbackPlan 등 모델 후보를 제시한다.
- schema.prisma, migration, DB write는 생성하지 않는다.
- 실제 execution runner/API는 만들지 않는다.

구현: `apps/web/src/lib/agents/evaluateRuntimeExecutionModelCandidate.ts`, `runtimeExecutionModelCandidateTypes.ts`, `runtimeExecutionModelCandidateSupport.ts`

### Stage 6 금지 항목

- actual runtime execution API
- actual execution runner
- actual Cursor execution wire
- actual GitHub operation wire
- actual Connector Gateway routing change
- actual feature flag wire
- actual DB write
- actual persistence implementation

### Stage 6-A Hardening Rule

Stage 6-A는 Stage 5-F의 `stage6RequiresSeparateApproval=true`를 명시적으로 검증한다.
`sourceStage6ActualRuntimeExecutionAllowed=false`, `stage6EntryMode=design_candidate_only`,
`stage6RequiresSeparateApproval=true`가 모두 충족되지 않으면 `blocked`가 된다.

요청된 `requestedExecutionUnitKinds`는 dedupe·정렬 후 unknown kind 검사를 수행한다.

### Stage 6-B Candidate Validation Rule

Stage 6-B는 실제 schema/prisma/migration이 아니라 model candidate report만 생성한다.
후보 모델은 7종으로 고정하며, 각 후보는 `purpose`, `modelName`, `proposedFields`,
`persistenceCandidateOnly=true`를 충족해야 한다.

금지 필드가 포함되거나, 후보가 누락/중복/unknown이면 `blocked`로 판정한다.

표준 필드 기준:

- RuntimeExecutionApprovalState: `id`, `requestId`, `approvalStatus`, `approvedBy`, `approvedAt`
- RuntimeExecutionRollbackPlan: `id`, `requestId`, `rollbackSteps`, `rollbackRequired`

### Stage 6-C Runtime Execution Model Review Gate

Stage 6-C는 Stage 6-B의 runtime execution model candidate를 검토하는 read-only gate다.

이 단계는 실제 실행 허가가 아니다. 다음만 수행한다.

- 후보 모델 7종 검토
- field contract 검토
- no-run boundary 검토
- persistence/schema boundary 검토
- approval boundary 검토
- 다음 단계인 Stage 6-D runtime execution contract candidate로 넘길 수 있는지 판정

Ready decision: `ready_for_runtime_execution_contract_candidate`

구현: `apps/web/src/lib/agents/evaluateRuntimeExecutionModelReviewGate.ts`, `runtimeExecutionModelReviewGateTypes.ts`, `runtimeExecutionModelReviewGateSupport.ts`

Stage 6-C에서도 다음은 금지된다.

- actual runtime execution API
- execution runner
- Cursor/GitHub wire
- Connector Gateway routing change
- DB write
- schema.prisma/migration
- persistence implementation
- UI implementation

#### Stage 6-C Hardening Boundary

Stage 6-C는 Stage 6-B report를 source로 사용한다.  
source의 candidate-only, no-run, persistence boundary는 report에 직접 trace로 남긴다.

Stage 6-C의 ready decision은 `ready_for_runtime_execution_contract_candidate`이지만, 이는 실제 실행 허가가 아니다.  
다음 Stage 6-D에서 runtime execution contract candidate를 설계할 수 있다는 의미다.

Stage 6-C checklist는 7개 runtime execution model candidate 영역을 모두 검토해야 한다.

- RuntimeExecutionRequest
- RuntimeExecutionPlan
- RuntimeExecutionStep
- RuntimeExecutionResult
- RuntimeExecutionFinding
- RuntimeExecutionApprovalState
- RuntimeExecutionRollbackPlan

### Stage 6-D Runtime Execution Contract Candidate

Stage 6-D는 Stage 6-C의 `ready_for_runtime_execution_contract_candidate`를 source로 사용한다.

이 단계는 실제 실행 구현이 아니라 runtime execution contract candidate를 정의하는 read-only 단계다.

Stage 6-D 산출물:

- RuntimeExecutionRequest contract
- RuntimeExecutionPlan contract
- RuntimeExecutionStep contract
- RuntimeExecutionResult contract
- RuntimeExecutionFinding contract
- RuntimeExecutionApprovalState contract
- RuntimeExecutionRollbackPlan contract

Ready decision: `ready_for_runtime_execution_dry_run_contract`

구현: `apps/web/src/lib/agents/evaluateRuntimeExecutionContractCandidate.ts`, `runtimeExecutionContractCandidateTypes.ts`, `runtimeExecutionContractCandidateSupport.ts`

Stage 6-D에서도 다음은 금지된다.

- actual runtime execution API
- execution runner
- Cursor/GitHub wire
- Connector Gateway routing change
- DB write
- schema.prisma/migration
- persistence implementation
- UI implementation

#### Stage 6-D Hardening

Stage 6-D contract candidate는 Stage 6-C source report를 직접 추적한다.

- source reviewed model kinds
- source reviewed model count
- source reviewed field count
- source forbidden field state
- source no-run/persistence/schema boundary

Stage 6-D는 source가 ready이고 contract candidate validation이 통과한 경우에만 `ready_for_runtime_execution_dry_run_contract`를 반환한다.

### Stage 6-E Runtime Execution Dry-run Contract

Stage 6-E는 Stage 6-D의 `ready_for_runtime_execution_dry_run_contract`를 source로 사용한다.

이 단계는 실제 dry-run runner 구현이 아니다.  
향후 dry-run runner를 설계하기 위한 read-only contract package다.

Stage 6-E 산출물:

- dry-run request contract
- dry-run plan contract
- dry-run step contract
- dry-run result contract
- dry-run finding contract
- dry-run approval contract
- dry-run rollback contract

Ready decision: `ready_for_runtime_execution_contract_closure`

구현: `apps/web/src/lib/agents/evaluateRuntimeExecutionDryRunContract.ts`, `runtimeExecutionDryRunContractTypes.ts`, `runtimeExecutionDryRunContractSupport.ts`

Stage 6-E에서 금지되는 항목:

- actual dry-run runner
- actual runtime execution API
- actual execution runner
- Cursor/GitHub wire
- Connector Gateway routing change
- DB write
- schema.prisma/migration
- persistence implementation
- UI implementation

#### Stage 6-E Hardening

Stage 6-E는 Stage 6-D contract candidate source를 직접 추적한다.

- source contract candidate validation
- source no-run boundary
- source persistence boundary
- source schema boundary
- actual runtime/dry-run/runner/wire/persistence/schema disallowed flags

Stage 6-E는 dry-run runner를 구현하지 않는다.  
`ready_for_runtime_execution_contract_closure`는 Stage 6-F closure로 넘기는 준비 상태일 뿐이다.

### Stage 6-F Runtime Execution Contract Closure

Stage 6-F는 Stage 6-A~6-E의 read-only runtime execution model/contract chain을 닫는다.

`stage6_runtime_execution_contract_closed`는 실제 실행 허가가 아니다.

Stage 6-F 이후에도 다음은 금지된다.

- actual runtime execution API
- actual execution runner
- actual dry-run runner
- Cursor/GitHub wire
- Connector Gateway routing change
- DB/schema/migration
- persistence implementation
- UI implementation

Ready decision: `stage6_runtime_execution_contract_closed`

구현: `apps/web/src/lib/agents/evaluateRuntimeExecutionContractClosure.ts`, `runtimeExecutionContractClosureTypes.ts`, `runtimeExecutionContractClosureSupport.ts`

Report는 Stage 6-E source trace(`sourceNoRunBoundarySatisfied`, `sourceActual*` boundary flags)를 노출한다.

### Stage 7-A Hardening

Stage 7-A planning candidate는 Stage 6-F closure source의 actual boundary를 직접 추적한다.

- actual runtime execution
- actual execution runner
- actual dry-run runner
- actual execution wire
- actual persistence
- actual schema migration
- Cursor/GitHub wire
- Connector Gateway routing change

Stage 7-A ready는 실제 구현 허가가 아니라, Stage 7-B 이후 contract design PR로 넘어가기 위한 planning readiness다.

### Stage 7-A Runtime Implementation Planning Candidate

Stage 7-A는 Stage 6-F closure를 source로 받아 실제 구현 PR 후보를 분리하는 read-only planning candidate다.

`ready_for_runtime_implementation_pr_planning`은 실제 구현 허가가 아니다.

Stage 7-A는 다음을 산출한다.

- runtime API design PR 후보
- execution runner design PR 후보
- dry-run runner design PR 후보
- Cursor/GitHub wire design PR 후보
- Connector Gateway routing design PR 후보
- persistence/schema approval PR 후보
- feature flag wire design PR 후보
- runtime UI design PR 후보

실제 구현은 Stage 7-B 이후 또는 별도 승인 PR에서만 진행한다.

구현: `apps/web/src/lib/agents/evaluateRuntimeImplementationPlanningCandidate.ts`, `runtimeImplementationPlanningCandidateTypes.ts`, `runtimeImplementationPlanningCandidateSupport.ts`

### Stage 7-B Runtime API Contract Design Hardening

Stage 7-B는 API endpoint contract를 설계하지만 실제 endpoint를 구현하지 않는다.

보강 기준:

- source actual boundary trace 전체 노출
- endpoint path safety 검증
- security/approval error code 검증
- endpoint design-only count 검증
- implemented endpoint count 0 유지

### Stage 7-B Runtime API Contract Design

Stage 7-B는 Runtime Execution API의 endpoint contract를 read-only로 설계한다.

이 단계는 실제 API route 구현이 아니다.

산출물:

- create runtime execution request contract
- get runtime execution status contract
- list runtime execution events contract
- request runtime execution cancel contract
- submit runtime execution approval contract
- request runtime execution rollback contract

Ready decision: `ready_for_execution_runner_contract_design`

Stage 7-B에서 금지되는 항목:

- actual API route handler
- actual runtime execution API
- actual execution runner
- actual dry-run runner
- Cursor/GitHub wire
- Connector Gateway routing change
- DB write
- schema.prisma/migration
- persistence implementation
- UI implementation

구현: `apps/web/src/lib/agents/evaluateRuntimeApiContractDesign.ts`, `runtimeApiContractDesignTypes.ts`, `runtimeApiContractDesignEndpoints.ts`

### Stage 7-C Integrated Runtime Execution Contract Bundle Closure

Stage 7-C는 압축형 Stage 7 종료 단계다.

기존 세분화 계획의 API/runner/dry-run/Cursor-GitHub/persistence/schema/approval/security/rollback/audit 계약을 개별 구현하지 않고, Stage 8-A 진입을 위한 통합 bundle closure로 닫는다.

Ready decision: `stage7_runtime_contract_bundle_closed`

의미:

- Stage 7 read-only contract bundle이 닫혔다.
- Stage 8-A Minimal Runtime Execution Vertical Slice로 넘어갈 준비가 되었다.
- 실제 runtime/API/runner/DB/GitHub 구현 허가는 아니다.

Stage 8-A 권장 최소 범위:

- in-memory runtime execution record
- mock/dry-run runner only
- no DB/schema/migration
- no Cursor/GitHub actual call
- no Connector Gateway routing change
- no UI by default

구현: `apps/web/src/lib/agents/evaluateRuntimeContractBundleClosure.ts`, `runtimeContractBundleClosureTypes.ts`, `runtimeContractBundleClosureItems.ts`, `runtimeContractBundleClosureItemValidation.ts`

### Stage 3–4 빠른 진행 로드맵

```text
Stage 3-A: Runtime Execution Plan Package
Stage 3-B: Runtime Execution Approval Gate
Stage 3-C: Controlled Runtime Wire Candidate
Stage 4-A: Runtime Wire Experiment Branch Plan
Stage 4-B: Manual Branch Creation Verification
Stage 4-C: Connector Gateway Shadow Routing Plan
Stage 4-D: Controlled Execution Path Candidate
Stage 4-E: Runtime Wire Experiment Review Package
Stage 4-F: Stage 4 Integrated Closure Verdict
Stage 5-A: Role Knowledge Binding Closure
Stage 5-B: Knowledge Pack Metadata Registry Candidate
Stage 5-C: Role Knowledge Pack Mapping Candidate
Stage 5-D: Prompt Context Injection Design Candidate
Stage 5-F: Integrated Knowledge Foundation Closure
```

### Stage 2 종료 판정 의미

```text
Stage 2 closure ready는 실제 runtime 변경 가능 상태가 아니다.
Stage 2 closure ready는 multi-agent runtime foundation의 read-only 설계·검증·승인 패키지가 정리되었다는 의미다.
실제 변경은 별도 schema PR, operator audit schema PR, connector gateway experiment branch, runtime execution wire design, feature flag wire 승인 단계를 거쳐야 한다.
```

### Stage 2 이후 권장 작업 순서

```text
1. schema.prisma / migration 별도 PR
2. Operator Approval / Audit schema 별도 PR
3. Connector Gateway 실험 브랜치 수동 생성 및 회귀 검증
4. Runtime execution wire design
5. Feature flag wire 설계
6. 실제 Connector Gateway routing 전환 여부 결정
```

### Stage 2-F 원칙

```text
- Stage 2는 read-only foundation 단계로 종료한다.
- runtime route를 변경하지 않는다.
- Connector Gateway routing을 변경하지 않는다.
- write path를 wire하지 않는다.
- feature flag를 wire하지 않는다.
- DB write를 하지 않는다.
- Prisma client를 호출하지 않는다.
- schema.prisma를 변경하지 않는다.
- migration을 생성하지 않는다.
- git/Cursor/GitHub를 호출하지 않는다.
- Stage 2 종료 후 실제 변경은 별도 PR/실험 브랜치/운영자 승인으로 진행한다.
```

### Stage 2-F Decision 규칙 요약

```text
runtime final approval / routing shadow / wire candidate blocked → blocked
no-run policy violation → blocked
runtime final approval 미준비 또는 review 미확인 → defer
모두 충족 → stage2_closure_ready
```

### Stage 2 이후 후보

```text
1. schema.prisma / migration 별도 PR
2. Operator Approval / Audit schema 별도 PR
3. Connector Gateway 실험 브랜치 수동 생성 및 회귀 검증
4. Runtime execution wire design
5. Feature flag wire 설계
6. 실제 Connector Gateway routing 전환 여부 결정
```
