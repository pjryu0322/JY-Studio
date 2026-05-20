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

### Stage 2-12 후보: Governance enforcement 적용 설계

Stage 2-12에서는 Governance dry-run을 실제 차단 정책으로 전환할 수 있는지 설계만 검토한다.

| 후보 | 설명 | 주의사항 |
|---|---|---|
| Policy severity mapping | warning/blocking_candidate를 실제 차단 기준으로 매핑 | 운영 승인 필요 |
| Enforcement scope | capability별 적용 범위 | 오탐 방지 |
| Override policy | 운영자 승인 우회 | 감사 로그 필요 |
| Rollback plan | enforcement 비활성화 경로 | 필수 |
