# JYOrchestration Platform Orchestration Current State Diagnosis

**진단 일자:** 2026-05-24  
**범위:** `projects/JYOrchestration/**` 소스 읽기 전용  
**목적:** 기능별 처리 로직의 집합인지, 플랫폼 전체를 관통하는 Orchestration Control Plane이 있는지 판단

---

## 1. Executive Summary

### 플랫폼 오케스트레이션 Control Plane 존재 여부

**소스 확인 결과: 공통 Platform Orchestration Control Plane은 존재하지 않는다.**

`memberRun`, `platformFlowId`, `memberDraft` 같은 플랫폼 공통 run 계약 심볼은 `apps/web/src` 전역 검색에서 **일치 항목이 없다**. 대신 다음 세 축이 **서로 다른 계약**으로 병렬 운영된다.

| 축 | 대표 모듈 | 성격 |
|---|---|---|
| Requirements 오케스트레이션 | `requirementsOrchestrationRegistry.ts`, `requirementsTransitionEngine.ts`, `requirementsIntentRouter.ts` | 기획·SingleChat·service-flow 단계/슬롯/상태 패치 (Level 2) |
| SingleChat 기능 라우팅 | `singleChatStageRouter.ts`, `singleChatSlotActionRouter.ts`, `useServiceFlowWorkshopChat.ts` | 입력별 분기 파이프라인 (Level 1–2) |
| Execution Runtime | `runExecutionLoop.ts`, `normalTaskWorkerDispatch.ts`, `ai-team-runtime/` | Cursor→PR→검수 파이프라인 (Level 3–4, requirements와 분리) |
| Agent Foundation | `defaultAgents.ts`, `orchestrationRuntimeBridge.ts` | 메타데이터·타임라인 브리지 (Level 1, 실행 run 미연결) |

### 전체 Level 판단

| 영역 | Level | 한 줄 요약 |
|---|---|---|
| 플랫폼 전체 | **1–2 (분산)** | 이름은 “오케스트레이션”이 많으나 공통 run contract 없음 |
| Requirements stage/slot | **2** | 슬롯·단계·statePatch는 있으나 memberRun 없음 |
| SingleChat 진입 | **1–2** | Intent/Stage/Slot 라우터로 분기되는 기능 UI |
| Fast Plan | **0–1** | 클라이언트 helper가 artifact·슬롯 패치 직행 |
| Execution Runtime | **3–4** | worker·승인·GitHub 연동은 성숙하나 requirements 계약과 미연결 |
| AI 멤버 정의 | **1** | 정의·브리지는 있으나 통합 memberRun 생성 경로 없음 |

### 가장 큰 구조 리스크

1. **“오케스트레이션” 명칭의 파편화** — `lib/requirements/*Orchestration*`(37+ 파일), `ai-team-runtime`, `harness/resourceOrchestration`, `overlayOrchestrationDecisionTrace` 등이 **서로 다른 도메인 계약**을 가짐.
2. **SingleChat 입력이 공통 trigger가 아닌 다중 라우터로 분산** — `routeSingleChatSlotAction` → slot API, `dispatchRequirementsUserIntentAsync` → stage/intent, `postServiceFlowAnalyze` 등.
3. **Fast Plan이 플랫폼 flow를 우회** — `generateFastPlanFromCurrentContext`가 intent/transition/member 제안 없이 `ProjectArtifact` + `fastPlanGenerationV1` 직접 기록.
4. **Execution과 Planning이 계약 단절** — `runExecutionLoop.ts`는 `workflowId`/task 중심이며 `requirementsOrchestrationRegistry`를 import하지 않음.

### 즉시 구현보다 먼저 정리해야 할 것

- 새 기능별 오케스트레이터 추가 **금지** — `fastPlanOrchestrator`, `planningOrchestrator` 등 분열 방지.
- **Platform Run Contract** (flowId, trigger, memberRun, statePatch, timelineEvent, nextAction) 스키마를 먼저 정의하고, 기존 경로를 **adapter**로 감싸는 순서.
- 1차 정렬 대상 flow: **`fast_plan_from_current_context`** (이미 UI·state 있음, 계약만 부재).

---

## 2. Source Inspection Scope

| 영역 | 확인 파일/폴더 | 확인 결과 |
|---|---|---|
| Stage registry | `apps/web/src/lib/requirements/requirementsOrchestrationRegistry.ts` | `OrchestrationStage`, `STAGE_REGISTRY`, `resolveAuthoritativeOrchestrationStage` 존재 |
| Transition engine | `apps/web/src/lib/requirements/requirementsTransitionEngine.ts` | `RequirementsTransitionSignal`, `RequirementsTransitionResult`, `applyRequirementsOrchestrationTransition` — requirements 전용 |
| Intent router | `apps/web/src/lib/requirements/requirementsIntentRouter.ts`, `requirementsIntentDispatch.ts` | `routeRequirementsIntentAsync`, `dispatchRequirementsUserIntentAsync` — Project SingleChat 전용 |
| SingleChat slots | `apps/web/src/lib/requirements/singleChatOrchestrationTypes.ts`, `singleChatOrchestrationSlots.ts` | `RequirementsSingleChatOrchestrationStateV1` — JSON state 내 슬롯 lifecycle |
| Slot next action | `apps/web/src/lib/requirements/singleChatSlotNextAction.ts` | `decideSingleChatSlotNextAction`, `buildSlotAwareQuickReplyWires` — 기능별 next label/wire |
| Slot action | `apps/web/src/lib/requirements/singleChatSlotActionRouter.ts`, `singleChatPlanningSlotProposal.ts` | `routeSingleChatSlotAction`, `executeSingleChatSlotAction` — 별도 API |
| Service-flow | `apps/web/src/app/api/requirements/service-flow-analyze/route.ts`, `serviceFlowStageTransition.ts` | LLM analyze + transition fast path |
| Fast plan | `apps/web/src/lib/requirements/fastPlanGeneration.ts`, `RequirementsWorkspace.tsx` | 클라이언트 deterministic artifact 생성 |
| Agent definitions | `apps/web/src/lib/agents/defaultAgents.ts`, `agentDefinitionTypes.ts`, `aiMemberAgentBridge.ts` | `AgentDefinition`, 역할→agentId 매핑 |
| Platform AI catalog | `apps/web/src/lib/ai-member/platformAiMembers.ts`, `lib/ai/platformAiMembers.ts` | UI/페르소나 catalog |
| Agent MVP baseline | `apps/web/src/lib/agents/multiAgentOrchestrationMvpBaseline.ts` | `actual_runtime_execution` 등 **명시적 disallow** |
| Runtime bridge | `apps/web/src/lib/agents/orchestrationRuntimeBridge.ts` | `AgentTimelineMetadata`, replay contract — timeline 메타만 |
| Execution loop | `apps/web/src/lib/executionLoop/runExecutionLoop.ts` | task/workflow graph, Cursor, PR, merge |
| Worker dispatch | `apps/web/src/lib/runtime/normalTaskWorkerDispatch.ts`, `pipelineExecutionJobSync.ts` | runtime worker 경로 |
| AI team runtime | `apps/web/src/lib/ai-team-runtime/teamRuntimeLoopBridge.ts`, `status.ts` | execution 상태 phase bridge |
| GitHub | `apps/web/src/lib/service/githubAutoMergeService.ts`, `githubCompareService.ts` | execution loop에서 호출 |
| Prompt timeline | `apps/web/src/lib/requirements/requirementsOrchestrationTimeline.ts`, `requirementsIdeationBootstrapPromptTimeline.ts` | requirements prompt trace (실행 timeline과 별도) |
| Pre-Project boundary | `apps/web/src/lib/conversation/conversationScopeBoundary.ts` | `isProjectSingleChatScope` — messenger 분리 |

---

## 3. Current Platform Orchestration Map

```text
[사용자 입력]
    │
    ├─ Project SingleChat (RequirementsWorkspace / useServiceFlowWorkshopChat)
    │       │
    │       ├─ routeSingleChatSlotAction ──► POST /api/requirements/single-chat-slot-action
    │       │         (slot_action wire, planning proposal)
    │       │
    │       ├─ dispatchRequirementsUserIntentAsync
    │       │       ├─ routeRequirementsIntentAsync (LLM/deterministic intent)
    │       │       └─ routeProjectSingleChatStage (stage flags: analyze / screen / feature…)
    │       │
    │       ├─ postServiceFlowAnalyze ──► service-flow-analyze route
    │       │       ├─ applyRequirementsOrchestrationTransition
    │       │       └─ enrichProjectSingleChatSlotOrchestration
    │       │
    │       └─ handleGenerateFastPlanFromCurrentContext (UI 버튼)
    │               └─ generateFastPlanFromCurrentContext (클라이언트, artifact 직행)
    │
    ├─ Execution UI / worker
    │       └─ runExecutionLoop
    │               ├─ runNormalTaskViaRuntimeWorkers
    │               ├─ Cursor adapter
    │               ├─ pipelineExecutionJobSync
    │               └─ ai-team-runtime status bridge
    │
    └─ Agent Foundation (read-only baseline)
            ├─ defaultAgents / agentRegistry
            └─ orchestrationRuntimeBridge → prompt timeline metadata

※ 위 경로 간 공통 platformFlowId / memberRun 레이어 없음
```

---

## 4. Platform Orchestration Control Plane Diagnosis

### Q1. 공통 control plane 존재 여부

**판단: 없음 (공통 Platform Orchestration Control Plane 없음)**

| 검사 항목 | 소스 확인 결과 |
|---|---|
| `memberRun` | **해당 심볼 없음** (`apps/web/src` 전역) |
| `platformFlowId` | **해당 심볼 없음** |
| 공통 `flowId` (플랫폼) | execution은 `workflowId`/`sourceSpecVersionId` 수준 (`runExecutionLoop.ts`) — requirements stage와 무관 |
| 공통 `trigger` | requirements: quick action / intent; execution: task event — **통합 타입 없음** |
| `statePatch` | `RequirementsTransitionResult.requirementsStatePatch`, API `meta.requirementsStatePatch` — **Partial&lt;RequirementsStateJson&gt; 산발** |
| `timelineEvents` | `requirementsOrchestrationTimeline`, `RequirementsPromptTimelineEntry`, task history — **통합 이벤트 스키마 없음** |
| `nextActions` (플랫폼) | git provisioning, knowledge precheck, prototype API 등 **도메인별 로컬 필드**만 존재 |

**근거 파일:**

- 파일: `apps/web/src/lib/requirements/requirementsTransitionEngine.ts`  
  함수: `applyRequirementsOrchestrationTransition`  
  판단: Intent→Signal→Transition→`requirementsStatePatch` 파이프라인은 **requirements 서브시스템 계약**이며 execution/single run과 공유하지 않음.

- 파일: `apps/web/src/lib/agents/multiAgentOrchestrationMvpBaseline.ts`  
  상수: `MULTI_AGENT_ORCHESTRATION_MVP_BASELINE.disallowedInBaseline`  
  판단: `actual_runtime_execution`, `actual_write_path_wire` 등이 **명시적으로 금지** — 플랫폼 통합 실행 기반선이 read-only로 고정됨.

---

## 5. AI Member Definition vs Platform Runtime

| AI멤버 (역할) | 정의 위치 | 실제 memberRun 생성 여부 | 연결된 플랫폼 흐름 | 판단 |
|---|---|---|---|---|
| AI기획자 (planner) | `platformAiMembers.ts` (`WorkspaceAiMemberId`), `defaultAgents.ts`, `aiMemberAgentBridge.ts` → `planner` | **없음** — `memberRun` 심볼 부재 | SingleChat LLM, slot proposal, fast plan heuristic | Level 1: 역할명·프롬프트 prefix |
| 분석가 (analyst) | `aiMemberAgentBridge.ts` `ORCHESTRATION_ROLE_TO_AGENT_ID`, slot `ownerAgent: "analyst"` | **없음** | service-flow analyze, slot projection | Level 1–2 |
| 설계자 (architect) | 동상 | **없음** | feature scope slot actions | Level 1–2 |
| 디자이너 (designer) | 동상 | **없음** | screen planning branch | Level 1–2 |
| 개발자 (developer) | `defaultAgents.ts`, execution prompts | **없음** — task/Cursor run은 별도 모델 | `runExecutionLoop`, `buildCursorExecutionPrompt` | Level 3 (execution만) |
| 검수자 (reviewer) | `aiMemberOrchestration.ts` `AiMemberRole`, execution review | **없음** | `executionReviewWithAiMembers`, team runtime review phase | Level 3 (execution) |
| 보안관 (security) | harness/reviewSecurity, execution pipeline | **없음** | governance harness, ENV_TEST | Level 3–4 (부분) |
| SCM | execution merge 단계 | **없음** | `githubAutoMergeService` | Level 3 (execution) |

**추가 근거:**

- 파일: `apps/web/src/lib/agents/orchestrationRuntimeBridge.ts`  
  함수: `buildAgentRuntimeEventContext`, `agentTimelineMetadataFromReplay`  
  판단: Agent ID·role을 **prompt timeline 메타데이터**에 붙이는 브리지일 뿐, run lifecycle을 만들지 않음.

- 파일: `apps/web/src/lib/ai-member/aiMemberOrchestration.ts`  
  타입: `OrchestrationStage = "spec" \| "service-flow" \| "task" \| "execution-review" \| "scm-manager"`  
  판단: requirements registry의 `OrchestrationStage`(`IDEATION`, `SERVICE_FLOW`, …)와 **동명이타 다른 타입** — 플랫폼 단일 registry 아님.

---

## 6. SingleChat as Platform Entry Point Diagnosis

### 구현된 것

- Project SingleChat send 경로: `useServiceFlowWorkshopChat.ts` `sendMessage`
- Intent dispatch: `dispatchRequirementsUserIntentAsync` (`requirementsIntentDispatch.ts`)
- Stage routing: `routeProjectSingleChatStage` (`singleChatStageRouter.ts`)
- Slot action fast path: `routeSingleChatSlotAction` → `postSingleChatSlotAction` (`singleChatSlotActionRouter.ts`, `singleChatSlotActionClient.ts`)
- Orchestration state: `singleChatOrchestrationV1` in `requirementsStateJson` (`singleChatOrchestrationTypes.ts`)
- Quick reply: `QuickReplyWire` + `SingleChatSlotActionWire` (`requirementsQuickActionRegistry.ts`) — **기능별 의미**

### 부족한 것

- 모든 사용자 입력이 **단일 `PlatformTrigger`** 로 들어가지 않음
- 결과가 **통합 `memberRun[]` + `platformNextActions[]`** 로 반환되지 않음
- 대화방(Pre-Project messenger)과 Project SingleChat은 `conversationScopeBoundary.ts`로 **의도적 분리**

### Level 판단: **Level 1–2 (기능 UI + 상태 기반 제어, 플랫폼 진입점 아님)**

### 근거

- 파일: `apps/web/src/components/service-flow/useServiceFlowWorkshopChat.ts`  
  함수: `sendMessage` 내부 `routeSingleChatSlotAction` → `dispatchRequirementsUserIntentAsync` 분기  
  판단: 입력이 **두 개의 상위 라우터**로 먼저 갈라짐 — 플랫폼 단일 control point 아님.

- 파일: `apps/web/src/lib/requirements/requirementsIntentDispatch.ts` (주석 L1–3)  
  판단: *"Project SingleChat 전용 (requirements workspace). Pre-Project messenger는 사용하지 않는다."* — 범위가 requirements로 한정됨.

---

## 7. Slot / ServiceFlow / Feature Flow Diagnosis

| 영역 | 주요 파일 | 현재 역할 | 플랫폼 통합? | Level |
|---|---|---|---|---|
| 슬롯 상태 판단 | `singleChatSlotNextAction.ts` | `decideSingleChatSlotNextAction`, `evaluateGenerationReadinessFromSlots` | 부분 (requirements JSON) | 2 |
| Slot action routing | `singleChatSlotActionRouter.ts` | slot_action wire → dedicated API | 아니오 (별도 pipeline) | 1–2 |
| service-flow analyze | `service-flow-analyze/route.ts` | LLM + `applyRequirementsOrchestrationTransition` | 부분 (stage patch) | 2 |
| service-flow transition | `serviceFlowStageTransition.ts` | fast path transition | 부분 | 2 |
| Slot enrichment | `singleChatSlotOrchestrationEnrichment.ts` | analyze 응답에 slot quick reply merge | 부분 | 2 |
| Feature planning | `feature-planning/chat`, `useFeaturePlanningSingleChatBridge` | 별도 workspace chat mirror | 아니오 | 1–2 |

### 리스크

- `QuickActionId` (service-flow) vs `SingleChatSlotActionId` (planning slots) — **서로 다른 wire·router**
- `DIRECT_INPUT` 제거 후 slot_action wire로 보완했으나, 여전히 **registry quick action과 slot action은 병렬 체계**

---

## 8. Fast Plan Generation Diagnosis

### 구현된 것

- `fastPlanGeneration.ts`: `buildFastPlanGenerationContext`, `buildFastPlanMarkdown`, `generateFastPlanFromCurrentContext`
- `fastPlanSlotAssumptions.ts`: 부족 슬롯 heuristic 보완 (`assumed_for_prototype` / `candidate`)
- `RequirementsWorkspace.tsx` `handleGenerateFastPlanFromCurrentContext`: strict gate **우회**, artifact + `fastPlanGenerationV1` persist
- Artifact type: `fast_prototype_plan` (`projectArtifactTypes.ts`)

### 부족한 것

- `routeRequirementsIntentAsync` / `applyRequirementsOrchestrationTransition` **미호출**
- AI기획자/분석가/설계자 **memberDraft** 제안 UI 없음 (단일 markdown artifact)
- `platformFlowId` / `memberRun` 없음

### 플랫폼 flow 여부

**판단: 독립 fast plan helper (플랫폼 오케스트레이션 flow 아님)**

### Level: **0–1** (기능 helper + state side-effect)

### 근거

- 파일: `apps/web/src/lib/requirements/fastPlanGeneration.ts` (파일 헤더)  
  판단: *"client-side"* — `generateFastPlanFromCurrentContext`가 서버 orchestration engine을 거치지 않음.

- 파일: `apps/web/src/components/requirements/RequirementsWorkspace.tsx`  
  함수: `handleGenerateFastPlanFromCurrentContext`  
  판단: `persistStateJsonOnly({ projectArtifacts, deliverableAssets, fastPlanGenerationV1, singleChatOrchestrationV1 })` — **직접 state 기록**.

---

## 9. Execution Runtime Diagnosis

### 구현된 것

- `runExecutionLoop.ts`: workflow task pick, Cursor run, evaluation, history
- `normalTaskWorkerDispatch.ts`: worker 경로 분기
- `pipelineExecutionJobSync.ts`: pipeline job 동기 처리
- `ai-team-runtime/`: developer/review/complete/halt 상태
- GitHub: compare, auto-merge (`githubAutoMergeService.ts`)
- 승인/정지: `approvalHalt.ts`, `haltTaskForTeamRuntimeApproval`

### 부족한 것

- requirements `OrchestrationStage` / `singleChatOrchestrationV1`과 **상태 연동 없음**
- fast plan / slot action 결과가 execution task로 **자동 handoff 없음**
- 공통 `timelineEvent` 스키마 없음 (task history vs prompt timeline 분리)

### 플랫폼 공통 계약 연결

**연결 없음** — import 그래프상 `runExecutionLoop.ts`는 requirements orchestration 모듈을 참조하지 않음.

### Level: **3–4 (execution 도메인 내부만)**

### 근거

- 파일: `apps/web/src/lib/executionLoop/runExecutionLoop.ts`  
  판단: `workflowId`, `TaskForPick`, `EXECUTION_WORKFLOW` 중심 — planning orchestration registry와 무관.

---

## 10. Duplication and Fragmentation Risks

| 리스크 | 관련 파일 | 증상 | 플랫폼 영향 | 우선순위 | 개선 방향 |
|---|---|---|---|---|---|
| 다중 SingleChat 라우터 | `singleChatStageRouter.ts`, `singleChatSlotActionRouter.ts`, `requirementsIntentDispatch.ts` | 동일 클릭이 서로 다른 pipeline으로 분기 | 사용자·타임라인 일관성 붕괴 | **P0** | 단일 `dispatchPlatformTrigger()` + adapter |
| Quick action vs slot_action 이중 체계 | `requirementsQuickActionRegistry.ts`, `singleChatSlotActionTypes.ts` | chip 의미·routing 규칙 불일치 | no-op / 잘못된 stage intent | **P0** | `PlatformNextAction` wire 통합 |
| Fast plan이 member 제안 생략 | `fastPlanGeneration.ts`, `RequirementsWorkspace.tsx` | artifact 직행 | “빠른 프로토타입”이 AI 협업 UX와 단절 | **P0** | `fast_plan_draft` flow + memberDraft rows |
| `OrchestrationStage` 타입 중복 | `requirementsOrchestrationRegistry.ts`, `aiMemberOrchestration.ts` | 동명 다른 enum | cross-domain handoff 불가 | **P1** | 플랫폼 stage registry 단일화 |
| Agent 정의 vs 실행 helper 분리 | `defaultAgents.ts` vs `runExecutionLoop.ts` | 역할은 catalog, 실행은 task row | memberRun 추적 불가 | **P1** | memberRun이 agentId 참조 |
| Timeline 분리 | `requirementsOrchestrationTimeline.ts`, `taskHistoryService`, `teamRuntimeLoopBridge` | 기획·실행 이력 상호 검색 어려움 | 운영/디버깅 비용 | **P1** | `PlatformTimelineEvent` 통합 |
| MVP baseline이 runtime wire 금지 | `multiAgentOrchestrationMvpBaseline.ts` | `actual_write_path_wire` disallow | 통합 작업 시 정책 충돌 | **P1** | baseline 단계적 해제 계획 |
| “오케스트레이션” 파일 55+ | `lib/**/orchestration*` | harness/overlay/requirements 각각 | 개념 혼란 | **P2** | 네이밍·레이어 정리 |
| Execution 고도화 vs Planning 미성숙 | `runExecutionLoop.ts` vs `fastPlanGeneration.ts` | 실행만 Level 3–4 | 제품 스토리 단절 | **P2** | planning flow를 동일 contract로 승격 |

---

## 11. Gap to Platform Orchestration Engine

| 필요 계약 | 현재 존재 여부 | 근거 | Gap |
|---|---|---|---|
| `platformFlowId` | **없음** | 전역 grep 무일치 | flow 단위 추적·재개 불가 |
| `trigger` (통합) | **부분** | quick action, intent, slot_action 각각 별도 | 단일 ingress 타입 필요 |
| `memberRun` | **없음** | 전역 grep 무일치 | AI 멤버 실행 단위 미모델링 |
| `memberDraft` | **없음** | fast plan은 markdown 일괄 생성 | 멤버별 초안·승인 UX 없음 |
| `statePatch` | **부분** | `RequirementsTransitionResult`, API meta patch | 플랫폼 envelope 아님 |
| `timelineEvent` | **부분** | prompt timeline, task history 분리 | 상관관계 쿼리 어려움 |
| `nextAction` (플랫폼) | **부분** | slot decision, quick reply, git provisioning 각각 | UI·라우터 일관성 없음 |
| `validation/gate` | **부분** | `ideationDraftGateStatus`, `evaluateGenerationReadinessFromSlots`, execution approval | flow별 gate 분산 |
| `runtime handoff` | **부분** | execution loop 내부만 명확 | planning → prototype → execution 자동 연결 없음 |

---

## 12. Recommended Direction

### 새 기능별 오케스트레이터를 만들면 안 되는 이유

소스에 이미 `requirementsOrchestration*`, `singleChat*Router`, `serviceFlow*`, `fastPlan*`, `executionLoop`, `ai-team-runtime` 등 **기능별 control logic**이 존재한다. 여기에 `PlanningOrchestrator`, `FastPlanOrchestrator` 등을 추가하면 **동일 책임이 제곱으로 증가**하고, quick reply·gate·timeline이 더 분열된다.

### 기존 로직을 플랫폼 공통 계약으로 감싸는 방법

1. **Platform Run Contract** 타입을 `lib/platform-orchestration/` (신규 패키지 1곳)에만 정의.
2. 각 기존 진입점은 **adapter**만 추가:
   - `dispatchRequirementsUserIntentAsync` → 내부에서 `PlatformRun` 생성 후 기존 로직 호출
   - `routeSingleChatSlotAction` → `PlatformTrigger.kind = "slot_action"`
   - `generateFastPlanFromCurrentContext` → `PlatformFlowId = "fast_plan_from_current_context"`
   - `runExecutionLoop` → `PlatformFlowId = "execution_runtime"` (별도 process, state link via `projectId`)
3. 결과를 **`memberRuns[]`, `statePatches[]`, `timelineEvents[]`, `nextActions[]`** 로 normalize하여 UI에 반환.

### 1차 적용 대상

**`fast_plan_from_current_context`** — 이유:

- UI 진입점 명확 (`RequirementsWorkspaceTopChrome` 버튼)
- state hook 존재 (`fastPlanGenerationV1`)
- strict gate 우회 요구사항이 제품적으로 확정됨
- 아직 memberDraft 없어 **계약 도입 효과가 가장 잘 보임**

---

## 13. Proposed Minimal Platform Orchestration Contract

```ts
/** 플랫폼 전역 — requirements/execution 도메인 공통 envelope (제안, 미구현) */

export type PlatformFlowId =
  | "single_chat_turn"
  | "slot_action"
  | "service_flow_analyze"
  | "fast_plan_from_current_context"
  | "deliverable_generate"
  | "prototype_run"
  | "execution_runtime";

export type PlatformTrigger = Readonly<{
  readonly flowId: PlatformFlowId;
  readonly source: "quick_reply" | "slot_action" | "cta" | "typed_text" | "system";
  readonly projectId: string;
  readonly conversationScope: "project_single_chat" | "pre_project_messenger" | "execution";
  readonly payload: unknown;
}>;

export type PlatformMemberRun = Readonly<{
  readonly runId: string;
  readonly flowId: PlatformFlowId;
  readonly agentId: string; // maps to defaultAgents / platformAiMembers
  readonly status: "pending" | "running" | "completed" | "failed" | "skipped";
  readonly inputRef: string;
  readonly outputRef?: string;
  readonly traceId?: string;
}>;

export type PlatformMemberDraft = Readonly<{
  readonly runId: string;
  readonly agentId: string;
  readonly slotKey?: string;
  readonly content: string;
  readonly confidence: "confirmed" | "partial" | "candidate" | "assumed_for_prototype";
}>;

export type PlatformStatePatch = Readonly<{
  readonly domain: "requirements" | "execution" | "prototype";
  readonly patch: Record<string, unknown>;
}>;

export type PlatformTimelineEvent = Readonly<{
  readonly at: string;
  readonly flowId: PlatformFlowId;
  readonly kind: string;
  readonly agentId?: string;
  readonly detail?: string;
}>;

export type PlatformNextAction = Readonly<{
  readonly id: string;
  readonly label: string;
  readonly flowId?: PlatformFlowId;
  readonly wire?: unknown; // QuickReplyWire | SingleChatSlotActionWire — 점진적 통합
}>;

export type PlatformRunResult = Readonly<{
  readonly flowId: PlatformFlowId;
  readonly memberRuns: readonly PlatformMemberRun[];
  readonly memberDrafts: readonly PlatformMemberDraft[];
  readonly statePatches: readonly PlatformStatePatch[];
  readonly timelineEvents: readonly PlatformTimelineEvent[];
  readonly nextActions: readonly PlatformNextAction[];
}>;
```

---

## 14. Proposed Stepwise Plan

### Step 0 — Diagnosis Baseline

- 본 문서를 baseline으로 고정. **기능 추가 없이** contract 합의만 진행.

### Step 1 — Platform Run Contract Only

- `lib/platform-orchestration/types.ts` (신규) — 타입·순수 함수만, runtime side-effect 없음.
- 기존 코드 경로 **미변경**.

### Step 2 — Existing SingleChat/FastPlan을 Contract Adapter로 감싸기

- `fastPlanGeneration.ts` → `PlatformRunResult` mapper (memberDraft는 heuristic row로 채움).
- `singleChatSlotActionRouter.ts` → trigger/result mapping.
- UI는 기존 동작 유지, timeline에 `flowId` 추가.

### Step 3 — `fast_plan_draft`를 첫 플랫폼 flow로 정렬

- Fast plan: N개 `PlatformMemberDraft` (planner/analyst/designer) + 1 artifact aggregate.
- `fastPlanGenerationV1.memberRuns` 참조 추가 (optional field).

### Step 4 — `planning_slots` / `service_flow` 정렬

- `decideSingleChatSlotNextAction` → `PlatformNextAction[]` 생성.
- service-flow analyze transition → 동일 envelope.

### Step 5 — `execution_runtime` 계약 alignment

- `runExecutionLoop` step을 `PlatformTimelineEvent`로 mirror (read-only bridge).
- requirements stage와 **링크 테이블** (`projectId`, `executionRunId`)만 공유.

### Step 6 — timeline/audit 통합

- Prompt timeline + task history + team runtime → 단일 조회 API (read model).

---

## 15. Do Not Do

- 기획/실행/빠른기획/슬롯마다 **별도 Orchestrator 클래스** 추가
- `memberRun` 없이 또 다른 `*OrchestrationEngine.ts` 이름만 추가
- Pre-Project messenger 경로를 Project SingleChat router와 무단 공유 (boundary 유지)
- Fast plan을 다시 strict `ideationDraftGateStatus`에 가두기
- Execution loop를 requirements state machine 안으로 **인라인 병합** (결합도 폭발)
- DB schema / Prisma migration (contract 안정화 전)
- MVP baseline disallow 목록을 **확인 없이** 무시

---

## 16. Cursor Recommendation

### 지금 바로 구현할 것

- **없음** (이번 작업은 진단 전용). 다음 단계는 Step 1 타입 PR만 — 구현팀·아키텍트 리뷰 후.

### 아직 구현하지 말 것

- 통합 Orchestration “mega engine”
- 새 LLM prompt layer for platform
- Execution ↔ requirements state machine 물리 병합

### 사용자 확인이 필요한 구조 결정

1. **Pre-Project messenger**를 플랫폼 orchestration에 포함할지, Project SingleChat만 포함할지.
2. **Fast plan**을 “단일 planner artifact”로 유지할지, “멤버별 draft → 합성 artifact” UX로 바꿀지.
3. **Execution Runtime**을 같은 UI timeline에 노출할지, operator 전용 view로 분리할지.
4. `multiAgentOrchestrationMvpBaseline`의 disallow 항목을 어떤 순서로 해제할지.

---

## 부록: 모듈 역할 분류표 (Q2)

| 영역 | 주요 파일 | 현재 역할 | 플랫폼 오케스트레이션에 통합됨? | 판단 |
|---|---|---|---|---|
| 1. AI멤버 정의 | `defaultAgents.ts`, `platformAiMembers.ts`, `aiMemberAgentBridge.ts` | 역할 catalog·agentId 매핑 | 아니오 (메타만) | Level 1 |
| 2. SingleChat / 대화 | `useServiceFlowWorkshopChat.ts`, `RequirementsWorkspace.tsx` | 채팅 UI·send | 아니오 | Level 1–2 |
| 3. 슬롯 상태 판단 | `singleChatSlotNextAction.ts`, `singleChatOrchestrationSlots.ts` | next action·progress | 부분 (state only) | Level 2 |
| 4. slot action routing | `singleChatSlotActionRouter.ts` | slot_action API | 아니오 | Level 1–2 |
| 5. service-flow analyze | `service-flow-analyze/route.ts` | LLM analyze | 부분 | Level 2 |
| 6. fast plan generation | `fastPlanGeneration.ts` | artifact 직행 | 아니오 | Level 0–1 |
| 7. prototype / deliverable | `deliverables-generate`, `projectArtifactGenerate.ts` | 산출물 | 아니오 | Level 1 |
| 8. execution loop | `runExecutionLoop.ts` | task 실행 | 아니오 (별도 도메인) | Level 3–4 |
| 9. Cursor runtime | `cursorExecutionAdapter.ts` | code run | 아니오 | Level 3 |
| 10. GitHub PR/merge | `githubAutoMergeService.ts` | SCM | 아니오 | Level 3 |
| 11. AI검수/보안 | `executionReviewWithAiMembers.ts`, harness review | review pipeline | 아니오 | Level 3–4 |
| 12. timeline / history | `requirementsOrchestrationTimeline.ts`, `taskHistoryService` | observability | 부분 | Level 2 (분리) |

---

## 작업 요약

- 소스 진단 완료
- 보고서 작성 완료

## 작성 파일

- `projects/JYOrchestration/docs/diagnosis/platform-orchestration-current-state-diagnosis.md`

## 핵심 결론

- **플랫폼 오케스트레이션 Control Plane 존재 여부:** 없음
- **전체 Level:** 1–2 (분산), Execution만 3–4
- **SingleChat Level:** 1–2 (다중 라우터, 플랫폼 진입점 아님)
- **Fast Plan Level:** 0–1 (독립 helper)
- **Execution Runtime Level:** 3–4 (requirements와 계약 단절)
- **가장 큰 리스크:** 라우터·quick reply·orchestration 명칭의 파편화, fast plan의 memberRun 우회

## 확인한 주요 파일

- `requirementsOrchestrationRegistry.ts`, `requirementsTransitionEngine.ts`, `requirementsIntentDispatch.ts`
- `singleChatStageRouter.ts`, `singleChatSlotActionRouter.ts`, `singleChatSlotNextAction.ts`, `fastPlanGeneration.ts`
- `useServiceFlowWorkshopChat.ts`, `RequirementsWorkspace.tsx`
- `defaultAgents.ts`, `multiAgentOrchestrationMvpBaseline.ts`, `orchestrationRuntimeBridge.ts`
- `runExecutionLoop.ts`, `normalTaskWorkerDispatch.ts`, `ai-team-runtime/teamRuntimeLoopBridge.ts`

## 수정 여부

- 소스 수정 없음
- 보고서 MD 외 파일 수정 없음

## 다음 검토 필요

- Platform Run Contract 타입 합의 및 Step 1 PR 범위
- Fast plan을 memberDraft 모델로 확장할지 제품 결정
- `multiAgentOrchestrationMvpBaseline` 해제 로드맵
