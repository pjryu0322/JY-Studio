# JYKStore P8.1.2 — Live Hybrid Semantic Retrieval Validation

## 최종 판정

**P8.1.2 LIVE HYBRID SEMANTIC RETRIEVAL PASSED**

---

## 1. Base / Work Commit

| Item | Value |
|------|-------|
| Base | `f60a3feb` — P8.1.1 retrieval recall hardening |
| Work | (this commit) |
| Pack | `p431e2ems633k5n` / version `cms633k7p0002unqsjrdlmm5g` (`v6.0-e2e`) |
| Published Revision | `5a2a0a02-15a5-4531-8155-4079498f0de2` |

---

## 2. 실제 Retrieval Call Graph

```text
executeRetrievalApiRequest / retrieveContextsForVersionWithDiagnostics
  → resolvePublicRetrievalGenerationScope (PRODUCTION + PROMOTED)
  → tokenizeSearchQueryDetailed(query)
  → collectRetrievalCandidates(lexicalPrefilterTokens)   // source CORE only
  → scoreRetrievalCandidates(scoringTokens)              // source + expansions
  → [hybrid] applyHybridVectorRanking
       → embedSearchQuery(buildHybridQueryEmbeddingText(query))  // live worker
       → querySearchIndexVectorsByGeneration(...)                // independent Top-K
       → or findJsonEmbeddingNeighbors(...)                      // generation-scoped fallback
       → mergeKeywordAndVectorCandidates (union + hydrate)
  → selectRetrievalCandidatesWithStats (relevance_diversity_v2)
  → mapRetrievalResponse
```

Live E2E used Public API hybrid mode (`retrievalMode: "hybrid"`) against the published pack. Embedding provider/model on responses: `local-e5` / `dragonkue/multilingual-e5-small-ko-v2`.

---

## 3. Worker Configuration

| Setting | Value |
|---------|-------|
| URL | `http://127.0.0.1:8000` (`JYKSTORE_EMBEDDING_WORKER_URL`) |
| `/ready` | `ready=true`, `stub=false`, `backend=sentence-transformers` |
| Model source | local directory offline |
| Auth | bearer token (local eval only; not committed) |

Script: `npm run embedding-worker:start:live`

---

## 4. Embedding Descriptor

Published `SearchIndexGeneration` (pinned revision for adapter match):

| Field | Value |
|-------|-------|
| provider | `local-e5` |
| model | `dragonkue/multilingual-e5-small-ko-v2` |
| revision | `fcfc26bf355882620c48df58be112275bd756f50` |
| dimension | `384` |

Query embedding uses the same descriptor via `embedSearchQuery` → live worker. Document and query models match.

---

## 5. Published Revision

| Check | Result |
|-------|--------|
| PRODUCTION + PROMOTED generation | `5a2a0a02-15a5-4531-8155-4079498f0de2` |
| Public resolver | same id |
| Draft/READY mix-in | none observed (excludeDraftScope + generation isolation) |

---

## 6. Lexical Candidate 구조

```text
lexicalPrefilterTokens = source CORE terms only
  (synonym expansions excluded from DB prefilter)
scoringTokens          = source + expansions (ranking / keyword reasons)
```

Domain terms (`api`/`grid`/`cell`/`셀`/…) stay in scoring at weight 0.35 but do not flood lexical prefilter when CORE exists.

---

## 7. Vector Candidate 구조

```text
vectorCandidates =
  embed(buildHybridQueryEmbeddingText(query))
  → generation-scoped Top-K (pgvector | JSON neighbors fallback)
union = lexical ∪ vector  (chunkId dedupe + vector-only hydration)
```

Limits: Lexical 1000 / Vector 200 / Union 1200.

`buildHybridQueryEmbeddingText` appends bilingual synonym expansions (e.g. merge/병합) so paraphrases align with indexed EN/KO passages — no product API hard-coding.

---

## 8. Vector-only Recovery 결과

| Field | Value |
|-------|-------|
| Query | `시각적으로 같은 이웃 값을 하나로 묶는 UI 처리는?` |
| Expected | `SpanMergingField` |
| lexicalHit | **false** (source-token lexical scoring) |
| vectorHit | **true** (empty-lexical hybrid ranking path) |
| finalHybridHit | **true** |
| Result | **PASS** |

Independent vector path is exercised: empty lexical scored set + generation vector search still surfaces the answer; public hybrid also returns it in Top-5.

---

## 9–16. Quality Gates

### P8.1 12 GT

| Metric | Value |
|--------|------:|
| Hit@1 | **1.00** |
| Hit@3 | **1.00** |
| Hit@5 | **1.00** |
| MRR | **1.00** |
| No Hit | 0 |
| Wrong Pack | 0 |
| False Positive | 0 |

### Paraphrase 10

| Metric | Value |
|--------|------:|
| Hit@1 | 0.90 |
| Hit@3 | **1.00** |
| Hit@5 | **1.00** (≥ 0.80 required) |
| MRR | 0.95 |
| No Hit | 0 |
| Wrong Pack | 0 |

### Distractor 4

| Metric | Value |
|--------|------:|
| Hit@5 | 1.00 |
| False Positive | **0** |
| Wrong Pack | **0** |

Artifact: `tmp-p8-1-2-e2e/p8-1-2-live-hybrid-report.json` (local; not committed).

---

## 17. Candidate Source

Public contexts expose `matchReasons` (`query:*` / `vector:similarity`). Eval maps to `lexical` | `vector` | `both`.

Paraphrase/P8.1 hybrid Top-5 commonly show `both` after synonym-aware scoring. Vector-only recovery still proves independent vector recall via the empty-lexical probe.

---

## 18. Generation Isolation

- Vector/JSON neighbors require `searchIndexGenerationId`
- Hydration uses chunk + index generation binding with Draft excluded
- Public scope = PRODUCTION + PROMOTED only

---

## 19. Latency (live sample)

| Path | Approx |
|------|--------|
| Lexical-only VOR collect | ~0.5s |
| Vector-only ranking (empty lexical) | ~0.15s |
| Full hybrid Public API | ~1–30s / query |

High hybrid latency is dominated by **generation-scoped JSON embedding neighbor scan** when pgvector returns null in this environment. Correctness path is live worker + generation isolation; pgvector HNSW as canonical production path remains a **remaining Gap** (not a semantic FAIL).

---

## 20. 수정 파일

| Path | Change |
|------|--------|
| `src/lib/search-utils.ts` | Particle/`함께` fix; source-only lexical prefilter; paraphrase synonyms; `buildHybridQueryEmbeddingText`; soft stopword topic markers |
| `src/lib/retrieval/hybrid-ranking-service.ts` | Embed synonym-enriched query text |
| `src/lib/retrieval/relevance-diversity-rerank.ts` | Final relevance terms use scoring tokens (incl. synonyms) |
| `scripts/p8-1-2-live-hybrid-semantic-eval.ts` | Live hybrid suite + VOR |
| `src/__tests__/p8-1-2-live-hybrid-semantic.test.ts` | Live hybrid prerequisites |
| `src/__tests__/p8-retrieval-quality-tokenize.test.ts` | Expansion/prefilter/`함께` coverage |
| `docs/JYKStore_P8_1_2_live_hybrid_semantic_validation.md` | This report |

DB note (not in git): published generation `embeddingModelRevision` pinned to model SHA so the adapter accepts live worker.

---

## 21. 테스트

```text
src/__tests__/p8-retrieval-quality-tokenize.test.ts
src/__tests__/p8-1-1-retrieval-recall-hardening.test.ts
src/__tests__/p8-1-2-live-hybrid-semantic.test.ts
src/__tests__/relevance-diversity-rerank.test.ts
scripts/p8-1-2-live-hybrid-semantic-eval.ts   # live E2E (worker required)
```

---

## 22. 남은 Gap

1. **pgvector availability** — this live run often falls back to JSON full-generation scan; production should prefer HNSW.
2. **P8.2 Cursor/MCP external client** — not started (explicitly out of scope).
3. Local `.env` worker URL/token — operator setup; do not commit secrets.

---

## 23. 최종 판정

```text
P8.1.2 LIVE HYBRID SEMANTIC RETRIEVAL PASSED
```

Ready for P8.2 Cursor/MCP external validation.
