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
| 재export | `apps/web/src/lib/overlay/index.ts` |

기존 Stage1/2·Cursor launch·GitHub·retrieval 본문은 변경하지 않는다.

### 2단계: 최소 런타임 연결 (완료 범위)

| 연결 | 설명 |
|------|------|
| **Identity resolve** | `resolveAiIdentityContract` 등 — 오케스트레이션 메타의 역할 문자열을 계약 행으로 매핑 |
| **Memory scope mapping** | `resolveMemoryScopeFromSource` / `buildPromptAssemblyMemoryRef` |
| **Prompt timeline metadata** | `requirementsChatOrchestration` 성공 시 `promptTrace`에 `overlayIdentity`, `overlayContextAssembly`, `overlayKnowledgeActivationHints` optional 필드 (`coerceRequirementsPromptTimelineEntry`에서 복원) |
| **Knowledge activation hint** | `resolveKnowledgeActivationHintsForRole` — synthetic id만, DB·retrieval 비침해 |
| **Review Harness helpers** | `selectExecutionReviewMembers`, `buildExecutionReviewBaseContext`, `executeReviewerStep`, `aggregateReviewerHarnessResult` |

### 아직 하지 않은 것 (Drift 방지)

- hard blocking (`canUseCursorByIdentity`는 힌트만)
- provider engine 단일 통합
- DB memory 스키마
- vector retrieval ↔ activation 자동 연결
- system prompt 본문에 perspective 강제 주입

## 진단 보고서·다운로드

- 본문: `apps/web/docs/platform-structure-diagnosis.md`
- 다운로드: `GET /api/diagnostics/platform-structure-report`
