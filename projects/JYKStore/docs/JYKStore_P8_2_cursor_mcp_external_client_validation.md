# JYKStore P8.2 — Cursor/MCP External Client Validation

## 최종 판정

**P8.2 CURSOR/MCP EXTERNAL CLIENT VALIDATION PASSED**

P8.2.1 live integration에서 Cursor MCP discovery와 `jykstore_retrieval_query` 실호출 증거를 확보했다.

상세 완료 기록: [`JYKStore_P8_2_1_cursor_mcp_live_e2e_completion.md`](./JYKStore_P8_2_1_cursor_mcp_live_e2e_completion.md)

---

## 1. Base / Work Commit

| Item | Value |
|------|-------|
| Base | `a10120f5` — P8.2 PENDING report |
| Work | this commit (P8.2.1 launcher + PASSED evidence) |
| Branch | `main` |

---

## 2. Discovery 실패 원인 → 수정

| Observation | Detail |
|-------------|--------|
| Symptom | Cursor `user-jykstore` live discovery FAIL; local stdio `tools/list` PASS |
| Root cause | Cursor Windows spawn **ignored `cwd`**, ran under `%USERPROFILE%` → `C:\Users\USER\mcp-server\server.ts` / `package.json` ENOENT |
| Fix | Absolute-path launcher `scripts/mcp-stdio-launcher.mjs` + Cursor mcp.json pointing at it (local only, not committed) |
| After | `user-jykstore` **ready**; Tools include `jykstore_retrieval_query` |

---

## 3. MCP Architecture

```text
Cursor → stdio → mcp-stdio-launcher.mjs → mcp-server/server.ts
  → jykstore_retrieval_query
  → POST /api/v1/mcp/retrieval/query (mcp:invoke)
  → executeRetrievalApiRequest(PUBLIC/MCP)
  → resolvePublicRetrievalGenerationScope (PRODUCTION+PROMOTED)
  → hybrid + local-e5 + pgvector
  → contexts → Cursor grounded answer
```

---

## 4. 실증 Pack

| Field | Value |
|-------|-------|
| packId | `p431e2ems633k5n` |
| versionId | `cms633k7p0002unqsjrdlmm5g` |
| Published generation | `5a2a0a02-15a5-4531-8155-4079498f0de2` |
| Draft coexisting | `p7draftb0b72f45f34fe` (DRAFT/READY) — **not served** |
| allowMcp | true |

---

## 5. Cursor Tool Invocation Evidence (요약)

| Id | Query | requestId | vectorBackend | Top titles | searchIndexGenerationId |
|----|-------|-----------|---------------|------------|-------------------------|
| A | 리아모어…셀 병합… | `req_4c19345d-…` | pgvector | Summary MergeJsFunction, SpanMergingField… | `5a2a0a02-…` |
| B | paraphrase 병합 | `req_533fb766-…` | pgvector | SpanMergingField, SpanSummaryCollection… | same |
| C | SpanMergingField API | `req_aa56df62-…` | pgvector | SpanMergingField… | same |
| D | VOR-style | `req_20f8fe4f-…` | pgvector | SpanMergingField… | same |
| E | 날씨 distractor | `req_b9f9cac2-…` | pgvector | Renderer Html / TextArea… (no merge forced) | same |

OLAPAttribute를 핵심 근거로 사용하지 않음. wrong-pack 없음.

---

## 6. Grounding / A/B

- **B (MCP ON):** Cursor가 Store context의 SpanMergingField / SpanSummaryCollection / mergingJsFunction을 근거로 rMateGrid 셀 병합 API를 설명 가능.
- **A (MCP OFF):** 동일 제품은 모델 prior에 의존; Store requestId/provenance 없음. A가 우연히 맞더라도 B의 Store 호출·근거 사용이 PASS 핵심.

---

## 7. Isolation / Unpublish

| Gate | Result |
|------|--------|
| Draft READY 공존 | Yes |
| Cursor contexts generation | only `5a2a0a02-…` (PRODUCTION) |
| Unpublish → Cursor MCP | `PACK_NOT_FOUND` (`req_ae94479a-…`, status 404) |
| Republish → Cursor MCP | 200 + SpanMergingField (`req_6009e250-…`) |
| Generation deleted? | No |

---

## 8. Regression / Security

- `npm run mcp:test` 63 pass
- P7 multi-channel 4 pass
- P8.1.2 / P8.1.3 / P8.1.4 unit suites 10 pass
- `prisma validate` PASS
- Secrets / `~/.cursor/mcp.json` / `tmp-p*-e2e` not committed

---

## 9. 변경 파일

- `scripts/mcp-stdio-launcher.mjs`
- `package.json` (`mcp:stdio` → launcher)
- `docs/examples/cursor-mcp.jykstore.example.json`
- `docs/mcp-runtime-ops-guide.md`
- this report + P8.2.1 completion note
