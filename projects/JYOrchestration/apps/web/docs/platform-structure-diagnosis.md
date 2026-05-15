# JYOrchestration 플랫폼 구조 진단 보고서

**범위**: `projects/JYOrchestration/**` 소스 기준 (추측 배제)  
**갱신**: 보고서 본문은 코드 변경 시 수동으로 이 파일과 동기화합니다.  
**다운로드**: 앱 기동 후 `GET /api/diagnostics/platform-structure-report` (응답 `Content-Disposition: attachment`)

---

## 0. 사전 고지

- **JY-Studio Ecosystem Philosophy** 공식 문서는 본 저장소 경로에서 확인하지 못했습니다. “철학 정합성”은 **코드에 드러난 구조 패턴** 대비한 평가입니다.
- Stage1 / Stage2 / ENV_TEST / Cursor 실행 파이프라인 **동작 변경 없이** 구조만 기술합니다.

---

# 1. 현행 구조 분석

## 1) AI 멤버 구조

### 상태

**반영됨** (DB + 서비스 + 카탈로그 + Stage2 조회 + 실행 리뷰 파이프라인)

### 현재 구현 위치

| 구분 | 경로 / 근거 |
|------|-------------|
| 모델(Prisma) | `packages/db/schema.prisma` — `ProjectMember` (`memberType`, `aiOrchestrationRole`, `orchestrationStage`, `aiModelOverride`, `orchestrationEnabled`, `aiProvider`, `aiAgentKey`, 실행 리뷰 override 필드 등) |
| RBAC vs 오케스트레이션 역할 | `apps/web/src/lib/ai-member/aiMemberOrchestration.ts` — `AiMemberRole`, `OrchestrationStage` |
| 역할 정의·Executor 예외 | `apps/web/src/lib/ai-member/aiMemberRoleDefinitions.ts` (Executor는 DB `ProjectMember`로 영속하지 않음 등) |
| 초대/저장 | `apps/web/src/lib/service/projectMemberService.ts`, `apps/web/src/app/api/project/members/invite/route.ts` |
| Stage2 DB AI 멤버 조회 | `apps/web/src/lib/service/envTestStage2AiMemberLookup.ts` — `getAiMemberByRole` |
| 워크스페이스 플랫폼 AI | `apps/web/src/lib/ai-member/platformAiMembers.ts`, `apps/web/src/lib/requirements/singleChatAgentContext.ts` — `resolveSingleChatAgentContext` |

### 현재 구현 수준 설명

- **AI/HUMAN 구분**: Prisma `ProjectMemberType` (`HUMAN` / `AI`).
- **프로젝트 RBAC** (`ProjectMemberRole`)와 **오케스트레이션 역할 문자열** (`aiOrchestrationRole`, `orchestrationStage`) 병행.
- **플랫폼 카탈로그** (`WorkspaceAiMemberId`, `executionProvider: "openai" \| "cursor"`)와 **프로젝트 초대 AI 멤버**가 SingleChat 컨텍스트에서 합쳐짐.

### 현재 사상과의 정합성

**부분 정합** — 멀티 주체·역할 분리는 반영. Executor는 Cursor 전용 경로로 **단일 추상 AI 멤버 모델과 이원화**.

### 문제점

오케스트레이션 역할이 **문자열 + 별도 타입 + 카탈로그 키**로 분산되어 신규 역할 시 스키마·lookup·LLM 프롬프트·화면 키를 함께 맞춰야 함.

### 재사용 가능성

**높음** — `ProjectMember` + lookup + `platformAiMembers`는 Harness/Memory 확장의 식별·활성화·모델 override 기반으로 적합.

### 권장 방향

**확장** — 역할 식별자 **단일 소스** 수렴 리팩터링 후보.

---

## 2) Harness 구조 (명칭 없이 역할 수행 여부)

### 상태

**부분 반영** — OpenAI HTTP 래퍼, Cursor 어댑터, 실행 리뷰 순회, SingleChat 다단계 LLM 존재. **단일 Harness 인터페이스 계층은 없음**. H8에서 maturity·release gate 기준화, **H8.5에서 Prompt Timeline Overlay·진단 API의 audience/compact/budget·경고 그룹화·운영 요약**으로 관측 UX를 정리, **H9에서 자원 orchestration planning**, **H9.5에서 자원 압력 심각도·과밀 완화·Explainability 노이즈 완화·추가 진단 요약 필드**로 스케일 안정화(실행·payload·DB 비변경).

### 현재 구현 위치

| 구분 | 경로 |
|------|------|
| OpenAI 실행 | `apps/web/src/lib/ai/openAiChatCompletions.ts` — `postOpenAiChatCompletion` |
| Cursor 실행 | `apps/web/src/lib/execution/cursorExecutionAdapter.ts` — `CursorRunResult`, `executeCursorRun` (ENV_TEST Stage1/2는 어댑터 밖 오케스트레이션 주석) |
| 실행 후 OpenAI JSON 평가 | `apps/web/src/lib/execution/openAiRelayEvaluation.ts` |
| 다중 리뷰어 | `apps/web/src/lib/execution/executionReviewWithAiMembers.ts` + `aiMemberOrchestration.ts` |
| SingleChat 라우팅→전문가 | `apps/web/src/lib/requirements/singleChatOrchestrationOpenAI.ts`, `singleChatOrchestrationOpenAI.plannerRoute.ts`, specialist/merge 모듈 |
| API 통합 | `apps/web/src/app/api/requirements/ai-facilitator/route.ts` — `runSelectiveMultiAgentOrchestrationOpenAI` |

### 현재 구현 수준 설명

Provider 분리는 **파일/함수 단위**. 공통 `AiEngine` 수준 추상은 두드러지지 않음. **Orchestration dispatcher** 성격은 `runSelectiveMultiAgentOrchestrationOpenAI` + `ai-facilitator`에 가깝다.

### 현재 사상과의 정합성

**부분 정합** — 역할별 실행 분리는 있으나 **엔진 스위칭을 한 곳에서 선언적으로 다루는 Harness**는 아님.

### 문제점

제3 제공자(국내 LLM 등) 추가 시 `postOpenAiChatCompletion` / `cursorExecutionAdapter` 주변 **분기 누적** 위험.

### 재사용 가능성

**중간** — 래퍼는 재사용 가능하나 정책이 라우트·오케스트레이션 파일에 분산.

### 권장 방향

**확장** (장기 Harness 계층 도입 여지).

---

## 3) Memory 구조

### 상태

**부분 반영** — 프로젝트 JSON 상태, DB 대화/프롬프트 로그, 브라우저 저장. **명시적 memory tier 추상화 없음**.

### 현재 구현 위치

| 구분 | 경로 |
|------|------|
| 프로젝트 오케스트레이션 상태(JSON) | `packages/db/schema.prisma` — `Project.requirementsStateJson`; 타입 `apps/web/src/lib/requirements/singleChatOrchestrationTypes.ts` — `RequirementsSingleChatOrchestrationStateV1` |
| 메신저·프롬프트 타임라인(DB) | `packages/db/schema.prisma` — `MessengerPromptTimelineLog`, `ChatRoom` / `ChatMessage` |
| 브라우저 working/session | `apps/web/src/lib/prototype/prototypeGenerationLocalStore.ts` (sessionStorage); `apps/web/src/lib/workflow/businessExecutionPersistence.ts` (localStorage, Stage1/2 상태 제외 주석) |

### 현재 구현 수준 설명

- **Orchestration memory에 가까운 것**: `singleChatOrchestrationV1`에 슬롯·동적 슬롯·owner momentum·최근 질문 등 **턴 간 상태** 저장.
- **shared / role / session memory**를 명명·계층화한 서브시스템은 코드 근거상 별도 없음 (JSON / DB / 브라우저 혼재).

### 현재 사상과의 정합성

**부분 정합** — “기억”은 있으나 **메모리 정책(보존·권한·스코프) 추상체** 없음.

### 문제점

대화 맥락이 **DB 채팅**, **프로젝트 JSON**, **클라이언트 storage**로 나뉘어 감사·재현 스토리 정리가 어려움.

### 재사용 가능성

**중간** — `requirementsStateJson` 패턴은 강하나 Memory 서비스로 승격 시 경계 정리 필요.

### 권장 방향

**확장**

---

## 4) Context Assembly 구조

### 상태

**반영됨**

### 현재 구현 위치

| 구분 | 경로 |
|------|------|
| SingleChat planner 블록 | `apps/web/src/lib/requirements/singleChatOrchestrationOpenAI.plannerRoute.ts` |
| 실행 리뷰 공통 컨텍스트 | `apps/web/src/lib/execution/executionReviewWithAiMembers.ts` — `buildCommonContext`, `roleSpecificInstructions` |
| 지식팩 검색→프롬프트 | `apps/web/src/lib/knowledge-packs/knowledgePackRetrievalService.ts` — `buildPromptContextFromRetrievedChunks` (청크당/총량 truncate 상수) |
| 병합·주입 | `knowledgePackMergedPromptContext.ts`, `knowledgePackWorkUnitPromptInjection.ts` |
| Cursor 실행 프롬프트 | `apps/web/src/lib/execution/buildCursorExecutionPrompt.ts` |

### 현재 구현 수준 설명

- Prompt composition / truncation 구현됨 (`PROMPT_CONTEXT_PER_CHUNK_MAX`, `PROMPT_CONTEXT_TOTAL_MAX` 등).
- 지식팩 retrieval: **키워드 모드가 실사용 경로**로 기술됨 (`embedding=not_used` 진단 문자열 등 코드 근거).

### 현재 사상과의 정합성

**정합에 가까움**

### 문제점

조립 로직이 **기능 영역별 파일**에 분산되어 토큰 예산·필터 통합이 어려움.

### 재사용 가능성

**높음** — 각 `build*` 함수가 Context Orchestration 서비스 하위 구현체로 이전하기 좋음.

### 권장 방향

**리팩토링** (동작 유지, 조립 단계 인터페이스화).

---

## 5) Knowledge Pack 구조

### 상태

**반영됨** (DB 모델·소스·청크·인덱스 잡·RAG 파이프라인·추천·병합·WorkUnit 주입)

### 현재 구현 위치

| 구분 | 경로 |
|------|------|
| Prisma 모델 | `packages/db/schema.prisma` — `KpKnowledgePack`, `KpKnowledgePackSource`, `KpKnowledgePackChunk`, … |
| 청크 스키마 | 임베딩 벡터 컬럼 없음 — `chunkText`, `tokenEstimate`, `contentHash` 등 |
| RAG/파이프라인 | `apps/web/src/lib/knowledge-packs/knowledgePackRagPipeline.ts`, `knowledgePackChunkService.ts`, `knowledgePackRetrievalService.ts` |
| 추천·병합 | `knowledgePackRecommendationService.ts`, `knowledgePackMergedPromptContext.ts` |
| WorkUnit 주입 | `knowledgePackWorkUnitPromptInjection.ts` |
| API/UI | `apps/web/src/app/api/knowledge-packs/**`, `apps/web/src/components/knowledge-packs/**` |

### 현재 구현 수준 설명

외부 문서 ingestion·청킹·인덱스 잡까지 DB·서비스 존재. **Vector RAG**: 파이프라인에 `vector?` 자리는 있으나 스키마상 영속 벡터 검색은 미흡, retrieval은 키워드 중심.

### 현재 사상과의 정합성

**부분 정합** — 지식팩 구조는 강함. **역할/프로젝트별 activation**은 `agentsJson`, 추천, WorkUnit 등에 분산.

### 문제점

platform vs project 구분 필드(`scope`, `projectId`, `isSystem`)는 있으나 **런타임 activation 규칙**이 단일 모듈로 모이지 않음.

### 재사용 가능성

**높음**

### 권장 방향

**확장** (벡터 검색 시 스키마·파이프라인 연동 추가).

---

## 6) SingleChat 및 Multi-Agent 구조

### 상태

**반영됨**

### 현재 구현 위치

| 구분 | 경로 |
|------|------|
| 오케스트레이션 코어 | `singleChatOrchestrationOpenAI.ts`, `singleChatOrchestrationSlots.ts`, `singleChatOrchestrationTypes.ts` |
| API | `apps/web/src/app/api/requirements/ai-facilitator/route.ts` |
| 참가자·프롬프트 블록 | `singleChatAgentContext.ts` |
| 멘션·퀵액션 | `singleChatQuickAction.ts` (오케스트레이션에서 import) |
| 프로토타입 로컬 | `prototypeGenerationLocalStore.ts` |

### 현재 구현 수준 설명

- **multi-agent**: planner-route JSON (`routingDecision`, `delegatedAgents`, `updatedSlots` 등) 이후 specialist 실행.
- **slot 기반**: `RequirementsSingleChatOrchestrationStateV1` + 동적 슬롯 제안/검증.
- **멘션**: `ai-facilitator`에서 `mentionTargetsSummary` 등을 오케스트레이션 입력으로 전달.

### 현재 사상과의 정합성

**정합에 가까움**

### 문제점

상태가 JSON optional 필드 확장에 의존 (스키마 마이그레이션 없이 필드 추가 패턴 등).

### 재사용 가능성

**높음**

### 권장 방향

**유지 + 점진 확장** (버전 관리 강화는 별도 과제).

---

# 2. 구조 충돌 분석 (코드 패턴 기준)

| 후보 | 근거 |
|------|------|
| Reviewer·execution-review 비중 | Prisma 실행 리뷰어 필드, `executionReviewWithAiMembers.ts`, `OrchestrationStage`에 `execution-review` |
| Orchestration logic 분산 | `ai-facilitator`, `singleChatOrchestrationOpenAI*`, `openAiChatCompletions`, 지식팩 서비스 등 |
| 실행 주체 이원화 | `platformAiMembers.ts` — `WorkspaceAiExecutionProviderId = "openai" \| "cursor"`; Executor DB 비영속 (`aiMemberRoleDefinitions.ts`) |
| Memory 계층 부재 | 동일 개념이 JSON / DB 로그 / 브라우저 storage에 분산 |
| Vector 기대 vs 스키마 | `KpKnowledgePackChunk`에 벡터 컬럼 없음; retrieval 키워드 중심 |

---

# 3. 향후 확장성 분석

| 관점 | 평가 | 요약 |
|------|------|------|
| Multi-agent | 양호 | 슬롯 + planner + delegate |
| Harness | 보통 | 어댑터 있음, 단일 인터페이스 없음 |
| 국내 LLM | 제한적 | OpenAI 중심 HTTP 래퍼 |
| Cursor/Copilot 병행 | 부분 | Cursor 전용 경로 존재; Copilot 전용 경로는 본 범위에서 미확인 |
| Memory 계층 | 보통 | 경계 정의 필요 |
| Knowledge Pack | 양호 | DB·파이프라인·주입; 벡터는 추가 작업 |
| Context orchestration | 보통 | 조립 함수 풍부, 중앙 조율 없음 |
| SingleChat 중심 | 양호 | `ai-facilitator` + 상태 JSON 허브 |

---

# 4. 우선순위 제안

| 우선순위 | 영역 | 이유 |
|----------|------|------|
| P0 | 실행/Harness 경계 (OpenAI vs Cursor vs 향후 provider) | 분기·테스트 비용 |
| P0 | `requirementsStateJson` 계약 | SingleChat·지식팩·실행 파이프 공통 의존 |
| P1 | Memory 스코프 명문화 | 감사·재현·멀티 워커 |
| P1 | 역할 식별자 단일화 | AI 멤버 추가 비용 절감 |
| P2 | Knowledge Pack 벡터 검색 | 품질; 스키마·파이프라인 연동 |
| P2 | Context assembly 모듈 경계 | 토큰·필터 정책 통합 |

---

# 5. Overlay Architecture 관점 보완 (계획서 7단계 반영)

## Identity-based AI Organization

- 플랫폼은 **단일 Assistant**가 아니라 화면별 **AI Identity Catalog**(`platformAiMembers`)와 프로젝트 **ProjectMember(AI)** 가 공존한다.
- **정체성 계약 타입**: `apps/web/src/lib/overlay/aiIdentityContract.ts` — 기존 DB/초대를 대체하지 않고, perspective·capability·memory/knowledge scope 어휘를 고정한다.
- **Cursor 실행 기본 정책**: 계약 파일 주석 — Code Agent는 명시된 실행 주체 역할에 한정하는 것이 방침(동작 가드는 미적용, 문서·계약만).

## Harness 부재 vs 부분 반영

| 영역 | 상태 |
|------|------|
| OpenAI Chat Completions 단일 HTTP | 반영 |
| Cursor Agent API 어댑터 | 반영 |
| 실행 **후** JSON 리뷰 다중 멤버 | **Review Harness**로 의미 분리 (`executionReviewWithAiMembers`) |
| 단일 교체 가능 Engine 인터페이스 | **미반영**(파일 단위 분기) |

## Persistent Memory 관점

- **Project Orchestration Memory**: `requirementsStateJson` / `singleChatOrchestrationV1`.
- **대화 기록**: `ChatMessage` 등.
- **감사**: `MessengerPromptTimelineLog`.
- **Working**: 브라우저 `localStorage` / `sessionStorage` (프로토타입·biz exec 등).
- **Memory scope 계약 타입**: `apps/web/src/lib/overlay/memoryScopeContract.ts` — DB migration 없이 의미만 명문화.

## Context Orchestration 위험도

- **중간**: 조립 함수가 다수 모듈에 흩어져 **토큰 예산·출처 추적**을 한 레이어에서 보기 어렵다.
- **완화 계약**: `PromptAssemblyMetadataContract` (`contextAssemblyContract.ts`) — 상위 호출이 선택적으로 메타를 채울 수 있게 함(기존 build 경로 비침해).
- **2단계 연결**: 서비스 기획 SingleChat 오케스트레이션 성공 턴에서 `promptTrace.overlayContextAssembly`에 `usedRole`, `usedMemoryRefs`, `usedKnowledgePacks`(synthetic 힌트 id), `usedStage`, `tokenBudgetHint: "not_measured"` 기록 (`ai-facilitator` + `buildOrchestrationOverlayPromptTraceAugments`).

## Knowledge Activation 부족 영역

- 추천·병합·WorkUnit 주입은 있으나 **런타임 activation 메타**가 단일 타입으로 고정되어 있지 않았다.
- **완화(1단계)**: `ActiveKnowledgePackRef` (`activeKnowledgePackRef.ts`) — 타입만.
- **완화(2단계)**: `resolveKnowledgeActivationHintsForRole` — `role-default:…` synthetic 힌트를 `promptTrace.overlayKnowledgeActivationHints`에 동시 기록(실제 지식팩 로드 아님).

## 2단계 Runtime 요약

- **1차**: 계약·문서·주석 중심.
- **2차**: 위 필드 + resolver·coerce 경로로 **추적성** 확보. 라우팅·LLM 파라미터·프롬프트 본문은 불변.

## Overlay Runtime Policy (힌트 전용)

- **현재 warning·diagnostic은 실행 차단이 아니다.** 운영·감사·추적·정책 설계용 metadata다.
- **단계**: Contract(1) → Runtime Metadata(2) → Policy Helper(3) → Diagnostic / Warning(4) → Runtime Diagnostic / Selection Preparation(5) → Policy-guided Context Assembly Preparation(6) → Policy-guided Assembly Plan Stabilization(7) → Overlay Observability UI Phase 1(8) → Overlay Observability UI Phase 1.5(9) → Harness Phase H1 — Controlled Prompt Assembly Preview(10) → Harness Phase H2 — Apply-readiness Preparation(11) → Harness Phase H3 — Role-aware Knowledge Activation(12) → Harness Phase H4 Preparation — Memory Runtime Harness(13) → Harness Phase H4.5 — Memory Runtime Harness Stabilization(14) → Harness Phase H5 Preparation — Execution Routing Harness(15) → Harness Phase H5.5 — Execution Routing Safety & Explainability Stabilization(16) → Harness Phase H6 Preparation — Review / Security Harness(17; planning metadata only) → **Harness Phase H6.5 — Review / Security Safety & Issue Planning(18; planning metadata only)** → **Harness Phase H7 — Message-level Explainability UI(19, 현재; SingleChat AI 응답 read-only 패널)** → **Harness Phase H7.5 — Explainability UX Stabilization(20, 현재; read-only)** → **Harness Phase H7.6 — SingleChat Explainability Integration Verification & Wiring(21, 현재; read-only)** → Enforcement(22, **미도입**). Harness 순서는 H1 → H2 → H3 → H4 → H4.5 → H5 → H5.5 → H6 → H6.5 → H7 → H7.5 → H7.6로 정렬되어 있다.
  - **진단 API의 Harness phase(현재 구현)**: `overlayArchitecturePhase.current`는 **`harness-review-security-issue-planning-layer`**(H6.5)이며, `harnessReviewSecurityIssuePlanningEnabled: true`, `overlayMaturity.harnessReviewSecurityIssuePlanningLayer: true`가 응답에 포함된다(H6 checklist 단계 플래그 `harnessReviewSecurityPreparation*` 등은 호환을 위해 병행 true일 수 있음). **`harnessControlledRuntimeTrialPreparationEnabled: true`**(H10), **`harnessControlledRuntimeGovernanceEnabled: true`**(H10.5), **`harnessRuntimeEnforcementCandidateLayerEnabled: true`**(H11), **`harnessControlledEnforcementGovernanceEnabled: true`**(H11.5), **`harnessRuntimeStabilityPlanningEnabled: true`**(H12), **`harnessRuntimePlanningPriorityEscalationEnabled: true`**(H12.5), **`harnessRuntimePlanningLifecycleGovernanceEnabled: true`**(H13.5), **`harnessRuntimePlanningCoherenceSynchronizationEnabled: true`**(H14), **`harnessRuntimePlanningConsolidationNormalizationEnabled: true`**(H14.5), **`harnessRuntimePlanningDependencyImpactGraphEnabled: true`**(H15), **`harnessRuntimePlanningCriticalityPriorityPropagationEnabled: true`**(H15.5), **`harnessRuntimePlanningTraceabilityReasoningChainEnabled: true`**(H16), **`harnessRuntimePlanningReasoningConsolidationEnabled: true`**(H16.5), **`harnessRuntimePlanningSemanticCompressionEnabled: true`**(H17), **`harnessRuntimePlanningSemanticQualityGateEnabled: true`**(H17.5), **`harnessRuntimePlanningSemanticExplainabilityGraphEnabled: true`**(H18), **`harnessRuntimePlanningSemanticNarrativeConsolidationEnabled: true`**(H18.5), **`harnessRuntimePlanningSemanticVocabularyStabilizationEnabled: true`**(H19), **`overlayMaturity.harnessControlledEnforcementGovernanceLayer: true`**, **`overlayMaturity.harnessRuntimeStabilityPlanningLayer: true`**, **`overlayMaturity.harnessRuntimePlanningPriorityEscalationLayer: true`**, **`overlayMaturity.harnessRuntimePlanningLifecycleGovernanceLayer: true`**, **`overlayMaturity.harnessRuntimePlanningCoherenceSynchronizationLayer: true`**, **`overlayMaturity.harnessRuntimePlanningConsolidationNormalizationLayer: true`**, **`overlayMaturity.harnessRuntimePlanningDependencyImpactGraphLayer: true`**, **`overlayMaturity.harnessRuntimePlanningCriticalityPriorityPropagationLayer: true`**, **`overlayMaturity.harnessRuntimePlanningTraceabilityReasoningChainLayer: true`**, **`overlayMaturity.harnessRuntimePlanningReasoningConsolidationLayer: true`**, **`overlayMaturity.harnessRuntimePlanningSemanticCompressionLayer: true`**, **`overlayMaturity.harnessRuntimePlanningSemanticQualityGateLayer: true`**, **`overlayMaturity.harnessRuntimePlanningSemanticExplainabilityGraphLayer: true`**, **`overlayMaturity.harnessRuntimePlanningSemanticNarrativeConsolidationLayer: true`**, **`overlayMaturity.harnessRuntimePlanningSemanticVocabularyStabilizationLayer: true`**도 동일 응답에 포함된다. assembly plan 안정화 등 **이전 Overlay 단계**의 phase 문자열과는 별개이다.
- **Soft policy + warning wire**: `overlayPolicy.ts` + **`overlayPolicyWarning.ts`** + **`overlayPolicyWarningSummary.ts`** — `buildOverlayPolicyWarnings`·`summarizeOverlayPolicyWarnings`(코드/역할/출처 집계 포함); read-only 리포트 묶음 **`overlayWarningReport.ts`**(`buildOverlayWarningReport`). SingleChat `buildOrchestrationOverlayPromptTraceAugments`가 `overlayPolicyHints`와 **`overlayPolicyWarnings`** 를 함께 기록. `requirementsStateJson` 타임라인은 `coerceRequirementsPromptTimelineEntry`가 **`parseOverlayPolicyWarningsFromUnknown`** 으로 경고를 보존(행당 최대 `OVERLAY_POLICY_WARNINGS_MAX_TIMELINE`; 알 수 없는 severity는 **`warning`** 으로 정규화). **`cursorCapabilityEnforcement`는 항상 `not_applied`** (Cursor launch 비변경).
- **워크스페이스 카탈로그 → 계약 역할**: `overlayIdentityFromWorkspace.ts` — `validateWorkspaceAiMemberOverlayMappings` / `listUnmappedWorkspaceAiMemberKeys`로 카탈로그 키 누락 진단.
- **프로젝트 진단 스냅샷**: `overlayProjectDiagnostic.ts` — 서비스 기획 `selectedAgents` 기준 resolve·분포.
- **프롬프트 타임라인 추출**: `overlayPromptTraceExtract.ts` — `extractOverlayPromptTraceMetadata`가 hints·**warnings** 포함; 진단 API `?projectId=` 시 마지막 타임라인 행에 대해 호출.
- **진단 API**: `GET /api/diagnostics/overlay-runtime` — **`overlayPolicyWarningSummary`**, **`overlayWarningReport`**, **`overlayArchitecturePhase`**, **`overlayMaturity`**, **`enforcementStatus`**, Harness·Review/Security·**H6.5** 요약 필드(`reviewSecurityIssuePlanningSummary`, `remediationLoopSummary`, `recentReviewSecurityIssueSummary` 등), **`resourceOrchestrationPlanningSummary`**(H9), **`resourcePressureSummary`·`overlayOverloadSummary`·`operatorRuntimeSummary`**(H9.5), **`runtimeTrialReadiness`·`runtimeRiskSummary`·`runtimeSimulationSummary`**(H10), **`runtimeGovernanceSummary`·`rollbackSafetyPlanning`·`runtimeAuditabilitySummary`**(H10.5), **`runtimeEnforcementCandidate`·`runtimeEnforcementRiskSummary`·`candidateCapabilityPlanning`**(H11), **`controlledEnforcementGovernance`·`governanceDependencyPlanning`·`governanceRiskSummary`**(H11.5), **`runtimeStabilitySummary`·`runtimeCandidateConflictReport`·`candidateSaturationSummary`**(H12), **`runtimePlanningDependencyReport`·`runtimeEscalationSummary`·`runtimePlanningBottleneckSummary`**(H12.5), **`runtimePlanningFreshnessSummary`·`runtimePlanningDriftReport`·`runtimePlanningInvalidationSummary`**(H13.5), **`runtimePlanningCoherenceSummary`·`runtimePlanningSynchronizationSummary`·`runtimePlanningDivergenceReport`**(H14), **`unifiedRuntimePlanningSummary`·`runtimePlanningRedundancySummary`**(H14.5), **`runtimePlanningDependencyGraph`·`runtimePlanningImpactPropagationSummary`·`runtimePlanningDependencyConflictSummary`**(H15), **`runtimePlanningCriticalitySummary`·`runtimePriorityPropagationSummary`·`runtimeEscalationPriorityFlowSummary`**(H15.5), **`runtimePlanningReasoningChain`·`runtimeDependencyReasoningTraceSummary`·`runtimePriorityReasoningTraceSummary`**(H16), **`unifiedRuntimeReasoningChain`·`runtimeReasoningRedundancySummary`·`normalizedRuntimeReasoningTrace`**(H16.5), **`runtimeSemanticGroups`·`compressedRuntimeReasoningTrace`·`runtimeSemanticRedundancySummary`·`stabilizedRuntimeSemanticOrdering`**(H17), **`runtimeSemanticCompressionQualityReport`·`runtimeHiddenSemanticTraceAudit`·`runtimeSemanticGroupBalanceSummary`**(H17.5), **`runtimeSemanticExplainabilityGraph`·`runtimeSemanticWarningOriginSummary`·`runtimeSemanticExplosionRiskSummary`**(H18), **`runtimeSemanticNarrativeSummary`·`runtimeSemanticRootCauseGroups`·`runtimeSemanticGraphRelevanceSummary`**(H18.5), **`runtimeSemanticVocabularySummary`·`runtimeSemanticNormalizedLabels`·`runtimeSemanticPriorityVocabulary`**(H19), `?roles=`, `workspaceAiMemberOverlayMappings`, 선택 `?projectId=` (세션 + `canViewProject`) 시 `projectOverlay`·`lastPromptTraceOverlayExtract`( **`reviewSecurityIssuePlanningReport`** · **`remediationLoopPlan`** 포함).
- **Review Harness**: `executionReviewWithAiMembers.ts` — 스텝에 **`overlayPolicyWarnings`**(JSON 리뷰 **판단 로직 비영향**); 반환에 **`overlayWarningCount`**·**`overlayWarningSummary`**(감사용 집계, decision 비영향). `evaluateExecutionResult`가 동일 metadata를 optional로 노출.
- **Runtime Diagnostic / Selection Preparation (5단계, 적용됨)** — 모두 read-only optional metadata. **prompt 본문·OpenAI payload·라우팅 비변경**, **자동 orchestration / 자동 retrieval / 자동 provider 선택 없음**.
  - `overlayContextSelection.ts` — `buildOverlaySelectedContextRefs`(역할·memory scope·knowledge hint·timeline·workspace·policy refs를 priority 정렬된 selection metadata로) / `summarizeOverlaySelectedContextRefs`.
  - `overlayContextBudget.ts` — `buildOverlayContextBudgetMetadata`(4 chars≈1 token 휴리스틱; `compact|balanced|default|extended` 정책 + `low|medium|high` overflowRisk) / `summarizeOverlayContextBudgetMetadata`. 실제 토큰 측정 아님.
  - `overlayConflictDetection.ts` — `detectOverlayConflicts`(키워드 휴리스틱; `localStorage vs JWT`, `session vs stateless`, `monolith vs microservice`). **warning only**. 행당 최대 `OVERLAY_CONFLICT_WARNINGS_MAX`(detect·parser 공통).
  - `overlayOrchestrationDecisionTrace.ts` — `buildOverlayOrchestrationDecisionTrace`(왜 그 역할이 선택되었는지 replay·감사용).
  - **augment 연결**: `overlayPromptTraceAugment.buildOrchestrationOverlayPromptTraceAugments`가 `timelineMessages`(user/assistant/bootstrap/orchestration text)를 받아 `detectOverlayConflicts`를 호출해 `overlayConflictWarnings`를 실제로 생성한다. budget metadata는 `promptLength → promptText.length → JSON.stringify(meta+refs)` fallback heuristic으로 **항상 생성**된다(실토큰 측정 아님).
  - **PromptTrace 직렬화**: `requirementsStateJson` 타임라인 entry가 optional **`overlaySelectedContextRefs`**·**`overlayContextBudget`**·**`overlayConflictWarnings`**·**`overlayOrchestrationDecisionTrace`** 보존. `coerceOverlayPromptTracePreparationMetadata`가 extract/coerce 양쪽에서 동일 dispatch를 공유. 행당 selection 최대 `OVERLAY_SELECTED_CONTEXT_REFS_MAX`, conflict 최대 `OVERLAY_CONFLICT_WARNINGS_MAX`(invalid category/severity 행은 drop).
  - **진단 API 확장**: `overlay-runtime` 응답에 **`overlaySelectionSummary`**·**`overlayConflictSummary`**·**`overlayContextBudgetSummary`** 추가(`?projectId=` 동반 시 마지막 promptTrace 기반).
- **Policy-guided Context Assembly Preparation (6단계, 적용됨)** — 모두 read-only **planning metadata**. 실제 prompt assembly·자동 pruning·자율 orchestration **여전히 금지**.
  - `overlayContextAssemblyPlan.ts` — `buildOverlayContextAssemblyPlan`(selection refs → `{type, source, priority, includeReason, estimatedCost, pruningCandidate, includeMode}` plan items, role은 plan에서 제외).
  - `overlayContextPrioritization.ts` — `prioritizeOverlayContexts({contexts, budgetPolicy})` — `compact|balanced|default|extended` 별 type weight로 selection refs sorting only.
  - `overlayContextPruning.ts` — `suggestOverlayPruningCandidates`. **suggestion only**.
  - `overlayPolicyDriftWarning.ts` — `detectOverlayPolicyDrift`. **warning only**(`enforcement: "not_applied"`).
- **Harness Phase H3 — Role-aware Knowledge Activation Harness (12단계, 현재; planning metadata only)** — "AI 역할·프로젝트 단계·작업 유형에 따라 어떤 지식팩이 왜 활성화 후보가 되었는가"를 설명 가능한 구조로 만든다. **실제 retrieval query, vector search, prompt payload, LLM 호출, provider, Cursor execution, GitHub PR/merge 어디에도 영향 없음.**
  - **신규 모듈** (`apps/web/src/lib/harness/knowledgeActivation/`):
    - `knowledgeActivationPolicyTypes.ts` — `KnowledgeActivationPriority`(`required`/`recommended`/`optional`), `KnowledgeActivationReasonType`(`role_policy`/`stage_policy`/`task_type_policy`/`project_context`/`manual_selection`/`safety_requirement`/`existing_hint`), `KnowledgeActivationPlanItem`, `KnowledgeActivationFinding { code, severity: "info"|"warning", message }`, `KnowledgeActivationPlan { mode: "dry_run", roleKey, workspaceStage, taskType, items, findings }`, `KnowledgeActivationSummary`. mode는 타입 시스템에서 `"dry_run"` only로 강제(apply가 아닌 planning).
    - `knowledgeActivationRolePolicy.ts` — 역할별 지식팩 후보 단일 출처(planner / architect / developer / security / reviewer / analyst / designer). kebab-case `knowledgePackId`만 사용해 향후 지식팩 등록 체계와 충돌을 방지.
    - `knowledgeActivationStagePolicy.ts` — 단계별 정책(`idea-refinement`/`service-flow`/`feature-definition`/`prototype-build`/`prototype-review`/`security-review`) + alias 정규화(`ideation` → `idea-refinement` 등).
    - `knowledgeActivationTaskPolicy.ts` — 작업 유형 정책(`planning`/`analysis`/`architecture`/`design`/`development`/`review`/`security`/`deployment`) + 역할-스타일 alias 매핑.
    - `deriveKnowledgeActivationTaskType.ts` — `decisionAxis` → `roleKey` → `workspaceStage` 순으로 안전한 단일 task type을 추론(실패 시 null).
    - `buildKnowledgeActivationPlan.ts` — role + stage + task policy 후보 + 기존 `overlayKnowledgeActivationHints`를 dedupe + `required > recommended > optional` priority merge + reasonType rank 기반 결정론적 정렬. 상한(`KNOWLEDGE_ACTIVATION_ITEMS_MAX=24`, `KNOWLEDGE_ACTIVATION_FINDINGS_MAX=6`). `NO_*_POLICY_MATCH`/`NO_KNOWLEDGE_HINTS`/`DUPLICATE_PACK_MERGED` finding 생성.
    - `knowledgeActivationCoerce.ts` — replay/persist 안전 파싱. mode 강제, 잘못된 priority는 `optional` fallback, 잘못된 reasonType drop, items/findings 상한 cap(64 / 16).
  - **PromptTrace 통합**: `RequirementsPromptTimelineEntry.knowledgeActivationPlan?` optional 필드 추가. `overlayPromptTraceAugment`가 plan을 만들어 attach → `coerceRequirementsPromptTimelineEntry` / `extractOverlayPromptTraceMetadata`가 replay 시 복원. 기존 `overlayKnowledgeActivationHints`는 그대로 유지하며 plan builder의 입력으로만 사용(payload 영향 없음).
  - **Diagnostic API**: `GET /api/diagnostics/overlay-runtime?projectId=...` 응답에 `knowledgeActivationSummary { mode, total, required, recommended, optional, rolePolicyDriven, stagePolicyDriven, taskTypePolicyDriven, existingHintDriven, findingsCount }` 추가. `harnessRoleAwareKnowledgeActivationEnabled: true`, `overlayMaturity.harnessRoleAwareKnowledgeActivationLayer: true`.
  - **Overlay UI**: 신규 `OverlayKnowledgeActivationSection` — Overlay 탭에서 plan 헤더(역할/단계/작업 유형 · 후보 수/우선순위 분포 · 사유 분포) + 후보 카드 리스트(priority/reasonType 배지, 사유 라벨, 컨텍스트 힌트) + finding list. "이 정보는 실제 검색/검색결과 주입이 아니라, 현재 역할과 단계 기준으로 어떤 지식팩을 고려할지 정리한 계획 정보입니다." 안내 고정.
  - **UI adapter** (`apps/web/src/lib/overlay-ui/knowledgeActivationUiAdapter.ts`): `KnowledgeActivationPlan` → VM. 한국어 priority/reasonType/severity 라벨(`필수`/`추천`/`선택`, `역할 기준`/`단계 기준`/`작업 유형 기준`/`기존 힌트`/`보안 기준`). 잘못된 mode/null → `hasData: false` 안전 fallback.
  - **테스트**: 7 (role) + 6 (stage) + 5 (task) + 5 (derive task) + 8 (planner) + 10 (coerce) + 9 (UI adapter) = 50 신규. harness + overlay-ui 통합 **168/168 통과**.
  - **여전히 금지**: 실제 retrieval orchestration, vector search control, automatic retrieval, actual prompt injection, provider routing, hard enforcement, automatic pruning, selectedAgents/platformAiMembers 구조 변경, DB schema·Prisma 변경, "지식팩이 활성화/주입되었다" 단정 표현, 적용 트리거 UI.

- **Harness Phase H4 Preparation — Memory Runtime Harness (13단계; planning metadata only)** — "AI가 이번 턴에 어떤 기억을 왜 참조 후보로 삼았는가"를 설명 가능한 구조로 만든다. **실제 prompt payload, LLM 호출, retrieval, vector DB, provider, Cursor execution, GitHub PR/merge 어디에도 영향 없음.**
  - **신규 모듈** (`apps/web/src/lib/harness/memoryRuntime/`):
    - `memoryRuntimeTypes.ts` — `MemoryScopeType`(기존 `MemoryScope` 재사용으로 단일 출처), `MemoryFreshness`(`fresh` / `aging` / `stale`), `MemoryRuntimeReference { memoryId, scope, summary, freshness, selectedReason, selectedBy, estimatedImportance }`, `MemoryRuntimeFinding { code, severity, message }`, `MemoryRuntimePlan { mode: "dry_run", roleKey, references, findings }`, `MemoryRuntimeSummary`. mode는 타입 시스템에서 강제(`"dry_run"` only).
    - `memoryRuntimeRolePolicy.ts` — 역할별 선호 스코프/키워드 단일 출처. 7개 역할(planner/architect/developer/security/reviewer/analyst/designer) + `MEMORY_RUNTIME_DEFAULT_POLICY` fallback. role key 정규화(`AI_PLANNER` / `ai-Architect` → `planner`/`architect`).
    - `evaluateMemoryFreshness.ts` — `MEMORY_FRESHNESS_THRESHOLDS_MS` 상수화. fresh ≤ 24h, aging ≤ 14d, 그 외 stale. `conflictDetected: true`이면 즉시 stale(`conflict_demoted`), 미래 시각은 보수적으로 aging(`future_timestamp`).
    - `buildMemoryRuntimePlan.ts` — overlay metadata + 최근 timeline + working context를 입력으로 결정론적 references 생성. 출처별 dedupe(`overlay:` / `timeline:` / `working:` prefix), 중요도 정렬 후 스코프 우선순위 → memoryId asc 안정 정렬. 상한(`MEMORY_RUNTIME_REFERENCE_MAX=12`, `MEMORY_RUNTIME_FINDINGS_MAX=6`).
    - `memoryRuntimeCoerce.ts` — replay/persist 안전 파싱. mode 강제, malformed reference/finding 조용히 drop, 상한 cap(64 refs, 16 findings).
  - **PromptTrace 통합**: `overlayPromptTraceAugment`가 plan을 만들어 `RequirementsPromptTimelineEntry.memoryRuntimePlan?`로 attach. `requirementsIdeationBootstrapPromptTimeline.coerceRequirementsPromptTimelineEntry`/`overlayPromptTraceExtract.extractOverlayPromptTraceMetadata`가 replay 복원.
  - **Diagnostic API**: `GET /api/diagnostics/overlay-runtime?projectId=...` 응답에 `memoryRuntimeSummary { mode, total, fresh, aging, stale, platformScoped, projectScoped, roleScoped, sessionScoped, workingScoped, findingsCount }` 추가. `overlayArchitecturePhase.current = "harness-memory-runtime-preparation-layer"`, `harnessMemoryRuntimePlanningEnabled: true`, `overlayMaturity.harnessMemoryRuntimePreparationLayer: true`.
  - **Overlay UI**: 신규 `OverlayMemoryRuntimeSection` — Overlay 탭 안에서 plan 헤더(역할·후보 수·freshness 분포·스코프 분포) + 후보 카드 리스트(스코프/freshness 배지, 사유, 선택자, 중요도) + finding list. "이 표시는 실제 장기 기억이 아니라, 이번 턴에서 AI가 참조 후보로 삼은 메모리 계획입니다." 안내 고정.
  - **UI adapter** (`apps/web/src/lib/overlay-ui/memoryRuntimeUiAdapter.ts`): `MemoryRuntimePlan` → VM 변환. 한국어 라벨(H4.5에서 `최신`/`확인 필요`/`오래됨·충돌 가능`으로 보강), 잘못된 mode/null → `hasData: false` 안전 fallback.
  - **테스트**: 6 (role policy) + 7 (freshness) + 8 (planner) + 9 (coerce) + 7 (UI adapter) = 37 신규. harness + overlay-ui 통합 **110/110 통과**.
  - **여전히 금지**: 실제 prompt payload·LLM call payload 변경, retrieval orchestration, vector DB orchestration, provider switching, hard enforcement, automatic pruning, memory persistence orchestration, autonomous memory update, DB schema·Prisma 변경, selectedAgents/platformAiMembers 구조 변경, "실제 long-term memory" 단정 표현, 적용 트리거 UI.

- **Harness Phase H6 Preparation — Review / Security Harness (17단계; planning metadata only)** — "AI검수자(AI Reviewer)와 AI보안관(AI Security Auditor)이 어떤 기준으로 결과물을 검토해야 하는가"를 review/security checklist planning metadata로 설명한다. **실제 보안 스캔·코드 리뷰 실행·이슈 등록·머지 차단·PR 게이트·remediation 자동 실행 어디에도 영향 없음.** 정책 표는 강제 규칙이 아니라 **검토 기준 추천**일 뿐이다.
  - **신규 모듈** (`apps/web/src/lib/harness/reviewSecurity/`):
    - `reviewSecurityHarnessTypes.ts` — `ReviewSecurityPlanMode = "dry_run_review_security"`, `ReviewSecurityArea`(8종: `requirements`/`architecture`/`uiux`/`code_quality`/`security`/`privacy`/`deployment`/`operations`), `ReviewSecuritySeverity`(`info`/`warning`/`critical_candidate`), `ReviewSecurityStandard`(6종: `jy_orchestration_baseline`/`owasp_top10`/`owasp_llm_top10`/`owasp_asvs`/`mitre_cwe_top25`/`internal_quality_standard`), `ReviewSecurityChecklistItem`, `ReviewSecurityFinding`, `ReviewSecurityHarnessPlan { mode, roleKey, workspaceStage, checklist, findings }`, `ReviewSecuritySummary`(영역별 count + criticalCandidates + findingsCount), `summarizeReviewSecurityHarnessPlan`, `empty*` helper, 카탈로그 키 export.
    - `reviewSecurityStandardPolicy.ts` — 역할(`reviewer`/`security`/`planner`/`architect`)별 표준 checklist 표(예: `reviewer` → 요구사항 충족도/UI/UX 일관성/품질 기준/기능 흐름; `security` → OWASP Top 10/OWASP LLM Top 10/ASVS/CWE Top 25/PII). `REVIEW_SECURITY_CODE_CAPABILITY_BOOSTERS`(code_generation/cursor_execution 감지 시 정적 점검 + 코드 변경 보안 검토 보강), `REVIEW_SECURITY_STAGE_BOOSTERS`(stage 키워드 매칭: deploy → 릴리스 안전성, ops → 관찰성), `REVIEW_SECURITY_SECURITY_KNOWLEDGE_BOOSTERS`(security 지식팩 활성화 시 LLM 프롬프트 처리 점검). severity rank/area·standard 표시 순서 단일 출처.
    - `buildReviewSecurityHarnessPlan.ts` — `buildReviewSecurityHarnessPlan({ roleKey, workspaceStage, executionRoutingPlan, knowledgeActivationPlan, memoryRuntimePlan }): ReviewSecurityHarnessPlan`. 결정론적 정렬(severity desc → area order → standard order → id asc), 상한(`REVIEW_SECURITY_CHECKLIST_MAX = 24`, `REVIEW_SECURITY_FINDINGS_MAX = 6`). findings: `NO_REVIEW_ROLE_MATCH`/`SECURITY_REVIEW_RECOMMENDED`/`CODE_GENERATION_WITHOUT_SECURITY_CHECKLIST`/`SECURITY_KNOWLEDGE_ACTIVATION_PRESENT`/`REVIEW_PLAN_DRY_RUN_ONLY`(항상 노출).
    - `reviewSecurityHarnessCoerce.ts` — `parseReviewSecurityHarnessPlanFromUnknown`/`coerceReviewSecurityHarnessMetadata`. `mode === "dry_run_review_security"`만 허용. invalid area/standard 누락 → row drop, invalid severity → `"info"` fallback, 중복 id 제거, 상한 cap(checklist 32, findings 12).
    - `reviewSecurityRecentSummary.ts` — `summarizeRecentReviewSecurityPlans({ plans }): RecentReviewSecuritySummary { sampledEntryCount, planEntryCount, totalChecklistItems, securityItemRate, codeQualityItemRate, criticalCandidateRate, findingRate }`. item 단위 rate + plan 단위 findingRate, 정밀도 0.0001.
  - **PromptTrace 연결**:
    - `RequirementsPromptTimelineEntry.reviewSecurityHarnessPlan?` optional 추가.
    - `overlayPromptTraceAugment`가 H3/H4/H5 plan 직후 `buildReviewSecurityHarnessPlan`을 호출해 attach. 입력은 `roleKey` + `workspaceStage` + H5 plan + H3 plan + H4 plan.
    - `overlayPromptTraceExtract`와 `requirementsIdeationBootstrapPromptTimeline`가 `coerceReviewSecurityHarnessMetadata`로 안전 복원.
  - **Diagnostic API**(`/api/diagnostics/overlay-runtime`):
    - 신규 응답 필드: `reviewSecuritySummary`, `recentReviewSecuritySummary`.
    - phase flag 업데이트: `overlayArchitecturePhase.current = "harness-review-security-preparation-layer"`, `harnessReviewSecurityPreparationEnabled: true`, `overlayMaturity.harnessReviewSecurityPreparationLayer: true`.
  - **Overlay UI 보강** (`apps/web/src/lib/overlay-ui/reviewSecurityUiAdapter.ts`, `apps/web/src/components/orchestration/overlay/OverlayReviewSecuritySection.tsx`):
    - area/standard/severity/reason 한국어 라벨 + tone 매핑. `ReviewSecurityPlanVM { hasData, disclaimer, roleValue, stageValue, totalLabel, criticalCandidatesLabel, areaBreakdown, standardLabels, items, findings }`, `ReviewSecurityRecentTrendVM`.
    - `OverlayReviewSecuritySection` — Overlay 탭에서 checklist 카드 리스트(area·standard·severity 배지 + 사유 라벨) + finding 리스트 표시. plan disclaimer 고정: "이 정보는 실제 보안 차단이나 머지 게이트가 아니라, 현재 역할과 단계 기준으로 어떤 검토 기준을 적용할지 보여주는 계획 정보입니다."
    - `OverlaySummaryCard`/`overlayUiAdapter`에 `reviewSecurity` section default 추가(데이터 있을 때만 펼침).
  - **하드코딩 방지 원칙**:
    - role policy / code capability booster / security knowledge booster는 모두 **검토 기준 추천**일 뿐 actual issue 등록·머지 차단·remediation 실행이 아니다.
    - `mode !== "dry_run_review_security"`는 모두 reject. severity 잘못 입력은 `"info"`로 흡수.
  - **테스트**: 10 (builder; 결정론·boosters·findings) + 8 (coerce; mode reject·area drop·severity fallback·dup id·findings drop) + 5 (recent summary; security/codeQuality/critical rate·plan-level finding) + 12 (UI adapter; VM·recent trend·label helper) = 35 신규. 누적 harness + overlay + overlay-ui **377/377 통과**, `tsc --noEmit` clean, 린트 무경고.
  - **여전히 금지**: actual merge blocking, actual PR gate, automatic security blocking, automatic remediation, actual security scan, actual code review execution, automatic issue registration, Cursor execution 변경, GitHub PR/merge 로직 변경, Stage1/Stage2/ENV_TEST 변경, provider switching, retrieval orchestration, vector search, actual prompt payload/LLM call payload 변경, DB migration·Prisma schema·selectedAgents/platformAiMembers 구조 변경, breaking API 변경.

- **Harness Phase H6.5 — Review / Security Safety & Issue Planning Stabilization (18단계, 현재; planning metadata only)** — H6 checklist·H5.5 execution routing safety·H4 stale memory를 입력으로 **issue 후보(실제 티켓 아님)** 와 **remediation loop 계획(실제 task·Cursor 실행 아님)** 을 구조화한다. **실제 이슈 등록·머지 차단·조치 실행·재점검 자동화·PR 게이트 어디에도 영향 없음.**
  - **신규 모듈** (`apps/web/src/lib/harness/reviewSecurity/`): `reviewSecurityIssueTypes.ts`, `buildReviewSecurityIssuePlanningReport.ts`, `buildRemediationLoopPlan.ts`, `reviewSecurityIssueCoerce.ts`, `reviewSecurityIssueRecentSummary.ts` (`summarizeRecentReviewSecurityIssuePlans`).
  - **PromptTrace**: `RequirementsPromptTimelineEntry`에 `reviewSecurityIssuePlanningReport?`, `remediationLoopPlan?` optional. `overlayPromptTraceAugment`가 H6 직후 빌드·attach; timeline coerce + `extractOverlayPromptTraceMetadata`가 `coerceReviewSecurityIssuePlanningMetadata`로 복원.
  - **Diagnostic API** (`/api/diagnostics/overlay-runtime`): `reviewSecurityIssuePlanningSummary`, `remediationLoopSummary`, `recentReviewSecurityIssueSummary`. `overlayArchitecturePhase.current = "harness-review-security-issue-planning-layer"`, `harnessReviewSecurityIssuePlanningEnabled: true`, `overlayMaturity.harnessReviewSecurityIssuePlanningLayer: true` (H6 maturity 플래그는 호환상 유지).
  - **Overlay UI**: `reviewSecurityIssueUiAdapter.ts`, `OverlayReviewSecurityIssueSection`, `OverlayRemediationLoopSection`; `OverlaySummaryCard`/`overlayUiAdapter`에 issue·remediation 섹션 default. 고정 disclaimer: 검토 결과를 조치 후보로 **정리하는 계획 정보**이며 실제 이슈 등록·머지 차단이 아님.
  - **단위 테스트**: `buildReviewSecurityIssuePlanningReport`·`buildRemediationLoopPlan`·`reviewSecurityIssueCoerce`·`reviewSecurityIssueRecentSummary`·`reviewSecurityIssueUiAdapter` 등 harness/overlay-ui 경로.
  - **여전히 금지**: H6와 동일 + **actual issue registration**, **actual remediation execution**, automatic recheck/merge gate.

- **Harness Phase H7 — Message-level Explainability UI (19단계, 현재; read-only)** — Prompt Timeline에 쌓인 harness·overlay metadata를 **해당 AI 응답 메시지**에 `extractOverlayPromptTraceMetadata` 스냅샷으로 붙이고(`messageOverlayExplainability`), SingleChat에서 `[AI 판단 보기]`로 요약 패널을 연다. **프롬프트·LLM 페이로드·라우팅·실행·이슈 등록 변경 없음.** 사용자 메시지에는 표시하지 않으며, 메타가 없으면 버튼을 숨긴다.
  - **신규 모듈**: `messageExplainabilityTypes.ts`, `buildMessageExplainabilityViewModel.ts`, `messageExplainabilityUiAdapter.ts`; UI는 `RequirementsMessageExplainability` + `RequirementsChatPanel` AI 분기.
  - **여전히 금지**: H6.5와 동일 + raw JSON·전체 plan 리스트·과도한 내부 키 노출(요약 전용).

- **Harness Phase H7.5 — Explainability UX Stabilization (20단계, 현재; read-only)** — SingleChat 사용자용 요약 UX를 안정화한다. `resolveMessageExplainabilityTrace`로 meta 직접 보유 → 타임라인 `responseText` 단일 일치 → `orchestratorAgent`+시간창 단일 후보 순으로만 보조 매핑하고, 불명확하면 null이다. `MessageExplainabilityPanel`로 패널 UI를 분리하고(720px 이하 전체폭 토글 등), 워크스페이스 `promptTimelineUi`와 프롬프트 드로어 열기 콜백을 채팅에 내려 「프롬프트 이력에서 자세히 보기」를 선택 제공한다. `NEXT_PUBLIC_JY_EXPLAINABILITY_DEBUG=1`일 때만 메타 없는 AI 메시지에 empty 안내를 노출한다.
  - **단위 테스트**: `resolveMessageExplainabilityTrace`, `messageExplainabilityPanel`(SSR 스모크) 등 `tests/harness/explainability/`.
  - **여전히 금지**: H7과 동일(실행·페이로드·스키마 변경 없음).

- **Harness Phase H7.6 — SingleChat Explainability Integration Verification & Wiring (21단계, 현재; read-only)** — `RequirementsChatPanel` AI 분기 하단에 `RequirementsMessageExplainability`를 고정 연결하고, `resolveMessageExplainabilityTraceWithConfidence`로 **`confidence: direct | response_text | role_time | none`** 를 노출한다. UI는 **`confidence !== "none"` 이고 ViewModel `hasData`** 일 때만 `[AI 판단 보기]` 패널을 연다(잘못된 trace 첨부 방지). 신규 API·DB 조회 없음.
  - **신규 타입**: `messageExplainabilityTraceResolution.ts` — `MessageExplainabilityTraceResolution`.
  - **여전히 금지**: H7.5와 동일.

- **Harness Phase H5.5 — Execution Routing Safety & Explainability Stabilization (16단계; planning metadata + dry-run safety diagnostic only)** — H5의 plan이 "실제 실행"으로 오해되거나 자동 연결되지 않도록 safety guard·explainability·누적 진단을 보강한다. **여전히 실제 provider switching, execution routing, automatic Cursor execution, GitHub operation, execution blocking 어디에도 영향 없음.** 정책 테이블은 강제 규칙이 아니라 capability **추천** / capability **compatibility reference**일 뿐이다.
  - **신규 모듈** (`apps/web/src/lib/harness/executionRouting/`):
    - `executionRoutingSafetyTypes.ts` — `ExecutionRoutingSafetyStatus`(`safe_dry_run`/`watch`/`unsafe_to_apply`), `ExecutionRoutingSafetyFinding { code, severity: "info"|"warning", message }`, `ExecutionRoutingSafetyReport { mode: "dry_run_safety", status, providerSwitchingEnabled: false, executionBlockingEnabled: false, automaticExecutionEnabled: false, unsupportedCapabilityCount, warningItemCount, providerHintCount, totalItems, findings }`. **3개 safety flag는 타입 시스템에서 `false` 고정**.
    - `evaluateExecutionRoutingSafety.ts` — `evaluateExecutionRoutingSafety({ plan }): ExecutionRoutingSafetyReport`. 결정론적·read-only. 임계 상수 `EXECUTION_ROUTING_SAFETY_UNSAFE_RATE = 0.5`. 우선순위 규칙:
      - `unsafe_to_apply`: `plan.mode !== "dry_run"` / disabled rate ≥ 0.5 / warning rate ≥ 0.5 / `unknown` provider + 민감 capability(`cursor_execution`/`github_operation`) 동시 존재.
      - `watch`: disabled ≥ 1 / warning ≥ 1 / hint 기반 unsupported(`provider_hint_unsupported:*`) 존재.
      - `safe_dry_run`: 그 외.
      - findings 코드: `MODE_NOT_DRY_RUN`/`HIGH_DISABLED_RATE`/`DISABLED_CAPABILITIES_PRESENT`/`HIGH_WARNING_RATE`/`UNSUPPORTED_PROVIDER_HINT`/`UNKNOWN_PROVIDER_SENSITIVE_CAPABILITY` + `DRY_RUN_SAFETY_PIN`(항상 노출). **어떤 자동 차단/routing/execution도 발생시키지 않음.**
    - `executionRoutingRecentSummary.ts` — `summarizeRecentExecutionRoutingPlans({ plans }): RecentExecutionRoutingSummary { sampledEntryCount, planEntryCount, totalItems, disabledItemRate, warningItemRate, unknownProviderRate, cursorCapabilityRate, githubCapabilityRate, findingRate }`. item 단위 rate + plan 단위 findingRate. 무효 plan은 sampled에는 포함하되 plan/item 모집단에는 제외.
  - **PromptTrace 연결**:
    - `RequirementsPromptTimelineEntry.executionRoutingSafetyReport?` optional 추가(기존 `executionRoutingPlan`은 유지).
    - `overlayPromptTraceAugment`가 H5 plan 직후 `evaluateExecutionRoutingSafety`로 report 계산 → attach.
    - `executionRoutingCoerce.ts`에 `parseExecutionRoutingSafetyReportFromUnknown` 추가, `coerceExecutionRoutingMetadata`가 plan+report를 한 번에 반환. mode reject(`dry_run_safety`만), invalid status → `safe_dry_run` fallback, 안전 플래그는 입력 무관 `false` 고정.
  - **Diagnostic API**(`/api/diagnostics/overlay-runtime`):
    - 신규 응답 필드: `executionRoutingSafetyReport`, `recentExecutionRoutingSummary`(기존 `executionRoutingSummary`는 유지).
    - 우선순위: replay된 safety report가 있으면 우선, 없으면 `lastPromptTraceOverlayExtract.executionRoutingPlan`으로 즉시 평가, 그 외 empty fallback.
    - phase flag 업데이트: `overlayArchitecturePhase.current = "harness-execution-routing-safety-stabilization-layer"`, `harnessExecutionRoutingSafetyStabilizationEnabled: true`, `overlayMaturity.harnessExecutionRoutingSafetyStabilizationLayer: true`.
  - **Overlay UI 보강** (`apps/web/src/lib/overlay-ui/executionRoutingUiAdapter.ts`, `apps/web/src/components/orchestration/overlay/OverlayExecutionRoutingSection.tsx`):
    - reason raw key → 사용자 친화 라벨 매핑: `role_policy_recommended:* → 역할 정책상 추천`, `provider_hint_matched:* → 외부 힌트와 일치`, `provider_hint_unsupported:* → 외부 힌트와 capability 불일치`, `no_provider_recommendation → 추천 provider 없음`.
    - `ExecutionRoutingSafetyVM { hasData, disclaimer, statusLabel, statusTone, status, summaryLine, flags, findings }` — flags는 `Provider 자동 전환 안 함` / `실행 차단 안 함` / `자동 실행 안 함`를 `positive` 톤 배지로 표시(모두 `false` 고정).
    - `ExecutionRoutingRecentTrendVM` — 누적 rate를 0–100% 정수 라벨로 표현(미지원 비율/경고 비율/미지정 provider/Cursor 계열/GitHub/진단 발생 plan).
    - `OverlayExecutionRoutingSection`이 상단에 Safety block(상태 배지 + flag 배지 + disclaimer + 안전 findings) 표시. plan disclaimer 카피 변경: "이 정보는 실제 실행 경로가 아니라, 현재 역할 기준으로 고려 가능한 실행 capability 계획입니다." safety disclaimer: "이 보고서는 실제 실행 경로가 아니라, 현재 역할 기준으로 고려 가능한 실행 capability 계획에 대한 안전 진단입니다. provider 자동 전환·실행 차단·자동 실행은 모두 비활성화되어 있습니다."
  - **하드코딩 방지 원칙**:
    - role policy는 default **recommendation**, provider matrix는 capability **compatibility reference**.
    - final routing decision은 별도 승인/정책/사용자 확인 이후 단계.
    - `mode !== "dry_run"`, `mode !== "dry_run_safety"`는 모두 reject.
  - **테스트**: 9 (safety evaluator; 모드/임계/민감 capability/플래그 고정) + 6 (recent summary; 비율/finding/잘못된 plan 처리) + 8 (UI adapter 추가; reason 라벨/safety VM/recent trend VM) + 5 (coerce 추가; safety mode reject/플래그 강제/잘못된 finding drop/통합) = 28 신규/갱신. 누적 harness + overlay + overlay-ui **342/342 통과**, `tsc --noEmit` clean.
  - **여전히 금지**: 실제 provider switching, execution routing, automatic Cursor execution, GitHub operation 자동 실행, hard enforcement, execution blocking, provider lock-in, retrieval orchestration, vector search, actual prompt payload/LLM call payload 변경, Stage1/Stage2/ENV_TEST/Cursor execution 로직, GitHub PR/merge 로직 변경, DB migration·Prisma schema·selectedAgents/platformAiMembers 구조 변경, breaking API 변경.

- **Harness Phase H5 Preparation — Execution Routing Harness (15단계; planning metadata only)** — "어떤 AI멤버가 어떤 실행 capability를 가질 수 있는가"를 planning metadata로 설명한다. **실제 provider switching, execution routing, automatic Cursor execution, GitHub PR/merge, retrieval orchestration 어디에도 영향 없음.**
  - **신규 모듈** (`apps/web/src/lib/harness/executionRouting/`):
    - `executionCapabilityTypes.ts` — `ExecutionCapability`(planning/analysis/architecture_review/design_review/code_generation/code_review/security_review/quality_review/deployment_review/cursor_execution/github_operation), `ExecutionProviderType`(openai/cursor/github/unknown), `ExecutionRoutingPlanItem { roleKey, capability, provider, enabled, reason, warning? }`, `ExecutionRoutingFinding { code, severity: "info"|"warning", message }`, `ExecutionRoutingPlan { mode: "dry_run", roleKey, workspaceStage, items, findings }`, `ExecutionRoutingSummary`. `mode === "dry_run"`은 타입 시스템에서 강제.
    - `executionRoutingRolePolicy.ts` — 역할별 capability 후보 표: planner=[analysis, planning], architect=[architecture_review, design_review], developer=[code_generation, cursor_execution], security=[security_review], reviewer=[code_review, quality_review], analyst=[analysis], designer=[design_review]. `normalizeExecutionRoutingRoleKey()`로 `AI_PLANNER`/`ai-architect` 등 다양한 형태를 정규화. 매칭 실패 시 빈 default.
    - `providerCapabilityMatrix.ts` — provider별 capability 매트릭스(openai: review/planning/analysis 다수, cursor: code_generation+cursor_execution, github: github_operation). `resolveRecommendedProviderForCapability` 우선순위: **cursor > github > openai > unknown**. `providerSupportsCapability(provider, capability)`.
    - `buildExecutionRoutingPlan.ts` — `buildExecutionRoutingPlan({ roleKey, providerHints, workspaceStage }): ExecutionRoutingPlan`. **결정론적 정렬**(capability asc → provider asc). 우선순위: hint+지원 매치 → hint+미지원(첫 hint 채택, `provider_hint_unsupported:*`) → 추천(`role_policy_recommended:*`) → `unknown`(`no_provider_recommendation`). findings: `NO_ROLE_POLICY_MATCH`(역할 매칭 실패), `NO_PROVIDER_HINTS`(items > 0 + hint 비어 있을 때 info), `UNSUPPORTED_CAPABILITY`(disabled item 존재 시 warning). items≤24, findings≤6.
    - `executionRoutingCoerce.ts` — `parseExecutionRoutingPlanFromUnknown(raw): ExecutionRoutingPlan | null`. `mode !== "dry_run"` reject. 필수 필드(roleKey/capability/reason) 누락 row drop. invalid provider는 `"unknown"` fallback(replay 안정성). invalid severity는 finding drop. 상한 cap(items 64, findings 16).
  - **데이터 흐름**:
    - `overlayPromptTraceAugment`가 `executionRoutingPlan`을 만들어 `RequirementsPromptTimelineEntry.executionRoutingPlan?`로 attach. 기본 호출은 provider hint 없이(역할 + workspaceStage만) 호출해 식별자 provider가 일률 hint로 주입되어 모든 developer turn이 `unsupported`로 표시되는 노이즈를 방지.
    - `requirementsStateJson.RequirementsPromptTimelineEntry`에 optional `executionRoutingPlan?: ExecutionRoutingPlan` 필드 추가.
    - `requirementsIdeationBootstrapPromptTimeline` / `overlayPromptTraceExtract`의 coerce 단계에서 `coerceExecutionRoutingMetadata` 호출로 replay-safe 복원.
  - **Diagnostic API**(`/api/diagnostics/overlay-runtime`): `executionRoutingSummary { mode: "dry_run", total, roles, providers, capabilities, warnings, enabledCount, disabledCount, findingsCount }` 응답 필드 추가. `overlayArchitecturePhase.current = "harness-execution-routing-preparation-layer"`, `harnessExecutionRoutingPlanningEnabled: true`, `overlayMaturity.harnessExecutionRoutingPreparationLayer: true`.
  - **Overlay UI**(`apps/web/src/lib/overlay-ui/executionRoutingUiAdapter.ts`, `apps/web/src/components/orchestration/overlay/OverlayExecutionRoutingSection.tsx`):
    - `ExecutionRoutingPlanVM { hasData, disclaimer, roleLabel, stageLabel, totalLabel, enabledLabel, disabledLabel, providerBreakdownText, capabilityBreakdownText, unsupportedWarning { visible, label, tone }, items, findings }`. 한국어 capability/provider/severity 라벨(기획/분석/Cursor 실행/OpenAI/Cursor/GitHub/안내/주의).
    - `OverlayExecutionRoutingSection`이 Overlay 탭에서 역할별 capability 카드(역할·capability·provider·가능/불가 배지·사유·warning) + finding list 표시. disabled 후보가 있으면 `OverlayUiNoticeBanner`로 강조 경고 배너 노출(`unsupportedWarning`).
    - 필수 안내 문구(disclaimer): **"이 정보는 실제 실행 강제가 아니라, 현재 역할 기준으로 어떤 실행 capability를 고려하는지 보여주는 계획 정보입니다."**
    - `OverlaySummaryCard`에 section 통합. `overlayUiAdapter.sectionDefaults.executionRouting`은 데이터가 있을 때만 펼침.
  - **테스트**: 5 (role policy) + 6 (provider matrix) + 9 (plan builder; 결정론·hint·findings·summary) + 7 (coerce; replay 안정성 포함) + 5 (UI adapter; unsupportedWarning 포함) = 32 신규. 누적 harness + overlay + overlay-ui 통합 **314/314 통과**, `tsc --noEmit` clean.
  - **여전히 금지**: 실제 provider switching, execution routing, automatic Cursor execution, actual retrieval orchestration, hard enforcement, execution blocking, provider lock-in, Stage1/Stage2/ENV_TEST/Cursor execution 로직 변경, GitHub PR/merge 변경, DB migration·Prisma schema·selectedAgents/platformAiMembers 구조 변경, breaking API 변경.

- **Harness Phase H4.5 — Memory Runtime Harness Stabilization (14단계; planning metadata only)** — H4의 입력 품질·scope 판단·stale 탐지·누적 진단·UI 표현을 안정화한다. **여전히 실제 prompt payload, LLM 호출, retrieval, vector DB, provider, Cursor execution, GitHub PR/merge 어디에도 영향 없음.** 장기기억 저장/검색/주입은 도입하지 않는다.
  - **Timeline memory input normalization** (`apps/web/src/lib/harness/memoryRuntime/internal/timelineMemoryInputs.ts`):
    - 신규 `normalizeTimelineMemoryMessages()` — 빈 문자열·10자 미만 noise·동일 문장 중복·`SUCCESS`/`OK`/`undefined`/`null`/`{}`/`[]`/`HTTP 200` 등 디버그 마커·내용 없는 bracket-only 문자열 제거. 한국어 문장은 유지. 메시지당 최대 길이/전체 결과 상한 보호.
    - `extractDirectionalKeywordsFromTimelineMessages` / `buildMemoryRuntimeEntriesFromTimelineMessages` / `pickRecentUserTextFromTimelineMessages`가 normalized 결과만 사용해 single source of truth 확립.
  - **Memory scope classifier** (`memoryRuntimeScopeClassifier.ts`):
    - 신규 `classifyMemoryRuntimeScope({ source, memoryId, roleKey, workspaceScreenKey })` — 우선순위: explicit token(`role-`/`session`/`working`/`project`/`platform`; **role 토큰이 project보다 우선**) → role memory token + roleKey → project memory token → working/workspaceScreenKey 매치 → session memory token → fallback **`working`**.
    - 기존 `resolveMemoryScopeFromSource()`는 그대로 두고, Memory Runtime planner 내부의 timeline/overlay reference 채집에서만 새 classifier 사용.
  - **Stale detection / conflict rules** (`memoryRuntimeConflictRules.ts`):
    - 카테고리별 상반 키워드 테이블: architecture(monolith ↔ microservice, client-side ↔ server-side), auth(session ↔ jwt, cookie ↔ bearer token), storage(localStorage ↔ server DB, sql ↔ nosql), deployment(on-premise ↔ cloud, static hosting ↔ server runtime).
    - `detectMemoryRuntimeDirectionalConflict({ memoryText, currentDirectionalKeywords }): boolean`이 `evaluateMemoryFreshness.conflictDetected` 입력으로 연결되어 stale 강등을 안정화. **warning only** — 실제 메모리 삭제·persistence 영향 없음.
    - `classifyMemoryRuntimeConflictCategory` / `listMemoryRuntimeConflictCategories`는 diagnostic 보조용.
  - **Recent memory runtime summary** (`memoryRuntimeRecentSummary.ts`):
    - 신규 `summarizeRecentMemoryRuntimePlans({ plans }): RecentMemoryRuntimeSummary { sampledEntryCount, planEntryCount, totalReferences, staleReferenceRate, agingReferenceRate, freshReferenceRate, roleScopedRate, projectScopedRate, workingScopedRate, findingRate }`.
    - reference 단위 rate(stale/aging/fresh, role/project/working scope), plan 단위 rate(findingRate). projectId 있을 때 `HARNESS_APPLY_READINESS_DEFAULT_SAMPLE_LIMIT`개 최근 promptTrace 묶음 기준.
  - **Diagnostic API**: `recentMemoryRuntimeSummary` 응답 필드 추가(projectId 없으면 empty fallback). `overlayArchitecturePhase.current = "harness-memory-runtime-stabilization-layer"`, `harnessMemoryRuntimeStabilizationEnabled: true`, `overlayMaturity.harnessMemoryRuntimeStabilizationLayer: true`.
  - **PromptTrace replay coerce 보강** (`memoryRuntimeCoerce.ts`):
    - invalid `scope`는 row drop 대신 **`working` fallback**, invalid `freshness`는 **`aging` fallback**으로 흡수해 replay 안정성 확보. memoryId/summary/selectedReason/selectedBy 같은 필수 필드 누락 row는 그대로 drop.
    - `mode !== "dry_run"` reject, oversized reference truncate(64), findings truncate(16) 정책은 유지.
  - **Overlay UI 보강** (`memoryRuntimeUiAdapter.ts`, `OverlayMemoryRuntimeSection.tsx`):
    - freshness label: `최신`/`확인 필요`/`오래됨·충돌 가능`. 항목 라벨: `선택 사유` / `선택 기준` / `중요도 추정`.
    - plan VM에 `staleWarning { visible, label, tone }` 신규 — stale 후보가 1개 이상이면 섹션 상단 강조 배너로 표시(warning tone).
    - disclaimer: "이 정보는 실제 장기기억 저장 결과가 아니라, 현재 응답에서 참고 후보로 분류한 기억 계획 정보입니다."
  - **테스트**: 6 (normalize) + 7 (scope classifier) + 11 (conflict rules) + 6 (recent summary) + 9 (coerce 갱신) + 8 (UI adapter; staleWarning 포함) = 47 신규/갱신. harness + overlay + overlay-ui 통합 **282/282 통과**.
  - **여전히 금지**: 실제 prompt payload·LLM call payload 변경, retrieval orchestration, vector DB orchestration, provider switching, hard enforcement, automatic pruning, memory persistence orchestration, autonomous memory update, DB schema·Prisma 변경, selectedAgents/platformAiMembers 구조 변경, breaking API 변경, "실제 long-term memory" 단정 표현, 적용 트리거 UI.

- **Harness Phase H2 — Apply-readiness Preparation (11단계; dry-run readiness only)** — 최근 promptTrace를 누적 집계해 "Harness preview가 실제 적용 후보 수준인지" 진단한다. **실제 prompt payload, LLM 호출, retrieval, provider, Cursor execution, GitHub PR/merge 어디에도 영향 없음.**
  - **신규 모듈** (`apps/web/src/lib/harness/promptAssembly/`):
    - `harnessPromptApplyReadinessTypes.ts` — `HarnessPromptApplyReadinessLevel`(`not_ready` / `watch` / `ready_candidate`), `HarnessPromptApplyReadinessFinding { code, severity: "info"|"warning", message }`, `HarnessPromptApplyReadinessReport { mode: "dry_run_readiness", level, sampledEntryCount, previewEntryCount, missingSectionRate, highOverflowRiskRate, warningRate, averageExistingPromptLength, averagePreviewLength, findings }`. mode는 타입 시스템에서 강제(apply가 아닌 readiness).
    - `evaluateHarnessPromptApplyReadiness.ts` — `entries`(가장 오래된 → 최근 순) 끝에서 `sampleLimit`개를 취해 preview/diff 누적 집계. threshold(`HARNESS_APPLY_READINESS_THRESHOLDS`)는 상수화하여 평가/UI/문서가 공유. 임계: not_ready(누락 ≥ 50% · 위험 ≥ 50% · 경고 ≥ 70%), watch(누락 ≥ 20% · 위험 ≥ 20% · 경고 ≥ 30%), 그 외 ready_candidate. `sampleLimit`은 1 ≤ value ≤ 50으로 정규화.
  - **Diagnostic API**: `GET /api/diagnostics/overlay-runtime?projectId=...` 응답에 `harnessPromptApplyReadinessReport` 추가. projectId 없으면 empty fallback. `overlayArchitecturePhase.current = "harness-apply-readiness-preparation-layer"`, `harnessPromptApplyReadinessEnabled: true`, `overlayMaturity.harnessApplyReadinessPreparationLayer: true`.
  - **Overlay UI**: 신규 `HarnessApplyReadinessSummaryCard` (`apps/web/src/components/orchestration/overlay/`). Prompt Timeline 상단(`Overlay 보기` 토글 ON일 때만 노출) — 레벨 배지(`준비 부족` / `관찰 필요` / `적용 후보`), 샘플/Preview 수, 누락·위험·경고 비율, 평균 기존/Preview 길이, finding 진단 리스트. "이 표시는 실제 적용 결과가 아니라, 최근 기록을 기준으로 한 Harness 적용 준비도 진단입니다." 안내 고정.
  - **UI adapter** (`apps/web/src/lib/overlay-ui/harnessPromptApplyReadinessUiAdapter.ts`): `HarnessPromptApplyReadinessReport` → VM. 비율 % 포맷(`25%`), 한국어 레벨/severity 라벨, 임계 헬프 텍스트(hover). 잘못된 mode/null report → `hasData: false` 안전 fallback.
  - **테스트**: evaluator 10 + UI adapter 7 = 17 신규. harness + overlay-ui 통합 **68/68 통과**.
  - **여전히 금지**: 실제 prompt payload·LLM call payload 변경, retrieval query 변경, provider switching, hard enforcement, automatic pruning, DB schema·Prisma 변경, "적용 가능" 단정 표현, 적용 트리거 UI.

- **Harness Phase H1 — Controlled Prompt Assembly Preview (10단계; dry-run only)** — Harness가 표준 방식으로 prompt를 조립한다면 어떤 prompt가 만들어질지 **미리보기(preview)** 만 생성한다. **실제 prompt payload, OpenAI 호출, retrieval, provider, Cursor execution 어디에도 영향 없음.**
  - **신규 모듈** (`apps/web/src/lib/harness/promptAssembly/`):
    - `harnessPromptAssemblyTypes.ts` — `HarnessPromptSectionType`(system, role_contract, project_context, memory_context, knowledge_context, current_request, constraints, output_format, diagnostic), `HarnessPromptSection { id, type, title, content, source, includeReason, priority, estimatedCost }`, `HarnessPromptAssemblyPreview { mode: "dry_run", sections, totalEstimatedCost, overflowRisk, warnings }`, `HarnessPromptPreviewDiff`, `HarnessPromptAssemblySummary`.
    - `buildHarnessPromptAssemblyPreview.ts` — overlay identity + assembly plan + budget + userRequest/existingPromptText 입력으로 **deterministic ordering** preview 생성. role_contract → project → memory → knowledge → current_request → constraints 순.
    - `compareHarnessPromptPreview.ts` — preview vs 기존 prompt 길이/누락 섹션/추가 섹션 diff. warnings(누락·길이 큰 폭 차이) 진단 metadata 출력.
    - `harnessPromptAssemblyCoerce.ts` — replay/parser. `mode !== "dry_run"`이면 거부. `coerceHarnessPromptAssemblyMetadata`가 preview/diff 양쪽을 단일 dispatch.
  - **PromptTrace 통합**: `RequirementsPromptTimelineEntry`에 optional `harnessPromptAssemblyPreview` / `harnessPromptPreviewDiff` 추가. `overlayPromptTraceAugment`가 성공 턴마다 build+diff를 계산해 promptTrace에 attach(payload 본문은 그대로). `overlayPromptTraceExtract`/`requirementsIdeationBootstrapPromptTimeline` parser가 coerce.
  - **Diagnostic API** `GET /api/diagnostics/overlay-runtime?projectId=...`에 `harnessPromptAssemblySummary { mode, sectionCount, totalEstimatedCost, overflowRisk, warningCount }` 추가. `overlayArchitecturePhase.current = "harness-controlled-prompt-assembly-preview-layer"`, `harnessPromptAssemblyPreviewEnabled: true`.
  - **Overlay UI**: 신규 `OverlayHarnessPromptPreviewSection` (Prompt Timeline Overlay 탭 안). dry-run 안내 고정 노출 + Preview 요약(mode/예산 위험/섹션 수/추정 비용) + section row 목록(추정 비용/출처 ellipsis/사유/content preview) + 기존 prompt 길이 vs preview 길이 diff. 데이터 없으면 empty hint. 기본 펼침/접힘은 `sectionDefaults.harnessPromptPreview`(adapter 단일 출처).
  - **테스트**: builder 10 + compare 5 + replay coerce 6 + UI adapter 6 = 27 신규. overlay+overlay-ui+harness 통합 **134/134 통과**.
  - **여전히 금지**: 실제 prompt payload·LLM call payload 변경, retrieval query 변경, provider switching, hard enforcement, automatic context pruning, DB schema·Prisma 변경, selectedAgents/platformAiMembers 구조 변경.

- **Overlay Observability UI Phase 1.5 (9단계; UI-only 안정화)** — Prompt Timeline Overlay 탭을 운영자/개발자가 실제 활용할 수 있는 수준으로 다듬는다. **여전히 runtime payload·라우팅·retrieval·orchestration 어디에도 영향 없음.**
  - **신규 SummaryHeader VM/컴포넌트**: `OverlayUiSummaryHeaderVM` + `OverlaySummaryHeader.tsx`. 역할 / 맥락 수(선택·우선순위) / 예산 위험 / 경고 수(conflict·drift 분리 카운트 포함) / 축소 후보 수 / 핵심·추천·선택·축소 후보 카운트를 한눈에 노출. 이전 `OverlayUiTimelineSnapshotVM` + `SnapshotStrip`은 정보 중복으로 제거됨(summary가 단일 출처).
  - **공통화 원시티브**: `OverlayIncludeModeBadge`(includeMode 배지 단일 진입점, label/tone/title이 `overlayUiLabel`의 매핑에서 도출) + `OverlayUiSourceText`(긴 source 말줄임) + `OVERLAY_INCLUDE_MODE_ORDER`(노출 순서 상수)를 `OverlayUiPrimitives.tsx`에 추가. SummaryHeader / AssemblyPlanSection / PruningSection이 동일한 출처를 공유.
  - **섹션 default 펼침 정책 → adapter VM 이관**: `OverlayUiSectionDefaultsVM`(context/budget=항상, warning/pruning=데이터 있을 때, assemblyPlan=항상 접힘)을 adapter에서 산출하여 SummaryCard가 prop 전달. UI 컴포넌트의 분기 분산 해소.
  - **사용자 표현 강화**: `overlayUiOverflowRiskLabel`이 영어 "LOW/MEDIUM/HIGH" → 한국어 "낮음/중간/높음" 으로 변경. drift 그룹 타이틀 "정책 정렬" → "정책 기준 차이", Warning 섹션 타이틀 "주의·정보" → "경고". budget high description은 "축약될 가능성이 있습니다" 등 사용자 친화 표현으로 보강.
  - **섹션 기본 펼침 정책**: 컨텍스트/예산은 항상 펼침, 경고·축소 후보는 데이터 있을 때 펼침, 조립 계획은 접힘(모바일 과밀 방지). 각 section 컴포넌트가 optional `defaultOpen` prop을 받도록 확장.
  - **Empty state 보강**: `OVERLAY_UI_EMPTY_STATE_HINT`("최근 AI 응답부터 역할, 맥락, 경고, 예산 정보가 기록됩니다.") 보조 안내. `OverlayUiEmptyHint`가 `secondary` prop을 받아 2-line 노출 + `role="status"` 접근성 보강.
  - **소스 말줄임**: `OverlayAssemblyPlanSection` / `OverlayPruningSection` row의 긴 `source` 텍스트를 `text-overflow: ellipsis`로 1줄 말줄임 + native `title` hover로 전체 노출.
  - **테스트**: `tests/overlay-ui/overlayUiDescription.unit.test.ts`(5 신규), adapter `summary` viewmodel 테스트 2건 추가. 기존 `overlayUiLabel` / `overlayUiAdapter`의 "HIGH" 등 영어 라벨 assertion은 한국어로 갱신. overlay-ui 전체 **24/24 통과**(기존 17 + 신규 7).
  - **여전히 금지**: 실제 prompt 조립, 자동 context 제거, hard enforcement, provider/retrieval orchestration, SingleChat 메시지 하단 AI 판단 보기(다음 단계).

- **Overlay Observability UI Phase 1 (8단계)** — replay 가능한 overlay metadata를 사용자가 볼 수 있게 만드는 *시각화 단계*. **runtime payload·라우팅·retrieval·orchestration 어디에도 영향 없음.**
  - **debug API 확장**: `PromptTimelineEntry.overlay?: ExtractedOverlayPromptTraceMetadata`. `/api/projects/[projectId]/debug/prompt-timeline` 응답이 promptTrace에서 `extractOverlayPromptTraceMetadata`로 꺼낸 metadata를 함께 포함(없을 때는 부재). `/api/me/debug/prompt-timeline`(messenger 전용)은 영향 없음.
  - **UI helper**: `apps/web/src/lib/overlay-ui/overlayUiLabel.ts`(badge label/tone), `overlayUiDescription.ts`(설명 문구·disclaimer 상수), `overlayUiAdapter.ts`(`buildOverlayUiViewModel` — `ExtractedOverlayPromptTraceMetadata` → 사용자 표현 view-model). 모두 **순수 함수**.
  - **컴포넌트**: `apps/web/src/components/orchestration/overlay/` 하위 `OverlaySummaryCard`, `OverlayContextSection`, `OverlayBudgetSection`, `OverlayWarningSection`, `OverlayAssemblyPlanSection`, `OverlayPruningSection`, `OverlayUiPrimitives`. 모두 read-only display(`details/summary` 기반 아코디언).
  - **Prompt Timeline UI**: 페이지 헤더에 **[Overlay 보기]** 토글(기본 닫힘). ON일 때 각 entry가 `프롬프트/응답/Overlay/진단` 4-탭으로 전환. OFF면 기존 dual-pane UX 유지(legacy 비훼손).
  - **사용자 표현 매핑**: `overflowRisk: high → "대화 맥락이 많아 일부 오래된 내용이 축약될 수 있습니다"`, `includeMode: required → 핵심`/`recommended → 추천`/`optional → 선택`/`excludeCandidate → 축소 후보`, `pruningCandidate → 축소 후보로 분류되었습니다(실제 제거 아님)`, conflict/drift는 *경고 only* 명시.
  - **empty/null safety**: overlay metadata가 없는 과거 timeline은 `OVERLAY_UI_EMPTY_STATE_MESSAGE`("이 시점에는 Overlay Runtime 정보가 기록되지 않았습니다.") 노출. 모든 section은 `hasData` 분기로 graceful degradation.
  - **테스트**: `apps/web/tests/overlay-ui/overlayUiLabel.unit.test.ts`(5 tests), `apps/web/tests/overlay-ui/overlayUiAdapter.unit.test.ts`(9 tests) — empty state/includeMode 변환/warning 라벨/overflowRisk 표현/null replay 처리.
  - **여전히 금지**: prompt payload 변경, retrieval/provider 변경, orchestration/Cursor execution 변경, DB schema/Prisma 변경, hard enforcement, selectedAgents/platformAiMembers 구조 변경, Stage1/Stage2/ENV_TEST 변경, GitHub PR merge 흐름 변경.

- **Policy-guided Assembly Plan Stabilization (7단계)** — selection → prioritization → assembly plan → pruning candidate → drift 흐름을 안정적으로 연결하고 replay·diagnostic 가능하게 만든다.
  - **prioritization 연결**: `overlayPromptTraceAugment.buildOrchestrationOverlayPromptTraceAugments`가 selection refs → `prioritizeOverlayContexts({ contexts, budgetPolicy: overlayContextBudget.budgetPolicy })` → `buildOverlayContextAssemblyPlan` 순으로 호출. payload·실제 assembly 비변경. 결과 `overlayPrioritizedContextRefs`는 read-only optional metadata로 저장.
  - **includeMode 분류**: `OverlayAssemblyPlanItem.includeMode` = `required|recommended|optional|excludeCandidate`. 기본은 type 기반(policy=required, memory/knowledge=recommended, timeline/workspace=optional). `overflowRisk === "high"` && low priority(`priority >= OVERLAY_ASSEMBLY_PLAN_LOW_PRIORITY_THRESHOLD`) timeline/workspace는 `excludeCandidate`로 강등. **실제 include/exclude 수행 없음.**
  - **estimatedCost 보정**: type별 base + `TYPE_BASE_MULTIPLIER` + `POLICY_TYPE_MULTIPLIER`(compact는 timeline/workspace 비용 ↑, extended는 ↓). 휴리스틱이며 실제 토큰 측정 아님.
  - **Pruning linkage**: `suggestOverlayPruningCandidates`가 `includeMode === "excludeCandidate"` 항목을 overflow 단계 무관히 1차 후보로 고려. 그 외 항목은 legacy `pruningCandidate` flag + medium/high overflow에서만 후보.
  - **Drift warning 확장**: `OVERLAY_DRIFT_COMPACT_OPTIONAL_TIMELINE_OVERLOAD`, `OVERLAY_DRIFT_HIGH_OVERFLOW_WITHOUT_EXCLUDE_CANDIDATE`, `OVERLAY_DRIFT_NO_REQUIRED_ITEM` 추가(includeMode 기반). 모두 `enforcement: "not_applied"`.
  - **Drift replay 저장**: augment가 `detectOverlayPolicyDrift` 결과를 `overlayPolicyDriftWarnings` 로 저장. 진단 API는 replay 값이 있으면 우선 사용, 없으면 즉시 재계산(읽기 전용 진단).
  - **PromptTrace 직렬화**: `requirementsStateJson` 타임라인 entry가 optional **`overlayPrioritizedContextRefs`**·**`overlayPolicyDriftWarnings`** 추가 보존(기존 plan/pruning과 함께). `coerceOverlayPromptTracePreparationMetadata`가 extract/coerce 양쪽에서 dispatch. 행당 prioritized refs 최대 `OVERLAY_SELECTED_CONTEXT_REFS_MAX`, drift warning 최대 `OVERLAY_POLICY_WARNINGS_MAX_TIMELINE`(invalid 행은 drop, parser는 알 수 없는 `includeMode`를 type 기본값으로 복원).
  - **진단 API 확장**: `overlay-runtime` 응답에 **`overlayAssemblyIncludeModeSummary`** (`required/recommended/optional/excludeCandidate`) 추가. `overlayPolicyDriftWarnings`는 replay 우선 노출. `overlayArchitecturePhase.current` = `"policy-guided-assembly-plan-stabilization-layer"`, `autoPromptAssemblyEnabled: false`, `overlayMaturity.policyGuidedAssemblyPlanStabilizationLayer = true`.
- **단위 테스트**: `tests/overlay/*.unit.test.ts`(6단계 셋트에 더해 **`overlayContextAssemblyPlan`** includeMode/cost adjustment, **`overlayContextPruning`** linkage, **`overlayPolicyDriftWarning`** new rules, **`overlayAssemblyReplay`** prioritized + drift replay 케이스 보강. 총 83 통과), `tests/api/overlayPromptTracePersistence.unit.test.ts`, `tests/api/executionReviewOverlayWarningSummary.unit.test.ts`, `tests/api/overlayRuntimeDiagnosticReplay.unit.test.ts`.
- **의도적으로 하지 않음**: 정책 엔진 강제, Cursor 실행 차단, vector memory, retrieval 본문 변경, Stage1/2·GitHub 플로우 변경, **자동 prompt 본문 조립**, **자동 context pruning 실행**, **자동 retrieval orchestration**, **자동 provider orchestration**.

## 관련 문서

- 단계 계획: `apps/web/docs/OVERLAY_ARCHITECTURE_STEP_PLAN.md`
- 매핑표·모듈 인덱스: `apps/web/docs/OVERLAY_ARCHITECTURE_CONTRACTS.md`

---

**문서 끝**
