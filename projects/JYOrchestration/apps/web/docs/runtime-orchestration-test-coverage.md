# H20.5~H45.5 / Pilot Validation Phase 0 Runtime Orchestration Test Coverage

## Coverage summary

| Priority | Layers | Harness unit tests | Overlay UI tests | Notes |
|----------|--------|-------------------|-------------------|-------|
| P1 | H38.5–H45.5, Pilot Validation Phase 0–3 | yes | H38–H45.5 + Pilot Validation + request draft + `PilotValidationReviewPanel` | `runtimeShared/runtimeReadOnlyInvariants.ts` + unit test |
| P2 | H36–H37.5 | yes | yes | execution boundary + governance boundary |
| P3 | H31–H35.5 | yes (H33 harness gap) | yes | H33 overlay only |
| P4 | H20.5–H30 | yes | yes | resource through runner harness |

## Required axes (by layer maturity)

| Axis | H38.5+ | H20.5–H37 |
|------|--------|-----------|
| ready / `*_metadata_ready` | covered | partial |
| watch | covered (H39.5, H40, H40.5) | partial |
| blocked | covered | partial |
| violation → blocked | covered (H40.5) | partial |
| proof `diagnosticOnly=false` → blocked | H40.5 | rare |
| forbidden flag incomplete | H40.5 | rare |
| serializer no rebuild | H40/H40.5, semantic bundle test | implicit |
| diagnostic API additive fields | H40.5 (+4 fields) | manual |
| overlay compact mode + final gate | H40.5 overlay test | most sections |

## Gaps / TODO (no blockers for H40.5 entry)

1. **Cross-layer invariant test** — extend `runtimeReadOnlyInvariants` to sample H38 governance forbidden proof (low risk).
2. **H33 harness unit test** — add `runtimeNoopShellHardening.unit.test.ts` (optional).
3. **Planning chain static audit** — document-only; no automated grep test yet.
4. **Diagnostic API payload size** — document split candidates in inventory; no API restructure in audit pass.
5. **Helper consolidation** — `runtimeChecklistHelpers` re-exports preflight helpers; full `runtimeViolationHelpers` merge deferred (H35.5 wording risk helpers stay local).

## Run commands

```bash
cd projects/JYOrchestration/apps/web
npx tsc --noEmit
npx vitest run tests/harness/runtimeShared tests/harness/runtimeUltimateGovernanceReview tests/harness/runtimeFinalReleaseGovernanceGate
npx vitest run tests/overlay-ui/runtimeUltimateGovernanceReviewSection.unit.test.ts
```

Heavy full suite:

```bash
npx vitest run tests/harness tests/overlay-ui
```
