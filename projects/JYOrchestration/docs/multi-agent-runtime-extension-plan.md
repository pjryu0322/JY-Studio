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

### Stage 2-6 후보: Connector Gateway Pass-through Integration 검토

| 후보 | 설명 | 주의사항 |
|---|---|---|
| Cursor execution boundary | 실행 전 facade record 생성 후보 | 실제 호출 라우팅 변경 금지 |
| GitHub PR boundary | PR 생성/상태 확인 전 facade record 후보 | 기존 GitHub 동작 변경 금지 |
| Timeline diagnostic | pass-through record read-only 표시 | 저장 구조 변경 별도 승인 |
```
