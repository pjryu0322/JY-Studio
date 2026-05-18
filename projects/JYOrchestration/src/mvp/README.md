# `src/mvp` — target MVP execution architecture (JY-Orchestration)

**This tree is the target architecture** for isolated execution, domain generation, prompts, and review
inside `projects/JYOrchestration`. Extend here (facade → application → ports) rather than growing
parallel engines.

**Legacy / transitional surfaces** (temporary until retirement criteria are met):

- `legacy/exampleFlow.ts` — in-process demos that bypass `mvpOrchestrationFacade`.
- Tasks without `screenId` — prompt/reviewer compatibility path (no ScreenFlow block).

The production **Stage1 / Stage2** stack and **ProjectSpec** pipelines live outside this package
(typically under `apps/web`); do not modify them from here.

See also: `docs/MVP_LEGACY_RETIREMENT_CHECKLIST.md`.
