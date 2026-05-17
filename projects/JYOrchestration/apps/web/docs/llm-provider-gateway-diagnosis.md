# JYOrchestration LLM Provider Gateway 소스 진단 보고서

**진단 일자**: 2026-05-16  
**범위**: `projects/JYOrchestration/**` (소스 조사만, 코드·스키마 변경 없음)  
**목적**: OpenAI/Gemini/CLOVA 등 LLM Provider를 선택·라우팅·호출·응답 표준화할 수 있는 **Gateway 구조가 동작 가능한 수준인지** 판별

> 필드(`aiProvider`, `aiModelOverride`, enum) 존재만으로 Gateway가 있다고 보지 않는다. 실제 호출 경로·dispatcher·credential resolver·adapter 추상화를 근거로 판단한다.

---

## 1. Provider Gateway 개념 구조 존재 여부

| 구성요소 | 존재 여부 | 관련 파일 | 현재 역할 | 실제 동작 여부 | 비고 |
|---|---:|---|---|---:|---|
| LLM Provider Gateway | 없음 | — | — | ✗ | 통합 게이트웨이 타입/모듈 없음 |
| Provider Router | 없음 (유사: Harness만) | `apps/web/src/lib/harness/executionRouting/*` | H5 **dry_run** 라우팅 **계획 메타** | ✗ (실행 비연동) | `ExecutionRoutingPlan.mode: "dry_run"` |
| Provider Registry | 없음 | `integrationRegistration.ts` | UI 등록 카드 정의 | △ (등록만) | Prisma `IntegrationProvider` enum |
| Model Registry | 없음 | `openAiEnv.ts`, `projectAiAgentEngineModel.ts` | env 기본값·UI 프리셋 | △ | DB 모델 카탈로그 테이블 없음 |
| Credential Resolver | 부분 | `resolveUserOpenAiApiKey.ts`, `workspaceAiEnginePreference.ts` (`resolveEnginePreferenceToUserIntegrationId`) | 사용자 OpenAI 키·핀 연동 ID 해석 | △ (OpenAI·핀 위주) | 멀티 provider 공통 resolver 아님 |
| Unified LLM Request | 없음 | — | — | ✗ | OpenAI 전용 `PostOpenAiChatCompletionInput`만 존재 |
| Unified LLM Response | 없음 | `openAiChatCompletions.ts` | OpenAI Chat Completions 래퍼 | △ (OpenAI만) | 공통 응답 타입 없음 |
| Usage Metering | 부분 | `openAiChatCompletions.ts`, `ProjectSpecWorkspaceResponse`, `TaskDraft` | 호출별 `usage` 파싱·일부 DB 저장 | △ | 비용·쿼터·중앙 집계 없음 |
| Fallback Policy | 부분·분산 | `knowledgePackDraftService.ts` (Mock fallback), env fallback flags | 기능별 ad-hoc | △ | Gateway 정책 아님 |
| Role/AI Member 기반 Provider Routing | 부분·메타만 | `executionRouting/*`, `singleChatAgentContext.ts` | 프롬프트 블록·진단·Harness | ✗ (provider 전환) | `aiProvider`는 executor 선택에 미사용 |

---

## 2. AI 멤버별 Provider/Model 설정 구조

### 2.1 필드·모델 매핑

| 항목 | DB 저장 | API 반영 | UI 반영 | 실행 반영 | 관련 파일 |
|---|---:|---:|---:|---:|---|
| `aiProvider` | ✓ `ProjectMember.aiProvider` | ✓ members/workspace-ai API | ✓ `ProjectMembersAdminClient`, `ProjectMembersSection` | △ | 실행 리뷰·SCM 등 일부 OpenAI 호출; **AI 액션 dispatcher는 미사용** |
| `aiModelOverride` | ✓ | ✓ | ✓ | △ | `executionReviewWithAiMembers.ts` (`resolveEffectiveReviewerModel`); SingleChat/bootstrap는 **주로 env 모델**, override는 **진단/타임라인 위주** |
| `aiAgentKey` | ✓ | ✓ | ✓ | △ | 표시·프롬프트·카탈로그 매핑; LLM 라우팅 키 아님 |
| `aiOrchestrationRole` | ✓ | ✓ | ✓ | △ | 오케스트레이션·리뷰어 선택·프롬프트 |
| `orchestrationStage` | ✓ | ✓ | ✓ | △ | 스테이지별 멤버 필터 |
| `providerKey` | ✓ `ProjectMemberAction.providerKey` | ✓ `aiMemberActionService` | △ 표시 | ✗ | executor payload·메타; **라우팅 미사용** |
| `executionMode` | ✓ | ✓ | △ | ✓ (STUB 등) | `selectExecutorForMode` — **OPENAI 모드는 shell 실패** |
| Workspace `enginePreference` / 핀 | ✓ `WorkspaceAiMember`, `AiMemberProvider` | ✓ `/api/project/workspace-ai` | ✓ AI 탭 | △ | `resolveEnginePreferenceToUserIntegrationId` — **대부분 SingleChat LLM은 env 키** |
| ANTHROPIC/GEMINI preference | ✓ 저장 가능 | ✓ | ✓ (라벨) | ✗ | UI는 OpenAI로 접힘 (`projectAiAgentEngineModel.ts`); adapter 미구현 |

### 2.2 확인 질문 요약

1. **AI 멤버 생성 시 provider/model 입력**: AI 멤버 초대·워크스페이스 AI 그래프·`ProjectMembersSection`에서 가능.
2. **수정**: PATCH members, workspace-ai 저장.
3. **실행 반영**: **일관되지 않음** — 실행 리뷰·일부 OpenAI 경로만 `aiModelOverride` 반영; AI Member Action의 `OPENAI` executor는 미구현; SingleChat/facilitator는 `OPENAI_API_KEY` + `resolveOpenAiModelFromEnv()`.
4. **저장만 되는 필드**: `providerKey`(라우팅), workspace의 ANTHROPIC/GEMINI preference(호출 없음), bootstrap의 `configuredModelOverride`(로그·타임라인, **실제 model 인자에는 미반영**).

---

## 3. Executor/Dispatcher 구조

| 확인 항목 | 결과 | 관련 파일/함수 | 판단 |
|---|---|---|---|
| `executionMode`로 executor 선택 | 예 | `selectExecutorForMode` (`executors/index.ts`) | STUB/MANUAL/OPENAI/INTERNAL_AGENT 분기 |
| `aiProvider`로 executor 선택 | 아니오 | `aiMemberActionDispatcher.ts` | `executionMode`만 사용 |
| `providerKey` 라우팅 | 아니오 | dispatcher, executors | 메타·수동 executor payload |
| `aiModelOverride` LLM 호출 | AI 액션 경로 아니오 | `openAIExecutorShell.ts` | 액션 파이프라인 미연결 |
| OpenAI executor 실제 API | 아니오 (shell) | `openAIExecutorShell.ts` → `OPENAI_EXECUTOR_NOT_CONFIGURED` | 실제 OpenAI는 feature별 `postOpenAiChatCompletion` |
| Gemini/CLOVA adapter | Gemini/Anthropic **스텁만** | `geminiAdapter.ts`, `anthropicAdapter.ts` | `*_NOT_IMPLEMENTED`; CLOVA 검색 0건 |
| Cursor vs LLM Gateway 통합 | 아니오 | `cursorExecutor.ts`, `execution/cursorExecutor.ts` | Git/GCR 실행 별도; LLM과 미통합 |

**실행 흐름**: `aiMemberActionService.create` → 기본 `executionMode: "STUB"` → `aiMemberActionDispatcher` → `selectExecutorForMode`.

**Prisma enum** (`packages/db/schema.prisma`):

- `AiMemberActionExecutionMode`: `STUB`, `MANUAL_AGENT`, `OPENAI`, `INTERNAL_AGENT`
- `IntegrationProvider`: `OPENAI`, `ANTHROPIC`, `GOOGLE_AI`, `GEMINI`, `AZURE_OPENAI`, `LOCAL_LLM`, `CURSOR`, `GITHUB`, `VERCEL`

---

## 4. 실제 LLM API 호출 구현

| Provider | 실제 호출 | 모델 선택 | API Key 관리 | 응답 표준화 | 사용량 저장 | 관련 파일 |
|---|---:|---:|---:|---:|---:|---|
| OpenAI | ✓ | env `OPENAI_MODEL` (+ 리뷰어 override 등 일부) | `UserIntegration`, legacy user key, env | OpenAI 전용 래퍼 | △ (기능별) | `openAiChatCompletions.ts`, requirements/project-spec/execution/messenger |
| Gemini | ✗ | — | 등록 UI | — | — | `geminiAdapter.ts` |
| Anthropic | ✗ | — | 등록 UI | — | — | `anthropicAdapter.ts` |
| CLOVA/HyperCLOVA | ✗ | — | — | — | — | 코드베이스 없음 |
| Cursor | △ (에이전트 실행, LLM 아님) | 정책/스텁 | integration | 별도 타입 | 제한적 | `cursorExecutor.ts` |

**공통 HTTP 진입점**: `apps/web/src/lib/ai/openAiChatCompletions.ts` — `postOpenAiChatCompletion` → `https://api.openai.com/v1/chat/completions`

- **동적 모델**: 리뷰어 경로는 `resolveEffectiveReviewerModel`; 대다수 orchestration은 `resolveOpenAiModelFromEnv()`.
- **비용 metering**: 중앙 집계·과금 없음; `promptTokens` 등 필드 단위 저장만.

---

## 5. 기능 영역별 LLM 호출

| 기능 영역 | LLM 호출 | 호출 방식 | Provider 선택 | Stub | 관련 파일 |
|---|---:|---|---:|---:|---|
| Project Spec 워크스페이스 | ✓ | `postOpenAiChatCompletion` | OpenAI 하드코딩 | — | project-spec OpenAI 모듈들 |
| Task Draft 생성 | ✓ | 동일 | OpenAI | — | `generateTaskDraftsWithOpenAI.ts` 등 |
| SingleChat / facilitator | ✓ | 동일 + 다단계 orchestration | OpenAI (env 키) | fallback 텍스트 | `singleChatOrchestrationOpenAI*`, `requirementsAiFacilitatorOpenAI.ts` |
| AI 기획자/분석가 등 | ✓ | 카탈로그 + `workspaceAiMemberSystemPrefix` | OpenAI HTTP | — | `platformAiMembers.ts` + OpenAI |
| Knowledge Pack 초안 | ✓/Mock | user key → OpenAI, 없으면 Mock | OpenAI 우선 | Mock fallback | `knowledgePackDraftService.ts` |
| Messenger LLM | ✓ | user OpenAI key | OpenAI | — | `messengerLlm.ts` |
| 실행 리뷰 (AI 멤버) | ✓ | `runOpenAiChatJsonEvaluation` 등 | OpenAI + **멤버 model override** | — | `executionReviewWithAiMembers.ts` |
| AI Member Action | △ | STUB/MANUAL 기본; OPENAI shell 실패 | executionMode만 | ✓ 기본 STUB | dispatcher + executors |
| Harness H5 execution routing | ✗ | dry_run 메타 | 표시만 | planning only | `executionCapabilityTypes.ts` |

**Gateway 경유 호출: 없음** — 모든 실호출이 `postOpenAiChatCompletion` 또는 Cursor 실행으로 직접 분산.

---

## 6. DB 모델 기준

| DB 모델/필드 | 목적 | Gateway 관련성 | 실제 사용 | 관련 코드 |
|---|---|---:|---:|---|
| `ProjectMember.aiProvider` / `aiModelOverride` | 멤버별 엔진·모델 | 높음 | △ | members API, execution review, UI |
| `ProjectMemberAction.executionMode` / `providerKey` | 액션 실행 정책 | 중간 | mode✓ / key✗ | dispatcher, service |
| `UserIntegration` + `IntegrationCredential` | 사용자 API 키 | 높음 | ✓ (OpenAI 등록) | integrations API, `resolveUserOpenAiApiKey` |
| `WorkspaceIntegration` / `ProjectIntegration` | capability별 연동 선택 | 중간 | △ | workspace overrides |
| `AiMemberProvider` | 카탈로그 멤버↔연동 핀 | 중간 | △ | `workspaceAiMemberGraphService` |
| `ProjectSpecWorkspaceResponse.provider/model/tokens` | Spec 응답 이력 | 중간 | ✓ | spec workspace |
| `TaskDraft.*Tokens` | 초안 생성 usage | 낮음 | ✓ | task draft generators |
| Provider/Model 마스터 테이블 | — | — | ✗ | Prisma enum만 |

---

## 7. UI 기준

| UI 기능 | 존재 | 화면/컴포넌트 | API 연결 | 실행 반영 |
|---|---:|---|---:|---:|
| Provider/API Key 등록 | ✓ | `/integrations`, `integrationRegistration.ts` | `/api/me/integrations` | OpenAI 키만 실질 사용 |
| Model 선택 (워크스페이스 AI) | ✓ | `ProjectMembersAdminClient` AI 탭 | `workspace-ai` | △ (대부분 env 모델) |
| AI 멤버 provider/model (오케스트레이션 멤버) | ✓ | `ProjectMembersSection` | members PATCH | 리뷰어 등 일부 |
| Cursor vs OpenAI 구분 | ✓ (prototype_build) | `projectAiAgentEngineModel` | persist prefs | Cursor는 실행 계층, LLM과 분리 |
| 프로젝트 capability override | ✓ | `ProjectIntegrationOverridesPanel` | project integrations | △ |
| 역할별 기본 LLM (멀티 provider) | △ UI 라벨만 | engine preference ANTHROPIC/GEMINI | 저장됨 | ✗ 호출 |
| 실행환경 LLM Provider 설정 | ✗ | — | — | — |
| Harness routing UI | ✓ (관측) | Overlay execution routing | diagnostic | ✗ (dry_run) |

---

## 8. 현재 상태 최종 판정

### Level 정의 (요약)

| Level | 설명 |
|:---:|---|
| 0 | Provider 관련 필드·실행 구조 없음 |
| 1 | 데이터 필드만 존재, 실행 미반영 |
| 2 | Executor shell·dispatcher 있으나 실제 LLM API 호출 없음 |
| 3 | 단일 Provider(OpenAI 등) 실제 연동, Gateway/Adapter 추상화 부족 |
| 4 | 공통 request/response·adapter·credential resolver 부분 구현 |
| 5 | 멀티 Provider 설정·라우팅·호출·표준화·usage까지 지원 |

### 결론

**현재 JYOrchestration의 LLM Provider Gateway 수준: Level 3**

(단일 Provider 실제 연동 + Gateway/Adapter 추상화 부족. Level 2 요소인 executor shell도 공존.)

### 판단 근거

1. **통합 Gateway 없음** — `ProviderGateway` / `UnifiedLlmRequest` 등 없고, OpenAI는 `postOpenAiChatCompletion`으로 기능별 직접 호출.
2. **실제 동작은 OpenAI 중심** — Spec/Task/SingleChat/Messenger/Knowledge Pack/실행 리뷰 등에서 HTTP 호출 확인; Gemini/Anthropic/CLOVA 호출 없음.
3. **실행 추상화는 Level 2 잔존** — `AiMemberAction` dispatcher·OPENAI executor shell은 있으나 API 미연결; `aiProvider` / `providerKey`는 라우팅에 미사용.

### 실제 구현된 것

- OpenAI Chat Completions 공통 HTTP 래퍼 (`openAiChatCompletions.ts`)
- 사용자 연동 키 저장·복호화 (`UserIntegration`, `resolveUserOpenAiApiKey`)
- 프로젝트/워크스페이스 AI 멤버 메타·UI·일부 실행 경로의 model override
- 토큰 usage의 기능별 DB/진단 기록
- Cursor/Git 실행 계층 (LLM과 별도)
- Harness H5 execution routing (**계획·오버레이 전용, dry_run**)

### 미구현/미흡한 것

- 멀티 provider 선택·라우팅·통합 request/response
- AI Member Action `OPENAI` executor의 실제 연동
- `aiModelOverride` / workspace engine preference의 SingleChat·facilitator 일관 반영
- Gemini/Anthropic/CLOVA adapter 및 호출
- 중앙 usage metering·비용 정책
- MCP 연동 (코드베이스 내 MCP 참조 없음)

### 개선 우선순위

1. **Thin Gateway**: `postOpenAiChatCompletion` 상위에 `resolveLlmCredentials(projectId, memberId, capability)` + 단일 `invokeChat` — 기존 호출부 점진 이전.
2. **AI Member Action**: `openAIExecutorShell`을 Gateway 경유로 구현하고 `executionMode` / `aiProvider` / `aiModelOverride` 정렬.
3. **Adapter 플러그인**: `anthropicAdapter` / `geminiAdapter` 스텁을 공통 인터페이스로 교체; workspace preference → 실제 provider 분기.

---

## 9. 다음 단계 제안 (후속 구현 프롬프트용)

1. **최소 변경 Gateway**: 기존 `postOpenAiChatCompletion` + `resolveUserOpenAiApiKey` / `resolveEnginePreferenceToUserIntegrationId`를 래핑; feature flag로 경로별 전환.
2. **OpenAI Adapter 먼저**: AI 액션 executor + facilitator/bootstrap에서 env-only 제거, member/workspace override 적용.
3. **Gemini/CLOVA 확장**: `IntegrationProvider` enum과 1:1 `LlmProviderAdapter { completeChat, normalizeUsage }`; CLOVA는 신규 enum·registration 카드.
4. **Credential**: `UserIntegration` 유지, 프로젝트 override는 `ProjectIntegration` / `AiMemberProvider` 우선순위 문서화.
5. **UI**: workspace AI의 ANTHROPIC/GEMINI를 “등록됨 + adapter 구현됨”일 때만 활성; 미구현 시 비활성/경고.
6. **Usage**: Gateway 응답에서 `usage` 표준화 → Prompt Timeline / 액션 결과 JSON 공통 필드.
7. **MCP**: MCP를 **도구·컨텍스트 채널**로 두고, **추론 provider는 Gateway**만 담당 — `contextAssemblyContract.ts`의 optional metadata 패턴 유지.

---

## 10. 관련 문서·코드 인덱스

| 주제 | 경로 |
|---|---|
| 플랫폼 구조 진단 (실행/Harness 경계) | `apps/web/docs/platform-structure-diagnosis.md` |
| Overlay Harness 계약 (H5 dry_run 등) | `apps/web/docs/OVERLAY_ARCHITECTURE_CONTRACTS.md` |
| OpenAI HTTP 래퍼 | `apps/web/src/lib/ai/openAiChatCompletions.ts` |
| AI 액션 dispatcher | `apps/web/src/lib/ai-member/aiMemberActionDispatcher.ts` |
| Executor 선택 | `apps/web/src/lib/ai-member/executors/index.ts` |
| 사용자 OpenAI 키 | `apps/web/src/lib/messenger/resolveUserOpenAiKey.ts` |
| 엔진 preference → 연동 ID | `apps/web/src/lib/workspace-ai/workspaceAiEnginePreference.ts` |
| Prisma 스키마 | `packages/db/schema.prisma` |
| 연동 등록 UI | `apps/web/src/app/integrations/page.tsx` |

---

*본 보고서는 `JYOrchestration_LLM_Provider_Gateway_Diagnosis_Prompt.md` 절차에 따른 read-only 소스 진단 결과이다.*
