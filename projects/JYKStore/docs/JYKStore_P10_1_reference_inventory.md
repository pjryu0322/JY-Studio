# JYKStore P10.1 — Reference Inventory

**Base SHA:** `69732a51`  
**Scope:** `projects/JYKStore/**`  
**Principle:** classify by real import / route / DB / runtime / test references; never delete on filename alone.

## 1. Classification legend

| Class | Meaning |
|---|---|
| CANONICAL_RUNTIME | Live product path (6-step workflow, publish gates, public API/MCP) |
| BOUNDARY_COMPATIBILITY | Legacy input → normalize → canonical; or intentional 410 freeze |
| TEST_SUPPORT | Unit/DB/E2E fixtures and assertions |
| OPERATIONS_TOOL | Ops scripts, MCP launcher, cleanup utilities |
| DOCUMENTATION | Phase audits / runbooks |
| LEGACY_REFERENCED | Still referenced; deprecate, do not blind-delete |
| DEAD_CANDIDATE | No runtime reach; safe DELETE after proof |
| UNKNOWN | Do not delete |

## 2. Canonical runtime map

| Area | Source of truth |
|---|---|
| Admin steps | `receipt → knowledgeScope → generation → correction → serviceValidation → publish` (`admin-workflow-steps.ts`) |
| Provider Review | Publish gate (`admin-workflow-gates.ts`, markers) — **not** a rail step |
| Publish recovery | `RESTORE_EXISTING` / `PUBLISH_NEW_REVISION` / `BLOCKED` (`publish-recovery.ts`) |
| Publish services | `approvePackReview`, `unpublishPackReview`, `restorePublishedPackAfterUnpublish`, `publishNewRevisionAfterUnpublish`, `rejectPackReview` |
| Inbox queues | Canonical `AdminWorkQueueKey` via `normalizeAdminWorkQueue` |

## 3. High-confidence candidates

| Path / Identifier | Current role | References | Runtime | Data | Compat | Recommendation | Risk |
|---|---|---|---|---|---|---|---|
| `QUALITY_CHECK_REQUIRED` inbox group | Declared/filter only; never assigned in `mapQueuePresentation` | `admin-work-inbox-view-model.ts`, `AdminWorkInboxPageClient.tsx` | No | No | No | **DELETE** | LOW |
| `AdminReviewDecisionPanel.tsx` | Deprecated re-export | Tests assert page does **not** import it | No | No | No | **DELETE** | LOW |
| `AdminReviewDecisionSummary.tsx` | Deprecated re-export → AcceptTab | Only DecisionPanel | No | No | No | **DELETE** | LOW |
| `adminAccept` BottomTab | Duplicate of `admin`/`adminReceipt` | `routes.ts`, `BottomTabNav.tsx`; rail order uses `admin` | No (unused in rail) | No | No | **DELETE** | LOW |
| `/admin/knowledge-unit-drafts` stub page | Soft-deprecation copy | `ROUTES`, chrome, freeze tests | Bookmark only | No | Thin redirect OK | **DELETE page UI → redirect** | LOW |
| `scripts/p4-3-1-check-run.ts`, `p4-3-pack-state.ts`, `p4-3-1-bootstrap-lookup.ts`, `p4-3-db-snapshot.ts` | Hard-coded pack probes | None (manual) | No | Read-only | No | **DELETE** | LOW |
| `scripts/p4-3-deep-probe.ts`, `p4-3-analyze-worker-output.ts`, `p4-3-inventory-capability-scan.ts`, `p4-3-provenance-map-check.ts` | One-off debug | None | No | Read-only | No | **DELETE** | LOW |
| ~25× `legacyBuilderDisabledBody` 410 routes | Intentional freeze contract | Freeze tests + clients expecting 410 | Yes (410) | No | Yes | **KEEP** (BOUNDARY) | — |
| Legacy queue aliases `accept`/`quality`/`provider-review`/`approval-publish` | Boundary parsers | `routes.ts`, chrome, tabs | Bookmark deep-links | No | Yes | **DEPRECATE** keep parsers | MED |
| Step aliases `providerConfirm`/`decision`/`searchValidation` | Boundary → canonical | `admin-workflow-steps.ts` | Deep-links | No | Yes | **DEPRECATE** keep parsers | MED |
| `isOpenAdminSupplementPhase` vs `isOpenProviderSupplementPhase` | Duplicate open-phase sets | Workflow transition / gates / UI | Yes | No | Soft | **CONSOLIDATE** | LOW |
| Docling UI (`NEXT_PUBLIC_PROVIDER_LEGACY_DOCLING`) | Flag-gated legacy import | Provider tabs + Docling APIs | Optional | Yes | Yes | **DEPRECATE** (P11+) | HIGH |
| Docling* Prisma models | Active when Docling used | Upload sessions, jobs | Conditional | Yes | Yes | **DEPRECATE** plan only | HIGH |
| `PipelineStatus` enum | Parallel pack pipeline vocabulary | PipelineRun | Yes | Yes | Audit | **DEPRECATE** / audit P11 | MED |
| Quality report models | Generation quality domain | Worker ZIP quality, gates | Yes | Yes | No | **KEEP** | — |
| Publish restore / new-revision APIs | P9.1 identity | Workbench + E2E | Yes | Yes | No | **KEEP** | — |
| `JYKSTORE_ALLOW_JSON_VECTOR_FALLBACK` | Ops degraded vector path | Retrieval / readiness | Ops | No | Yes | **KEEP** | — |
| Untracked `tmp-p*-e2e/` | Local E2E scratch | gitignore incomplete | No | Artifacts | No | **IGNORE** + gitignore | LOW |

## 4. API route sketch

| Class | Examples |
|---|---|
| PUBLIC | `/api/health`, `/api/v1/packs/...`, `/api/v1/retrieval/query`, `/api/v1/mcp/...`, exports |
| ADMIN | `/api/v1/admin/**` reviews, worker-zip, knowledge-scope, correction, store-workflow, ops |
| PROVIDER | `/api/v1/provider/**` packs, search-data, service-validation, distribution |
| INTERNAL_WORKER | Docling / search-data workers (process-side) |
| TEST_ONLY | `/api/v1/dev/test-accounts*` (`JYKSTORE_ENABLE_TEST_ACCOUNT_SWITCHER`) |
| BOUNDARY / 410 | Legacy builder evaluate / chunks mutate / KU activate / github auto-collect |
| CANONICAL publish | approve, reject, unpublish, restore-publish, publish-new-revision, publish-recovery |

## 5. Scripts sketch

| Class | Scripts |
|---|---|
| OPERATIONS_REQUIRED | `dev-minio.mjs`, `mcp-stdio-launcher.mjs`, embedding runners, `smoke-dev-processes.ts` |
| RELEASE_VALIDATION | `audit-published-revision-identity.ts`, `p8-1-*`, `p8-retrieval-quality-eval.ts` |
| REGRESSION_E2E | `p6-1-*`, `p7-*`, `p9-1-role-*`, `p9-1-browser-*`, `p4-3-1-admin-e2e.ts` |
| ONE_TIME_MIGRATION | `cleanup-legacy-zip-payloads.ts`, `backfill-search-generations.ts` |
| OBSOLETE / DEBUG | hard-coded `p4-3-*` probes listed in §3 |

## 6. Deletion gate applied in P10.2

Candidates marked **DELETE** above satisfied:

- no runtime import / rail mount
- no package.json script
- no DB write dependency
- tests updated or obsolete
- compatibility either unnecessary or replaced by thin redirect/parser

**Not deleted in P10:** 410 freeze routes, Docling schema/UI, legacy queue parsers, publish recovery surface.

## 7. Next

- P10.2: execute DELETEs + CONSOLIDATE supplement helper  
- P10.3: data model / object storage / env plans (no DROP)  
- P10.4: regression + Role E2E + final verdict
