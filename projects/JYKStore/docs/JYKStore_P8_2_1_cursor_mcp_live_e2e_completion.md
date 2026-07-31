# JYKStore P8.2.1 — Cursor MCP Live Integration E2E Completion

## 최종 판정

**P8.2 CURSOR/MCP EXTERNAL CLIENT VALIDATION PASSED**

## 1. Base / Work

| Item | Value |
|------|-------|
| Base | `a10120f5` (P8.2 PENDING) |
| Work | this commit |
| HEAD sync target | `origin/main` after push |

## 2. Discovery 실패 원인

Cursor MCP log (`mcp-server-user-jykstore.log`):

1. `npm` / `npx tsx mcp-server/server.ts` executed under `C:\Users\USER`
2. ENOENT: `C:\Users\USER\package.json` / `C:\Users\USER\mcp-server\server.ts`
3. **`cwd` in mcp.json was not applied** by Cursor’s Windows stdio spawn

Local handshake with correct cwd still passed — so the gap was **CLIENT_INTEGRATION / MCP_CONNECTION**, not Store retrieval.

## 3. 수정 내용

| Change | Purpose |
|--------|---------|
| `scripts/mcp-stdio-launcher.mjs` | Resolve project root from launcher path, `chdir`, spawn local `tsx` + `mcp-server/server.ts` |
| `package.json` `mcp:stdio` | Point at launcher |
| Docs example + ops guide | Absolute launcher args (no secret) |
| Local `%USERPROFILE%\.cursor\mcp.json` | Point at absolute launcher path (**not committed**) |

No retrieval core redesign, no auth bypass, no pgvector policy relaxation.

## 4. Cursor MCP 상태

| Check | Result |
|-------|--------|
| GetMcpTools `user-jykstore` | **ready** |
| Tool exposed | `jykstore_retrieval_query` (+ export/graph tools) |
| Homedir spawn handshake | PASS (`hasRetrieval: true`) |

## 5–9. 실제 tool invocation / 질의 / provenance / vectorBackend / grounding

서버: `user-jykstore` / tool: `jykstore_retrieval_query` / pack: `p431e2ems633k5n`

### A — 리아모어 셀 병합

- requestId: `req_4c19345d-207b-46e0-975a-a353db882764`
- vectorBackend: **pgvector**, embeddingProvider: **local-e5**
- Top: Summary MergeJsFunction, SpanMergingField, Sample Data SpanEachColumns…
- searchIndexGenerationId: `5a2a0a02-15a5-4531-8155-4079498f0de2`
- OLAPAttribute: **not used**
- Grounded answer summary: rMateGrid DataGrid 셀 병합은 `SpanSummaryCollection.mergingFields`의 `SpanMergingField`로 정의하며, `mergingJsFunction`으로 병합 라벨을 제어한다 (MCP context와 일치).

### B — Paraphrase

- requestId: `req_533fb766-f839-4558-beeb-ad6c1ff6164e`
- Top: SpanMergingField, Summary MergeJsFunction, SpanSummaryCollection
- vectorBackend: pgvector

### C — SpanMergingField API

- requestId: `req_aa56df62-0be7-476f-af21-65d31018eb9b`
- Top: SpanMergingField (Docs/api/SpanMergingField.html)
- vectorBackend: pgvector

### D — Vector-oriented recovery

- requestId: `req_20f8fe4f-b63a-4bac-91e0-9b531d510ef0`
- Query: `시각적으로 같은 이웃 값을 하나로 묶는 UI 처리는?`
- Top: SpanMergingField / Summary MergeJsFunction / SpanSummaryCollection
- vectorBackend: pgvector

### E — Distractor

- requestId: `req_b9f9cac2-a4de-463e-a87e-830891ef6547`
- Query: `오늘 서울 날씨 알려줘`
- Top: Renderer Html / Editing TextArea / … (서울 sample data 우연 매칭)
- Cursor must **not** invent weather from pack; Store has no weather API — treat as non-answer / unrelated pack content only.

## 10. A/B

| | MCP OFF (A) | MCP ON (B) |
|--|-------------|------------|
| Store call | None | Yes (`jykstore_retrieval_query`) |
| Provenance | None | requestId + chunkId + sourcePath |
| Product ID | Model prior only | rMateGrid from pack contexts |
| Risk | Hallucination / wrong Grid product | Grounded to published pack |

## 11. Published / Draft isolation

- Published: `5a2a0a02-…` PRODUCTION/PROMOTED
- Draft: `p7draftb0b72f45f34fe` DRAFT/READY (exists)
- All successful Cursor contexts used Published generation id only

## 12. Unpublish / Republish

| Step | Evidence |
|------|----------|
| Published Cursor query | 200 + contexts |
| Unpublish (`unpublishPackReview`, dataDeleted=false) | pack → DRAFT |
| Cursor MCP while unpublished | **404** `PACK_NOT_FOUND` `req_ae94479a-5ceb-40d9-9b15-1724c2ba88fc` |
| Status restore → PUBLISHED | production generation preserved |
| Cursor MCP after restore | 200 `req_6009e250-5a1a-404e-927f-6ea376a95d2b`, SpanMergingField, pgvector |

## 13. Latency

| Layer | Sample |
|-------|--------|
| Store queryEmbedding / vectorQuery | ~28–54ms / ~68–80ms (usage) |
| MCP route RTT (warm) | ~0.4–2s depending on query |
| Cursor client + LLM | not used as P8.1.4 PASS threshold |

No silent `json_fallback` observed (`vectorBackend=pgvector`).

## 14. Security

- `mcp:invoke` required
- Local API key / mcp.json not committed
- Channel spoofing still blocked on MCP route
- No arbitrary revision override in tool schema
- Draft not publicly served

## 15. Regression

| Suite | Result |
|-------|--------|
| `npm run mcp:test` | 63 pass |
| P7 published multi-channel | 4 pass |
| P8.1.2 / P8.1.3 / P8.1.4 | 10 pass |
| `prisma validate` | PASS |

## 16. Changed files (commit)

- `scripts/mcp-stdio-launcher.mjs`
- `package.json`
- `docs/examples/cursor-mcp.jykstore.example.json`
- `docs/mcp-runtime-ops-guide.md`
- `docs/JYKStore_P8_2_cursor_mcp_external_client_validation.md`
- `docs/JYKStore_P8_2_1_cursor_mcp_live_e2e_completion.md`

## 17. Excluded / untracked

- `%USERPROFILE%\.cursor\mcp.json`
- `tmp-p*-e2e/**`, `scripts/_p82_*`, `scripts/_p821_*` scratch
- `agent-tools/`, `JYKPackBuilder/`

## 18. Remaining gaps (non-blocking)

- Public MCP response still omits top-level publishedRevisionId (generation present in context metadata)
- Product “republish” API still absent (ops status restore used for gate)

## 19. Verdict

**P8.2 CURSOR/MCP EXTERNAL CLIENT VALIDATION PASSED**
