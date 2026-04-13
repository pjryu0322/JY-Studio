# MVP `legacy/` — transitional surfaces

Code here is **supported** but **not the default extension point** for new platform work.

- **`exampleFlow.ts`** — in-process demos that call `startRun` directly instead of `mvpOrchestrationFacade` / application use-cases.

**Target path** for new features: `../orchestration/mvpOrchestrationFacade.ts`, `../domain/`, `../../application/`, and `runMvpSelfCheck()` for regressions.

Removal criteria: `docs/MVP_LEGACY_RETIREMENT_CHECKLIST.md`.
