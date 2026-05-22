# JYOrchestration AI Engine Orchestration 소스 진단 결과

**진단 일자**: 2026-05-16  
**범위**: `projects/JYOrchestration/**` (소스·Prisma·API·UI·테스트·docs 조사만, 코드 변경 없음)  
**기준 문서**: `JYOrchestration_AI_Engine_Orchestration_Diagnosis_Prompt.md`

> OpenAI 호출·Cursor 실행기·`aiProvider` 필드 존재만으로 Gateway/Harness 완성으로 보지 않는다. **실제 호출 경로·dispatcher·credential resolve·상태·감사**를 근거로 판단한다.

---

## 1. 요약 결론

JYOrchestration은 **Task·Run·ExecutionSetup·GitChangeRequest·승인·RBAC·ExecutionJob/이벤트 로그**를 갖춘 **오케스트레이션 코어(Workflow/Ops)** 는 성숙하지만, 프롬프트에 정의한 **AI Engine Gateway(LLM / Coding Agent / Tool·Context / Review·Security) 통합 계층** 은 **미완**이다.

- **LLM**: OpenAI `postOpenAiChatCompletion`이 기능별로 **직접 분산** 호출(약 25+ 파일). `resolveProvider`·`openaiAdapter`는 **자격 해석**에 가깝고, Gemini/Anthropic adapter는 **스텁**.
- **Coding Agent**: **Cursor Cloud Agents API** 실제 호출(`cursorExecutionAdapter.ts`). Codex·Copilot·Claude Code **미구현**. 공통 `CodingAgentAdapter` 없음.
- **Tool/Context**: GitHub·Knowledge Pack·Overlay context assembly는 **기능별 직접 연동**. **MCP 코드 없음**.
- **AI Member**: DB·카탈로그·Harness H5 **dry_run** capability 메타는 있으나, **Role → Capability → Engine → Provider 실시간 라우팅**은 미연동.
- **Harness(H17–H35)**: Runtime planning **read-only 메타**만; 실제 엔진 실행과 **분리**됨.

**한 줄 판정**: 분산된 **OpenAI 직접 호출 + Cursor 실행기 + AI 멤버 메타데이터 + 강한 Task/Git 오케스트레이션** 상태이며, 아직 **통합 AI Engine Orchestration 플랫폼**은 아니다.

---

## 2. 전체 성숙도 판정

| 영역 | Level | 핵심 근거 | 주요 미흡점 |
|---|:---:|---|---|
| Orchestration Core | **4** | `Task`, `TaskRun`, `TaskExecutionRun`, `ExecutionJob`, `ExecutionEventLog`, `GitChangeRequest`, `ExecutionSetup`, git approve API | LLM/Cursor가 코어 **위** 단일 Gateway로 편입되지 않음 |
| LLM Provider Gateway | **2** | `openAiChatCompletions.ts` 실호출; `resolveProvider`+`openaiAdapter` | 통합 Gateway/Router 없음; Gemini/CLOVA/Anthropic 미호출 |
| Coding Agent Gateway | **3** | `cursorExecutionAdapter.ts` Cloud Agent API·폴링·`TaskExecutionRun` 연계 | Cursor 단일; pilot connector·stub 혼재; Codex/Copilot 없음 |
| Tool/Context Gateway | **2** | `knowledgePackRetrievalService.ts`, `contextAssemblyContract.ts`, GitHub services | MCP 없음; Tool 추상화·RBAC 일원화 없음 |
| Review/Security Gateway | **3** | `executionReviewWithAiMembers.ts`, `buildReviewSecurityHarnessPlan.ts` | Harness는 planning only; SAST/외부 도구 Gateway 없음 |
| AI Member Harness | **2** | `ProjectMember` AI 필드, `platformAiMembers.ts`, `WorkspaceAiMember` | 실행 라우팅 불일치; 카탈로그 vs DB AI 멤버 이원화 |
| Capability Registry | **2** | `executionCapabilityTypes.ts`, `providerCapabilityMatrix.ts` (H5) | **dry_run 메타만**; Task 유형·Engine 선택 미연동 |
| Credential/Integration Layer | **3** | `UserIntegration`, `ProjectIntegration`, `WorkspaceIntegration`, `AiMemberProvider`, `resolveProvider.ts` | OpenAI/Cursor 위주; 우선순위 분산(ExecutionSetup 평문 키 병존) |
| Execution State/Audit | **4** | `ExecutionJob` PENDING/RUNNING/DONE/FAILED, `ExecutionEventLog`, `aiMemberActionAudit` | LLM 호출 상태는 Job 모델과 **별도** |
| Usage/Cost Metering | **2** | `usage` in OpenAI 응답, `TaskDraft`·Spec 토큰 필드 | 중앙 metering·과금 없음 |
| Security/Approval Gate | **3** | `gitApprovalMode`, `requireApprovalBeforeApply`, `allowedPathGlobs`+`evaluateTaskExecution` | Engine별 권한 차등·통합 policy layer 없음 |
| **Overall AI Engine Orchestration** | **2** | 코어+Cursor+OpenAI **각각 동작** | Gateway·Capability 기반 멀티 Engine **미통합** |

```text
현재 JYOrchestration의 AI Engine Orchestration 성숙도: Level 2 / 5

판단 근거:
1. Orchestration Core(Task→Run→Cursor loop→GCR→PR/approve)는 DB·서비스·API로 실제 동작한다.
2. LLM·Coding Agent는 “Gateway”가 아니라 기능별/어댑터 파일 직접 호출·실행으로 분산되어 있다.
3. Capability·Execution Routing(H5)은 overlay/diagnostic planning metadata이며 execution path에 연결되지 않는다.

현재 구현된 것:
- OpenAI Chat Completions 다기능 실호출 (`apps/web/src/lib/ai/openAiChatCompletions.ts`)
- Cursor Cloud Agents API 실행·폴링·PR 연계 (`apps/web/src/lib/execution/cursorExecutionAdapter.ts`, `runExecutionLoop.ts`)
- 통합 credential resolve 골격 (`apps/web/src/lib/integrations/resolveProvider.ts`)
- AI 멤버·플랫폼 카탈로그·실행 후 리뷰 (`executionReviewWithAiMembers.ts`, `platformAiMembers.ts`)
- ExecutionJob/ExecutionEventLog 비동기 작업·감사 (`executionService.ts`, `executionWorker.ts`)

미구현/미흡한 것:
- LLM Provider Gateway (멀티 provider 라우팅·공통 request/response)
- Coding Agent Gateway (Cursor 외 Codex/Copilot/Claude Code, 공통 adapter)
- Tool/Context Gateway (MCP, 표준 context resource API)
- Role → Capability → Engine → Provider 실시간 매핑 및 fallback
- AI Member Action의 OPENAI/INTERNAL_AGENT executor 실구현

가장 큰 구조적 리스크:
- OpenAI 호출부·프롬프트 조립·credential 경로가 기능마다 달라 provider 전환·감사·비용 집계가 어렵다.
- `aiProvider`/`aiModelOverride`/`enginePreference`가 UI·DB에 있으나 SingleChat·AI Action 경로와 **불일치**해 운영 혼선이 난다.
- Harness runtime planning(H17–H35)과 실제 실행 엔진이 분리되어 “메타만 성숙”한 착시가 생길 수 있다.

개선 우선순위:
1. Thin `LLM Provider Gateway` + `OpenAIAdapter`로 기존 `postOpenAiChatCompletion` 래핑(기능별 직접 호출 유지·점진 이전)
2. `CursorCodingAgentAdapter`를 `Coding Agent Gateway` 진입점으로 명시·ExecutionSetup/Integration credential 단일화
3. H5 `ExecutionCapability`를 **실행 경로**에 연결(최소: facilitator·task run 진입 시 provider hint)
4. `resolveProvider` 우선순위 문서화 + ExecutionSetup 레거시 키와 Integration 계층 정렬
5. Gemini/Codex/Copilot은 adapter 스텁 유지·`mvpConnected: false`와 코드 일치 유지
```

---

## 3. Orchestration Core 진단

### 3.1 AI Engine Orchestration 8항목 요약

| 진단 항목 | 존재 | 관련 파일 | 실제 동작 | 판단 |
|---|---|---|---|---|
| Orchestration Core | ✓ | `schema.prisma` `Task`~`GitChangeRequest`, `runExecutionLoop.ts`, `executionService.ts` | ✓ | Workflow·Git·승인 **실동작** |
| AI Engine Gateway (통합) | ✗ | — | ✗ | 계층 없음 |
| LLM Provider Gateway | △ | `openAiChatCompletions.ts`, `integrations/*` | △ OpenAI만 | 직접 호출 분산 |
| Coding Agent Gateway | △ | `cursorExecutionAdapter.ts`, `cursorAdapter.ts` | △ Cursor만 | 공통 adapter 없음 |
| Tool/Context Gateway | △ | `knowledge-packs/*`, `github*Service.ts` | △ | MCP 없음 |
| AI Member Harness 실행 연결 | △ | `aiMemberActionDispatcher.ts`, `platformAiMembers.ts` | △ 부분 | STUB·OpenAI shell |
| Role→Capability→Engine 매핑 | △ | `executionRouting/*` (H5) | ✗ 실행 | planning only |
| 결과→Task/Run/History/GCR 연결 | ✓ | `TaskExecutionRun`, `gitChangeRequestFromTaskRun.ts`, `TaskHistory` | ✓ | Cursor 루프 **연결됨** |

### 3.2 구성요소 상세

| 구성요소 | DB/코드 존재 | 실제 사용 | 관련 파일 | 판단 |
|---|---:|---:|---|---|
| Project | ✓ | ✓ | `schema.prisma` `Project` | 기본 단위 |
| Task / TaskDraft / TaskPrompt | ✓ | ✓ | `Task`, `TaskDraft`, `TaskPrompt`, project-spec generators | Spec→Task 파이프라인 |
| TaskRun | ✓ | ✓ | `TaskRun`, `apps/web/src/app/api/task/run/route.ts` | 레거시 run 모델 |
| TaskExecutionRun | ✓ | ✓ | `TaskExecutionRun`, `runExecutionLoop.ts` | **Cursor 루프 주 기록** |
| ExecutionSetup | ✓ | ✓ | `ExecutionSetup`, `execution-setup/route.ts` | Repo·Cursor·policy·`allowedPathGlobs` |
| ExecutionJob | ✓ | ✓ | `ExecutionJob`, `executionWorker.ts` | PENDING/RUNNING/DONE/FAILED·retry |
| ExecutionEventLog | ✓ | ✓ | `ExecutionEventLog` | stage·status·`detailJson` |
| GitChangeRequest | ✓ | ✓ | `GitChangeRequest`, `task/git-request`, `git/approve` | PR·apply·승인 |
| TaskHistory | ✓ | ✓ | `taskHistoryService.ts` | 이벤트 이력 |
| ProjectMemberAction | ✓ | △ | `ProjectMemberAction`, `aiMemberActionService.ts` | AI 액션 워크플로(executor 제한) |
| Approval / RBAC | ✓ | ✓ | `projectAccessGuard.ts`, `gitApprovalMode`, `ProjectAiActionPolicy` | 프로젝트·Git 게이트 |
| Cursor/OpenAI 통제 | △ | △ | `runExecutionLoop` vs 분산 OpenAI API | **코어가 Cursor 루프 통제**; OpenAI는 루프 평가·기능 API |

**확인 질문 요약**

1. Task→실행→검토→GCR→PR: **예** (`runExecutionLoop.ts`, `evaluateTaskExecution.ts`, Stage2 PR flow).
2. 실행 상태 DB 저장: **예** (`Task.executionWorkflowStatus`, `TaskExecutionRun.status`).
3. 이벤트 로그: **예** (`ExecutionEventLog`, `appendTaskHistory`).
4. 승인/검토/적용 분리: **예** (GCR status, `ProjectMemberAction` review/apply, git approval routes).
5. 프로젝트별 실행 정책: **예** (`ExecutionSetup` flags).
6. Cursor/OpenAI 코어 통제: **Cursor는 예**, OpenAI는 **기능별 직접**.
7. 재시도/중단: **예** (`maxAutoRetriesPerTask`, `loopControllerState`, `ExecutionJob.retryCount`).

---

## 4. LLM Provider Gateway 진단

| Provider | 실제 호출 | Gateway 경유 | 모델 선택 | Credential | Usage 기록 | 관련 파일 |
|---|---:|---:|---:|---:|---:|---|
| OpenAI | ✓ | ✗ 직접 | env `OPENAI_MODEL` + 일부 override | `resolveProvider`/`UserIntegration`/env | △ | `openAiChatCompletions.ts`, `resolveUserOpenAiApiKey.ts`, `openaiAdapter.ts` |
| Gemini / Google AI | ✗ | ✗ | UI·enum만 | 등록 가능 | ✗ | `geminiAdapter.ts` (`GEMINI_ADAPTER_NOT_IMPLEMENTED`) |
| Anthropic | ✗ | ✗ | 등록 카드 | 등록 가능 | ✗ | `anthropicAdapter.ts` |
| CLOVA/HyperCLOVA | ✗ | ✗ | — | — | ✗ | 검색 0건 |
| Azure OpenAI / Local LLM | ✗ | ✗ | 등록만 | 등록만 | ✗ | `integrationRegistration.ts` |

**공통 타입**: `PostOpenAiChatCompletionInput` — OpenAI 전용 (`openAiChatCompletions.ts`).  
**Provider Router**: 없음. 유사: `buildExecutionRoutingPlan.ts` + `providerCapabilityMatrix.ts` — **H5 dry_run, 실행 비연동**.

**주요 직접 호출 영역** (grep `postOpenAiChatCompletion`):

- Requirements/SingleChat: `singleChatOrchestrationOpenAI*.ts`, `requirementsAiFacilitatorOpenAI.ts`
- Project Spec: `generateTaskDraftsWithOpenAI.ts`, `generateSpecContextWithOpenAI.ts` 등
- Execution 평가: `openAiRelayEvaluation.ts`, `executionReviewWithAiMembers.ts`
- Prototype/Feature/Actor-flow/Worknote/Messenger 등

상세 LLM 전용 진단: `apps/web/docs/llm-provider-gateway-diagnosis.md`

---

## 5. Coding Agent Gateway 진단

| Coding Agent | 구조 존재 | 실제 실행 | 연결 방식 | 공통 Adapter | 결과 저장 | 관련 파일 |
|---|---:|---:|---|---:|---:|---|
| Cursor | ✓ | ✓ HTTP API | Cloud Agents `POST/GET /v0/agents` | ✗ | ✓ | `cursorExecutionAdapter.ts`, `cursorAdapter.ts`, `buildCursorExecutionPrompt.ts` |
| Cursor (pilot/stub) | ✓ | △ 정규화만 | `cursorExecutorConnectorPilot.ts` | ✗ | △ | pilot connector — Stage1/2와 별도 경로 |
| Codex | ✗ | ✗ | — | ✗ | ✗ | **미구현** |
| Copilot Coding Agent | ✗ | ✗ | — | ✗ | ✗ | **미구현** |
| Claude Code | ✗ | ✗ | — | ✗ | ✗ | **미구현** |

1. **Cursor 실행기**: 존재. `executeCursorRun` 등 (`cursorExecutionAdapter.ts`).
2. **실행 방식**: **HTTP API** (Basic auth, base URL normalize). CLI/Webhook 단독 Gateway 아님.
3. **결과 표준화**: `CursorRunResult` 타입.
4. **TaskRun/GCR 연결**: `TaskExecutionRun` (`cursorRunId`, `changedFiles`), `runExecutionLoop` → GCR/PR (`gitChangeRequestFromTaskRun.ts`).
5–7. Codex/Copilot/Claude Code: **미구현**.
8. **공통 Coding Agent Adapter**: 없음 (`ExecutorIntegrationAdapter`는 workflow pilot 용어).
9. **Capability**: H5 `cursor_execution`, `code_generation` — matrix만.
10. **Credential**: `getCursorApiTokenForProject` → `resolveProvider(CODE_AGENT)`; **ExecutionSetup.cursorApiToken** 병존.
11. **사용량**: Cursor 전용 중앙 metering 없음.
12. **AI개발자 연결**: `platformAiMembers` `prototype_build` → `executionProvider: "cursor"`; Stage2 `envTestStage2AiMemberLookup`; Executor는 DB 멤버가 아닌 **Cursor 전용 경로** (`aiMemberRoleDefinitions.ts`).

---

## 6. Tool / Context Gateway 진단

| Tool/Context | 구조 존재 | 표준 인터페이스 | 실제 사용 | 권한 통제 | 관련 파일 |
|---|---:|---:|---:|---:|---|
| MCP | ✗ | ✗ | ✗ | — | 코드베이스 **없음** |
| GitHub (SCM) | ✓ | ✗ 기능별 service | ✓ | △ token·project | `githubPullRequestService.ts`, `githubCompareService.ts`, `integrations/providerAdapters/githubAdapter.ts` |
| Knowledge Pack | ✓ | △ overlay contract | ✓ | △ | `knowledgePackRetrievalService.ts`, `knowledgeActivation/*`, `activeKnowledgePackRef.ts` |
| Project Spec / Artifacts | ✓ | △ | ✓ | project scope | `contextAssemblyContract.ts`, `overlayPromptTraceAugment.ts` |
| Context assembly (overlay) | ✓ | ✓ contract 타입 | ✓ read-only meta | `contextAssemblyContract.ts`, H4 knowledge activation |
| Security/SAST tool | △ | ✗ | △ planning | harness only | `buildReviewSecurityHarnessPlan.ts` — **실제 SAST 호출 없음** |
| Git diff/PR (review) | ✓ | △ | ✓ | GCR·GitHub API | `executionReviewWithAiMembers.ts`, compare/fetch services |

---

## 7. AI Member Harness 진단

### 7.1 역할·저장소

| 저장소 | 역할 표현 | 관련 |
|---|---|---|
| DB `ProjectMember` | `aiOrchestrationRole`, `orchestrationStage`, `aiProvider`, `aiModelOverride`, `aiAgentKey` | 프로젝트 초대 AI |
| `platformAiMembers.ts` | `WorkspaceAiMemberId` (ideation, feature_planning, prototype_build, …) | 화면별 플랫폼 AI |
| `aiMemberOrchestration.ts` | `AiMemberRole`, `OrchestrationStage` 타입 | lookup·리뷰 |
| Harness H5 | `roleKey` + `ExecutionCapability` | **planning metadata only** |

프롬프트의 **AI기획자/AI분석가/…/AI SCM** 은 코드에서 **문자열 역할**(`planner`, `reviewer`, `security-reviewer`, `scm-manager` 등)과 **카탈로그 키**로 **부분 매핑**되며 단일 enum 테이블은 없다.

### 7.2 역할별 연결 (요약)

| AI멤버 역할 (개념) | 설정 구조 | 실제 Engine 연결 | 실행 결과 저장 | 미흡점 | 관련 파일 |
|---|---:|---:|---:|---|---|
| AI기획자/분석/설계 (planner 등) | ✓ DB+catalog | OpenAI 직접 | △ timeline/Spec | model override 불일치 | `singleChatOrchestrationOpenAI*`, `ensure-default-planner` API |
| AI디자이너 | ✓ catalog `designer` | OpenAI | △ | 동일 | `platformAiMembers.ts` |
| AI개발자 (executor) | △ Cursor 경로 | Cursor API | ✓ `TaskExecutionRun` | DB AI 멤버 아님 | `runExecutionLoop.ts`, role definitions |
| AI검수자 | ✓ `reviewer` | OpenAI JSON eval | ✓ run steps | Harness만 security 분리 아님 | `executionReviewWithAiMembers.ts` |
| AI보안관 | ✓ `security-reviewer` | OpenAI + harness meta | △ | SAST 미연동 | `buildReviewSecurityHarnessPlan.ts` |
| AI SCM | ✓ `scm-manager` | GitHub services + AI assist | ✓ PR/merge flow | Tool gateway 없음 | `scmManagerWithAiMembers.ts`, github services |
| AI Member Action | ✓ `ProjectMemberAction` | `executionMode`→executor | ✓ audit | OPENAI shell 미구현 | `aiMemberActionDispatcher.ts`, `executors/*` |

10. **UI만 반영 필드**: `providerKey`(라우팅 미사용), workspace `ANTHROPIC`/`GEMINI` preference(호출 없음), bootstrap `configuredModelOverride`(타임라인 위주).

---

## 8. Capability Registry 진단

| Capability | 정의 존재 | Engine 매핑 | Role 매핑 | 실제 사용 | 관련 파일 |
|---|---:|---:|---:|---:|---|
| planning, analysis, *_review | ✓ type | △ matrix | △ H5 plan | ✗ 실행 | `executionCapabilityTypes.ts`, `providerCapabilityMatrix.ts` |
| code_generation, cursor_execution | ✓ | cursor in matrix | △ | ✗ 라우팅 | 동일 |
| github_operation | ✓ | github in matrix | △ | ✗ | 동일 |
| repo_edit, pr_create, test_run (프롬프트 예시) | ✗ enum | ✗ | ✗ | △ 암묵적 | 실행 루프·Git API에 분산 |

`ExecutionRoutingPlan.mode` = **`"dry_run"`** (`executionCapabilityTypes.ts` 주석). Task 유형별 capability 판별·fallback engine **없음**.

---

## 9. Credential / Integration Layer 진단

| Credential 영역 | 구조 존재 | Provider 범위 | 실제 resolve | 보안 처리 | 관련 파일 |
|---|---:|---|---:|---:|---|
| UserIntegration | ✓ | OPENAI, CURSOR, GITHUB, … enum | ✓ | `credentialCrypto.ts` encrypt | `schema.prisma`, `me/integrations` API |
| ProjectIntegration override | ✓ | capability별 | ✓ | — | `resolveIntegration.ts`, `resolveProvider.ts` |
| WorkspaceIntegration | ✓ | capability별 | ✓ | — | `workspace_integrations` |
| AiMemberProvider pin | ✓ | per catalog member | ✓ | — | `AiMemberProvider`, workspace-ai API |
| ExecutionSetup 평문 키 | ✓ | OpenAI planner, Cursor, GitHub | ✓ (레거시) | masked/reveal API | `ExecutionSetup` — Integration과 **병존** |
| env fallback | ✓ | OPENAI | △ dev flags | env | `resolveProvider.ts` `allowEnvOpenAiFallback` |

**우선순위** (`resolveProvider.ts`): AiMember pin → Project override → Workspace → User default → env(조건부) — **코드에 구현**, 문서는 `integrationRegistration.ts` 설명과 부분 중복.

---

## 10. Execution State / Audit 진단

| 상태관리 요소 | 존재 | LLM 적용 | Coding Agent 적용 | 확장성 | 관련 파일 |
|---|---:|---:|---:|---:|---|
| ExecutionJob | ✓ | △ git/cursor job type | ✓ | 중간 | `ExecutionJob`, `executionWorker.ts` |
| TaskExecutionRun | ✓ | △ eval 단계 | ✓ | Cursor 중심 | `TaskExecutionRun` |
| Task workflow status | ✓ | △ | ✓ | DAG | `executionWorkflowStatus` on `Task` |
| ExecutionEventLog | ✓ | △ | ✓ | ✓ | `ExecutionEventLog` |
| AI Member Action status | ✓ | △ shell | STUB/MANUAL | 제한 | `ProjectMemberAction`, dispatcher |
| Pause/retry | ✓ | △ | ✓ | — | `loopControllerState`, setup retries |
| Audit (AI action) | ✓ | △ | △ | — | `aiMemberActionAudit.ts` |

LLM 호출은 대부분 **동기 HTTP** 요청으로 Job 모델과 분리. Codex/Copilot 비동기 agent를 붙이려면 **ExecutionJob 타입 확장**은 가능하나 **Engine 추상화 선행**이 필요.

---

## 11. Security / Approval Gate 진단

| 보안/승인 요소 | 구조 존재 | 실제 적용 | Engine별 차등 | 관련 파일 | 판단 |
|---|---:|---:|---:|---|---|
| Git 승인 모드 | ✓ | ✓ | △ | `Project.gitApprovalMode`, `git/approve` | MANUAL 등 |
| Apply 전 승인 | ✓ | ✓ | — | `requireApprovalBeforeApply` on `ExecutionSetup` | |
| GCR 승인/반려 | ✓ | ✓ | — | `GitChangeRequest`, submit-approval routes | |
| allowedPathGlobs | ✓ | ✓ | Cursor eval | `evaluateTaskExecution.ts`, `buildCursorExecutionPrompt.ts` | out-of-scope 실패 |
| Sensitive task gate | ✓ | △ | — | `taskSensitivity.ts`, `requireApprovalForSensitiveTasks` | |
| AI 역할 분리 | ✓ | △ | reviewer/security/scm lookup | `aiMemberOrchestration.ts`, Stage2 | 실행 경로는 OpenAI 공유 |
| Review/Security harness | ✓ | ✗ enforcement | — | H6/H6.5 harness | planning only |
| Audit trail | ✓ | ✓ | △ | TaskHistory, ExecutionEventLog, AI action audit | |

---

## 12. 현재 구조의 분산/중복 문제

| 분산/중복 항목 | 현재 상태 | 문제점 | 관련 파일 | 개선 필요도 |
|---|---|---|---|:---:|
| OpenAI 호출 분산 | 25+ 파일이 `postOpenAiChatCompletion` | provider 교체·테스트·비용 집계 어려움 | `openAiChatCompletions.ts` 호출자들 | **5** |
| Cursor vs Integration credential | ExecutionSetup + `resolveProvider` | 이중 저장·우선순위 혼란 | `ExecutionSetup`, `cursorAdapter.ts` | **4** |
| AI 멤버 필드 vs 실행 | DB 필드 rich, routing poor | UI 설정 신뢰도 저하 | `ProjectMember`, dispatcher | **5** |
| Context/Knowledge 조립 | overlay·feature별 | Tool Gateway 부재 | `overlayPromptTraceAugment.ts` | **3** |
| Usage/token | 기능별 DB 필드 | 중앙 metering 없음 | TaskDraft, Spec workspace | **3** |
| Credential resolve | `resolveProvider` + legacy user key + env | 경로 다수 | `resolveUserOpenAiApiKey.ts` 등 | **3** |
| Executor shells | STUB default, OPENAI/INTERNAL shell | AI Action 경로 미완 | `openAIExecutorShell.ts`, `internalAgentExecutorShell.ts` | **4** |
| Harness vs Runtime execution | H17–H35 read-only | 실행 성숙도 착시 | `runtimeSemantic/*`, `runExecutionLoop.ts` | **2** (문서화) |

---

## 13. AI Engine Orchestration 관점의 핵심 리스크

1. **표면적 통합 착시**: Integration UI·Harness·AI 멤버 필드가 “멀티 엔진 플랫폼”처럼 보이나 **실행은 OpenAI+Cursor 직접 경로**에 한정.
2. **운영·보안 감사 단절**: LLM 호출이 ExecutionEventLog/Job과 **자동 연계되지 않아** 장애·비용·정책 위반 추적이 어렵다.
3. **확장 비용**: Gemini/Codex 추가 시 **기능마다 신규 분기** 가능성 — Gateway 없이는 Level 4+ 달성 불가.

---

## 14. 개선 우선순위

1. **Thin AI Engine Gateway 골격** (LLM + Coding Agent + Tool 인터페이스만, 기존 호출 래핑)
2. **OpenAIAdapter** — 모든 `postOpenAiChatCompletion`의 **선택적** 위임(기능별 제거 금지 원칙)
3. **CursorCodingAgentAdapter** — `cursorExecutionAdapter` 단일 진입 + credential을 `resolveProvider(CODE_AGENT)` 우선
4. **Role→Capability→Engine** — H5 `ExecutionRoutingPlan`을 **한 API 경로**(예: task run / facilitator)에만 실연결
5. **ExecutionSetup vs Integration** 정렬 문서 + 마이그레이션 계획(평문 키 deprecate)
6. **McpToolContextAdapter** — 후순위; 현재 MCP 없음 명시 유지

---

## 15. 다음 작업을 위한 권장 방향

### 15.1 AI Engine Gateway 최소 골격 (제안)

```text
AI Engine Gateway (thin)
├─ LLM Provider Gateway → OpenAIAdapter (실装), GeminiAdapter (stub)
├─ Coding Agent Gateway → CursorCodingAgentAdapter (실装)
├─ Tool/Context Gateway → GitHubToolAdapter, KnowledgePackContextAdapter
└─ Review/Security Gateway → OpenAIReviewAdapter + harness bridge
```

### 15.2 기존 구조 유지 원칙

- OpenAI 직접 호출 **일괄 삭제 금지**
- `runExecutionLoop`·GCR·승인 흐름 **유지**
- `ProjectMember` / `WorkspaceAiMember` 필드 **재사용**
- Harness H5–H35는 **실행 비침범** 유지

### 15.3 Role → Capability → Engine (목표 모델)

| AI멤버 (개념) | Capability | Primary Engine | Fallback | 현재 근사 구현 |
|---|---|---|---|---|
| AI기획자 | planning, chat | OpenAI | — (Gemini stub) | SingleChat OpenAI |
| AI분석가 | analysis | OpenAI | — | organize-analyze routes |
| AI설계자 | architecture_design | OpenAI | — | Spec/feature planning |
| AI디자이너 | design_review | OpenAI + KP | — | designer catalog |
| AI개발자 | repo_edit, code_generate | **Cursor** | — | `runExecutionLoop` |
| AI검수자 | diff_review | OpenAI + GitHub | — | `executionReviewWithAiMembers` |
| AI보안관 | security_review | OpenAI (harness) | — | review security harness |
| AI SCM | pr_create, github_operation | GitHub services | — | scmManager, github APIs |

---

## 16. 관련 소스 인덱스

### Orchestration Core

- `packages/db/schema.prisma` — `Task`, `TaskRun`, `TaskExecutionRun`, `ExecutionSetup`, `ExecutionJob`, `ExecutionEventLog`, `GitChangeRequest`, `ProjectMember`, `ProjectMemberAction`
- `apps/web/src/lib/executionLoop/runExecutionLoop.ts`
- `apps/web/src/lib/service/executionService.ts`, `executionWorker.ts`
- `apps/web/src/app/api/task/run/route.ts`, `task/git-request/route.ts`, `git/approve/route.ts`

### LLM

- `apps/web/src/lib/ai/openAiChatCompletions.ts`
- `apps/web/src/lib/integrations/resolveProvider.ts`
- `apps/web/src/lib/integrations/providerAdapters/openaiAdapter.ts`
- `apps/web/docs/llm-provider-gateway-diagnosis.md`

### Coding Agent (Cursor)

- `apps/web/src/lib/execution/cursorExecutionAdapter.ts`
- `apps/web/src/lib/integrations/providerAdapters/cursorAdapter.ts`
- `apps/web/src/lib/execution/buildCursorExecutionPrompt.ts`
- `apps/web/src/lib/workflow/cursorExecutorConnectorPilot.ts`

### AI Member & Routing (metadata)

- `apps/web/src/lib/ai-member/platformAiMembers.ts`
- `apps/web/src/lib/ai-member/aiMemberOrchestration.ts`
- `apps/web/src/lib/ai-member/aiMemberActionDispatcher.ts`
- `apps/web/src/lib/ai-member/executors/index.ts`
- `apps/web/src/lib/harness/executionRouting/executionCapabilityTypes.ts`
- `apps/web/src/lib/harness/executionRouting/providerCapabilityMatrix.ts`

### Tool / Context / Review

- `apps/web/src/lib/knowledge-packs/knowledgePackRetrievalService.ts`
- `apps/web/src/lib/overlay/contextAssemblyContract.ts`
- `apps/web/src/lib/execution/executionReviewWithAiMembers.ts`
- `apps/web/src/lib/harness/reviewSecurity/buildReviewSecurityHarnessPlan.ts`
- `apps/web/src/lib/service/githubPullRequestService.ts`

### Integration UI

- `apps/web/src/lib/integrations/integrationRegistration.ts`

### Platform structure (보조)

- `apps/web/docs/platform-structure-diagnosis.md`

---

## 부록: 확장 후보 평가

| 후보 | 코드 존재 | 실호출 | Gateway 편입 난이도 | 비고 |
|---|---:|---:|---|---|
| Gemini | adapter stub | ✗ | 중 | `geminiAdapter.ts` |
| Anthropic | adapter stub | ✗ | 중 | `anthropicAdapter.ts` |
| CLOVA | ✗ | ✗ | 높음 | 신규 |
| Codex / Copilot / Claude Code | ✗ | ✗ | 높음 | Coding Agent Gateway 필요 |
| MCP | ✗ | ✗ | 높음 | Tool Gateway 신규 |

---

*본 보고서는 저장소 스냅샷 기준이며, 배포 환경 변수·비공개 설정은 포함하지 않습니다.*
