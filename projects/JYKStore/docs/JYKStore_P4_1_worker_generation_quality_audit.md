# JYKStore P4.1 — Worker Generation Quality Audit

**Base commit:** `49ab4263` — feat(JYKStore): bind Inventory to Working Copy and align Generation gates  
**Audit date:** 2026-07-29  
**Scope:** `projects/JYKStore/**` (python-worker + Store TS). No PackBuilder / agent-tools.  
**Method:** Code and test evidence only. No threshold unification or feature implementation in this phase.

**Final verdict:** `P4.2 WORKER HARDENING REQUIRED`

---

## 1. Executive Summary

P3.1/P4 established a sound **orchestration** path:

`Original → Working Copy → Inventory FINALIZED INCLUDED-only → Worker → Import → Quality refresh → Correction / Service Validation gates`

Generation **routing and Store quality detection** are largely ready. Worker **auto-quality correction** is only partial:

| Capability | Verdict |
|---|---|
| Router (knowledge parsers) | **PARTIAL** — PDF + path-specific HTML only; MD/TXT/DOCX/JSON knowledge **MISSING** |
| Parse | **PARTIAL** — three parsers; no typed PARSE_FAILED taxonomy |
| Structure | **PARTIAL** — normalized documents exist; no dedicated KU builder; limited structure QA in Worker |
| Chunk | **PARTIAL** — E5 budget split works; **no overlap**; tables not in chunk text |
| Too-large | **READY** (Worker split + embed gate + tests) |
| Too-small | **PARTIAL / NOT_IMPLEMENTED** for general fragments — `section_merge` is **heading chrome merge only** |
| Duplicate content | **PARTIAL** — Store detects; Worker only dedupes **IDs**; no auto-remove |
| Labels | **PARTIAL** — taxonomy/metadata only; no label QA / editor model |
| Source traceability | **PARTIAL** — path + section + hash; **no** page/offset/inventoryItemId |
| Correction data model | **MISSING** for executable actions (`MODEL_CHANGE_REQUIRED`) |
| Severity / gates | **READY** (WARNING → SV allowed; BLOCKER → Correction) |

**Decision:** Do **not** build Correction UI first. Harden Worker (and align token policy) in P4.2, then design Correction around remaining human exceptions.

### Critical answers (prompt §28)

| Question | Answer |
|---|---|
| **A. Too-small auto-merge?** | **NO** as general small-chunk merge. `merge_heading_fragments` merges named chrome headings (`Returns`, `Parameters`, …) under char caps — not arbitrary undersized chunks. |
| **B. 480 / 512 / 448?** | **512** = E5 hard max sequence (Worker + Store). **480** = Worker ZIP chunk **target**. **448** = Store Docling/E5 preferred passage (+ **48** overlap). Same purpose as 480 → **DUPLICATED_POLICY** with drift. |
| **C. Correction model?** | Display queue only. delete/merge/split/label/file-exclude → **MODEL_CHANGE_REQUIRED**. |
| **D. Source traceability?** | Path/section/hash yes; page/offset/inventory item **no** — Correction cannot reliably juxtapose chunk ↔ WC/Original location. |

---

## 2. Canonical Generation Call Graph

| Step | File | Symbol | Role | Failure |
|---|---|---|---|---|
| Admin CTA | `src/components/AdminWorkerZipGenerationCard.tsx` | `runAdminWorkerZipGeneration(packId)` | UI | — |
| Client API | `src/lib/admin-review-api.ts` | `runAdminWorkerZipGeneration` | HTTP | — |
| Route | `src/app/api/v1/admin/packs/[packId]/worker-zip/route.ts` | `POST` | Auth + exec | 401/403 |
| Orchestration | `src/lib/python-worker/worker-zip-import-provider-service.ts` | `runAdminWorkerZipGeneration` | Store | `ALREADY_RUNNING`, scope codes |
| Inventory gate | `src/lib/knowledge-scope/inventory-gate.ts` | `isKnowledgeScopeReadyForGeneration` | Store | `KNOWLEDGE_SCOPE_NOT_READY` |
| WC consistency | `src/lib/knowledge-scope/inventory-consistency.ts` | `assertInventoryMatchesWorkingCopyBytes` | Store | `INVENTORY_STALE`, `WORKING_COPY_CHANGED` |
| Manifest | `src/lib/knowledge-scope/inventory-worker-manifest.ts` | `buildWorkerInputManifestFromItems` | Store | — |
| WC stream | `worker-zip-working-copy-service.ts` | `withVerifiedWorkingCopyTempFile` | Store | integrity codes |
| Pipeline | `worker-zip-pipeline-service.ts` | `runWorkerZipImportPipeline` | Store | stage codes |
| Worker CLI | `python-worker-runner.ts` → `python-worker/parse_archive.py` | `main` → `run_pipeline` | Worker | status failed |
| Extract / inventory | `safe_extract_zip`, `build_inventory` | Worker | zip policy |
| Parse | `html_api` / `html_sample` / `pdf_docling` | Worker | skipped/failed |
| Normalize | `normalizer.normalize_documents` | Worker | — |
| Chunk + trace | `chunker.build_chunks_and_traces` | Worker | — |
| Embed | `embedding.build_embeddings` | Worker | token > 512 |
| Artifacts | `validation_report.json`, `chunks.json`, … | Worker | empty on fail |
| Import | `worker-output-db-import-service.ts` | `importWorkerOutputToStoreDb` | Store | replace by generation |
| Quality refresh | `worker-zip-quality-refresh-service.ts` | **manual** Admin CTA (not auto after gen) | Store | — |
| Outcome | `src/lib/workflow/generation-outcome.ts` | `resolveGenerationOutcome` | Store | — |
| Gates | `admin-workflow-gates.ts` | `canEnterCorrection` / `canEnterServiceValidation` | Store | — |

**Canonical:** Admin ZIP Worker path above.  
**Non-canonical / frozen:** Provider ZIP = request only; Docling TS builders for ZIP; provider quality evaluate routes **410** `LEGACY_BUILDER_DISABLED`.

**Note:** Generation success does **not** auto-run quality; Admin must call quality-refresh (`QUALITY_REFRESH_PENDING` warning path).

---

## 3. Router Matrix

Classifier: `python-worker/src/policies.py` → `classify_file` / `detect_file_type` (via `inventory.build_inventory`).

| Type | Support | Parser | Docling | Fallback | Unsupported handling |
|---|---|---|---|---|---|
| PDF | YES | `docling_pdf` | YES | skip if Docling missing | `status: skipped` |
| HTML under `Docs/.../api/` | YES | `html_api` | NO | — | — |
| HTML under samples paths | YES | `html_sample` | NO | — | — |
| Other HTML | review_target | None | — | — | not chunked |
| Markdown | NO as knowledge | — | — | — | `excluded` / no parser |
| TXT / DOCX / XLSX / PPTX | NO | — | — | — | excluded / unknown |
| JSON (non-sample) | NO knowledge | — | — | — | excluded |
| Images / fonts / css / dist | supporting / excluded | — | — | — | policy |
| License-like | review_target | `license_inspector` preview | — | — | not search-chunked |

**Gap:** Inventory may **INCLUDE** MD/TXT that Worker will **never parse** into knowledge chunks. UI/Inventory policy vs Worker capability **diverge** → P4.2 should align Inventory auto-exclude / router, or add parsers.

**Verdict:** `PARTIAL`

---

## 4. Parse Capability Matrix

| Field | html_api | html_sample | pdf_docling |
|---|---|---|---|
| title | YES | YES | YES |
| heading hierarchy | YES | weak (single section) | YES (from MD export) |
| paragraph/body | YES | YES | YES |
| table | YES | empty in samples | YES (markdownRows / raw) |
| code | YES | YES | YES |
| list | implicit in text | implicit | via markdown |
| image reference | NO | NO | NO |
| link objects | NO | NO | NO |
| metadata | symbols/keywords/entities | relatedFiles, … | status/skipReason |
| page / offset / line | NO | NO | NO |

**Failure taxonomy:** statuses `ok` / `skipped` / `failed` and free-text reasons. Typed codes `PARSE_FAILED` / `EMPTY_CONTENT` / `UNSUPPORTED_CONTENT` / encryption / encoding → **MISSING** as enums.

**Verdict:** `PARTIAL`

---

## 5. Structure Capability Matrix

- **NormalizedDocument:** `python-worker/src/normalizer.py` (`_from_api` / `_from_sample` / `_from_pdf` / `_from_license`).
- **Knowledge Unit builder:** no separate Worker module; chunks are retrieval units.
- **Store structure QA:** `structure-coverage-runner.ts` — score PASS/WARNING/FAIL; **no per-rule issue codes**.
- Detected in Store (knowledge-quality): source validation fail, coverage fail/warn, security blockers, productVersion issues, checksum duplicate, URL-only.
- Worker does **not** flag orphan sections / bad parent-child / missing source refs as structured quality events.

**Verdict:** `PARTIAL`

---

## 6. Chunk Algorithm

| Item | Implementation |
|---|---|
| Entry | `python-worker/src/chunker.py` → `build_chunks_and_traces` |
| Input | Normalized documents (skip `license_review`) |
| Pre-pass | `merge_heading_fragments` |
| Split | `_split_content` — paragraphs → lines → hard char split |
| Tokenizer | `estimate_embedding_token_count` ≈ `ceil(len/4)` — **not** HF tokenizer in chunker |
| Target | `E5_TARGET_PASSAGE_TOKENS = 480` |
| Hard max | `E5_MAX_SEQUENCE_TOKENS = 512` at embed |
| Overlap | **none** |
| Heading | included in content + `section` / `sectionPath` |
| Tables | **not** appended into chunk content |
| Code | folded into content; metadata on first part only |
| Cap | `content[:20000]` before split |

**Verdict:** `PARTIAL` (works for HTML/PDF path; tables/overlap/provenance weak)

---

## 7. Chunk Threshold SoT

| Value | Definition | Used by | Meaning | SoT? |
|---|---|---|---|---|
| **512** | `embedding.py` + `e5-embedding-constants.ts` | Embed gate | Model input hard limit | YES (aligned) |
| **480** | `chunker.py` `E5_TARGET_PASSAGE_TOKENS` | Worker ZIP chunks | Preferred passage under 512 | Worker ZIP SoT |
| **448** | `e5-embedding-constants.ts` `E5_TARGET_PASSAGE_TOKENS` | Store Docling / E5 profile | Preferred passage | Store Docling SoT |
| **48** | `E5_OVERLAP_TOKENS` | Store Docling split | Overlap | Docling only |
| **120 / 4000** | `chunk-quality-runner.ts` `MIN/MAX_CHUNK_CHARS` | Post-import QA | SHORT/LONG warnings | Store QA SoT |
| **40** | `docling-nd-token-split-policy.ts` `MIN_CHUNK_CHARS` | Docling builder | Gen floor | Docling path |
| **48** (`_MIN_CONTENT_TOKENS`) | `chunker.py` | Budget floor vs overhead | **Not** min chunk size | Internal |
| **160 / 80** | `section_merge.py` | Fragment merge char caps | Heading chrome only | Merge policy |

**Flag:** Worker **480** vs Store **448** = **DUPLICATED_POLICY** (same purpose, different value). Do **not** unify in P4.1.

**Verdict:** `DUPLICATED` (policy) + documented purpose split

---

## 8. Too-Large Handling

| Aspect | Status |
|---|---|
| Detect | Budget 480 + embed >512 raise |
| Split | `_split_content` paragraph/line/hard |
| Boundary-aware | Partial (paragraph first; not semantic) |
| Recursive re-chunk | NO |
| Code/table special | Code in text; tables not in chunk body |
| Re-validate after split | At embed only |
| Source ref | Same `section` / `sourcePath` on parts; no page offsets |
| Tests | `test_oversized_section_splits_into_budget_fitting_chunks`, token limit tests |

**Verdict:** `READY` (for Worker ZIP path)

---

## 9. Too-Small Handling

| Aspect | Status |
|---|---|
| MIN chunk size | **NO** |
| Merge candidate for arbitrary small chunks | **NOT_IMPLEMENTED** |
| `section_merge` | **Heading chrome fragments only** (`Returns`, `Type`, `Parameters`, KO equivalents, …); skips if code/tables present |
| Meaningful short protection | `_is_low_value_section` **drops** chrome/empty; does not protect short API signatures as “keep” |
| Post-split undersized parts | Not re-merged |
| Store | `SHORT_CHUNK` WARNING only — **no auto-fix** |
| Tests | Fragment merge tests; **no** general min-chunk merge suite |

**Verdict:** `PARTIAL` / core general merge = `MISSING`

---

## 10. Duplicate / Overlap Handling

| Problem | Worker | Store |
|---|---|---|
| Exact duplicate content | NO | Detect `CHUNK_DUPLICATE_EXACT` (WARNING); ratio → BLOCKER |
| Near duplicate | NO | Jaccard / prefix / title-section WARNINGs |
| Overlap window | N/A (no overlap) | Docling overlap only |
| Chunk ID collision | `_dedupe_id` YES | — |
| Auto remove/merge | NO | NO |

**Verdict:** `PARTIAL` (detect in Store; auto-correct `NO`)

---

## 11. Structure Auto-Normalization

| Capability | Actual |
|---|---|
| Heading + body chrome merge | YES — `merge_heading_fragments` |
| Wrong section merge (general) | NO |
| Small fragment integrate (general) | NO |
| Table restore into chunks | NO |
| Code/example bind | Partial (code in content) |
| Parent-child restore | Limited to merge parent heuristics |
| Empty/low-value drop | YES — `_is_low_value_section` |
| Duplicate section remove | NO |

**Verdict:** `PARTIAL` — do not treat `section_merge` as general auto-normalize.

---

## 12. Label / Classification

| Source | What |
|---|---|
| Inventory | `classification`, `fileType`, `parser` |
| Document/chunk | `sourceType`, entities `type`, symbols/keywords |
| Rule vs LLM | Rule / parser metadata only — **no LLM** |
| Quality on labels | Store `CHUNK_TAGS_MISSING` WARNING; no LABEL_MISSING taxonomy |
| Correction editable | **NO** structured label model |

**Verdict:** `PARTIAL`

---

## 13. Source Traceability

Target chain:

`Chunk → Structure → Inventory Item → WC path → Source Revision → Original`

| Link | Status |
|---|---|
| Chunk → `sourcePath` / section | YES (metadata + SourceDocument map) |
| `sourceHash` on trace | YES |
| `workingCopyId` / `sourceRevisionId` on chunk row | NO (indirect via SourceDocument / run) |
| `inventoryItemId` | NO |
| page / offset / line | NO |
| Docling ND provenance ranges | EXISTS for Docling path — **not** on Worker ZIP import |

**Correction juxtapose WC/Original:** path-level only → **PARTIAL**

---

## 14. Quality Rule Inventory (Store — real codes)

### Chunk (`chunk-quality-runner.ts`)

| Rule ID | Severity | Auto-fix | Gate |
|---|---|---|---|
| `CHUNK_SOURCE_COVERAGE_MISSING` | BLOCKER | NO | FAIL |
| `CHUNK_NO_ELIGIBLE_SOURCE` | BLOCKER | NO | FAIL |
| `CHUNK_ORPHAN` | WARNING | NO | ratio may FAIL |
| `CHUNK_INVALID_SOURCE_REFERENCE` | BLOCKER | NO | FAIL |
| `CHUNK_ORPHAN_RATIO_HIGH` | BLOCKER | NO | FAIL |
| `EMPTY_CHUNK` | BLOCKER | NO | FAIL |
| `CHUNK_TITLE_MISSING` | BLOCKER | NO | FAIL |
| `SHORT_CHUNK` | WARNING | NO | WARNING |
| `LONG_CHUNK` | WARNING | NO | WARNING |
| `CHUNK_SECTION_MISSING` | WARNING | NO | WARNING |
| `CHUNK_TAGS_MISSING` | WARNING | NO | WARNING |
| `CHUNK_METADATA_MISSING` | WARNING | NO | WARNING |
| `CHUNK_DUPLICATE_EXACT` / `NEAR` / `PREFIX_OVERLAP` / `TITLE_SECTION` | WARNING | NO | WARNING |
| `CHUNK_DUPLICATE_RATIO_HIGH` | BLOCKER | NO | FAIL |
| `CHUNK_STRUCTURE_SECTION_MISSING` | WARNING | NO | WARNING |

### Knowledge (`knowledge-quality-runner.ts`)

`SOURCE_VALIDATION_FAIL`, `SOURCE_VALIDATION_NOT_CHECKED`, `STRUCTURE_COVERAGE_FAIL`, `STRUCTURE_COVERAGE_WARNING`, `SECURITY_BLOCKER_IN_SOURCE`, `PRODUCT_VERSION_MISMATCH`, `CHECKSUM_DUPLICATE_PACK`, `PRODUCT_VERSION_MISSING`, `URL_ONLY_SOURCE`.

### Structure coverage

Score bands only — **no rule IDs**.

### Worker

No Store-compatible quality rule IDs; inventory/exclusion reasons + validation_report warnings/errors (free-form).

**Approx Store named rules:** ~25+ across chunk + knowledge + source-validation family.

---

## 15. Auto-Correction Matrix

| Problem | Detect | Auto-correct | Re-validate | Human needed |
|---|---|---|---|---|
| Too large | YES (Worker+Store) | YES (Worker split) | PARTIAL (embed) | Rare |
| Too small | PARTIAL (Store SHORT; Worker chrome only) | PARTIAL / NO | NO | YES |
| Empty | YES | NO (drop low-value only) | NO | YES |
| Duplicate | YES (Store) | NO | NO | YES |
| Overlap | N/A Worker ZIP | NO | — | — |
| Heading chrome split | YES | YES (`section_merge`) | NO formal | Rare |
| Structure error | PARTIAL (Store coverage) | NO | NO | YES |
| Label missing | PARTIAL (tags) | NO | NO | YES |
| Source ref missing | YES (orphan/invalid) | NO | NO | YES |
| Parse fail | PARTIAL (status) | NO | NO | YES / exclude |

---

## 16. Correction Candidate Capability

**Current:** `CorrectionQueueIssue` in `admin-correction-queue-issues.ts`

Fields: `id`, `title`, `severity`, `category`, `targetId`, `sourceLocation`, `recommendedAction` (free text), `raw`, `contentPreview`.

Built from **string** blockers/warnings + regex heuristics — **not** typed rule payloads, before/after, actor, status machine, or run binding.

| Future action | Status |
|---|---|
| 파일 제외 | PARTIAL pre-gen (Inventory); post-gen **MODEL_CHANGE_REQUIRED** |
| 구조 삭제/통합/분할/분류 | MODEL_CHANGE_REQUIRED |
| Chunk 삭제/통합/분할 | MODEL_CHANGE_REQUIRED (`DISABLED_ACTIONS` in UI) |
| Label 수정 | MODEL_CHANGE_REQUIRED |

**Verdict:** `MISSING` for executable Correction — detect & route only.

---

## 17. Source vs Generation Error Classification

**No dedicated SOURCE_PROBLEM vs GENERATION_PROBLEM taxonomy.**

- Import failures: `classifyWorkerZipError` → code/stage/retryable.
- Quality: domain by rule prefix (source validation vs chunk) but not “원본 문제 → Inventory 재검토” workflow wiring.
- Encrypted/corrupt/encoding: **not** first-class typed outcomes.

**Correction design gap:** record as **MISSING** classification layer.

---

## 18. Severity / Gate Mapping

| Policy | Implementation |
|---|---|
| WARNING alone → SV allowed | `canEnterServiceValidation`, `resolveGenerationOutcome` → `SUCCEEDED_WITH_WARNINGS` |
| BLOCKER/fail → Correction | `canEnterCorrection`, UI destination |
| INFO | Knowledge quality INFO possible; not a separate generation outcome |

Worker does not emit Store severities; Store assigns after import.

**Verdict:** `READY`

---

## 19. Retry / Idempotency

| Topic | Behavior |
|---|---|
| Concurrent gen | Blocked (`ALREADY_RUNNING`) |
| New run | New `PipelineRun` each time |
| Re-import same generation | deleteMany by `chunkGenerationId` then insert |
| WC | version+idempotencyKey unique |
| Correction → Gen 2 | PipelineRun history retained; successor reset clears stale quality — **PARTIAL** for explicit Gen1↔Gen2 compare UX |
| Unchanged ZIP skip | NO content-hash short-circuit |

**Verdict:** `PARTIAL`

---

## 20. Test Coverage

| Area | Status | Evidence |
|---|---|---|
| Router / classify | COVERED | `python-worker/tests/test_worker.py` ClassificationTests |
| Parse HTML/PDF | COVERED / PARTIAL Docling optional | same |
| Structure Store | COVERED | structure-coverage tests |
| Chunk / too-large | COVERED | Worker + Store LONG_CHUNK |
| Too-small general | MISSING | fragment tests only |
| Duplicate detect | COVERED | chunk-quality-runner tests |
| Duplicate auto-fix | MISSING | — |
| Label editor | MISSING | — |
| Quality refresh | COVERED | worker-zip-quality-refresh |
| Correction actions | PARTIAL | queue build only |
| Traceability page/offset | MISSING | — |
| Import / gates | COVERED | provider + workflow + inventory tests |
| Retry idempotency deep | PARTIAL | RUNNING guard |

**Executed this audit:** Store unit (inventory/workflow/chunk-quality/correction-queue) pass; `pytest python-worker/tests/test_worker.py` → **59 passed**.

---

## 21. Dead / Legacy / Duplicate Candidates

| Item | Class |
|---|---|
| Admin Worker ZIP + Inventory gates | CANONICAL |
| Provider ZIP request | CANONICAL (request) |
| Store quality runners | CANONICAL |
| Provider quality evaluate 410 | DEAD (frozen) |
| TS Docling chunk for Worker ZIP | DEAD for path / COMPATIBILITY elsewhere |
| Correction structural UI stubs | DEAD stubs |
| Distribution ZIP review blocker message | DEAD |
| 480 vs 448 passage targets | DUPLICATE policy |
| MIN_CHUNK_CHARS 120 vs 40 | DUPLICATE name / different paths |

**No deletions in P4.1.**

---

## 22. P4.2 Gaps (Worker hardening first)

### A. Worker / policy (mechanical)

1. Align Inventory INCLUDE with Worker parseable types (or add parsers for MD/TXT if required).
2. General **too-small** merge policy (with meaningful-short protection) — not only heading chrome.
3. Optional: fold tables into chunk content or explicit table chunks.
4. Document/decide **480 vs 448** SoT (do not silently change both).
5. Typed parse/source failure codes for Inventory re-review candidates.
6. Stronger provenance (page/offset where Docling/HTML allows).
7. Consider auto quality-refresh after successful generation (or explicit UX must-run).

### B. Correction (human) — after A

See §23.

### C. Service Validation

Search Top-K, download/MCP/RAG — out of Worker quality scope (already separate step).

### D. Delete/integrate later

Frozen Docling routes, unused correction stubs, duplicate constants after SoT decision.

---

## 23. Correction Scope (post P4.2)

Only exceptions Worker cannot auto-handle:

| Target | Actions |
|---|---|
| FILE | exclude + reason + optional provider request (via Inventory re-open) |
| STRUCTURE | delete / merge / split / classify (needs model) |
| CHUNK | delete / merge / split (needs model) |
| LABEL | edit tags/category (needs model) |

**Remove from Correction scope if P4.2 automates:** pure too-large splits, heading chrome merges already done.

**Do not** build full Correction UI until P4.2 closes automatic gaps and a remediation command model exists.

---

## 24. Recommended Next Step

1. **P4.2 Worker Hardening** — too-small policy, router/Inventory alignment, provenance, token SoT decision, optional post-gen quality auto-refresh.  
2. **Then** Correction data model + exception workbench.  
3. Keep 6-step workflow; do not reintroduce quality/providerConfirm as rail steps.

---

## Area verdicts (prompt §27)

| Area | Verdict |
|---|---|
| Router | PARTIAL |
| Parse | PARTIAL |
| Structure | PARTIAL |
| Chunk | PARTIAL |
| Too-large | READY |
| Too-small | MISSING (general) / PARTIAL (heading) |
| Duplicate | PARTIAL |
| Auto-normalize | PARTIAL |
| Labels | PARTIAL |
| Traceability | PARTIAL |
| Quality detect (Store) | READY |
| Auto-correct | PARTIAL |
| Correction model | MISSING |
| Gates | READY |
| Token policy | DUPLICATED |

### Overall

```text
P4.2 WORKER HARDENING REQUIRED
```

Orchestration + detection + gates are enough to **route** work. Automatic quality that Correction must not reinvent is **not** complete — especially general too-small merge, duplicate normalization, and parseable-type alignment.
