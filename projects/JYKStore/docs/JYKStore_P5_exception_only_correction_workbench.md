# JYKStore P5 — Exception-only Correction Workbench

## Verdict

**P5 EXCEPTION-ONLY CORRECTION WORKBENCH PASSED**

Base: `518a6145` (P4.3.1 Admin E2E Completion)

## Goal

관리자는 생성된 모든 Chunk를 편집하지 않는다. 자동 Generation → Quality 이후 남는 **예외만** FILE / STRUCTURE / CHUNK 보정한다.

## Implementation

### Data model

- `CorrectionCase` — targetType `FILE|STRUCTURE|CHUNK`, status `OPEN→APPLIED→REGENERATED→VERIFIED→CLOSED`
- `CorrectionAuditEvent` — case-level audit trail
- `AuditAction`: `ADMIN_CORRECTION_APPLY|REGENERATE|VERIFY|CLOSE`
- Migration: `prisma/migrations/20260730060000_correction_case_workbench/`

### Services (`src/lib/correction/`)

| Service | Role |
|---------|------|
| `correction-sync-service` | Quality blockers/warnings → OPEN cases |
| `correction-apply-service` | FILE exclude / provider request; STRUCTURE delete/merge; CHUNK delete/merge |
| `correction-regenerate-service` | Applied → Worker regen (FILE) or overlay + Auto Quality → REGENERATED + Outcome |
| `correction-lifecycle-service` | Verify / Close |
| `correction-query-service` | Workbench summary + case list + audit events |

### FILE under FINALIZED inventory

Normal Inventory UI still blocks FINALIZED edits. Correction path uses `allowFinalizedCorrectionOverride` so exception-only EXCLUDE / REQUEST_PROVIDER can land, then regeneration reads Inventory excludes.

### Admin APIs

- `GET/POST /api/v1/admin/packs/[packId]/correction` — list / sync
- `POST .../correction/cases/[caseId]/apply`
- `POST .../correction/regenerate`
- `POST .../correction/cases/[caseId]/verify|close`
- `GET .../correction/cases/[caseId]/events`

### UI

`AdminKnowledgeCorrectionPanel` (`?step=correction`):

- Left: Blocker / Warning cases (not full chunk list)
- Center: preview + problem description
- Right: FILE/STRUCTURE/CHUNK actions + regenerate → Auto Quality → Outcome
- Header: 보정 필요 / 차단 / 주의 / 현재 상태 / 다음 작업
- Tech IDs behind “기술 정보 보기”

### Out of scope (as specified)

- Label Editor
- Generic Split
- Semantic duplicate delete
- Service Validation / Provider Review redesign
- Public API / MCP

## Tests

- `src/__tests__/correction-workbench.test.ts` — action surface, status next-work, summary
- Existing correction queue / rail UX tests updated for Workbench copy
- `npx tsx --test` correction + rail: **pass** (pre-existing material-acceptance copy assertions unrelated to P5 still fail)

## TS / Prisma

- P5 Correction sources: **0 new TS errors** after apply-service separator fix
- `prisma generate` + `migrate deploy` applied locally

## Regeneration flow

1. Apply correction (OPEN → APPLIED) + Audit
2. Regenerate:
   - FILE cases → `runAdminWorkerZipGeneration` (Inventory excludes)
   - CHUNK/STRUCTURE → overlay re-apply after gen (or quality-only if no FILE)
3. `refreshWorkerZipReviewReadiness` (Auto Quality)
4. Outcome via `resolveGenerationOutcome`
5. Cases → REGENERATED → VERIFIED → CLOSED

## Report path

`docs/JYKStore_P5_exception_only_correction_workbench.md`
