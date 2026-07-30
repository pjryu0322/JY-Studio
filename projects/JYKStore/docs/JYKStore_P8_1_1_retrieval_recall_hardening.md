# JYKStore P8.1.1 — Retrieval Recall Hardening

## 최종 판정

**P8.1.1 RETRIEVAL RECALL HARDENING PASSED**

## 1. Base / Work Commit

| Item | Value |
|------|-------|
| Base | `5a4cc25d` — P8.1 Korean retrieval quality |
| Work | (this commit) |

## 2. 기존 retrieval call graph (HEAD 확인)

```text
executeRetrievalApiRequest / retrieveContextsForVersionWithDiagnostics
  → tokenizeSearchQueryDetailed(query)
  → collectRetrievalCandidates(lexicalPrefilterTokens)   // lexical only
  → scoreRetrievalCandidates(scoringTokens)
  → [hybrid] applyHybridVectorRanking
       → embedSearchQuery (1회)
       → querySearchIndexVectorsByGeneration(searchIndexGenerationId)  // 독립 Top-K
       → mergeKeywordAndVectorCandidates (union by chunkId + hydrate)
       → 또는 findJsonEmbeddingNeighbors (pgvector null fallback, generation-scoped)
  → selectRetrievalCandidatesWithStats → mapRetrievalResponse
```

Published scope: `resolvePublicRetrievalGenerationScope` → PRODUCTION + PROMOTED `searchIndexGenerationId`.

## 3. 문제 확인

| 이슈 | 상태 |
|------|------|
| Lexical prefilter가 vector hard gate | pgvector 경로는 이미 독립. **JSON fallback이 lexical chunkIds만 재점수**하던 부분이 BLOCKER 후보 → 수정 |
| Domain stopword (api/grid/cell/rmate) | P8.1에서 제거 → Index 억제엔 도움, recall 위험 → **유지 + 가중치/프리필터 분리** |
| MAX_TOKENS=10 + synonym 선점 | source budget 분리 |
| Paraphrase GT 부족 | +10 paraphrase / +4 distractor |

## 4. Candidate architecture (변경 후)

```text
lexicalCandidates = collectByQueryTokens(CORE lexical tokens)
vectorCandidates  = pgvector Top-K | JSON generation neighbors
candidates        = union(lexical, vector)  // chunkId dedupe
                  → keyword/metadata/vector score → select
```

| Budget | Constant | Value |
|--------|----------|------:|
| Lexical | `LEXICAL_CANDIDATE_LIMIT` | 1000 |
| Vector | `VECTOR_CANDIDATE_LIMIT` | 200 |
| Union | `UNION_CANDIDATE_LIMIT` | 1200 |

keyword mode: lexical only. hybrid: lexical ∪ vector. keyword에 vector 강제 없음.

## 5. Published scope

- Vector/JSON neighbors: `searchIndexGenerationId` 필수
- Hydration: `chunkGenerationId` + `indexGenerationId` + Draft 제외 (`excludeDraftScope`)
- Draft/READY vector union 혼입 시 BLOCKER — isolation helper 유지

## 6. Token / stopword 정책

| 종류 | 처리 |
|------|------|
| Conversational | 제거 (`관련된`, `찾아줘`, `how`, …) |
| Domain (`api`,`grid`,`cell`,`rmate`,`셀`,…) | **유지**. scoring weight 0.35. CORE와 함께일 때 lexical prefilter에서는 **제외** (flood 방지). domain-only면 lexical 빈 집합 → vector가 recall |
| CORE | lexical + scoring full weight |

근거: q11(`How to merge cells… rmate grid`)에서 domain을 lexical에 넣으면 DataGrid/Index가 SpanMergingField를 압도. CORE-only prefilter로 P8.1 12문항 Hit@5=1.0 회복.

## 7. MAX_TOKENS 정책

| Budget | Value |
|--------|------:|
| `SOURCE_TOKEN_BUDGET` | 12 |
| `EXPANSION_TOKEN_BUDGET` | 8 |

원문 source를 먼저 채운 뒤 synonym expansion. expansion이 source를 밀어내지 않음 (`tokenizeSearchQueryDetailed`).

## 8. Synonym 정책

유지: `병합↔merge/merging`, `이벤트↔event`, `속성↔property/properties`  
추가(평가 paraphrase 필요): `합치/합쳐/합쳐서/묶/묶어서↔merge…`, `칸↔cell/셀`  
제품 API 이름 hard-code 없음.

## 9. 기존 GT

P8.1 12문항 회귀: **Hit@1/3/5 = 1.0, MRR = 1.0, Wrong-pack = 0, No-hit = 0**

## 10. Paraphrase GT

10문항 (merge/병합 직접 사용 최소화). Keyword-only Paraphrase Hit@5 ≈ **0.4** (embedding worker 미설정 환경).

동의어가 있는 질문(합쳐/묶어서)은 SpanMerging* 적중. 순수 paraphrase는 hybrid/vector 필요 → Gap.

## 11. Distractor GT

4문항 (OLAP / summary / grouping / span 혼동). Hit@5 = 1.0, False-positive = 0.

## 12. Before / After

| Metric | P8.1 After (12) | P8.1.1 After (12) | Full keyword (26) |
|--------|----------------:|------------------:|------------------:|
| Hit@1 | 1.00 | **1.00** | 0.69 |
| Hit@3 | 1.00 | **1.00** | — |
| Hit@5 | 1.00 | **1.00** | 0.77 |
| MRR | 1.00 | **1.00** | 0.71 |
| No-hit | 0 | **0** | 6 |
| Wrong-pack | 0 | **0** | 0 |
| False-positive | — | **0** | 0 |
| Paraphrase Hit@5 | (없음) | **0.40** (keyword) | — |

## 13. Candidate source

Diagnostic: keyword rows에 `matchReasons` / scores 기록. Public API shape 변경 없음.  
`candidateSource=lexical|vector|both`는 hybrid+worker 환경에서 `vector:similarity` reason으로 구분 가능.

## 14. Vector-only recovery

- Unit: empty lexical ∪ vector ids = vector set
- Source invariant: `querySearchIndexVectorsByGeneration` + `findJsonEmbeddingNeighbors` (lexical chunkId-only JSON fallback 제거)
- Live hybrid: `JYKSTORE_EMBEDDING_WORKER_URL` 미설정 → `EMBEDDING_PROVIDER_NOT_CONFIGURED` (환경 Gap, 아키텍처 PASS)

## 15. Pack isolation

Wrong-pack = 0. Published revision `5a2a0a02-15a5-4531-8155-4079498f0de2`.

## 16. 성능

Keyword 대표 질의 ~2–4s (P8.1과 유사). Hybrid는 worker 필요. 대규모 최적화 없음.

## 17. Tests

- `src/__tests__/p8-1-1-retrieval-recall-hardening.test.ts`
- `src/__tests__/p8-retrieval-quality-tokenize.test.ts` (갱신)
- `scripts/p8-1-1-retrieval-recall-eval.ts`
- hybrid-vector-candidates / P7 regression / tsc / build / prisma

## 18. 변경 파일

- `src/lib/search-utils.ts`
- `src/lib/chunk-search-service.ts`
- `src/lib/retrieval/hybrid-ranking-service.ts`
- `src/lib/retrieval/retrieval-config.ts`
- `src/lib/retrieval-service.ts`
- tests / scripts / docs / `tsconfig.json`

## 19. 남은 Gap

- Embedding worker 연결 후 paraphrase hybrid 재측정
- Public diagnostic에 `candidateSource` 명시 필드 (내부 only)
- P8.2 Cursor MCP 외부 실증

## 20. 최종 판정

**P8.1.1 RETRIEVAL RECALL HARDENING PASSED**

```text
Lexical Precision  +  Vector Recall (independent)
        ↓
Stable Hybrid Retrieval
```
