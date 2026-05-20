# Multi-Agent Foundation 현재 구조 진단

Stage 1 — Agent Definition / Capability Registry 선행 작업용.  
범위: `projects/JYOrchestration/**` (2026-05 기준).

---

## 1. 현재 AI멤버 구조

- **파일**
  - `apps/web/src/lib/ai-member/platformAiMembers.ts` — 화면별 AI Identity Catalog (ideation, actor_flow, …)
  - `apps/web/src/lib/ai/platformAiMembers.ts` — 레거시 플랫폼 카탈로그
  - `apps/web/src/lib/ai-member/aiMemberRoleDefinitions.ts` — Stage2 executor/reviewer/security/scm
  - `apps/web/src/lib/ai-member/aiMemberOrchestration.ts` — DB `aiOrchestrationRole` / stage 문자열
  - `packages/db/schema.prisma` — `ProjectMember.aiOrchestrationRole`, `orchestrationStage`
- **현재 역할**
  - UI 참가자·시스템 프롬프트 prefix·provider 표시(openai/cursor)
  - 실행 리뷰 파이프라인 역할 순서 (`EXECUTION_REVIEW_ROLE_ORDER`)
- **한계**
  - Agent ≠ Capability ≠ Connector 계약이 한 모델에 묶이지 않음
  - 카탈로그(화면) / DB 멤버 / Requirements runtime `agentRole` 문자열이 **이원·삼원화**
  - `AgentDefinition` 수준의 입력·출력·책임 경계 없음

---

## 2. 현재 Runtime 구조

- **파일**
  - `requirementsIntentDispatch.ts` — intent → guard → product runtime patch
  - `requirementsIntentOrchestrationProductRuntime.ts` — governed + lifecycle/replay/transaction
  - `requirementsIntentOrchestrationGovernedRuntime.ts` — phase 3+4 governed patch
  - `requirementsMultiAgentAuthority.ts` — QuickActionId 기준 runtime role (planner/architect/developer)
  - `singleChatOrchestrationOpenAI.ts` — `runSelectiveMultiAgentOrchestrationOpenAI`
  - `ai-facilitator/route.ts` — bootstrap multi-agent orchestration 호출
- **현재 역할**
  - Requirements 워크숍 대화·퀵액션·state JSON (`requirementsIntentOrchestrationV1`) 중심 단일 파이프라인
  - LLM 라우터 + Registry Guard + stage governance
- **한계**
  - 독립 **Agent 실행 단위** 없음 (dispatch transaction이 사실상 단일 orchestrator)
  - Agent Harness / Worker Runtime 미구현
  - Capability id가 timeline/replay에 아직 없음

---

## 3. Governance / Projection / Timeline / Replay 구조

- **파일**
  - Governance: `requirementsStageGovernance.ts`, `requirementsStageGovernanceResolver.ts`, `requirementsRecommendationGovernance.ts`
  - Projection: `requirementsIntentOrchestrationAggregateProjection.ts`, `requirementsOrchestrationReadModel.ts`
  - Timeline: `requirementsOrchestrationTimeline.ts`, `requirementsOrchestrationTimelineFolding.ts`
  - Replay: `requirementsOrchestrationReplay.ts`, `requirementsOrchestrationReplayGovernance.ts`
  - Wire: `requirementsIntentOrchestrationWire.ts` (`lastRouting`, `replayHistory`, `lastTransaction`)
- **현재 역할**
  - Stage·recommendation·focus·artifact 거버넌스 + UI slim read model + folded timeline + bounded replay
- **한계**
  - `agentRole` / `actorId` 메타는 있으나 **foundation AgentDefinition.id** / **capabilityId** 미연결
  - Replay에 capability 입력·출력 스냅샷 스키마 없음 (Stage 1 bridge 타입만 정의)

---

## 4. Cursor / GitHub 연동 구조

- **파일**
  - Cursor: `executionAssignment.ts` (`cursor_executor`), `executionService.ts`, ExecutionJob/Setup Prisma
  - GitHub: `githubPullRequestService.ts`, execution setup token columns, reviewer harness
  - Platform: `platformAiMembers.ts` — `prototype_build` → `executionProvider: "cursor"`
- **현재 역할**
  - ENV_TEST / execution loop / PR sync — Requirements orchestration과 **느슨한 병렬** 경로
- **한계**
  - Connector Gateway 없음 — connector 호출이 서비스·라우트에 분산
  - Capability `requiredConnectors` 와 런타임 enforcement 연결 없음

---

## 5. Multi-Agent 전환 관점의 핵심 Gap

| 구분 | 현재 상태 | 문제 | 보완 방향 |
|---|---|---|---|
| Agent Definition | platformAiMembers + ProjectMember | 프롬프트·표시 중심, 계약 없음 | `lib/agents` AgentDefinition + bridge map |
| Capability | QuickAction / slot / bootstrap owner | Registry 없음 | `CapabilityDefinition` + validation |
| Connector | cursor/github 직접 호출 | 통제 경계 분산 | Connector Gateway (Stage 2+) |
| Authority | Guard + `requirementsMultiAgentAuthority` | Agent type·capability 단위 아님 | Harness가 registry + authority 조합 |
| Runtime History | promptTimeline, replayHistory | capabilityId 없음 | timeline metadata 확장 |
| Worker Runtime | Cursor job / OpenAI | Agent worker 추상화 없음 | `connector_worker` runtimeMode 예약 |

---

## 6. Stage 1 산출물 (이번 작업)

- `apps/web/src/lib/agents/**` — 타입, defaultAgents/Capabilities, registry, validation, aiMember bridge
- 본 문서 + `multi-agent-runtime-extension-plan.md`
- `tests/api/multiAgentFoundation.unit.test.ts`

기존 AI 멤버 호출·dispatch 경로는 **대체하지 않음**.
