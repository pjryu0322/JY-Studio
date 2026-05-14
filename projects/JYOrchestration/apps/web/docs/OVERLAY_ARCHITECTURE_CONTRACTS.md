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
8. **Overlay Observability UI — Phase 1** — replay 가능한 overlay metadata를 사용자가 볼 수 있게 만드는 *시각화 단계*. **runtime payload·라우팅·retrieval·orchestration 어디에도 영향이 없는 UI-only 변경**.
   - `PromptTimelineEntry`에 optional `overlay` 필드 추가(`ExtractedOverlayPromptTraceMetadata`). `/api/projects/[projectId]/debug/prompt-timeline` 응답이 promptTrace에서 `extractOverlayPromptTraceMetadata`로 꺼낸 값을 함께 내려준다.
   - 신규 UI helper: `apps/web/src/lib/overlay-ui/overlayUiLabel.ts`, `overlayUiDescription.ts`, `overlayUiAdapter.ts` — 내부 enum/code 값을 사용자 표현으로 변환하는 **순수 함수**. 토큰 추정·overflow 위험·includeMode 등을 한국어 label/badge tone/문장으로 변환.
   - 신규 React 컴포넌트(`apps/web/src/components/orchestration/overlay/`): `OverlaySummaryCard`, `OverlayContextSection`, `OverlayBudgetSection`, `OverlayWarningSection`, `OverlayAssemblyPlanSection`, `OverlayPruningSection`, `OverlayUiPrimitives`. 모두 **read-only display**.
   - Prompt Timeline 페이지에 페이지 레벨 **[Overlay 보기]** 토글(기본 닫힘) 추가. 토글이 ON일 때 각 entry가 `프롬프트 / 응답 / Overlay / 진단` 4-탭 구조로 전환되며, OFF면 기존 dual-pane UX 유지.
   - Empty/null 안전: overlay metadata 없는 과거 timeline은 "이 시점에는 Overlay Runtime 정보가 기록되지 않았습니다." empty state로 처리. `OverlaySummaryCard`가 `buildOverlayUiViewModel` 결과의 `hasOverlayData`를 검사.
   - UI 문구는 항상 planning metadata임을 명시(`OVERLAY_UI_PLANNING_DISCLAIMER`, `OVERLAY_UI_BUDGET_DISCLAIMER`, `OVERLAY_UI_WARNING_DISCLAIMER`)하여 실제 prompt 포함 여부와 혼동을 방지.
9. **Overlay Observability UI — Phase 1.5** (현재; UI-only 안정화) — Prompt Timeline Overlay 탭을 운영자/개발자가 실제 활용 가능한 수준으로 다듬는다.
   - 신규 viewmodel `OverlayUiSummaryHeaderVM` + 컴포넌트 `OverlaySummaryHeader`: 역할 / 맥락 수(선택·우선순위) / 예산 위험 / 경고 수(conflict·drift 분리 카운트 포함) / 축소 후보 수 / 핵심·추천·선택·축소 후보 카운트를 한눈에 보여준다. 이전의 `OverlayUiTimelineSnapshotVM` + `SnapshotStrip`은 정보가 중복되어 제거되었고, summary가 단일 출처가 되었다.
   - 신규 공통 원시티브: `OverlayIncludeModeBadge`(includeMode 단일 출처 배지) + `OverlayUiSourceText`(긴 source 1줄 ellipsis) + `OVERLAY_INCLUDE_MODE_ORDER`(노출 순서 상수). includeMode 배지의 label/tone/title 트리오는 `overlayUiIncludeModeLabel/Tone/BadgeTitle` 매핑에서 일관되게 도출된다.
   - 섹션 default 펼침/접힘 정책은 adapter `OverlayUiSectionDefaultsVM`(단일 출처)에서 결정 후 SummaryCard가 prop으로 전달.
   - `overlayUiOverflowRiskLabel`을 영어 "LOW/MEDIUM/HIGH" → 한국어 "낮음/중간/높음" 으로 교체(내부 enum 노출 완화). description 문구도 "축약될 가능성이 있습니다" 등 사용자 친화 표현으로 보강.
   - `OverlayWarningSection`을 "경고" 섹션으로 리네이밍, drift 그룹 타이틀을 "정책 정렬" → "정책 기준 차이"로 변경(요구사항 매핑).
   - 섹션 기본 펼침 정책 도입: 컨텍스트/예산은 항상 펼침, 경고·축소 후보는 데이터 있을 때 펼침, 조립 계획은 접힘(모바일 과밀 방지).
   - Empty state 강화: `OVERLAY_UI_EMPTY_STATE_HINT`("최근 AI 응답부터 역할, 맥락, 경고, 예산 정보가 기록됩니다.") 보조 안내문 추가. `OverlayUiEmptyHint`가 `secondary` prop을 받아 2-line 형태로 노출하며 `role="status"`로 접근성 보강.
   - 조립 계획/축소 후보 row의 긴 `source` 텍스트를 1줄 `text-overflow: ellipsis`로 말줄임 + `title` hover로 전체 노출(모바일 카드 안정성).
   - 신규 unit 테스트: `tests/overlay-ui/overlayUiDescription.unit.test.ts`(5) + adapter `summary` viewmodel 테스트 2건 추가. 기존 라벨 테스트는 한국어 라벨로 갱신.
   - **여전히 금지**: prompt payload 변경, retrieval/provider 변경, orchestration/Cursor execution 변경, DB schema 변경, hard enforcement, `selectedAgents/platformAiMembers` 구조 변경, 기존 Prompt Timeline 공개 동작 breaking change.
10. **Harness Phase H1 — Controlled Prompt Assembly Preview Layer** (현재; dry-run only) — Harness가 기존 prompt를 "표준 방식으로 조립한다면 어떤 prompt가 만들어질지" 미리 보여주는 **read-only preview** 단계. **실제 prompt payload, OpenAI 호출, retrieval, provider, Cursor execution 어디에도 영향 없음.**
    - 신규 모듈: `apps/web/src/lib/harness/promptAssembly/`
      - `harnessPromptAssemblyTypes.ts` — `HarnessPromptSectionType`(system, role_contract, project_context, memory_context, knowledge_context, current_request, constraints, output_format, diagnostic), `HarnessPromptSection`, `HarnessPromptAssemblyPreview`(`mode === "dry_run"` 강제), `HarnessPromptPreviewDiff`, `HarnessPromptAssemblySummary`.
      - `buildHarnessPromptAssemblyPreview.ts` — overlay identity + assembly plan + budget + (선택) userRequest/existingPromptText에서 **deterministic ordering**으로 preview 생성. 각 section은 source/includeReason/priority/estimatedCost를 포함.
      - `compareHarnessPromptPreview.ts` — preview vs 기존 prompt 본문의 거시적 diff(길이·누락/추가 섹션·경고).
      - `harnessPromptAssemblyCoerce.ts` — unknown raw → preview/diff 안전 정규화 + 단일 dispatcher `coerceHarnessPromptAssemblyMetadata`.
    - `RequirementsPromptTimelineEntry`에 `harnessPromptAssemblyPreview?` / `harnessPromptPreviewDiff?` optional 필드 추가. 과거 timeline row와 호환 유지.
    - `overlayPromptTraceAugment`가 SingleChat 성공 턴마다 build/diff를 계산해 promptTrace에 attach. **payload 자체는 변경하지 않음** — augment 출력 객체의 별도 metadata로만 흐른다.
    - Diagnostic API(`GET /api/diagnostics/overlay-runtime?projectId=...`)에 `harnessPromptAssemblySummary { mode, sectionCount, totalEstimatedCost, overflowRisk, warningCount }` 추가. `lastPromptTraceOverlayExtract`에 preview/diff도 포함.
    - UI: Prompt Timeline Overlay 탭에 **`Harness Prompt Preview` 섹션**(접힘 기본; 데이터 있을 때 펼침) — section list, summary header(mode/예산 위험/섹션 수/추정 비용 합계), warnings, 기존 prompt 길이 vs preview 길이 diff. 상단에 "이 미리보기는 실제 LLM 호출에 사용된 프롬프트가 아니라, Harness 기준으로 조립했을 때의 예시입니다." 안내 고정.
    - **여전히 금지**: 실제 prompt payload 변경, LLM call payload 변경, retrieval query 변경, provider switching, hard enforcement, automatic context pruning, DB schema 변경.
11. **Harness Phase H2 — Apply-readiness Preparation Layer** (dry-run readiness; 유지) — 최근 promptTrace를 누적 집계해 "Harness preview가 실제 적용 후보 수준인지" 진단하는 단계. **실제 prompt payload·LLM 호출·retrieval·provider·Cursor execution·GitHub PR/merge 어디에도 영향 없음.**
    - 신규 모듈: `apps/web/src/lib/harness/promptAssembly/`
      - `harnessPromptApplyReadinessTypes.ts` — `HarnessPromptApplyReadinessLevel`(`not_ready`/`watch`/`ready_candidate`), `HarnessPromptApplyReadinessFinding { code, severity, message }`, `HarnessPromptApplyReadinessReport { mode: "dry_run_readiness", level, sampledEntryCount, previewEntryCount, missingSectionRate, highOverflowRiskRate, warningRate, averageExistingPromptLength, averagePreviewLength, findings }`. mode는 항상 `"dry_run_readiness"` — apply가 아닌 readiness.
      - `evaluateHarnessPromptApplyReadiness.ts` — 최근 N entry의 preview/diff를 안전 집계. threshold(`HARNESS_APPLY_READINESS_THRESHOLDS`)는 상수화: not_ready(누락≥50%·위험≥50%·경고≥70%), watch(누락≥20%·위험≥20%·경고≥30%), 그 외 ready_candidate. `sampleLimit`은 1 ≤ value ≤ 50으로 정규화.
    - Diagnostic API(`GET /api/diagnostics/overlay-runtime?projectId=...`)에 `harnessPromptApplyReadinessReport` 추가. `overlayMaturity.harnessApplyReadinessPreparationLayer: true`, `harnessPromptApplyReadinessEnabled: true`.
    - UI: 신규 `HarnessApplyReadinessSummaryCard` (Prompt Timeline 상단; `Overlay 보기` 토글이 ON일 때만 노출). dry-run 진단 안내 고정 + 레벨 배지(`준비 부족`/`관찰 필요`/`적용 후보`) + 샘플·Preview 수·누락/위험/경고 비율·평균 길이·진단 findings. 적용 버튼·단정 표현 없음.
    - UI adapter: `harnessPromptApplyReadinessUiAdapter` — `HarnessPromptApplyReadinessReport` → VM 변환. 비율 % 포맷, 한국어 레벨/severity 라벨, 임계 헬프 텍스트 노출.
    - **여전히 금지**: 실제 prompt payload·LLM call payload 변경, retrieval query 변경, provider switching, hard enforcement, automatic pruning, DB schema·Prisma 변경, selectedAgents/platformAiMembers 구조 변경, "적용 가능" 단정 표현, 적용 트리거 UI.
12. **Harness Phase H3 — Role-aware Knowledge Activation Harness Layer** (현재; planning metadata only) — "AI 역할·프로젝트 단계·작업 유형에 따라 어떤 지식팩이 왜 활성화 후보가 되었는가"를 설명 가능한 구조로 만드는 단계. **실제 retrieval query·vector search·prompt payload·LLM 호출·provider·Cursor execution·GitHub PR/merge 어디에도 영향 없음.**
    - 신규 모듈: `apps/web/src/lib/harness/knowledgeActivation/`
      - `knowledgeActivationPolicyTypes.ts` — `KnowledgeActivationPriority`(`required`/`recommended`/`optional`), `KnowledgeActivationReasonType`(`role_policy`/`stage_policy`/`task_type_policy`/`project_context`/`manual_selection`/`safety_requirement`/`existing_hint`), `KnowledgeActivationPlanItem { knowledgePackId, priority, reasonType, reasonLabel, roleKey?, workspaceStage?, taskType? }`, `KnowledgeActivationFinding { code, severity, message }`, `KnowledgeActivationPlan { mode: "dry_run", roleKey, workspaceStage, taskType, items, findings }`, `KnowledgeActivationSummary`. mode는 항상 `"dry_run"` — apply가 아닌 planning.
      - `knowledgeActivationRolePolicy.ts` — 역할별 지식팩 후보 단일 출처(`planner/architect/developer/security/reviewer/analyst/designer`). kebab-case ID만 사용 → 향후 지식팩 등록 체계와 충돌 회피.
      - `knowledgeActivationStagePolicy.ts` — 프로젝트 단계 정책(`idea-refinement`/`service-flow`/`feature-definition`/`prototype-build`/`prototype-review`/`security-review`) + 단계 alias 정규화(`ideation` → `idea-refinement` 등).
      - `knowledgeActivationTaskPolicy.ts` — 작업 유형 정책(`planning`/`analysis`/`architecture`/`design`/`development`/`review`/`security`/`deployment`) + 역할-스타일 alias.
      - `deriveKnowledgeActivationTaskType.ts` — `decisionAxis`/`roleKey`/`workspaceStage` 입력을 안전하게 단일 task type으로 추론(실패 시 null).
      - `buildKnowledgeActivationPlan.ts` — role + stage + task policy 후보 수집 → `overlayKnowledgeActivationHints` 병합 → dedupe + `required > recommended > optional` priority merge → reasonType rank 기반 결정론적 정렬(상한 `KNOWLEDGE_ACTIVATION_ITEMS_MAX=24`, `KNOWLEDGE_ACTIVATION_FINDINGS_MAX=6`). `NO_ROLE_POLICY_MATCH`/`NO_STAGE_POLICY_MATCH`/`NO_TASK_POLICY_MATCH`/`NO_KNOWLEDGE_HINTS`/`DUPLICATE_PACK_MERGED` finding 생성.
      - `knowledgeActivationCoerce.ts` — replay/persist 안전 파싱. mode 강제, 잘못된 priority는 `optional` fallback, 잘못된 reasonType drop, items/findings 상한 cap.
    - 데이터 흐름: `overlayPromptTraceAugment`가 plan을 만들어 `RequirementsPromptTimelineEntry.knowledgeActivationPlan?`로 attach → coerce로 안전하게 persist/restore → `overlayPromptTraceExtract`가 replay 시 복원. 기존 `overlayKnowledgeActivationHints`는 그대로 유지(병합 입력으로 사용; payload 영향 없음).
    - Diagnostic API: `knowledgeActivationSummary { mode, total, required, recommended, optional, rolePolicyDriven, stagePolicyDriven, taskTypePolicyDriven, existingHintDriven, findingsCount }` 추가. `harnessRoleAwareKnowledgeActivationEnabled: true`, `overlayMaturity.harnessRoleAwareKnowledgeActivationLayer: true`.
    - UI adapter: `knowledgeActivationUiAdapter` — `KnowledgeActivationPlanVM { hasData, disclaimer, roleLabel, stageLabel, taskTypeLabel, totalLabel, requiredLabel, recommendedLabel, optionalLabel, reasonBreakdownText, items, findings }` 변환. 한국어 priority/reasonType/severity 라벨(필수/추천/선택 · 역할 기준/단계 기준/작업 유형 기준/기존 힌트/보안 기준).
    - UI: 신규 `OverlayKnowledgeActivationSection` — Overlay 탭 안에서 후보 지식팩 카드 리스트 + finding list 표시. "이 정보는 실제 검색/검색결과 주입이 아니라, …" 안내 고정. 적용 트리거·"실제 활성화" 단정 표현 없음.
    - **여전히 금지**: 실제 retrieval orchestration, vector search control, automatic retrieval, actual prompt injection, provider routing, hard enforcement, automatic pruning, selectedAgents/platformAiMembers 구조 변경, DB schema·Prisma 변경, "지식팩이 활성화/주입되었다" 단정 표현.
13. **Harness Phase H4 Preparation — Memory Runtime Harness Layer** (planning metadata only) — "AI가 이번 턴에 어떤 기억을 왜 참조 후보로 삼았는가"를 설명 가능한 구조로 만드는 단계. **실제 prompt payload·LLM 호출·retrieval·vector DB·provider·Cursor execution·GitHub PR/merge 어디에도 영향 없음.**
    - 신규 모듈: `apps/web/src/lib/harness/memoryRuntime/`
      - `memoryRuntimeTypes.ts` — `MemoryScopeType`(기존 `MemoryScope` 재사용), `MemoryFreshness`(`fresh`/`aging`/`stale`), `MemoryRuntimeReference { memoryId, scope, summary, freshness, selectedReason, selectedBy, estimatedImportance }`, `MemoryRuntimeFinding { code, severity, message }`, `MemoryRuntimePlan { mode: "dry_run", roleKey, references, findings }`, `MemoryRuntimeSummary`. mode는 항상 `"dry_run"` — planning이 아닌 적용 아님.
      - `memoryRuntimeRolePolicy.ts` — 역할별 선호 스코프/키워드 단일 출처. 7개 역할(planner/architect/developer/security/reviewer/analyst/designer) + `MEMORY_RUNTIME_DEFAULT_POLICY` fallback.
      - `evaluateMemoryFreshness.ts` — `lastReferencedAt`/`now`/`conflictDetected` 입력으로 `fresh`(24h 이내) / `aging`(14d 이내) / `stale`(그 외 또는 충돌) 판정. 임계값(`MEMORY_FRESHNESS_THRESHOLDS_MS`) 상수화.
      - `buildMemoryRuntimePlan.ts` — overlay metadata + 최근 timeline + working context를 입력으로 결정론적 후보 정렬·dedupe·findings 생성. 상한(`MEMORY_RUNTIME_REFERENCE_MAX=12`, `MEMORY_RUNTIME_FINDINGS_MAX=6`).
      - `memoryRuntimeCoerce.ts` — replay/persist 안전 파싱. mode 강제, 잘못된 reference/finding 조용히 drop, 상한 cap.
    - 데이터 흐름: `overlayPromptTraceAugment`가 plan을 만들어 `RequirementsPromptTimelineEntry.memoryRuntimePlan?`로 attach → coerce로 안전하게 persist/restore → `overlayPromptTraceExtract`가 replay 시 복원.
    - Diagnostic API: `memoryRuntimeSummary { mode, total, fresh, aging, stale, platformScoped, projectScoped, roleScoped, sessionScoped, workingScoped, findingsCount }` 추가. `harnessMemoryRuntimePlanningEnabled: true`, `overlayMaturity.harnessMemoryRuntimePreparationLayer: true`.
    - UI adapter: `memoryRuntimeUiAdapter` — `MemoryRuntimePlanVM { hasData, disclaimer, roleLabel, totalLabel, freshLabel, agingLabel, staleLabel, scopeBreakdownText, references, findings }` 변환. 한국어 스코프/freshness/severity 라벨.
    - UI: 신규 `OverlayMemoryRuntimeSection` — Overlay 탭 안에서 후보 메모리 카드 리스트 + finding list 표시. "이 정보는 실제 장기기억 …" 안내 고정. 적용 트리거·"실제 기억" 단정 표현 없음.
    - **여전히 금지**: 실제 prompt payload·LLM call payload 변경, retrieval orchestration, vector DB orchestration, provider switching, hard enforcement, automatic pruning, memory persistence orchestration, autonomous memory update, DB schema·Prisma 변경.
14. **Harness Phase H4.5 — Memory Runtime Harness Stabilization Layer** (planning metadata only) — H4의 입력 품질, scope 판단, stale 탐지, 누적 진단, UI 표현을 안정화한다. **여전히 실제 prompt payload·LLM 호출·retrieval·vector DB·provider·Cursor execution·GitHub PR/merge 어디에도 영향 없음.** 실제 장기기억 저장/검색/주입은 도입하지 않는다.
    - **Timeline memory input normalization**: `apps/web/src/lib/harness/memoryRuntime/internal/timelineMemoryInputs.ts` — 신규 `normalizeTimelineMemoryMessages()` 도입. 빈 문자열·10자 미만 noise·동일 문장 중복·`SUCCESS`/`OK`/`undefined`/`null`/`{}`/`[]`/`HTTP 200` 등 디버그 마커·내용 없는 bracket 문자열 제거. 한국어 문장은 유지. `extractDirectionalKeywordsFromTimelineMessages` / `buildMemoryRuntimeEntriesFromTimelineMessages` / `pickRecentUserTextFromTimelineMessages`가 정규화된 결과만 사용한다(단일 출처).
    - **Memory scope classifier**: `memoryRuntimeScopeClassifier.ts` 신규 — `classifyMemoryRuntimeScope({ source, memoryId, roleKey, workspaceScreenKey })`. 우선순위: explicit scope token(`role-`/`session`/`working`/`project`/`platform`) → role token + roleKey → project token → working token/workspaceScreenKey 매치 → session token → fallback `working`. 기존 `resolveMemoryScopeFromSource`는 그대로 유지하고 Memory Runtime planner 내부에서만 사용.
    - **Stale detection / conflict rules**: `memoryRuntimeConflictRules.ts` 신규 — 카테고리별 상반 키워드 테이블(architecture: monolith ↔ microservice, client/server-side; auth: session ↔ jwt, cookie ↔ bearer token; storage: localStorage ↔ server DB, sql ↔ nosql; deployment: on-premise ↔ cloud, static ↔ server runtime). `detectMemoryRuntimeDirectionalConflict({ memoryText, currentDirectionalKeywords }): boolean`이 결과를 `evaluateMemoryFreshness`의 `conflictDetected`로 전달해 stale 강등을 안정화. **warning only** — 실제 메모리 삭제·persistence 영향 없음.
    - **Recent memory runtime summary**: `memoryRuntimeRecentSummary.ts` 신규 — `summarizeRecentMemoryRuntimePlans({ plans }): RecentMemoryRuntimeSummary`. 최근 N개 promptTrace의 `memoryRuntimePlan`을 비율 기반(`staleReferenceRate`/`agingReferenceRate`/`freshReferenceRate`/`roleScopedRate`/`projectScopedRate`/`workingScopedRate`/`findingRate`)으로 누적 집계.
    - Diagnostic API: `recentMemoryRuntimeSummary` 응답 필드 추가(projectId 없으면 empty). `overlayArchitecturePhase.current = "harness-memory-runtime-stabilization-layer"`, `harnessMemoryRuntimeStabilizationEnabled: true`, `overlayMaturity.harnessMemoryRuntimeStabilizationLayer: true`.
    - **PromptTrace replay coerce 보강**: `memoryRuntimeCoerce.ts` — invalid scope/freshness는 row drop 대신 보수적 fallback(`working` / `aging`)으로 흡수해 replay 안정성을 확보. `mode !== "dry_run"` reject, 상한 cap, oversized reference truncate는 그대로.
    - UI: `memoryRuntimeUiAdapter` — freshness label을 "최신/확인 필요/오래됨·충돌 가능"으로 보강, 항목 라벨을 "선택 사유 / 선택 기준 / 중요도 추정"으로 사용자 표현화. plan VM에 `staleWarning { visible, label, tone }` 노출. `OverlayMemoryRuntimeSection`이 stale 후보 발생 시 강조 배너 표시.
    - **여전히 금지**: 실제 prompt payload·LLM call payload 변경, retrieval orchestration, vector DB orchestration, provider switching, hard enforcement, automatic pruning, memory persistence orchestration, autonomous memory update, DB schema·Prisma 변경, breaking API 변경.
15. **Harness Phase H5 — Execution Routing Harness Preparation Layer** (planning metadata only) — "어떤 AI멤버가 어떤 실행 capability를 가질 수 있는가"를 planning metadata로 설명 가능한 상태를 만든다. **실제 provider switching·execution routing·automatic Cursor execution·GitHub PR/merge·retrieval orchestration 어디에도 영향 없음.**
    - 신규 모듈: `apps/web/src/lib/harness/executionRouting/` 폴더 일괄
      - `executionCapabilityTypes.ts` — `ExecutionCapability`(planning/analysis/architecture_review/design_review/code_generation/code_review/security_review/quality_review/deployment_review/cursor_execution/github_operation), `ExecutionProviderType`(openai/cursor/github/unknown), `ExecutionRoutingPlanItem`, `ExecutionRoutingFinding`, `ExecutionRoutingPlan`(mode 항상 `"dry_run"`), `ExecutionRoutingSummary`, `summarizeExecutionRoutingPlan`, `emptyExecutionRoutingPlan`/`emptyExecutionRoutingSummary`.
      - `executionRoutingRolePolicy.ts` — 역할별 capability 후보 표(planner/architect/developer/security/reviewer/analyst/designer). 매칭 실패 시 default 빈 정책.
      - `providerCapabilityMatrix.ts` — provider별 capability 매트릭스, `resolveRecommendedProviderForCapability`(cursor > github > openai > unknown), `providerSupportsCapability`.
      - `buildExecutionRoutingPlan.ts` — `buildExecutionRoutingPlan({ roleKey, providerHints, workspaceStage }): ExecutionRoutingPlan`. 결정론적 정렬(capability asc → provider asc). 우선순위: hint+지원 → hint+비지원(첫 hint 채택, warning) → 추천 → unknown. findings: `NO_ROLE_POLICY_MATCH`/`NO_PROVIDER_HINTS`/`UNSUPPORTED_CAPABILITY`.
      - `executionRoutingCoerce.ts` — replay/persist 안전 파싱. `mode === "dry_run"`만 허용, 잘못된 provider는 `"unknown"` fallback, 필수 필드(roleKey/capability/reason) 누락 row drop, 상한 cap(items 64, findings 16).
    - 데이터 흐름: `overlayPromptTraceAugment`가 plan을 만들어 `RequirementsPromptTimelineEntry.executionRoutingPlan?`로 attach → coerce로 안전하게 persist/restore → `overlayPromptTraceExtract`가 replay 시 복원. 기본 augment 호출은 provider hint 없이(역할만 입력) 호출하여 식별자 provider 노이즈를 방지.
    - Diagnostic API: `executionRoutingSummary { mode, total, roles, providers, capabilities, warnings, enabledCount, disabledCount, findingsCount }` 응답 필드 추가. `overlayArchitecturePhase.current = "harness-execution-routing-preparation-layer"`, `harnessExecutionRoutingPlanningEnabled: true`, `overlayMaturity.harnessExecutionRoutingPreparationLayer: true`.
    - UI: 신규 `executionRoutingUiAdapter` — `ExecutionRoutingPlanVM { hasData, disclaimer, roleLabel, stageLabel, totalLabel, enabledLabel, disabledLabel, providerBreakdownText, capabilityBreakdownText, unsupportedWarning { visible, label, tone }, items, findings }` 변환. 한국어 capability/provider/severity 라벨. `OverlayExecutionRoutingSection`이 Overlay 탭에서 capability 카드 리스트 + finding list + unsupported warning 배너 표시. 안내 문구: "이 정보는 실제 실행 강제가 아니라, 현재 역할 기준으로 어떤 실행 capability를 고려하는지 보여주는 계획 정보입니다.".
    - **여전히 금지**: 실제 provider switching·execution routing·automatic Cursor execution·actual retrieval orchestration·hard enforcement·execution blocking·provider lock-in·Stage1/Stage2·ENV_TEST·Cursor execution 로직·GitHub PR/merge·DB migration·Prisma schema·selectedAgents/platformAiMembers 구조 변경·breaking API 변경.
16. **Harness Phase H5.5 — Execution Routing Safety & Explainability Stabilization Layer** (planning metadata + dry-run safety diagnostic only) — H5의 plan이 "실제 실행"으로 오해되거나 자동 연결되지 않도록 safety guard·explainability·누적 진단을 보강한다. **여전히 실제 provider switching·execution routing·automatic Cursor execution·GitHub operation·execution blocking 어디에도 영향 없음.** 정책 테이블은 강제 규칙이 아니라 capability **추천** / capability **compatibility reference**일 뿐이다.
    - 신규 모듈 (`apps/web/src/lib/harness/executionRouting/`):
      - `executionRoutingSafetyTypes.ts` — `ExecutionRoutingSafetyStatus`(`safe_dry_run`/`watch`/`unsafe_to_apply`), `ExecutionRoutingSafetyFinding`, `ExecutionRoutingSafetyReport`(`mode: "dry_run_safety"` + `providerSwitchingEnabled: false` + `executionBlockingEnabled: false` + `automaticExecutionEnabled: false` **타입 시스템에서 강제**), `emptyExecutionRoutingSafetyReport`, `executionRoutingSafetyStatusRank`.
      - `evaluateExecutionRoutingSafety.ts` — `evaluateExecutionRoutingSafety({ plan }): ExecutionRoutingSafetyReport`. 임계: disabled rate ≥ 0.5 / warning rate ≥ 0.5 / `unknown` provider + 민감 capability(`cursor_execution|github_operation`) 동시 → `unsafe_to_apply`; disabled≥1 또는 warning≥1 또는 hint 기반 unsupported 존재 → `watch`; 그 외 → `safe_dry_run`. findings: `MODE_NOT_DRY_RUN`/`HIGH_DISABLED_RATE`/`DISABLED_CAPABILITIES_PRESENT`/`HIGH_WARNING_RATE`/`UNSUPPORTED_PROVIDER_HINT`/`UNKNOWN_PROVIDER_SENSITIVE_CAPABILITY` + `DRY_RUN_SAFETY_PIN`(항상 노출). **실제 apply 판단 아님 — 어떤 자동 차단/routing/execution도 발생시키지 않음.**
      - `executionRoutingRecentSummary.ts` — `summarizeRecentExecutionRoutingPlans({ plans }): RecentExecutionRoutingSummary { sampledEntryCount, planEntryCount, totalItems, disabledItemRate, warningItemRate, unknownProviderRate, cursorCapabilityRate, githubCapabilityRate, findingRate }`. 최근 N개 promptTrace의 `executionRoutingPlan`을 비율 기반으로 누적 집계.
    - **PromptTrace 보강**: `RequirementsPromptTimelineEntry.executionRoutingSafetyReport?` optional 추가. `overlayPromptTraceAugment`가 plan을 만든 직후 `evaluateExecutionRoutingSafety`로 report 계산 → attach. `executionRoutingCoerce`에 `parseExecutionRoutingSafetyReportFromUnknown` / 통합 `coerceExecutionRoutingMetadata` 보강(invalid status → `safe_dry_run` fallback, 안전 플래그는 입력 무관 `false` 고정).
    - **Diagnostic API**: `executionRoutingSafetyReport`, `recentExecutionRoutingSummary` 응답 필드 추가. replay된 safety report가 있으면 우선 사용, 없으면 plan으로부터 즉시 평가(자동 차단 없음). `overlayArchitecturePhase.current = "harness-execution-routing-safety-stabilization-layer"`, `harnessExecutionRoutingSafetyStabilizationEnabled: true`, `overlayMaturity.harnessExecutionRoutingSafetyStabilizationLayer: true` 플래그 추가.
    - **UI 보강** (`executionRoutingUiAdapter`, `OverlayExecutionRoutingSection`):
      - reason raw key → 사용자 표현 라벨 매핑(`role_policy_recommended:* → 역할 정책상 추천`, `provider_hint_matched:* → 외부 힌트와 일치`, `provider_hint_unsupported:* → 외부 힌트와 capability 불일치`, `no_provider_recommendation → 추천 provider 없음`).
      - `ExecutionRoutingSafetyVM` — `statusLabel`(`안전한 미리보기`/`관찰 필요`/`적용 부적합`) + tone, `flags`(`Provider 자동 전환 안 함` / `실행 차단 안 함` / `자동 실행 안 함` — 모두 `false` 고정 표시), `summaryLine`(전체/미지원/경고/외부 힌트 카운트), safety findings 변환.
      - `ExecutionRoutingRecentTrendVM` — 누적 비율을 0–100% 정수 라벨로 표현(미지원 비율/경고 비율/미지정 provider/Cursor 계열/GitHub/진단 발생 plan).
      - `OverlayExecutionRoutingSection`이 상단에 Safety block(상태 배지·플래그 배지·디스클레이머·진단 리스트) 표시. plan disclaimer 문구 H5.5 카피로 갱신: "이 정보는 실제 실행 경로가 아니라, 현재 역할 기준으로 고려 가능한 실행 capability 계획입니다."
    - **하드코딩 방지 원칙(문서/UI 양쪽 합치)**: role policy는 default **recommendation**, provider matrix는 capability **compatibility reference**. final routing decision은 별도 승인/정책/사용자 확인 이후 단계. `mode !== "dry_run"`, `mode !== "dry_run_safety"`는 모두 reject.
    - **여전히 금지**: 실제 provider switching, execution routing, automatic Cursor execution, GitHub operation 자동 실행, hard enforcement, execution blocking, provider lock-in, retrieval orchestration, vector search, actual prompt payload/LLM call payload 변경, Stage1/Stage2/ENV_TEST/Cursor execution 로직, GitHub PR/merge 로직 변경, DB migration·Prisma schema·selectedAgents/platformAiMembers 구조 변경, breaking API 변경.
17. **Harness Phase H6 — Review / Security Harness Preparation Layer** (planning metadata only) — "AI검수자(AI Reviewer)와 AI보안관(AI Security Auditor)이 어떤 기준으로 결과물을 검토해야 하는가"를 review/security checklist planning metadata로 설명 가능한 상태를 만든다. **실제 보안 스캔·코드 리뷰 실행·이슈 등록·머지 차단·PR 게이트·remediation 자동 실행 어디에도 영향 없음.** 정책 표는 강제 규칙이 아니라 **검토 기준 추천**이다.
    - 신규 모듈 (`apps/web/src/lib/harness/reviewSecurity/`):
      - `reviewSecurityHarnessTypes.ts` — `ReviewSecurityArea`(requirements/architecture/uiux/code_quality/security/privacy/deployment/operations), `ReviewSecuritySeverity`(info/warning/critical_candidate), `ReviewSecurityStandard`(jy_orchestration_baseline/owasp_top10/owasp_llm_top10/owasp_asvs/mitre_cwe_top25/internal_quality_standard), `ReviewSecurityChecklistItem`, `ReviewSecurityFinding`, `ReviewSecurityHarnessPlan`(mode 항상 `"dry_run_review_security"`), `ReviewSecuritySummary`, `summarizeReviewSecurityHarnessPlan`, `empty*` helper.
      - `reviewSecurityStandardPolicy.ts` — 역할(reviewer/security/planner/architect)별 표준 checklist 후보 표 + code capability booster + workspaceStage booster + 보안 지식팩 booster. severity rank/area·standard 표시 순서 단일 출처.
      - `buildReviewSecurityHarnessPlan.ts` — `buildReviewSecurityHarnessPlan({ roleKey, workspaceStage, executionRoutingPlan, knowledgeActivationPlan, memoryRuntimePlan })`. 결정론적 정렬(severity desc → area order → standard order → id asc), 상한(`REVIEW_SECURITY_CHECKLIST_MAX=24`, `REVIEW_SECURITY_FINDINGS_MAX=6`). findings: `NO_REVIEW_ROLE_MATCH`/`SECURITY_REVIEW_RECOMMENDED`/`CODE_GENERATION_WITHOUT_SECURITY_CHECKLIST`/`SECURITY_KNOWLEDGE_ACTIVATION_PRESENT`/`REVIEW_PLAN_DRY_RUN_ONLY`(항상 노출).
      - `reviewSecurityHarnessCoerce.ts` — replay/persist 안전 파싱. `mode === "dry_run_review_security"`만 허용. invalid area/standard/severity는 drop 또는 `"info"` fallback. 중복 id 제거. 상한 cap(checklist 32, findings 12).
      - `reviewSecurityRecentSummary.ts` — `summarizeRecentReviewSecurityPlans({ plans }): RecentReviewSecuritySummary { sampledEntryCount, planEntryCount, totalChecklistItems, securityItemRate, codeQualityItemRate, criticalCandidateRate, findingRate }`. 최근 N개 promptTrace의 `reviewSecurityHarnessPlan`을 비율 기반(0–1) 누적 집계.
    - **PromptTrace 보강**: `RequirementsPromptTimelineEntry.reviewSecurityHarnessPlan?` optional 추가. `overlayPromptTraceAugment`가 H3/H4/H5 plan 직후 `buildReviewSecurityHarnessPlan`을 호출해 attach. `coerceReviewSecurityHarnessMetadata`가 ideation bootstrap timeline coerce + overlay extract 양쪽에서 안전하게 복원.
    - **Diagnostic API**: `reviewSecuritySummary`, `recentReviewSecuritySummary` 응답 필드 추가. H6 단계에서는 `overlayArchitecturePhase.current = "harness-review-security-preparation-layer"` 등으로 노출되었으며, **H6.5 도입 후 현재 phase 플래그는 H6.5(아래 18항)를 따른다** — H6 요약 필드는 호환을 위해 그대로 유지된다.
    - **UI**: 신규 `reviewSecurityUiAdapter` — area/standard/severity/reason 한국어 라벨 + tone 매핑, `ReviewSecurityPlanVM { hasData, disclaimer, roleValue, stageValue, totalLabel, criticalCandidatesLabel, areaBreakdown, standardLabels, items, findings }`, `ReviewSecurityRecentTrendVM`. 신규 `OverlayReviewSecuritySection`이 Overlay 탭에서 checklist 카드 리스트 + finding 리스트를 표시. 안내 문구 고정: "이 정보는 실제 보안 차단이나 머지 게이트가 아니라, 현재 역할과 단계 기준으로 어떤 검토 기준을 적용할지 보여주는 계획 정보입니다.".
    - **하드코딩 방지 원칙(문서/UI 양쪽 합치)**: role policy / code capability booster / 보안 지식팩 booster는 모두 **검토 기준 추천**일 뿐 actual issue 등록·머지 차단·remediation 실행이 아니다. `mode !== "dry_run_review_security"`는 모두 reject.
    - **여전히 금지**: actual merge blocking, actual PR gate, automatic security blocking, automatic remediation, actual security scan, actual code review execution, automatic issue registration, Cursor execution 변경, GitHub PR/merge 로직 변경, Stage1/Stage2/ENV_TEST 변경, provider switching, retrieval orchestration, vector search, actual prompt payload/LLM call payload 변경, DB migration·Prisma schema·selectedAgents/platformAiMembers 구조 변경, breaking API 변경.
18. **Harness Phase H6.5 — Review / Security Safety & Issue Planning Stabilization Layer** (현재; planning metadata only) — H6 checklist·H5.5 execution routing safety·H4 stale memory 힌트를 입력으로 **조치 가능한 issue 후보(issue candidate)** 와 **remediation loop dry-run 계획**을 구조화한다. **실제 이슈 등록·머지 차단·PR 게이트·task 생성·assignment·Cursor 실행·remediation 자동 실행·재점검 자동 실행 어디에도 영향 없음.** H6.5는 "검토 기준을 이슈 후보·조치 루프 계획으로 정리하는 설명 계층"일 뿐이다.
    - 신규 모듈 (`apps/web/src/lib/harness/reviewSecurity/`):
      - `reviewSecurityIssueTypes.ts` — `ReviewSecurityIssuePlanMode = "dry_run_issue_planning"`, `RemediationLoopPlanMode = "dry_run_remediation_loop"`, `ReviewSecurityIssueStatus`, `ReviewSecurityRemediationActionType`, `RemediationLoopStepType`, `ReviewSecurityIssueCandidate`, `ReviewSecurityIssuePlanningFinding`, `ReviewSecurityIssuePlanningReport`, `RemediationLoopPlan` / `RemediationLoopStep`, `ReviewSecurityIssuePlanningSummary`, `RemediationLoopSummary`, `summarizeReviewSecurityIssuePlanningReport` / `summarizeRemediationLoopPlan`, `empty*` helper.
      - `buildReviewSecurityIssuePlanningReport.ts` — checklist 항목을 issue 후보로 변환 + `unsafe_to_apply`/`watch` safety 시 synthetic issue + stale memory 시 synthetic issue. 결정론적 정렬·상한(`REVIEW_SECURITY_ISSUE_MAX` 등). findings: `ISSUE_PLAN_DRY_RUN_ONLY`(항상)·`CRITICAL_CANDIDATE_PRESENT`·`SECURITY_RECHECK_RECOMMENDED`·`EXECUTION_ROUTING_UNSAFE_REVIEW_REQUIRED`·`EXECUTION_ROUTING_WATCH_REVIEW_RECOMMENDED`·`STALE_MEMORY_REVIEW_RECOMMENDED` 등.
      - `buildRemediationLoopPlan.ts` — issue report 입력으로 `review`→`assign`→`fix`→`recheck`→`final_review` step 시퀀스(데이터 없으면 empty loop + dry-run finding만).
      - `reviewSecurityIssueCoerce.ts` — `coerceReviewSecurityIssuePlanningMetadata` / `parseReviewSecurityIssuePlanningReportFromUnknown` / `parseRemediationLoopPlanFromUnknown`. mode reject, invalid enum fallback/drop, 리스트 상한 cap.
      - `reviewSecurityIssueRecentSummary.ts` — `summarizeRecentReviewSecurityIssuePlans({ reports }): RecentReviewSecurityIssueSummary` (security/critical/needsRemediation/finding 비율 등).
    - **PromptTrace 보강**: `RequirementsPromptTimelineEntry.reviewSecurityIssuePlanningReport?` / `remediationLoopPlan?` optional 추가. `overlayPromptTraceAugment`가 H6 plan 직후 issue report + remediation loop를 계산해 attach. `requirementsIdeationBootstrapPromptTimeline` + `overlayPromptTraceExtract`가 `coerceReviewSecurityIssuePlanningMetadata`로 복원.
    - **Diagnostic API**: `reviewSecurityIssuePlanningSummary`, `remediationLoopSummary`, `recentReviewSecurityIssueSummary` 응답 필드 추가. `overlayArchitecturePhase.current = "harness-review-security-issue-planning-layer"`, `harnessReviewSecurityIssuePlanningEnabled: true`, `overlayMaturity.harnessReviewSecurityIssuePlanningLayer: true` (H6 maturity 플래그는 true 유지).
    - **UI**: `reviewSecurityIssueUiAdapter.ts` — issue/remediation/recent trend VM. `OverlayReviewSecurityIssueSection` · `OverlayRemediationLoopSection` — 후보 수·severity·status·권장 조치·duplicate group·loop step·actor·dry-run disclaimer(「실제 이슈 등록이나 머지 차단이 아니라…」 카피). `OverlaySummaryCard` / `overlayUiAdapter`에 `reviewSecurityIssue`·`remediationLoop` section default.
    - **하드코딩 방지**: `mode !== "dry_run_issue_planning"` / `mode !== "dry_run_remediation_loop"`는 coerce에서 reject. UI·문서에 **이슈 후보 = 실제 티켓 등록 아님**을 반복 명시.
    - **여전히 금지**: H6 항목과 동일 — 특히 actual issue registration, actual remediation execution, automatic recheck, merge gate, PR blocking.
19. **Message-level Explainability UI** (다음 단계 준비) — **미도입**. SingleChat 메시지 단위에 [AI 판단 보기] 확장(역할 선택 이유·knowledge activation·context summary·warning·budget risk) 노출. **여전히 read-only**.
20. **Runtime Policy Enforcement Layer** (향후) — **미도입** (hard gate·Cursor 차단·라우팅 강제 없음).

> Harness 단계 순서는 **H1 → H2 → H3 → H4 → H4.5 → H5 → H5.5 → H6 → H6.5**로 정렬되어 있다. 위 phase list는 도입 순서가 아니라 **권장 학습 순서**(Controlled Preview → Apply-readiness → Knowledge Activation → Memory Runtime → Memory Runtime Stabilization → Execution Routing → Execution Routing Safety → Review/Security checklist → Review/Security issue & remediation loop planning)로 읽는다.

### Contract → Runtime Metadata → Runtime Policy

- **Contract**: `aiIdentityContract`·`memoryScopeContract`·`contextAssemblyContract`·`activeKnowledgePackRef` 등 타입과 `overlayRuntimeResolver`의 정적 행(역할별 identity·기본 memory/knowledge scope).
- **Runtime Metadata**: 오케스트레이션·리뷰 경로가 기록하는 값 — `promptTrace`의 `overlayIdentity` / `overlayContextAssembly` / `overlayKnowledgeActivationHints` / `overlayPolicyHints` / **`overlayPolicyWarnings`** / **`overlaySelectedContextRefs`** / **`overlayContextBudget`** / **`overlayConflictWarnings`** / **`overlayOrchestrationDecisionTrace`** / **`harnessPromptAssemblyPreview`** / **`harnessPromptPreviewDiff`** / **`knowledgeActivationPlan`** / **`memoryRuntimePlan`** (H4.5에서 stale fallback·scope classifier·conflict rules·`recentMemoryRuntimeSummary` 진단으로 안정화) / **`executionRoutingPlan`** (H5에서 역할별 capability·provider 추천·unsupported 경고를 planning metadata로 진단) / **`executionRoutingSafetyReport`** (H5.5에서 dry-run safety status·provider switching/execution blocking/automatic execution false 강제·민감 capability 경고·`recentExecutionRoutingSummary` 누적 진단으로 안정화) / **`reviewSecurityHarnessPlan`** (H6에서 AI검수자/AI보안관 기준 review/security checklist planning metadata와 `reviewSecuritySummary`/`recentReviewSecuritySummary` 진단으로 검토 기준을 설명 — 실제 보안 스캔·머지 차단·이슈 등록 없음) / **`reviewSecurityIssuePlanningReport`** · **`remediationLoopPlan`** (H6.5에서 checklist·safety·stale memory를 issue 후보·조치 루프 **계획**으로 구조화; `reviewSecurityIssuePlanningSummary`·`remediationLoopSummary`·`recentReviewSecurityIssueSummary`는 진단 API 누적/단일턴 요약 — **실제 이슈 등록·조치 실행·머지 차단 없음**), Review 스텝의 동일 계열 필드(프롬프트 본문은 그대로).
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
| **읽기 전용 진단 API** | `GET /api/diagnostics/overlay-runtime` — `overlayPolicyWarningSummary`(경고 샘플 + **byCode/byRole/bySource**), **`overlayWarningReport`**, **`overlaySelectionSummary`**, **`overlayConflictSummary`**, **`overlayContextBudgetSummary`**, **`overlayArchitecturePhase`**, **overlayMaturity**, **enforcementStatus**, Harness 요약(H1 preview·H2 apply-readiness·H3 knowledge·H4 memory·H5 routing·H5.5 safety·H6 review-security·**H6.5** `reviewSecurityIssuePlanningSummary`·`remediationLoopSummary`·`recentReviewSecurityIssueSummary`), `?roles=`, `workspaceAiMemberOverlayMappings`, 선택 `?projectId=` 시 `projectOverlay`·`lastPromptTraceOverlayExtract`(**`reviewSecurityIssuePlanningReport`**·**`remediationLoopPlan`** 포함) |
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
- Overlay 런타임 스냅샷(JSON): `GET /api/diagnostics/overlay-runtime` (`overlayPolicyWarningSummary`, **`overlayWarningReport`**, **`overlaySelectionSummary`**, **`overlayConflictSummary`**, **`overlayContextBudgetSummary`**, **`overlayArchitecturePhase`**, **overlayMaturity**, **enforcementStatus**, Harness·Review/Security·**H6.5 issue/remediation** 요약 필드, `?roles=`, `?projectId=` + 로그인 시 `projectOverlay`·`lastPromptTraceOverlayExtract`, `workspaceAiMemberOverlayMappings`)
