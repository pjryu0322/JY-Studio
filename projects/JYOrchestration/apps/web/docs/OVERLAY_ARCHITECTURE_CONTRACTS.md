# Overlay Architecture — 구조 명명·계약 (JYOrchestration)

이 문서는 **기존 코드 경로를 바꾸지 않고** 부여하는 **의미(Contract)** 와 매핑표이다.  
단계별 원칙은 `OVERLAY_ARCHITECTURE_STEP_PLAN.md` 참고.

## 철학 한 줄

- **Visible AI Team Collaboration Platform** (단일 Assistant 아님)
- **Identity-based AI Organization** (함수 나열형 AI 아님)

## 현재 구조 ↔ Overlay 의미

| 현재 구현 | Overlay 역할명 | 설명 |
|-----------|----------------|------|
| `apps/web/src/app/api/requirements/ai-facilitator/route.ts` | **Orchestration Entry** | 요구·SingleChat·멀티에이전트 턴의 HTTP 진입·상태 반영 |
| `apps/web/src/lib/ai-member/platformAiMembers.ts` | **AI Identity Catalog** | 화면별 플랫폼 AI 정체성·실행 provider 표시·system 정체 문구 |
| `Project.requirementsStateJson` (`requirementsStateJson.ts` 등) | **Project Orchestration Memory** | 슬롯·오케스트레이션 상태·부트스트랩 메타 등 프로젝트 단위 JSON |
| `apps/web/src/lib/execution/executionReviewWithAiMembers.ts` | **Review Harness** | 실행 후 OpenAI JSON 리뷰 멤버 선택·컨텍스트·모델 호출·집계 |
| `apps/web/src/lib/knowledge-packs/knowledgePackRetrievalService.ts` | **Knowledge Retrieval Provider** | 키워드(및 모드) 기반 청크 검색·프롬프트 컨텍스트 조각 생성 |

## 타입(계약) 모듈 위치

| 계약 | 경로 |
|------|------|
| Memory scope | `apps/web/src/lib/overlay/memoryScopeContract.ts` |
| AI identity | `apps/web/src/lib/overlay/aiIdentityContract.ts` |
| Prompt assembly metadata | `apps/web/src/lib/overlay/contextAssemblyContract.ts` |
| Active knowledge pack ref | `apps/web/src/lib/overlay/activeKnowledgePackRef.ts` |
| Runtime resolver (identity·memory default) | `apps/web/src/lib/overlay/overlayRuntimeResolver.ts` |
| Memory scope → 출처 매핑 | `apps/web/src/lib/overlay/memoryScopeRuntime.ts` |
| Knowledge activation synthetic hints | `apps/web/src/lib/overlay/knowledgeActivationResolver.ts` |
| Orchestration `promptTrace` augment | `apps/web/src/lib/overlay/overlayPromptTraceAugment.ts` |
| Registry wrapper (identity·scopes·provider) | `apps/web/src/lib/overlay/overlayRegistry.ts` |
| Runtime policy (soft booleans, 비차단) | `apps/web/src/lib/overlay/overlayPolicy.ts` |
| Workspace catalog → contract role (선택 매핑) | `apps/web/src/lib/overlay/overlayIdentityFromWorkspace.ts` |
| Prompt trace row에서 overlay 메타 추출 | `apps/web/src/lib/overlay/overlayPromptTraceExtract.ts` |
| 프로젝트별 overlay 진단 스냅샷 빌더 | `apps/web/src/lib/overlay/overlayProjectDiagnostic.ts` |
| Policy warning 표준(비차단) | `apps/web/src/lib/overlay/overlayPolicyWarning.ts` |
| Warning 집계(byCode/byRole/bySource) | `apps/web/src/lib/overlay/overlayPolicyWarningSummary.ts` — `byRole`은 `roleKey` 없으면 **`unknown`** 버킷 |
| Warning read-only 리포트 묶음 | `apps/web/src/lib/overlay/overlayWarningReport.ts` |
| **Selection metadata 빌더(read-only)** | `apps/web/src/lib/overlay/overlayContextSelection.ts` — `buildOverlaySelectedContextRefs`·`summarizeOverlaySelectedContextRefs`·`parseOverlaySelectedContextRefsFromUnknown` |
| **Context budget heuristic(read-only)** | `apps/web/src/lib/overlay/overlayContextBudget.ts` — `buildOverlayContextBudgetMetadata`·`parseOverlayContextBudgetMetadataFromUnknown`·`summarizeOverlayContextBudgetMetadata` (payload·prompt 비변경) |
| **Conflict detection(키워드 휴리스틱, warning only)** | `apps/web/src/lib/overlay/overlayConflictDetection.ts` — `detectOverlayConflicts`·`summarizeOverlayConflictWarnings`·`OVERLAY_CONFLICT_WARNINGS_MAX` |
| **Orchestration decision trace(replay metadata)** | `apps/web/src/lib/overlay/overlayOrchestrationDecisionTrace.ts` — `buildOverlayOrchestrationDecisionTrace` |
| **5단계 preparation 코어션 단일창** | `apps/web/src/lib/overlay/overlayPromptTracePreparationCoerce.ts` — `coerceOverlayPromptTracePreparationMetadata`(extract+coerce 공유, 6단계 `assemblyPlan`·`pruningCandidates`도 함께 처리) |
| **Context Assembly Plan(read-only)** | `apps/web/src/lib/overlay/overlayContextAssemblyPlan.ts` — `buildOverlayContextAssemblyPlan`·`parseOverlayAssemblyPlanFromUnknown`·`summarizeOverlayAssemblyPlan`·`summarizeOverlayAssemblyIncludeMode`·`OVERLAY_ASSEMBLY_PLAN_ITEMS_MAX`·`OVERLAY_ASSEMBLY_PLAN_LOW_PRIORITY_THRESHOLD`. **`includeMode` (required/recommended/optional/excludeCandidate)** 부여(실제 include/exclude 수행은 하지 않음). type별 base + budget policy multiplier로 `estimatedCost` 보정. |
| **Context Prioritization(metadata sort only)** | `apps/web/src/lib/overlay/overlayContextPrioritization.ts` — `prioritizeOverlayContexts` (compact/balanced/default/extended). augment 경로에서 selection refs → `overlayPrioritizedContextRefs` → assembly plan 순으로 직접 사용. |
| **Pruning Candidate Suggestion(read-only)** | `apps/web/src/lib/overlay/overlayContextPruning.ts` — `suggestOverlayPruningCandidates`(우선순위: `includeMode === "excludeCandidate"` → legacy `pruningCandidate` flag) · `parseOverlayPruningCandidatesFromUnknown` · `summarizeOverlayPruningCandidates` · `OVERLAY_PRUNING_CANDIDATES_MAX`. |
| **Selection Policy Drift Warning(warning only)** | `apps/web/src/lib/overlay/overlayPolicyDriftWarning.ts` — `detectOverlayPolicyDrift`. includeMode 기반 규칙: `OVERLAY_DRIFT_COMPACT_OPTIONAL_TIMELINE_OVERLOAD`·`OVERLAY_DRIFT_HIGH_OVERFLOW_WITHOUT_EXCLUDE_CANDIDATE`·`OVERLAY_DRIFT_NO_REQUIRED_ITEM` 추가. 모두 `enforcement: "not_applied"`. |
| 재export | `apps/web/src/lib/overlay/index.ts` |

기존 Stage1/2·Cursor launch·GitHub·retrieval 본문은 변경하지 않는다.

### 단계 모델 (현재 범위 명시)

1. **Contract Layer** — 타입·정적 resolver 행.
2. **Runtime Metadata Layer** — `promptTrace` / Review step에 optional overlay 필드 기록.
3. **Runtime Policy Helper Layer** — `overlayPolicy`의 `shouldEnable*`·`buildOverlayRuntimePolicyHintsWire`·`parseOverlayRuntimePolicyHintsWire`; **기록·진단만**, 차단 없음.
4. **Runtime Policy Diagnostic / Warning Layer** — `overlayPolicyWarnings`·`buildOverlayPolicyWarnings`·`summarizeOverlayPolicyWarnings`(요약에 **`byCode` / `byRole` / `bySource`** 포함); 진단 API **`overlayPolicyWarningSummary`**·**`overlayWarningReport`**(`buildOverlayWarningReport`)·**`overlayArchitecturePhase`**·**`overlayMaturity`**·**`enforcementStatus`**. **`parseOverlayPolicyWarningsFromUnknown`** 는 알 수 없는 `severity`를 replay 안정화를 위해 **`warning`** 으로 본다(그 외 필드는 기존 검증 유지). **경고는 기록·진단만** 하며 실행 차단·pass/fail 변경 없음.
5. **Runtime Diagnostic / Selection Preparation Layer** — `overlaySelectedContextRefs`·`overlayContextBudget`·`overlayConflictWarnings`·`overlayOrchestrationDecisionTrace`(모두 read-only optional metadata). 진단 API에 **`overlaySelectionSummary`**·**`overlayConflictSummary`**·**`overlayContextBudgetSummary`** 노출. SingleChat augment 경로가 `detectOverlayConflicts({ timelineMessages })`를 호출해 `overlayConflictWarnings`를 실제로 생성한다(warning only). budget metadata는 `promptLength → promptText.length → JSON.stringify` fallback을 사용해 항상 생성된다. **prompt 본문·OpenAI payload·라우팅 변경 없음**, **자동 orchestration / retrieval / provider 선택 없음**.
6. **Policy-guided Context Assembly Preparation Layer** — "무엇이 선택되었는가"에서 한 단계 더 들어가 **"무엇을 실제 prompt assembly에 우선 사용할 것인가"** 를 read-only로 *계획*한다. 신규 metadata: `overlayContextAssemblyPlan`, `overlayPruningCandidates`. 신규 helper: `buildOverlayContextAssemblyPlan`·`prioritizeOverlayContexts`·`suggestOverlayPruningCandidates`·`detectOverlayPolicyDrift`. **여전히 prompt 본문 자동 변경·자동 pruning 실행·retrieval/provider/orchestration 자율 실행 금지**.
7. **Policy-guided Assembly Plan Stabilization Layer** — selection → prioritization → assembly plan → pruning candidate → drift warning 흐름을 안정적으로 연결하고 replay·diagnostic 가능하게 만든다.
   - `overlayPrioritizedContextRefs`: augment 경로에서 `prioritizeOverlayContexts({contexts, budgetPolicy})` 결과를 read-only optional metadata로 보존(sorting only, payload 비변경).
   - `OverlayAssemblyPlanItem.includeMode` (`required` / `recommended` / `optional` / `excludeCandidate`): type별 기본 분류 + `overflowRisk === "high"` && 낮은 우선순위 timeline/workspace는 `excludeCandidate`로 강등(실제 include/exclude 수행 없음).
   - `estimatedCost`: type별 base + `compact|extended` budget policy multiplier로 timeline/workspace 비용 조정(휴리스틱, 실제 토큰 측정 아님).
   - `suggestOverlayPruningCandidates`: `includeMode === "excludeCandidate"` 항목을 1차 후보로 고려(overflow 단계 무관), 그 외 항목은 legacy `pruningCandidate` flag가 true이면서 overflow medium/high인 경우만 후보.
   - `detectOverlayPolicyDrift`: 신규 규칙 `OVERLAY_DRIFT_COMPACT_OPTIONAL_TIMELINE_OVERLOAD`, `OVERLAY_DRIFT_HIGH_OVERFLOW_WITHOUT_EXCLUDE_CANDIDATE`, `OVERLAY_DRIFT_NO_REQUIRED_ITEM` 추가(모두 warning only).
   - `overlayPolicyDriftWarnings`: 계산된 drift warning을 promptTrace optional metadata로 저장하여 replay 가능. 진단 API는 replay 값이 있으면 우선 사용, 없으면 즉시 재계산.
   - 진단 API 신규 응답 필드: **`overlayAssemblyIncludeModeSummary`** (`{ required, recommended, optional, excludeCandidate }`), drift warning replay 우선 노출. `overlayArchitecturePhase.current = "policy-guided-assembly-plan-stabilization-layer"`, `overlayMaturity.policyGuidedAssemblyPlanStabilizationLayer = true`, `autoPromptAssemblyEnabled = false`.
   - **여전히 금지**: actual prompt assembly, actual context pruning, retrieval/provider/autonomous orchestration, hard enforcement.
8. **Overlay Observability UI — Phase 1** (현재) — replay 가능한 overlay metadata를 사용자가 볼 수 있게 만드는 *시각화 단계*. **runtime payload·라우팅·retrieval·orchestration 어디에도 영향이 없는 UI-only 변경**.
   - `PromptTimelineEntry`에 optional `overlay` 필드 추가(`ExtractedOverlayPromptTraceMetadata`). `/api/projects/[projectId]/debug/prompt-timeline` 응답이 promptTrace에서 `extractOverlayPromptTraceMetadata`로 꺼낸 값을 함께 내려준다.
   - 신규 UI helper: `apps/web/src/lib/overlay-ui/overlayUiLabel.ts`, `overlayUiDescription.ts`, `overlayUiAdapter.ts` — 내부 enum/code 값을 사용자 표현으로 변환하는 **순수 함수**. 토큰 추정·overflow 위험·includeMode 등을 한국어 label/badge tone/문장으로 변환.
   - 신규 React 컴포넌트(`apps/web/src/components/orchestration/overlay/`): `OverlaySummaryCard`, `OverlayContextSection`, `OverlayBudgetSection`, `OverlayWarningSection`, `OverlayAssemblyPlanSection`, `OverlayPruningSection`, `OverlayUiPrimitives`. 모두 **read-only display**.
   - Prompt Timeline 페이지에 페이지 레벨 **[Overlay 보기]** 토글(기본 닫힘) 추가. 토글이 ON일 때 각 entry가 `프롬프트 / 응답 / Overlay / 진단` 4-탭 구조로 전환되며, OFF면 기존 dual-pane UX 유지.
   - Empty/null 안전: overlay metadata 없는 과거 timeline은 "이 시점에는 Overlay Runtime 정보가 기록되지 않았습니다." empty state로 처리. `OverlaySummaryCard`가 `buildOverlayUiViewModel` 결과의 `hasOverlayData`를 검사.
   - UI 문구는 항상 planning metadata임을 명시(`OVERLAY_UI_PLANNING_DISCLAIMER`, `OVERLAY_UI_BUDGET_DISCLAIMER`, `OVERLAY_UI_WARNING_DISCLAIMER`)하여 실제 prompt 포함 여부와 혼동을 방지.
   - **여전히 금지**: prompt payload 변경, retrieval/provider 변경, orchestration/Cursor execution 변경, DB schema 변경, hard enforcement, `selectedAgents/platformAiMembers` 구조 변경, 기존 Prompt Timeline 공개 동작(`PromptTimelineEntry` 필수 필드) breaking change.
9. **Message-level Explainability UI** (다음 단계 준비) — **미도입**. SingleChat 메시지 단위에 [AI 판단 보기] 확장(역할 선택 이유·knowledge activation·context summary·warning·budget risk) 노출. **여전히 read-only**.
10. **Controlled Prompt Assembly Preparation Layer** (향후) — **미도입**. deterministic ordering·controlled assembly·overflow mitigation planning·memory/knowledge ranking·assembly trace. **자율 execution·provider switching·retrieval rewriting·automatic blocking 금지 유지**.
11. **Runtime Policy Enforcement Layer** (향후) — **미도입** (hard gate·Cursor 차단·라우팅 강제 없음).

### Contract → Runtime Metadata → Runtime Policy

- **Contract**: `aiIdentityContract`·`memoryScopeContract`·`contextAssemblyContract`·`activeKnowledgePackRef` 등 타입과 `overlayRuntimeResolver`의 정적 행(역할별 identity·기본 memory/knowledge scope).
- **Runtime Metadata**: 오케스트레이션·리뷰 경로가 기록하는 값 — `promptTrace`의 `overlayIdentity` / `overlayContextAssembly` / `overlayKnowledgeActivationHints` / `overlayPolicyHints` / **`overlayPolicyWarnings`** / **`overlaySelectedContextRefs`** / **`overlayContextBudget`** / **`overlayConflictWarnings`** / **`overlayOrchestrationDecisionTrace`**, Review 스텝의 동일 계열 필드(프롬프트 본문은 그대로).
- **Runtime Policy**: `overlayPolicy`의 `shouldEnable*` 등과 `buildOverlayPolicyWarnings`가 역할 미해결·Cursor 요청 불일치·hint/assembly 기대 vs 정책 불일치를 **warning/info** 로만 기록(`enforcement: "not_applied"`). SingleChat augment·Review Harness·진단 API가 동일 어휘를 사용한다.

### 2단계: 최소 런타임 연결 (완료 범위)

| 연결 | 설명 |
|------|------|
| **Identity resolve** | `resolveAiIdentityContract` 등 — 오케스트레이션 메타의 역할 문자열을 계약 행으로 매핑 |
| **Memory scope mapping** | `resolveMemoryScopeFromSource` / `buildPromptAssemblyMemoryRef` |
| **Prompt timeline metadata** | `requirementsChatOrchestration` 성공 시 `promptTrace`에 overlay 필드 + **`overlayPolicyWarnings`** (`buildOrchestrationOverlayPromptTraceAugments`) |
| **Knowledge activation hint** | `resolveKnowledgeActivationHintsForRole` — synthetic id만, DB·retrieval 비침해 |
| **Review Harness helpers** | `selectExecutionReviewMembers`, `buildExecutionReviewBaseContext`, `executeReviewerStep`, `aggregateReviewerHarnessResult` — 스텝에 overlay·`overlayPolicyHints`·**`overlayPolicyWarnings`**; knowledge 힌트는 `shouldEnableKnowledgeHints`에 따름 |
| **Registry / policy / trace extract** | `getOverlayIdentity` 등, `shouldEnable*`, `extractOverlayPromptTraceMetadata`, `parseOverlayRuntimePolicyHintsWire`, **`parseOverlayPolicyWarningsFromUnknown`** |
| **읽기 전용 진단 API** | `GET /api/diagnostics/overlay-runtime` — `overlayPolicyWarningSummary`(경고 샘플 + **byCode/byRole/bySource**), **`overlayWarningReport`**, **`overlaySelectionSummary`**, **`overlayConflictSummary`**, **`overlayContextBudgetSummary`**, **`overlayArchitecturePhase`**, **overlayMaturity**, **enforcementStatus**, `?roles=`, `workspaceAiMemberOverlayMappings`, 선택 `?projectId=` 시 `projectOverlay`·`lastPromptTraceOverlayExtract` |
| **Review Harness 집계** | `evaluateExecutionResult` — Harness 경로에서 **`overlayWarningSummary`**·`overlayWarningCount` optional(metadata; **decision 비영향**). |

### 아직 하지 않은 것 (Drift 방지)

- **현재 warning은 실행 차단이 아니다** (pass/fail·Cursor launch·retrieval 본문 비영향). Warning은 진단·감사·추적·향후 정책 설계를 위한 metadata다.
- **선택/예산/충돌 metadata는 read-only**: `overlaySelectedContextRefs`·`overlayContextBudget`·`overlayConflictWarnings`·`overlayOrchestrationDecisionTrace`는 **promptTrace replay 용 metadata** 이며 prompt 본문 자동 조립·라우팅·payload 어떤 것도 변경하지 않는다.
- **아직 없음**: hard enforcement, Cursor execution blocking, retrieval orchestration 변경, prompt injection policy, **context budget enforcement(현재는 휴리스틱 진단만)**, memory orchestration, provider orchestration, **자동 orchestration / 자동 retrieval / 자동 provider 선택**.
- **Cursor capability**는 메타·경고만; hard block 아님.
- **지식팩 hint**는 retrieval에 강제 반영되지 않는다.
- **context assembly 메타**는 prompt 본문을 바꾸지 않는다.
- **Review Harness**의 `overlayPolicyWarnings`는 JSON 리뷰 **판단 로직에 영향 없음**.
- **memory orchestration** (벡터·영속 계층 통합) 없음
- **DB memory 스키마**·vector retrieval ↔ activation 자동 연결 없음
- system prompt 본문에 perspective 강제 주입 없음

## 진단 보고서·다운로드

- 본문: `apps/web/docs/platform-structure-diagnosis.md`
- 다운로드: `GET /api/diagnostics/platform-structure-report`
- Overlay 런타임 스냅샷(JSON): `GET /api/diagnostics/overlay-runtime` (`overlayPolicyWarningSummary`, **`overlayWarningReport`**, **`overlaySelectionSummary`**, **`overlayConflictSummary`**, **`overlayContextBudgetSummary`**, **`overlayArchitecturePhase`**, **overlayMaturity**, **enforcementStatus**, `?roles=`, `?projectId=` + 로그인 시 `projectOverlay`·`lastPromptTraceOverlayExtract`, `workspaceAiMemberOverlayMappings`)
