# Implementation Control Plane Complexity Summary

## Status

Implementation-stage parent hook is now maintained as a controller-composition shell.

## Parent Hook

Target:

- `apps/web/src/components/preview/usePrototypeImplementationStagePanel.tsx`

Policy:

- Parent hook wires controller hooks.
- Heavyweight business logic must live in named `useImplementation*Controller` hooks.
- Static guard tests prevent reintroducing heavy execution, preview, SCM, quality, runtime sync, notice, entry recovery, and derived view-model logic into the parent hook.

## Controller Groups

- Runtime Sync
- Derived ViewModel
- Notice Modal
- Entry Recovery
- Quick Run
- GitHub Verify
- Integration Pipeline
- Stage Action Adapter
- WIP Chip Handler
- Board Interaction
- Chip Handler
- Preview
- Final SCM
- Quality / Integrated Stage
- Developer Prompt Copy
- Execution Log
- Auto Prep Sync
- Status / Notice
- Planning / Seed / TaskList
- DB Strategy
- Board Refresh
- Toolbar
- Runtime Recovery / Retry
- Deliverable Viewer

## Guard Tests

- `implementationParentHookComplexityGuard.unit.test.ts`
- `implementationControlPlaneComplexitySummary.unit.test.ts`
- Controller-specific static wiring tests

## Completion Criteria

Implementation-stage complexity cleanup is considered complete when:

1. Parent hook remains a controller-composition shell.
2. Heavyweight action, runtime, preview, SCM, quality, notice, entry recovery, and derived view-model bodies are not in the parent hook.
3. Controller-specific static wiring tests exist.
4. Complexity guard tests pass.
5. TypeScript and relevant tests pass.

## Assembly Budget (parent hook)

Static test `implementationControlPlaneComplexitySummary.unit.test.ts` enforces approximate ceilings:

- Named `useImplementation*Controller` references: ≥ 22
- `useMemo`: ≤ 3 (current shell: 2 — orchestration-aware state, planning orchestration view)
- `useEffect`: ≤ 6 (current shell: 5 — requirements sync, project/session reset, pending-patch clear, ref sync, orchestration ref)
- `useCallback`: ≤ 4 (current shell: 3 — enrich patch, pending patch apply, quick-run client trace)

Adjust thresholds only when the shell legitimately grows; prefer new controllers over expanding the parent hook.
