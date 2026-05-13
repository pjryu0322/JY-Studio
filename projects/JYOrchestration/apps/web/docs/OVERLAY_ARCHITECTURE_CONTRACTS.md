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
| Warning 집계(byCode/byRole/bySource) | `apps/web/src/lib/overlay/overlayPolicyWarningSummary.ts` |
| Warning read-only 리포트 묶음 | `apps/web/src/lib/overlay/overlayWarningReport.ts` |
| 재export | `apps/web/src/lib/overlay/index.ts` |

기존 Stage1/2·Cursor launch·GitHub·retrieval 본문은 변경하지 않는다.

### 단계 모델 (현재 범위 명시)

1. **Contract Layer** — 타입·정적 resolver 행.
2. **Runtime Metadata Layer** — `promptTrace` / Review step에 optional overlay 필드 기록.
3. **Runtime Policy Helper Layer** — `overlayPolicy`의 `shouldEnable*`·`buildOverlayRuntimePolicyHintsWire`·`parseOverlayRuntimePolicyHintsWire`; **기록·진단만**, 차단 없음.
4. **Runtime Policy Diagnostic / Warning Layer** (현재) — `overlayPolicyWarnings`·`buildOverlayPolicyWarnings`·`summarizeOverlayPolicyWarnings`(요약에 **`byCode` / `byRole` / `bySource`** 포함); 진단 API `overlayPolicyWarningSummary`·**`overlayMaturity`**·**`enforcementStatus`**. **경고는 기록·진단만** 하며 실행 차단·pass/fail 변경 없음.
5. **Runtime Policy Enforcement Layer** (향후) — **미도입** (hard gate·Cursor 차단·라우팅 강제 없음).

### Contract → Runtime Metadata → Runtime Policy

- **Contract**: `aiIdentityContract`·`memoryScopeContract`·`contextAssemblyContract`·`activeKnowledgePackRef` 등 타입과 `overlayRuntimeResolver`의 정적 행(역할별 identity·기본 memory/knowledge scope).
- **Runtime Metadata**: 오케스트레이션·리뷰 경로가 기록하는 값 — `promptTrace`의 `overlayIdentity` / `overlayContextAssembly` / `overlayKnowledgeActivationHints` / `overlayPolicyHints` / **`overlayPolicyWarnings`**, Review 스텝의 동일 계열 필드(프롬프트 본문은 그대로).
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
| **읽기 전용 진단 API** | `GET /api/diagnostics/overlay-runtime` — `overlayPolicyWarningSummary`(경고 샘플 + **byCode/byRole/bySource**), **overlayMaturity**, **enforcementStatus**, `?roles=`, `workspaceAiMemberOverlayMappings`, 선택 `?projectId=` 시 `projectOverlay`·`lastPromptTraceOverlayExtract` |

### 아직 하지 않은 것 (Drift 방지)

- **현재 warning은 실행 차단이 아니다** (pass/fail·Cursor launch·retrieval 본문 비영향). Warning은 진단·감사·추적·향후 정책 설계를 위한 metadata다.
- **아직 없음**: hard enforcement, Cursor execution blocking, retrieval orchestration 변경, prompt injection policy, context budget enforcement, memory orchestration, provider orchestration.
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
- Overlay 런타임 스냅샷(JSON): `GET /api/diagnostics/overlay-runtime` (`overlayPolicyWarningSummary`에 **byCode/byRole/bySource**, **overlayMaturity**, **enforcementStatus**, `?roles=`, `?projectId=` + 로그인 시 `projectOverlay`·`lastPromptTraceOverlayExtract`, `workspaceAiMemberOverlayMappings`)
