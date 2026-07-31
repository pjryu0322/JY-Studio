# JYKStore P8.1.3 — pgvector Production Retrieval Hardening

## 최종 판정

**P8.1.3 PGVECTOR PRODUCTION RETRIEVAL PASSED**

Evidence: live Public hybrid E2E with `usage.vectorBackend === "pgvector"` on all 26 GT queries (JSON fallback not used).

---

## 1. Base / Work Commit

| Item | Value |
|------|-------|
| Base | `33f263e1` — P8.1.2 live hybrid semantic retrieval |
| Work | (this commit) |
| Pack | `p431e2ems633k5n` |
| Published Revision | `5a2a0a02-15a5-4531-8155-4079498f0de2` |

---

## 2. 실제 Retrieval Call Graph

```text
executeRetrievalApiRequest
  → resolvePublicRetrievalGenerationScope (PRODUCTION + PROMOTED)
  → tokenizeSearchQueryDetailed
  → collectRetrievalCandidates(lexicalPrefilterTokens)   // source CORE only
  → scoreRetrievalCandidates(scoringTokens)
  → applyHybridVectorRanking
       → embedSearchQuery(buildHybridQueryEmbeddingText(query))  // live E5
       → querySearchIndexVectorsByGeneration(...)                // pgvector <=>
       → [only if unavailable AND allow] findJsonEmbeddingNeighbors
       → mergeKeywordAndVectorCandidates
  → selectRetrievalCandidatesWithStats
  → mapRetrievalResponse (usage.vectorBackend, latencies)
```

---

## 3. 수정 파일

| Path | Change |
|------|--------|
| `src/lib/search-vector/search-vector-runtime.ts` | JSON fallback only for `NODE_ENV=test` or `JYKSTORE_ALLOW_JSON_VECTOR_FALLBACK`; else hard-fail |
| `src/lib/retrieval/hybrid-ranking-service.ts` | `vectorBackend` + latencies; warn on JSON degraded path |
| `src/lib/retrieval-service.ts` / `retrieval-response-mapper.ts` / `retrieval-dto.ts` | Propagate diagnostics on hybrid `usage` |
| `scripts/p8-1-3-live-pgvector-eval.ts` | Live E2E gate requiring `vectorBackend=pgvector` |
| `src/__tests__/p8-1-3-pgvector-production.test.ts` | Policy + diagnostic coverage |
| `.env.example` | Document allow/require flags |
| `scripts/run-unit-tests.mjs` | Default `NODE_ENV=test` for fallback policy |
| `scripts/unit-test-files.json` | Register P8.1.x unit tests |

---

## 4. pgvector schema / index

| Item | Value |
|------|-------|
| Extension | `vector` (live) |
| Mirror table | `SearchIndexVector` |
| Rows (published gen) | **2298 / 2298** (matches `KnowledgeChunkEmbedding`) |
| ANN index present | `SearchIndexVector_local_e5_384_hnsw_idx` (HNSW, cosine, local-e5 / dim 384) |
| Isolation indexes | btree on `searchIndexGenerationId`, unique (gen, chunk, provider, model) |

---

## 5. 실제 vector query 방식

```sql
-- buildSearchVectorQuerySql (generation + provider + model scoped)
ORDER BY (sv."vector"::vector(384) <=> $query) ASC
LIMIT VECTOR_CANDIDATE_TOP_K  -- resolveVectorCandidateTopK(topK), max 200
```

Distance: pgvector cosine (`<=>` / `vector_cosine_ops`). Score = clamp(`1 - distance`, 0..1).

---

## 6. Published Generation isolation

- Public resolver → PRODUCTION + PROMOTED only
- Vector SQL always filters `searchIndexGenerationId`
- Draft/READY not selected as fallback
- Wrong-pack in E2E: **0**

---

## 7. Embedding descriptor

| Field | Published generation |
|-------|----------------------|
| provider | `local-e5` |
| model | `dragonkue/multilingual-e5-small-ko-v2` |
| revision | `fcfc26bf355882620c48df58be112275bd756f50` |
| dimension | `384` |

Query embed uses the same descriptor via `embedSearchQuery`. Operational create path pins revision from worker `/ready` (`search-generation-types`); P8.1.2-era `legacy-unknown` rows must be regenerated/promoted rather than hand-edited for lasting ops.

---

## 8. pgvector / JSON fallback 정책

| Condition | Behavior |
|-----------|----------|
| `NODE_ENV=production` or `JYKSTORE_REQUIRE_PGVECTOR` | Hard-fail `SEARCH_RUNTIME_UNAVAILABLE` |
| `NODE_ENV=test` or `JYKSTORE_ALLOW_JSON_VECTOR_FALLBACK` | `vectorBackend=json_fallback` + warn log |
| Other (e.g. bare `next dev`) | Hard-fail — **no silent JSON scan** |

P8.1.3 E2E sets `JYKSTORE_REQUIRE_PGVECTOR=true` and asserts every hybrid row uses `pgvector`.

---

## 9. EXPLAIN 결과 (live)

Published gen, Top-25 cosine query:

- **Index:** Bitmap Index Scan on `SearchIndexVector_searchIndexGenerationId_idx` (generation filter), then distance sort + join to `KnowledgeChunk`
- **HNSW:** index **exists** (`SearchIndexVector_local_e5_384_hnsw_idx`); at **~2298** vectors in one generation the planner preferred generation btree + sort over HNSW ANN
- **Seq Scan on SearchIndexVector:** not used
- **Execution Time (EXPLAIN):** ~61 ms

Honest ops note: small per-generation cardinality often yields btree+sort plans; HNSW becomes more valuable as generation size grows. Canonical correctness path is still **PostgreSQL pgvector**, not Node JSON full scan.

---

## 10. Latency (26 hybrid queries, warm worker)

| Metric | p50 | p95 | max |
|--------|----:|----:|----:|
| Query embedding | 23 ms | 29 ms | 30 ms |
| Vector DB query (`vectorQueryLatencyMs`) | **324 ms** | 361 ms | 410 ms |
| Hybrid total (end-to-end Public API) | 10152 ms | 27773 ms | 32823 ms |

Vector neighbor path is sub-second. Remaining end-to-end cost is lexical collect / hydration / ranking (not JSON full-generation scan). Further E2E latency work is out of P8.1.3 scope.

Artifact: `tmp-p8-1-3-e2e/p8-1-3-live-pgvector-report.json` (local).

---

## 11–14. Semantic regression

### P8.1 12 GT

| Hit@1 | Hit@3 | Hit@5 | MRR | No Hit | Wrong Pack |
|------:|------:|------:|----:|---------:|-----------:|
| 1.00 | 1.00 | 1.00 | 1.00 | 0 | 0 |

### Paraphrase 10

| Hit@5 | MRR | No Hit |
|------:|----:|-------:|
| **1.00** | 0.95 | 0 |

### Distractor

False Positive **0**, Wrong Pack **0**.

### Vector-only recovery

`lexicalHit=false`, `vectorHit=true`, `finalHybridHit=true` — **PASS**.

---

## 15. Public API / MCP / RAG

- Served revision on Public hybrid = published production id
- Optional `usage.vectorBackend` / latency fields added (additive; keyword mode unchanged)
- MCP protocol / Cursor client **not** started (P8.2)

---

## 16. 테스트

```text
src/__tests__/p8-1-3-pgvector-production.test.ts
src/__tests__/search-vector-generation-isolation.test.ts
src/__tests__/hybrid-generation-fail-closed.test.ts
scripts/p8-1-3-live-pgvector-eval.ts   # live, REQUIRE_PGVECTOR
tsc --noEmit / prisma validate / next build (as run in session)
```

---

## 17. 남은 Gap

1. Planner may use generation btree + sort instead of HNSW at ~2k vectors — monitor at larger generations; do not treat as JSON fallback.
2. End-to-end hybrid still multi-second due to non-vector stages.
3. P8.2 Cursor/MCP external A/B — next phase only after this PASS.

---

## 18. 최종 판정

```text
P8.1.3 PGVECTOR PRODUCTION RETRIEVAL PASSED
```
