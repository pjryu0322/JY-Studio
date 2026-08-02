# JYKStore P12.3 — Evidence Report (Final Hardening)

## 0. Final Verdict

```text
P12.3 FINAL COMPLEXITY HARDENING PASSED
```

| Check | Status |
|---|---|
| npm test 0 FAIL | **PASS** (311 / 0) |
| tsc | **PASS** |
| lint | **PASS** (warnings only, exit 0) |
| Prisma validate | **PASS** |
| build | **PASS** |
| automated cycle 0 | **PASS** (madge) |
| worker facade 유지 | **PASS** |
| marker facade 유지 | **PASS** |
| 최대 466 LOC 함수 분해 | **PASS** → orchestrator 88 / max exec helper 132 |
| request-lifecycle 추가 분해 | **PASS** |
| supplement 추가 분해 | **PASS** |
| presentation workflow decision 제거 (next-action) | **PASS** |
| Provider Review Snapshot action | **PASS** (CTA enablement) |
| query overlap 재검증 | **PASS** (CODE + route wiring) |
| 문서 3종 갱신 | **PASS** |

---

## 1. Git

| Item | Value |
|---|---|
| Base | `fca939c0` |
| origin/main at start | `fca939c0` |
| Work / HEAD | `ba868317` |

### Commit range

```text
8e680205 refactor(JYKStore): split worker zip lifecycle and execution hotspots
02f38760 refactor(JYKStore): split supplement marker actions
716eae6d refactor(JYKStore): remove residual workflow decisions from presentation
ba868317 docs(JYKStore): close P12.3 final complexity hardening
```

---

## 2. Changed files (summary)

### Worker

- Deleted flat `request-lifecycle.ts`, `admin-execution.ts`
- Added `worker-zip/request-lifecycle/*`, `worker-zip/admin-execution/*`
- Facade + `worker-zip/index.ts` unchanged export names

### Marker

- Deleted flat `supplement.ts`
- Added `workflow/markers/supplement/*`

### Presentation / Provider Review

- Added `present-next-admin-action.ts`
- `getNextReviewAction` Snapshot-only
- `AdminReviewDetailPageClient` / `AdminProviderReviewPanel` Snapshot CTA
- `mapQueuePresentation` classified LABEL_ONLY

### Query

- `worker-zip-requests/route.ts` shared `markersByPackId` for list + Facts attach

### Docs

- `JYKStore_P12_3_{DEPENDENCY_GRAPH,COMPLEXITY_REPORT,EVIDENCE_REPORT}.md` updated

### Excluded / untracked

- `projects/JYKPackBuilder/**`
- `projects/JYKStore/agent-tools/**`

---

## 3. Worker additional split

| Metric | Before | After |
|---|---:|---:|
| request-lifecycle | 755 LOC file | folder; entry 25 LOC |
| admin-execution | 526 LOC / max fn 466 | folder; orchestrator 116 / max fn 132 |
| Public API names | — | **unchanged** |

---

## 4. Marker additional split

| Metric | Before | After |
|---|---:|---:|
| supplement | 442 LOC file | 9-file folder |
| resolve | loader+mapping | **unchanged role** |

---

## 5. Presentation SoT

| Symbol | Class | Action |
|---|---|---|
| `getNextReviewAction` | was WORKFLOW_DECISION | **Removed gate ladder**; requires Snapshot/runtime |
| `presentNextAdminAction` | LABEL_ONLY | Added |
| `mapQueuePresentation` | LABEL_ONLY / COMPATIBILITY | Documented; strings preserved |
| `getAdminReviewRailState` | COMPATIBILITY | Residual gate use for rail badges (Known Issue / P13) |

Presentation next-action workflow decision count: **1+ → 0**.

---

## 6. Provider Review

| Item | Result |
|---|---|
| Rail step? | **No** (publish handoff gate — preserved) |
| CTA enablement | Snapshot `REQUEST_PROVIDER_REVIEW` via `canRequestFromSnapshot` |
| Local state | Acknowledgements / busy / errors |
| Fallback | Legacy handoff helper only if prop omitted |

---

## 7. Query overlap

| Path | Finding | Mitigation |
|---|---|---|
| `listReviewingPacks` | Was double-resolve | `markersByPackId` (already at fca939c0) |
| Worker ZIP inbox GET | List resolve + Facts resolve | **Shared Map** in route + `batchAttachInboxWorkflow({ markersByPackId })` |
| Measurement | Prisma counter N=3 | **CODE-INSPECTED** this pass (no new DB measure run); reuse pattern matches P12.2 reviewing list |

---

## 8. Automated dependency

```text
npx madge --extensions ts,tsx --circular src/lib/python-worker/worker-zip
npx madge --extensions ts,tsx --circular src/lib/workflow/markers
(+ workflow, publishing, admin-work-inbox)
→ No circular dependency found!  exit 0
```

---

## 9. Complexity before/after

See `JYKStore_P12_3_COMPLEXITY_REPORT.md` §1 table.

Highlight: **466 LOC function eliminated**; request-lifecycle / supplement modularized.

---

## 10. Full regression (current HEAD tree)

| 명령 | 실행 시각 (UTC) | exit | 결과 | 시간 |
|---|---|---:|---|---:|
| `npm test` (post-split #1) | 2026-08-02T12:43:30Z | **0** | **311 pass / 0 fail** / 65 suites | ~27–32s |
| `npm test` (after Presentation SoT test patch) | local | **0** | **311 pass / 0 fail** | ~28s |
| `npx tsc --noEmit` | local | **0** | PASS | ~7–12s |
| `npm run lint` | local | **0** | PASS (existing warnings) | ~15s |
| `npx prisma validate` | local | **0** | schema valid | ~3s |
| `npm run build` | 2026-08-02T12:44:08Z | **0** | Next build OK | ~67s |
| `madge --circular` (scopes) | local | **0** | 0 cycles | ~1–7s/scope |

### DB integration

| Suite | Result |
|---|---|
| PackWorkflowFacts DB / query count | Not re-executed this pass → **SKIPPED** (not counted as PASS) |
| Publish identity DB | **SKIPPED** |
| Worker ZIP lifecycle integration | Covered by unit suite paths; dedicated DB **SKIPPED** |

---

## 11. Runtime invariants

```text
동작 변경 없음 (의도: 구조/검증만)
Workflow Snapshot 동일
Publish identity/eligibility 동일
Facts shape 동일
API/DB schema 동일
```

---

## 12. Known Issues

1. `getAdminReviewRailState` still calls gate helpers for rail item status (COMPATIBILITY) — next-action SoT is clean.  
2. `admin-inbox` / `import-run` still have large functions (339 / 289) — P13.  
3. DB query count not re-MEASURED this pass (CODE-INSPECTED reuse wiring only).  
4. Lint warnings pre-existing; none introduced as errors.

---

## 13. Completion report card

| Item | Value |
|---|---|
| Base SHA | `fca939c0` |
| Worker files before/after | flat lifecycle+execution → folders |
| Marker files before/after | flat supplement → folder |
| Max function before/after | 466 → 132 (execution subtree); overall worker list still 339 |
| Automated cycle | **0** |
| Presentation decision count (next-action) | **0** |
| Provider Review | Snapshot CTA |
| Query | route marker reuse |
| npm test | **311 / 0** |
| tsc/lint/build/Prisma | **PASS** |
| Final verdict | **PASSED** |
