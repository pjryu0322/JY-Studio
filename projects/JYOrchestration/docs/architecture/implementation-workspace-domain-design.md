# Implementation Workspace Domain Design

P4-M0-01 산출물. **구현 코드 변경 없음** — 현재 `projects/JYOrchestration` 구조 분석과 목표 도메인 경계 정의.

---

## 1. Current Problem

### 1.1 제품 관점

오늘 사용자가 보는 구현단계는 **CodeTask Execution Board가 메인 화면**이다.

```text
Implementation ≈ CodeTask Board + Task Tree + Integration Footer + Toolbar icons
```

사용자는 branch, commit SHA, GitHub verify, integration merge, CodeTask ID를 직접 해석해야 다음 행동을 선택한다. AI 개발자(`prototype_build`)는 대화·칩·보드 메시지로 존재하지만, **화면 주목점은 보드**이다.

### 1.2 소스 관점 (2026-06 기준)

| 영역 | 현재 위치 | 역할 |
|------|-----------|------|
| Route | `apps/web/src/app/execution/page.tsx` → `ExecutionPageClient` | `?projectId=` 로 프로젝트 orchestration 로드 |
| Stage shell | `PrototypePreviewPanel.tsx` → `PrototypeImplementationStagePanel.tsx` | 구현단계 전체 UI 루트 |
| Controller composition | `usePrototypeImplementationStagePanel.tsx` | 20+ `useImplementation*Controller` 조립 (parent는 shell만 유지) |
| Main surface | `ImplementationExecutionBoardPanel.tsx` | Task tree, integration footer, developer prompt preview, runtime admin |
| Toolbar | `ImplementationStageGlobalToolbar` + `useImplementationToolbarController.tsx` | 환경설정, 상세 로그, 선택 CodeTask 빠른 실행, 세션 초기화 |
| Board domain | `implementationExecutionBoard.ts`, `implementationExecutionBoardState.ts`, `implementationExecutionBoardPanelView.ts` | DevTask/통합 단계/사용자 확인 집계 |
| CodeTask run | `codeTaskExecutionRun.ts`, `codeTaskGithubOutcome.ts`, `implementationCodeTaskGithubPollingState.ts` | Cursor → GitHub verify 상태 머신 |
| Integration / Preview | `implementationIntegrationPipelineService.ts`, `projectIntegrationPipelineService.ts`, `POST /api/prototype/integration/run-pipeline` | merge/build/PR/Pages preview |
| Client integration | `useImplementationIntegrationPipelineController.ts`, `implementationIntegrationClient.ts` | “통합 및 Preview 준비” |
| Preview open | `useImplementationPreviewController.ts`, `implementationPreviewReadiness.ts` | integrated app preview URL |
| Stage actions | `implementationStageActionPipeline.ts`, `implementationStageActionExecutionDispatch.ts`, `implementationStageNextActions.ts` | 칩/게이트/디스패치 |
| Chat persistence | `prototypeExecutionSingleChatWire.ts`, `requirementsStateJson.prototypeExecutionSingleChatV1` | 구현단계 SingleChat 메시지 저장 |
| Chat UI building blocks | `prototypeChatTimeline.tsx` (`PrototypeChatShell`, `PrototypeChatTimeline`) | **재사용 가능**; 현재 execution 메인 레이아웃에서는 보드가 전면 |
| Orchestration blob | `requirementsStateJson.ts` | 프로젝트 단일 JSON에 implementation·runtime·integration 상태 대부분 저장 |
| Navigation | `flow-state.ts` (`execution`), `workflowStepMeta.ts`, `ProjectRailWorkflowStrip.tsx` | 레일: 기획 / 구현 / 검토(placeholder) |
| Review stage | `app/prototype-review/PrototypeReviewPlaceholderPageClient.tsx` | **레거시 검토 UI 제거 후 placeholder** — 구현단계와 분리 재개발 예정 |

### 1.3 구조적 문제

1. **UX와 도메인 불일치**: “AI Developer Workspace” 목표 vs “CodeTask Board” UI.
2. **상태 응집**: `requirementsStateJson`에 실행·보드·통합·채팅·타임라인이 혼재 — Workspace 도메인 경계가 타입/모듈에 없음.
3. **파이프라인과 UI 결합**: Integration merge 전략, GitHub verify, preview ready가 보드/푸터/컨트롤러에 직접 노출.
4. **보완요청 버퍼 없음**: 사용자 자연어 요청이 곧바로 CodeTask/Cursor 경로로 갈 수 있음 (`implementationStageAction*`, WIP chip handlers).
5. **Developer Memory 없음**: 설계 의도·영향 범위가 프롬프트/타임라인/보드 메시지에 분산.

---

## 2. Product Direction

```text
Implementation = AI Developer Workspace
```

- **Primary**: SingleChat — 한 명의 AI Developer(`prototype_build`)와 대화하며 진행.
- **Secondary**: Developer Dashboard — 현재 `ImplementationExecutionBoardPanel` 역할을 Modal/Drawer로 격리.
- **Loop**: Preview 확인 → 보완요청 → Working Queue → 승인 → CodeTask → Preview 갱신.
- **Engine**: 기존 CodeTask / GitHub verify / integration / preview pipeline은 **변경하지 않고** Adapter로만 연결.

구현단계 Preview는 **샘플 데이터 기반 integrated app preview** (실데이터/DB 연동 검토는 **검토단계**에서 별도).

---

## 3. Domain Boundary

```text
Implementation Workspace (UX orchestration)
├─ AI Developer          (persona + policy + narration)
├─ SingleChat Workspace  (main UI)
├─ Working Queue         (human intent buffer)
├─ Developer Memory      (internal, summarized to user)
├─ Developer Dashboard   (ex-board, drawer/modal)
├─ Preview Loop          (open preview + feedback capture)
└─ Execution Pipeline Adapter (wraps existing services)
```

**Platform boundaries (unchanged in P4-M0):**

- Cursor / GitHub / merge / build / Pages deploy — server pipeline 그대로.
- CodeTask planner / prompt generation — 기존 모듈.
- 검토단계 — placeholder; 신규 구현은 별 Epic.

---

## 4. Domain Objects

### 4.1 Implementation Workspace (aggregate)

- **ID**: `projectId` + workspace session generation (optional future `implementationWorkspaceV1` root in state).
- **Owns**: UX mode (chat-first), drawer open state (ephemeral UI), adapter facades.
- **Does not own**: raw Git operations, merge algorithms, Cursor API.

### 4.2 AI Developer

- **Persona**: `prototype_build` (`platformAiMembers`, `visibleAiOrchestrator`).
- **Inputs**: Working Queue approved items, pipeline events, Developer Memory summaries, board snapshot (via adapter).
- **Outputs**: `RequirementsMessage` / interview chips, next-action narration, planner handoff requests.
- **Maps today**: `implementationExecutionBoardMessage.ts`, `implementationStageNextActions.ts`, `implementationChipPolicy.ts`, orchestration messages in `prototypeExecutionSingleChatV1`.

### 4.3 SingleChat Workspace

- **State**: `prototypeExecutionSingleChatV1` (+ future dedicated slot for workspace-only metadata if split).
- **UI reuse**: `PrototypeChatShell`, `PrototypeChatTimeline`, `PrototypeChatInput` (`prototypeChatTimeline.tsx`).
- **Maps today**: `useImplementationRuntimeSyncController`, `usePrototypeExecutionPersistChatToDb`, chip handlers — but **not** main layout today.

### 4.4 Working Queue

- **Purpose**: 사용자 보완요청·변경 의도를 **즉시 CodeTask 실행하지 않고** 구조화.
- **Proposed type** (design-only):

```ts
export type ImplementationWorkItemStatus =
  | "pending"
  | "approved"
  | "running"
  | "completed"
  | "rejected"
  | "deferred";

export type ImplementationWorkItemV1 = Readonly<{
  readonly workItemId: string;
  readonly projectId: string;
  readonly source: "user_chat" | "preview_feedback" | "dashboard";
  readonly summary: string;
  readonly detail?: string;
  readonly status: ImplementationWorkItemStatus;
  readonly linkedCodeTaskIds?: readonly string[];
  readonly createdAt: string;
  readonly updatedAt: string;
}>;
```

- **Maps today (partial)**: `implementationUserFeedback` (generic), `implementationExecutionBoardStateV1` rework/confirmation rows, `cursorWorkItemsV1` (planning/implementation WIP — **not** a user intent queue). **Greenfield** for P4.

### 4.5 Developer Memory

- **Purpose**: AI-only context — branch plan intent, file boundaries, open risks, last integration outcome.
- **Exposure**: Summaries only in chat (“지금 integration branch에 screen head만 merge했습니다”).
- **Maps today (fragments)**: `codeTaskPromptContextMapV1`, `implementationCodeTaskPlanV1`, `promptTimeline`, `implementationExecutionLogTimeline` — **no unified memory model**.

### 4.6 Developer Dashboard

- **Absorbs**: `ImplementationExecutionBoardPanel` (task tree, integration footer, github recheck, execution log entry, developer prompt preview).
- **Placement**: Toolbar icon → Drawer/Modal (not full-page default).
- **Maps today**: entire panel + `ImplementationExecutionLogModal`, integration footer components.

### 4.7 Preview Loop

- **States**: `implementationPreviewScopeV1`, `implementationPreviewRuntimeV1`, `prototypeRunSyncSnapshot.previewReady`, `integratedAppPreviewReady` (`implementationPreviewReadiness.ts`).
- **Actions**: open external preview (`useImplementationPreviewController`), post-preview feedback → Working Queue.
- **Maps today**: preview controllers + integration success toasts; **no** closed-loop queue yet.

### 4.8 Execution Pipeline Adapter

Facade over **existing** stable paths:

| Step | Existing module / API |
|------|------------------------|
| CodeTask plan / prompts | `implementationCodeTaskPlanV1`, code task planner services |
| Cursor dispatch | `taskCursorExecution`, `implementationExecutionJob`, runtime DB actions |
| GitHub verify | `codeTaskExecutionRun` + polling state + `useImplementationGithubVerifyController` |
| CodeTask complete | run status `github_verified` / `completed` |
| Integration | `runProjectIntegrationPipeline` → `runIntegrationBranchPipeline` |
| Merge strategy | `integrationMergeTargetsResolver.ts` (linear chain head-only) |
| Build / check / PR | `implementationIntegrationPipelineService`, GitHub services |
| Preview deploy | integration pipeline outcome, `previewReady` |
| Client entry | `POST /api/prototype/integration/run-pipeline`, `implementation-runtime/actions` (redirects integration to run-pipeline) |

Adapter **translates** pipeline timeline events → AI Developer utterances + Dashboard rows; **must not** fork merge/verify logic.

---

## 5. Responsibility Matrix

| Domain | Responsibility | Must Not Do |
|--------|----------------|-------------|
| **Implementation Workspace** | Chat-first UX; orchestrate dashboard/preview/queue; route user intent | Direct Git merge; rewrite CodeTask planner rules; implement review-stage QA |
| **AI Developer** | Progress narration; next-step guidance; interpret supplement requests; approve queue → planner | Execute every user message immediately; override planning scope; act as security/reviewer |
| **SingleChat Workspace** | Main conversation UI; show summarized status; capture feedback text | Show full CodeTask tree by default; expose raw branch/SHA as primary UI |
| **Working Queue** | Structure/defer/approve/reject user requests; batching rules | Skip approval before Cursor; replace CodeTask plan |
| **Developer Memory** | Retain design intent & impact; feed planner context | Show raw internal notes to user |
| **Developer Dashboard** | CodeTask/Cursor/GitHub/integration/preview/log **truth panel** | Replace chat as primary surface |
| **Preview Loop** | Preview readiness messaging; open preview; funnel feedback to queue | Sample-data quality gate for production DB (review stage) |
| **Execution Pipeline Adapter** | Invoke existing APIs; map events to workspace model | Change verify/merge/build semantics |

---

## 6. State Ownership

| Concern | Current owner (persisted) | Target owner (P4+) |
|---------|---------------------------|---------------------|
| Chat messages | `requirementsStateJson.prototypeExecutionSingleChatV1` | SingleChat Workspace (same field or alias) |
| CodeTask runs / verify | `codeTaskExecutionRunsV1` | Adapter read-only; Dashboard display |
| Board / rework / confirmation | `implementationExecutionBoardStateV1` | Derived snapshot for Dashboard; shrink over time |
| Task list / plan | `implementationTaskListV1`, `implementationCodeTaskPlanV1` | Developer Memory + Adapter |
| Integration plan | `codeTaskIntegrationPlanV1`, `implementationIntegrationStepsV1` | Adapter + Dashboard |
| Preview scope/runtime | `implementationPreviewScopeV1`, `implementationPreviewRuntimeV1` | Preview Loop |
| Prompt timeline / exec log | `promptTimeline` | Dashboard log tab + AI summaries |
| Working Queue | *(none)* | **New** `implementationWorkQueueV1` (proposed) |
| Developer Memory | *(fragments)* | **New** `developerMemoryV1` (proposed, AI-facing) |
| UI drawer/modal | — | Ephemeral React state only |

**Rule**: Pipeline services remain source of truth for **execution truth** (runs, merge results). Workspace owns **intent** (queue) and **presentation** (chat, summaries).

---

## 7. Relationship with Existing Pipeline

Preserved end-to-end chain (do not break in migration):

```text
CodeTask 생성
→ Cursor workBranch commit/push
→ GitHub branch/head commit 확인
→ CodeTask 완료 판정
→ integration branch 생성
→ merge/build/check (topology-aware merge targets)
→ PR 생성 (optional)
→ GitHub Pages Preview 배포
→ previewReady / integratedAppPreviewReady
```

**Adapter contract (design):**

1. UI / Workspace calls **existing** client methods (`runIntegrationBranchPipelineClient`, runtime actions, task cursor APIs).
2. Adapter subscribes to `promptTimeline` + integration plan patches + run list changes.
3. Adapter emits **domain events** (`ImplementationWorkspaceEventV1`) for AI Developer — implementation later, not in M0-01.

**Explicit non-touch list (P4-M0):**

- `implementationIntegrationPipelineService.ts` merge loop & merge target resolver
- GitHub polling schedulers / verify workers
- CodeTask prompt generation / artifact contract
- `POST /api/prototype/integration/run-pipeline` request shape

---

## 8. Relationship with Review Stage

| | Implementation Workspace | Review Stage (future) |
|--|-------------------------|------------------------|
| **Goal** | Build integrated **sample-data** preview via AI dev loop | User/AI **acceptance** of prototype; real-data/DB concerns |
| **Primary UI** | AI Developer chat | Separate review workspace (TBD) |
| **Preview** | Integrated app URL from implementation pipeline | May reuse URL; different checklist |
| **Current code** | Full pipeline + board | `PrototypeReviewPlaceholderPageClient` only |
| **Rail** | “구현” step (`execution`) | “검토” step (`prototype_review`) — icon retained |

Implementation Workspace **must not** absorb review-stage acceptance criteria. Moving to review is a **workflow transition**, not a board chip.

---

## 9. Non-goals (P4-M0)

- Rewriting integration merge strategy or linear-chain head-only behavior.
- Replacing GitHub verify or Cursor dispatch.
- Building new review-stage features (legacy removed intentionally).
- Large-scale UI rewrite in M0-01 (design only).
- Splitting `requirementsStateJson` persistence in this document’s implementation phase (planned in M0-03/M0-04).

---

## 10. Next Implementation Tasks

Suggested sequence (aligns with `jyo_p4_m0_02` ~ `04` prompts):

1. **M0-02 Runtime architecture** — event flow: chat → queue → adapter → pipeline → chat; controller layering vs new `ImplementationWorkspaceProvider`.
2. **M0-03 Component & data model** — `implementationWorkQueueV1`, `developerMemoryV1`; SingleChat-first layout; Dashboard drawer wrapping existing board panel.
3. **M0-04 Migration strategy** — phased: (a) dashboard behind icon, (b) chat-first layout with adapter read-only, (c) queue before Cursor, (d) deprecate board-as-home.
4. **Adapter spike** — thin module mapping `promptTimeline` actions to workspace events (no pipeline edits).
5. **Guardrails** — extend complexity guards so new logic lands in workspace modules, not `usePrototypeImplementationStagePanel` body.

---

## Appendix A — Key file index (implementation stage)

```text
apps/web/src/app/execution/
apps/web/src/components/preview/PrototypeImplementationStagePanel.tsx
apps/web/src/components/preview/ImplementationExecutionBoardPanel.tsx
apps/web/src/components/preview/usePrototypeImplementationStagePanel.tsx
apps/web/src/components/preview/useImplementation*Controller.*
apps/web/src/lib/prototype/implementationExecutionBoard.ts
apps/web/src/lib/prototype/codeTaskExecutionRun.ts
apps/web/src/lib/prototype/implementationIntegrationPipelineService.ts
apps/web/src/lib/prototype/projectIntegrationPipelineService.ts
apps/web/src/app/api/prototype/integration/run-pipeline/route.ts
apps/web/src/lib/requirements/requirementsStateJson.ts
apps/web/src/components/preview/prototypeChatTimeline.tsx
docs/implementation-control-plane-complexity-summary.md
```

---

## Appendix B — Migration principles

1. **Strangler fig**: Dashboard drawer first; chat-first layout second; queue third.
2. **Dual read**: During migration, Dashboard and Adapter both read same `requirementsStateJson` fields.
3. **No pipeline forks**: All execution side effects go through existing routes/services.
4. **User-visible simplification**: Branch/SHA/conflict details stay in Dashboard “advanced” sections until user opens them.
