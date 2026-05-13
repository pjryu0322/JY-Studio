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

**부분 반영** — OpenAI HTTP 래퍼, Cursor 어댑터, 실행 리뷰 순회, SingleChat 다단계 LLM 존재. **단일 Harness 인터페이스 계층은 없음**.

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
- **단계**: Contract(1) → Runtime Metadata(2) → Policy Helper(3) → **Diagnostic / Warning(4)** → Enforcement(5, **미도입**).
- **Soft policy + warning wire**: `overlayPolicy.ts` + **`overlayPolicyWarning.ts`** + **`overlayPolicyWarningSummary.ts`** — `buildOverlayPolicyWarnings`·`summarizeOverlayPolicyWarnings`(코드/역할/출처 집계 포함); read-only 리포트 묶음 **`overlayWarningReport.ts`**(`buildOverlayWarningReport`). SingleChat `buildOrchestrationOverlayPromptTraceAugments`가 `overlayPolicyHints`와 **`overlayPolicyWarnings`** 를 함께 기록. `requirementsStateJson` 타임라인은 `coerceRequirementsPromptTimelineEntry`가 **`parseOverlayPolicyWarningsFromUnknown`** 으로 경고를 보존(행당 최대 `OVERLAY_POLICY_WARNINGS_MAX_TIMELINE`; 알 수 없는 severity는 **`warning`** 으로 정규화). **`cursorCapabilityEnforcement`는 항상 `not_applied`** (Cursor launch 비변경).
- **워크스페이스 카탈로그 → 계약 역할**: `overlayIdentityFromWorkspace.ts` — `validateWorkspaceAiMemberOverlayMappings` / `listUnmappedWorkspaceAiMemberKeys`로 카탈로그 키 누락 진단.
- **프로젝트 진단 스냅샷**: `overlayProjectDiagnostic.ts` — 서비스 기획 `selectedAgents` 기준 resolve·분포.
- **프롬프트 타임라인 추출**: `overlayPromptTraceExtract.ts` — `extractOverlayPromptTraceMetadata`가 hints·**warnings** 포함; 진단 API `?projectId=` 시 마지막 타임라인 행에 대해 호출.
- **진단 API**: `GET /api/diagnostics/overlay-runtime` — **`overlayPolicyWarningSummary`**, **`overlayWarningReport`**, **`overlayArchitecturePhase`**, **`overlayMaturity`**, **`enforcementStatus`**, `?roles=`, `workspaceAiMemberOverlayMappings`, 선택 `?projectId=` (세션 + `canViewProject`) 시 `projectOverlay`·`lastPromptTraceOverlayExtract`.
- **Review Harness**: `executionReviewWithAiMembers.ts` — 스텝에 **`overlayPolicyWarnings`**(JSON 리뷰 **판단 로직 비영향**); 반환에 **`overlayWarningCount`**·**`overlayWarningSummary`**(감사용 집계, decision 비영향). `evaluateExecutionResult`가 동일 metadata를 optional로 노출.
- **단위 테스트**: `tests/overlay/*.unit.test.ts`, `tests/api/overlayPromptTracePersistence.unit.test.ts`, `tests/api/executionReviewOverlayWarningSummary.unit.test.ts`.
- **의도적으로 하지 않음**: 정책 엔진 강제, Cursor 실행 차단, vector memory, retrieval 본문 변경, Stage1/2·GitHub 플로우 변경.

## 관련 문서

- 단계 계획: `apps/web/docs/OVERLAY_ARCHITECTURE_STEP_PLAN.md`
- 매핑표·모듈 인덱스: `apps/web/docs/OVERLAY_ARCHITECTURE_CONTRACTS.md`

---

**문서 끝**
