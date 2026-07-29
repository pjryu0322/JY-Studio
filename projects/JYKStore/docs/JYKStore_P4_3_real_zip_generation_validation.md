# JYKStore P4.3 — Real ZIP Generation Validation

**Base commit:** `503486c7`  
**Work commit:** (this report + validation scripts)  
**Date:** 2026-07-29  
**Final verdict:** `P4.3 HARDENING REQUIRED`

---

## 1. 실증 대상

| Item | Value |
|------|-------|
| ZIP | `C:\doc\JYKStore\rMateGridH5Web_v6.0_EN_Trial.zip` |
| Size | 17,366,069 bytes (~16.56 MB) |
| Pack (DB) | `rmategridh5webv60` / 리아모어 - rMateGridH5Web_v6.0 (DRAFT) |
| Composition | PDF manual, Docs/api HTML, Samples HTML, JS/CSS/JSON companions, images, LicenseKey |

ZIP에 0 Byte / 실행파일은 **없음** (해당 케이스는 Inventory unit test로 회귀 확인).

---

## 2. 환경

| Component | Status |
|-----------|--------|
| OS | Windows 10 |
| Python Worker | `python-worker/parse_archive.py` + Docling + local_e5 |
| E5 model | `C:\JYKStore\models\multilingual-e5-small-ko-v2\fcfc26bf355882620c48df58be112275bd756f50` |
| PostgreSQL | Available (`JYKStore`) |
| MinIO / Object Storage | Configured; prior pack payloads present |
| Next.js `:3004` | **Down during P4.3 run** — Admin UI E2E not executed live |
| Chunk policy | `chunk-policy-v1` target 480 / hard max 512 |
| Capability policy | `worker-capability-v1` |

Artifacts (local, untracked): `tmp-p4-3-validation/`

---

## 3. E2E 결과

### 3.1 Worker CLI (실ZIP) — PASSED

```text
Status: ok
Files=867 docs=275 chunks=2298 embeddings=2298 warnings=2 errors=0
elapsed ≈ 599s (~10 min)
```

Warnings (SOURCE/review advisory only):

1. LicenseKey folder detected; contents excluded from knowledge  
2. License/copyright review files detected  

### 3.2 Store Inventory/Capability scan (ZIP bytes, no DB) — PASSED

`scripts/p4-3-inventory-capability-scan.ts` against the same ZIP.

### 3.3 Canonical Admin path (Provider → Accept → WC → Inventory FINALIZE → Generation → Auto Quality) — **NOT COMPLETED**

Blockers observed on pack `rmategridh5webv60`:

- `currentWorkingCopyId = null`
- No FINALIZED Knowledge Scope Inventory for the current P4.2 WC-bound flow
- Dev web server not running (`:3004` unreachable)

Prior (pre-P4.2) evidence on the same pack:

- SearchIndexGeneration `READY` with 2353 chunks (2026-07-27)
- Quality pipeline markers exist with WARNING summaries (source/structure/chunk/release)

**Conclusion:** Worker half of P4.2 is empirically validated on the real ZIP. Full Admin Generation Outcome with *automatic* Quality Refresh was **not** proven on this pack in P4.3.

---

## 4. Inventory / Capability

| Metric | Count |
|--------|------:|
| Total files | 867 |
| SUPPORTED (knowledge-eligible) | 267 |
| UNSUPPORTED | 71 |
| REVIEW_REQUIRED | 7 |
| SUPPORTING | 522 |
| Auto EXCLUDED (SYSTEM) | 593 |
| Auto PENDING (include candidates) | 267 |
| Auto REVIEW_REQUIRED | 7 |
| Zero-byte | 0 |
| Executable / lib | 0 |

Decision ↔ capability alignment:

- `PENDING == SUPPORTED == 267` ✅  
- Parser-less files are EXCLUDED / REVIEW, not PENDING ✅  
- Forcing INCLUDED on `.md` → `WORKER_CAPABILITY_MISMATCH` (unit) ✅  

Worker inventory classification (after extract):

| classification | count |
|----------------|------:|
| knowledge_target | 267 |
| excluded | 86 |
| review_target | 7 |
| supporting_asset | 507 |

Knowledge parsers: `html_api=72`, `html_sample=194`, `docling_pdf=1`.

---

## 5. Parse

| Metric | Value |
|--------|------:|
| Input files | 867 |
| Normalized documents | 275 (incl. 8 license_review) |
| Parse errors (validation_report) | 0 |
| Parse warnings | 2 (license) |
| Skipped non-knowledge | via exclusion / non knowledge_target |

Typed taxonomy:

- License signals → SOURCE / REVIEW advisory (not PARSE_FAILED)  
- Free-text warnings not fully mapped to `SOURCE_*` codes → **Gap** (taxonomy coverage)

---

## 6. Structure

Documents by sourceType: `api_html=72`, `sample_html=194`, `pdf_manual=1`, `license_review=8`.

Sample auto structure issues (document sections before chunk filters):

| Issue | Count |
|-------|------:|
| Empty body sections | 63 |
| Isolated headings | 63 |

Chunker low-value filter + merges reduce many of these; residual empty/isolated headings remain as STRUCTURE Correction candidates (not auto-fixed).

PDF page/element provenance: **not present** in `source_trace` (keys: sourcePath, sourceHash, section, parser only). Locator = file + section, not page.

---

## 7. Chunk 통계

| Metric | Value |
|--------|------:|
| Total chunks | 2298 |
| Embeddings | 2298 |
| Approx token avg / min / max | 274 / 1 / 470 |
| over target 480 | **0** |
| over hard max 512 | **0** |
| too-small (&lt;48 approx tokens) remaining | 404 |

Hard max gate: **PASS (0 violations)**.

---

## 8. Too-large

No final chunk exceeded target 480 or hard max 512 (approx chars/4 heuristic consistent with Worker budget).

Long sections were split by existing chunker budget logic. Exact “auto-split event” counter is not separately emitted; outcome is reflected in max≤470.

---

## 9. Too-small

| Metric | Value |
|--------|------:|
| Chunks with undersized merge reason | 106 |
| UNDERSIZED_FRAGMENT_MERGE autoCorrection events | 114 |
| heading_fragment_merged | 2 |

Representative merges: empty/chrome fragments folded into Class overview sections (API HTML). Methods/Members sections remain separate in samples.

Short meaningful units: unit tests protect API/error/code; live ZIP still retains many short method-like chunks (404 &lt;48) — expected for API docs, not forced merges.

**False-merge BLOCKER (API signature wrongly absorbed):** not observed in sampled Methods sections. Residual risk remains for future packs → monitor in Correction.

---

## 10. Duplicate

| Metric | Value |
|--------|------:|
| Exact duplicate groups (cross-chunk content) | 156 |
| Occurrences in those groups | 391 |

Within-document section exact-body dedupe runs in Worker. Remaining dups are largely **cross-sample** boilerplate (same JS/XML snippets repeated across Samples). Near-duplicate sample variants were **not** auto-deleted (policy-correct).

→ Cross-doc exact duplicate cleanup = `AUTO_FIX_POSSIBLE_LATER` / Correction CHUNK scope.

---

## 11. Provenance

| Field | CLI run result |
|-------|----------------|
| workingCopyId | 2298/2298 stamped (`p43-wc-validation`) |
| sourceRevisionId | 2298/2298 stamped |
| inventoryItemId | 0/2298 (empty `inventoryItemIdByPath` in options) |

Map simulation (`scripts/p4-3-provenance-map-check.ts`):

- 267 knowledge paths → synthetic inventory item ids  
- 2298/2298 chunks resolvable to map + inventory sha256  
- Verdict: `PROVENANCE_PATH_OK_WITH_STORE_MAP`

Live Store Admin path (Inventory id → metadata on import) **not re-proven** in this session.

PDF page provenance: **unsupported** in current Docling worker traces.

---

## 12. Quality

| Check | Result |
|-------|--------|
| Code path: Generation → auto `refreshWorkerZipReviewReadiness` | Implemented in P4.2 (`worker-zip-import-provider-service`) |
| Unit: quality failure → `QUALITY_REFRESH_FAILED` retryable | Pass |
| Manual CTA label | 「재검사」 (P4.2 UX) |
| Live Admin auto Quality after Generation on Trial ZIP | **Not executed** (server down / no WC Inventory) |
| Historical pack quality (2026-07-27) | WARNING on source/structure/chunk/release |

---

## 13. Generation Outcome

Live P4.2 Outcome not produced in this run.

Policy mapping (unit / prior design):

| Quality | Outcome | Service Validation |
|---------|---------|--------------------|
| Clean | SUCCEEDED | allowed |
| Warning only | SUCCEEDED_WITH_WARNINGS | allowed |
| Blocker / FAIL | CORRECTION_REQUIRED | blocked |

Historical pack state after pre-P4.2 quality: WARNING → would map to `SUCCEEDED_WITH_WARNINGS` under P4 gates.

---

## 14. Auto-correction 효과

| 유형 | 탐지 | 자동처리 | 남은 건수 |
|------|-----:|---------:|----------:|
| Too-large (hard max) | 0 final | n/a (split) | 0 |
| Too-small (undersized merge) | ≥114 events | 106 chunks marked | 404 short remain |
| Exact duplicate (within section) | (dedupe applied) | yes | cross-doc 156 groups remain |
| Heading fragment | 2 | 2 | residual chrome possible |
| Low-value section skip | (chunker filter) | yes | 63 empty sections pre-filter |

---

## 15. 남은 예외

### FILE
- License / LicenseKey → REVIEW / excluded (provider confirmation)  
- SUPPORTING assets (images, sample companions) → correctly excluded from knowledge  
- Cross-sample duplicated content files → knowledge still duplicated via sample HTML pages  

### STRUCTURE
- Isolated / empty headings (63 pre-filter)  
- PDF structure without page locators  

### CHUNK
- Cross-document exact duplicate sample snippets (156 groups)  
- Many intentional short API chunks (&lt;48 tokens)  

### LABEL
- No strong evidence of wrong labels requiring a Label Editor in this ZIP  

---

## 16. Error taxonomy

| Category | Observed |
|----------|----------|
| SOURCE | LicenseKey / license review warnings |
| PARSER | 0 failures |
| STRUCTURE | residual empty headings |
| CHUNK | remaining short + cross-doc dups |
| EMBEDDING | 2298/2298 ok |
| WORKER | exit 0 |
| QUALITY | live auto not run |

Gaps: Worker free-text warnings not always emitted as `SOURCE_*` codes.

---

## 17. Retry / Idempotency

| Path | Evidence |
|------|----------|
| Worker retry | CLI re-run safe (output dir cleared by pipeline) — not stress-tested this session |
| Import / Quality retry | Unit coverage in P4.2 (`QUALITY_REFRESH_FAILED` retryable) |
| Live retry on Admin pack | Not executed |

---

## 18. 성능

| Stage | Time / note |
|-------|-------------|
| Inventory/capability scan | ~3s |
| Worker full (parse+chunk+embed) | **~599s** |
| ZIP size / files | 16.56 MB / 867 |
| Chunks / embeddings | 2298 / 2298 |

No stage timing instrumentation beyond wall clock for CLI.

---

## 19. Admin UX

Code inspection (P4.2):

- Completion summary: 처리 완료 · chunk/embedding counts  
- Quality button: 재검사 when prior result exists  
- Debug JSON behind toggle  

Not live-audited in browser this session. Remaining UX risks: historical quality WARNING density; chunk lists in diganostic panels.

---

## 20. Correction Scope (확정 후보)

Include:

1. **FILE** — exclude / provider confirm (license, non-knowledge)  
2. **STRUCTURE** — delete/merge empty or wrong sections  
3. **CHUNK** — delete/merge cross-doc exact duplicates; optional split only if future hard-max regressions appear  

Exclude for now:

- **LABEL editor** (no empirical need on this ZIP)  
- Broad semantic near-duplicate auto-delete  

---

## 21. Correction Data Model 요구사항 (구현 금지 — 요구만)

Must support:

```text
targetType, targetId, source/inventory reference, issueCode, severity,
requestedAction, parameters, status, actor, audit,
generationRunId, before reference, after/result reference
```

Flow: `Generation Run 1 → Correction → Generation Run 2 → Revalidation` without overwriting prior run artifacts.

---

## 22. 최종 판정

### `P4.3 HARDENING REQUIRED`

Reasons (against PASS criteria):

1. **Canonical Admin E2E + Auto Quality** on the Trial pack was not completed (no WC-bound FINALIZED Inventory; web server down).  
2. **Cross-document exact duplicates** remain at scale after Worker auto-normalize — still mostly human/Correction or later auto scope.  
3. **inventoryItemId** live end-to-end (Inventory DB → Worker → Import metadata) not re-proven on Admin path this session (CLI map simulation only).  
4. PDF **page** provenance still unavailable.

Worker-side empirical strengths (do not claim full PASS alone):

- Capability ↔ PENDING alignment on 867-file ZIP  
- Hard max 512 violations = 0  
- Undersized merge + heading chrome active  
- Embeddings complete  
- WC/revision provenance stamp works when options provided  

---

## 23. 다음 단계

1. Start local stack; for `rmategridh5webv60` (or fresh pack): Provider submit → Accept → WC → Inventory finalize INCLUDED-only → Generation → confirm Auto Quality + Outcome.  
2. Close P4.3 Admin E2E gap; only then decide PASS vs remaining Worker hardening.  
3. If PASS: Correction Data Model → exception-only Workbench focused on FILE / STRUCTURE / CHUNK actions above.  
4. Optional Worker follow-up: cross-doc exact-hash dedupe policy; emit typed `SOURCE_*` codes for license warnings; PDF page locators if Docling exposes them.

---

## Appendix — Commands used

```powershell
node --import tsx scripts/p4-3-inventory-capability-scan.ts "C:/doc/JYKStore/rMateGridH5Web_v6.0_EN_Trial.zip"
python python-worker/parse_archive.py --options-json tmp-p4-3-validation/options.json --output tmp-p4-3-validation/worker-out
node --import tsx scripts/p4-3-analyze-worker-output.ts tmp-p4-3-validation/worker-out
node --import tsx scripts/p4-3-deep-probe.ts tmp-p4-3-validation/worker-out
node --import tsx scripts/p4-3-provenance-map-check.ts
```

Regression (this session): P4.2 TS suites 93 pass; Python `test_small_fragment_merge` 5 pass.
