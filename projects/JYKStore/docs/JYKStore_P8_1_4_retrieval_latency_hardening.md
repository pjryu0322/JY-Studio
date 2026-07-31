# JYKStore P8.1.4 — Retrieval Latency Profiling & Targeted Optimization

## 최종 판정

**P8.1.4 RETRIEVAL LATENCY HARDENING PASSED**

---

## 1. Base / Work Commit

| Item | Value |
|------|-------|
| Base | `3c726261` — P8.1.3 pgvector production path |
| Work | (this commit) |

---

## 2. 실제 Call Graph

```text
executeRetrievalApiRequest
  → resolvePublicRetrievalGenerationScope
  → tokenizeSearchQueryDetailed
  → collectRetrievalCandidates          // lexical ILIKE + slim sourceDocument
  → scoreRetrievalCandidates
  → applyHybridVectorRanking            // embed + pgvector + union/rescore
  → selectRetrievalCandidatesWithStats  // dedupe + relevance_diversity_v3
  → mapRetrievalResponse
```

---

## 3. Profiling 방법

- Script: `scripts/p8-1-4-profile-retrieval.ts`
- 8 warm representative queries (ko/en exact, paraphrase, VOR, distractor, long NL, API name, rowspan)
- Stage timers around collect / score / hybrid / rerank + Public API total
- `JYKSTORE_REQUIRE_PGVECTOR=true` (JSON fallback not used)

---

## 4–7. Before latency & bottlenecks (warm, 8 queries)

| Stage | Before p50 | Before p95 | Before max |
|-------|----------:|----------:|----------:|
| lexicalCollect | 488 | 685 | 685 |
| hybridRanking (embed+vector+union) | 402 | 433 | 433 |
| **rerank/dedupe** | **14725** | **23739** | **23739** |
| query embedding | 25 | 30 | — |
| vector DB | 341 | 370 | — |
| **API total** | **15385** | **24401** | **24401** |

**Bottleneck #1:** `deduplicateScoredCandidates` near-dupe Jaccard O(n²) on up to ~500 long bodies (uncached normalize/shingles).

**Bottleneck #2:** Lexical collect hydrating full `sourceDocument` payloads (secondary; ~0.5s).

Candidate counts observed: lexical 27–500; hybrid union ≈ same + vector-only.

---

## 8. 수정 내용 (최대 2개 병목)

### #1 Rerank / near-dupe (`relevance-diversity_v3`)

- Request-local cache: normalized body + word shingles per chunkId
- Length-ratio prefilter before Jaccard
- Near-dupe Jaccard only while `kept.length < NEAR_DUPLICATE_COMPARE_CAP` (120); exact-hash dedupe still full-pool
- Policy version bump: `relevance_diversity_v2` → `v3`

### #2 Lexical hydration slim

- `sourceDocument: { select: { id, title } }` in candidate collect (references only need these)

Minor: `missingForLoad` filter uses `Set` instead of `Array.includes`.

---

## 9–10. After latency

### Warm profile set (8 queries)

| Stage | After p50 | After p95 | After max |
|-------|---------:|---------:|---------:|
| lexicalCollect | 382 | 734 | 734 |
| hybridRanking | 424 | 529 | 529 |
| **rerank** | **808** | **1280** | **1280** |
| **API total** | **1625** | **2592** | **2592** |

### Full 26 GT hybrid (P8.1.3 eval harness)

| Metric | After |
|--------|------:|
| total p50 | **1392 ms** |
| total p95 | **2155 ms** |
| max | 2252 ms |
| vectorBackend | **pgvector** (26/26) |

### Improvement (profile set API total)

| | Before | After | Δ |
|--|------:|------:|--:|
| p50 | 15385 ms | 1625 ms | **~89% ↓ (~9.5×)** |
| p95 | 24401 ms | 2592 ms | **~89% ↓** |

Meets recommended warm targets: p50 &lt; 2s, p95 &lt; 5s.

---

## 11. pgvector backend

All measured hybrid runs: `vectorBackend=pgvector`. JSON fallback not used.

---

## 12–14. Semantic regression

| Suite | Result |
|-------|--------|
| P8.1 12 GT Hit@1/3/5 / MRR | **1.00 / 1.00 / 1.00 / 1.00** |
| Paraphrase Hit@5 | **1.00** |
| Distractor FP / wrong-pack | **0 / 0** |
| Vector-only recovery | **PASS** |
| Wrong-pack (all) | **0** |

---

## 15. Public API / MCP / RAG

Published revision isolation unchanged. Additive ranking policy version string only (`v3`). No channel contract split.

---

## 16. 테스트

```text
src/__tests__/p8-1-4-retrieval-latency.test.ts
src/__tests__/relevance-diversity-rerank.test.ts
scripts/p8-1-4-profile-retrieval.ts
scripts/p8-1-3-live-pgvector-eval.ts   # semantic + pgvector gate
```

---

## 17. 남은 Gap

1. Lexical ILIKE content scans still ~0.3–0.7s — index/trigram work deferred.
2. Keyword-candidate vector reload still inside hybrid (~hundreds ms); not dominant after dedupe fix.
3. P8.2 Cursor/MCP external validation is next.

---

## 18. 최종 판정

```text
P8.1.4 RETRIEVAL LATENCY HARDENING PASSED
```
