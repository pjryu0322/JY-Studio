# JYOrchestration Phase 7 — Project Knowledge & User Memory Handoff

작성일: 2026-06-27  
기준 커밋: Phase 7 completion (requirements turn context, panel API, stale preview, state adapter)

---

## 1. Phase 7 목표

동일 사용자(same-user)의 이전 프로젝트 지식을 **Reference Snapshot**(명시 선택)과 **User Project Knowledge Memory**(자동 수집·주입) 두 축으로 프로젝트 기획·구현 AI 흐름에 연결한다. Agent-aware Knowledge Graph, Graph Viewer, Control UX, usage metrics, 경계 리팩터링까지 포함한다.

---

## 2. 구현 완료 범위

- Agent-aware Project Knowledge Graph metadata 및 Agent Graph View / Projection
- Same-user User Project Knowledge Memory 수집·Agent별 prompt injection
- SingleChat: `requirementsTurnKnowledgeContext` 경유 reference + user memory 준비
- CodeTask Developer Memory prompt injection 및 usage recording
- User Memory Control UX (enabled, agent toggle, pin/ignore, opaque action ID, ignored restore)
- User Memory usage metrics (event summary, sanitized API, Control Panel “최근 사용”)
- Boundary refactor: turn context service, `projectKnowledgeRequirementsStateAdapter`, panel 통합 API, Graph Explorer memory section
- **Stale detection 1차**: ignored / low_relevance 후보 preview (자동 삭제·prompt 제외 없음)
- Phase 7 completion: adapter 확장(reference/materialized/graph trace), stale API, handoff 문서

---

## 3. 주요 설계 결정

- User Project Knowledge Memory는 **same-user scope**로 제한한다. 다른 사용자/팀/조직 공유는 Phase 7 범위가 아니다.
- Reference Snapshot은 **명시 선택** 기반 고급 기능으로 유지한다.
- Same-user Memory는 Agent별 prompt context로 자동 반영하되, **프로젝트 단위 Control UX**를 제공한다.
- `sourceProjectId` / `sourceNodeId` / raw memory item id는 사용자 UI/API에 노출하지 않는다 (opaque action ID 사용).
- Usage metrics는 **원문이 아니라 event summary**만 저장·API는 sanitize한다.
- Stale detection 1차는 **후보 표시**이며 자동 삭제/자동 prompt 제외가 아니다.

---

## 4. 주요 파일 맵

| 영역 | 경로 |
|------|------|
| Turn context | `apps/web/src/lib/requirements/requirementsTurnKnowledgeContext.ts` |
| State adapter | `apps/web/src/lib/project-state/projectKnowledgeRequirementsStateAdapter.ts` |
| Facade | `apps/web/src/lib/project-knowledge/userMemoryFacade.ts` |
| Memory core | `projectKnowledgeUserMemoryService.ts`, `projectKnowledgeUserMemoryPromptInjection.ts` |
| CodeTask dev memory | `projectKnowledgeDeveloperMemoryCodeTaskPrompt` / augmentation |
| Control / usage | `projectKnowledgeUserMemoryControl*`, `projectKnowledgeUserMemoryUsage*` |
| Stale | `projectKnowledgeUserMemoryStaleTypes.ts`, `projectKnowledgeUserMemoryStaleService.ts` |
| Panel API | `app/api/project-knowledge/user-memory-panel/route.ts`, `projectKnowledgeUserMemoryPanelService.ts` |
| UI | `UserProjectKnowledgeMemoryControlPanel.tsx`, `UserProjectKnowledgeMemoryStalePreview.tsx`, `ProjectKnowledgeMemoryControlSection.tsx` |

---

## 5. 데이터 흐름 (요약)

1. 프로젝트 `requirementsStateJson`에 reference selection, materialized reference, user memory control/usage, graph trace 등이 저장된다.
2. SingleChat/API turn 시 `prepareRequirementsTurnKnowledgeContext`가 reference block + user memory prepared context를 한 번에 준비한다.
3. Control/usage persistence는 adapter를 통해 state field를 merge한다.
4. Control Panel은 `GET /api/project-knowledge/user-memory-panel`로 control + preview + usageSummary + stalePreview를 한 번에 로드한다.

---

## 6. Prompt injection 흐름

- **Reference**: `[reference_context]` block — materialized reference 또는 legacy selection 기반 (`projectKnowledgeReferencePromptContext`).
- **User Memory**: Agent별 markdown section — control enabled 및 agent toggle, pin/ignore/exclude 반영 (`prepareSameUserProjectKnowledgeMemoryPromptContexts`).
- **CodeTask**: Developer agent memory augmentation on execute prompt path (기존 hardening 유지).

---

## 7. User Memory Control UX 흐름

- Panel toggle → `PATCH /api/project-knowledge/user-memory-control` (opaque actionId 기반 pin/ignore/exclude).
- Preview list + ignored section + unignore.
- Stale section: 정리 후보 표시, **동일 pin/ignore action** 재사용.

---

## 8. Usage metrics 흐름

- 성공 SingleChat / CodeTask prompt build 후 fire-and-forget recording → `userProjectKnowledgeMemoryUsageStateV1`.
- `GET /api/project-knowledge/user-memory-usage` 및 panel의 `usageSummary`는 **sanitized** recentEvents.

---

## 9. Stale detection 1차 범위

- 계산: preview + control + usage (optional agent lastUsedAt).
- 필수 reasons: `ignored`, `low_relevance` (&lt; 0.4).
- `not_recently_used`, `old_source_project`: 데이터 join 가능 시 확장 (코드에 TODO).
- API: `GET /api/project-knowledge/user-memory-stale-preview?projectId=`.
- **Prompt injection 변경 없음.**

---

## 10. 보안 / 비노출 정책

UI/API/prompt timeline/log에 노출 금지: raw conversation, personal memo, provider keys, sourceProjectId, sourceNodeId, raw memory item id, prompt markdown 전체, userId 원문, internal execution id (usage API recentEvents).

허용: agent label, counts, timestamps, surface/outcome, opaque action id, sanitized title/summary, stale reason labels.

---

## 11. 테스트 실행

`projects/JYOrchestration/apps/web`에서:

```bash
npx vitest run tests/lib/requirementsTurnKnowledgeContext.unit.test.ts
npx vitest run tests/lib/projectKnowledgeRequirementsStateAdapter.unit.test.ts
npx vitest run tests/api/projectKnowledgeUserMemoryPanelRoute.unit.test.ts
npx vitest run tests/lib/projectKnowledgeUserMemoryStaleService.unit.test.ts
npx vitest run tests/api/projectKnowledgeUserMemoryStalePreviewRoute.unit.test.ts
npx vitest run tests/components/UserProjectKnowledgeMemoryStalePreview.unit.test.tsx
```

Phase 7 회귀: user memory usage/control/preview routes, control panel, graph view, developer memory CodeTask tests (프롬프트 §9 목록).

---

## 12. 남은 후속 과제

- Stale: `not_recently_used` / `old_source_project` 정밀 join, optional prompt deprioritization (정책 합의 후).
- Knowledge Pack candidate promotion (Phase 8 후보).
- Adapter를 통한 requirementsStateJson 접근 추가 확대 (readonly UI 경로).
- Panel API dedupe: stale 계산 시 preview 단일 pass 최적화.

---

## 13. Phase 8 진입 제안

**Knowledge Pack Candidate Promotion** — 재사용 가치 높은 지식 후보화, Agent별 draft pack, 검수 기준 연결, export 경계를 Knowledge Pack Management System과 분리 가능하게 설계.
