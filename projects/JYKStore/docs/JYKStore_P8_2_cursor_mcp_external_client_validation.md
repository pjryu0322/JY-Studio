# JYKStore P8.2 — Cursor/MCP External Client Validation

## 최종 판정

**P8.2 CURSOR/MCP EXTERNAL CLIENT VALIDATION PENDING**

이 세션에서 Cursor MCP 서버 `user-jykstore`는 등록되었으나 **live tool discovery 실패** 상태이며, `jykstore_retrieval_query`를 Cursor 프로세스에서 호출한 증거가 없다.  
프롬프트 기준상 MCP HTTP 경로 smoke / stdio handshake / in-process 테스트만으로는 **PASSED로 판정하지 않는다**.

---

## 1. Base / Work Commit

| Item | Value |
|------|-------|
| Base (start) | `a8e38de4` — P8.1.4 hybrid latency hardening |
| Work | this commit (report + MCP docs/example + README path fix) |
| Branch | `main` tracking `origin/main` at start |

---

## 2. MCP Architecture / Call Graph

```text
Cursor (MCP client, stdio)
  → mcp-server/server.ts (transport=stdio|http)
  → tool handler jykstore_retrieval_query
  → POST /api/v1/mcp/retrieval/query
  → authenticateApiKey(requiredScope: mcp:invoke)
  → executeRetrievalApiRequest({ serviceChannel: "MCP", executionMode: "PUBLIC" })
  → resolvePublicRetrievalGenerationScope (PRODUCTION + PROMOTED only)
  → hybrid retrieval + E5 query embedding + pgvector
  → RetrievalResponseDto { contexts, usage }
  → MCP tool result (raw JSON; no answer generation in bridge)
  → Cursor LLM answer (client-side)
```

| Item | Value |
|------|-------|
| Transport | stdio (Cursor local default); HTTP optional (`:3014`) |
| Auth | Bearer `JYKSTORE_API_KEY` with `mcp:invoke` (+ pack read scopes) |
| Primary tool | `jykstore_retrieval_query` |
| Retrieval adapter | `src/lib/retrieval/retrieval-api-adapter.ts` |
| Scope resolver | `resolvePublicRetrievalGenerationScope` |
| Shared core | Public API / MCP / RAG export share the same retrieval core |

Channel spoofing: client `X-JYK-Service-Channel` on MCP route is rejected (`SERVICE_CHANNEL_SPOOFING_NOT_ALLOWED`).

---

## 3. Cursor 연결 방법

예제(비밀 없음): [`docs/examples/cursor-mcp.jykstore.example.json`](./examples/cursor-mcp.jykstore.example.json)

로컬 등록 위치(개인 설정, **Git 커밋 금지**): `%USERPROFILE%\.cursor\mcp.json`

권장 Windows 형태:

```json
{
  "mcpServers": {
    "jykstore": {
      "command": "cmd",
      "args": ["/c", "npx", "tsx", "mcp-server/server.ts", "--transport", "stdio"],
      "cwd": "C:/project/JY-Studio/projects/JYKStore",
      "env": {
        "JYKSTORE_BASE_URL": "http://localhost:3004",
        "JYKSTORE_API_KEY": "<API_KEY with mcp:invoke>"
      }
    }
  }
}
```

사전 조건:

1. JYKStore `npm run dev` (또는 production) on `:3004`
2. Embedding worker reachable (local E5) when hybrid/semantic 필요
3. Cursor에서 MCP 서버 재로드 후 Tools에 `jykstore_retrieval_query` 노출 확인

이 세션 상태:

| Check | Result |
|-------|--------|
| `~/.cursor/mcp.json` written | Yes (local only) |
| stdio JSON-RPC `tools/list` (외부 Cursor 아님) | PASS — tool list includes `jykstore_retrieval_query` |
| Cursor GetMcpTools `user-jykstore` | **error** — live tool discovery failed |
| Cursor → `jykstore_retrieval_query` call | **Not obtained** |

Failure class for remaining gap: **CLIENT_INTEGRATION** / **MCP_CONNECTION**.

---

## 4. 실증 Pack / Published Revision

DB / distribution snapshot (`tmp-p8-2-e2e/published-scope.json`, untracked):

| Field | Value |
|-------|-------|
| packId | `p431e2ems633k5n` |
| versionId | `cms633k7p0002unqsjrdlmm5g` |
| Pack status | `PUBLISHED` |
| `allowMcp` | `true` |
| Published SearchIndexGeneration | `5a2a0a02-15a5-4531-8155-4079498f0de2` (`PRODUCTION` / `PROMOTED`) |
| Draft coexisting | `p7draftb0b72f45f34fe` (`DRAFT` / `READY`) |
| Embedding | `local-e5` / `dragonkue/multilingual-e5-small-ko-v2` / dim 384 |

---

## 5. 외부 호출 증거 (Cursor)

| Evidence type | Status |
|---------------|--------|
| Cursor MCP tool call transcript | **Missing** |
| Cursor grounded answer screenshots/logs | **Missing** |
| Supporting: MCP Public route probe | Obtained (not Cursor) |
| Supporting: stdio handshake tool list | Obtained (not Cursor) |

---

## 6. 대표 질의 — Supporting MCP route only

경로: `POST /api/v1/mcp/retrieval/query` with local API key (`mcp:invoke`).  
**이것은 Cursor 증거가 아니다.**

| Id | Query | HTTP | vectorBackend | Top titles (abbrev) | Pack |
|----|-------|------|---------------|---------------------|------|
| A-core | 셀 병합과 관련된 기능이나 API를 찾아줘 | 200 | `pgvector` | SpanMergingField, Summary MergeJsFunction | `p431e2ems633k5n` |
| B-paraphrase | 반복되는 셀 값을 하나의 영역처럼… | 200 | `pgvector` | SpanMergingField, SpanSummaryCollection | same |
| C-api-name | SpanMergingField API에 대해 알려줘 | 200 | `pgvector` | SpanMergingField… | same |
| D-vor | 시각적으로 같은 이웃 값을 하나로 묶는 UI 처리는? | 200 | `pgvector` | SpanMergingField… | same |
| E-distractor | 오늘 서울 날씨 알려줘 | 200 | `pgvector` | Renderer Html / TextArea / Excel Import… (no forced merge narrative) | same |

Sample requestIds: `req_1e6cc770-…` (A), `req_ee49eaa0-…` (B), …

Warm latencies (route RTT, not Cursor end-to-end): A ~0.6–0.8s, C ~0.4–0.6s, D ~1.9s.

---

## 7. Provenance

MCP response DTO exposes `contexts[]` + `usage` (requestId, retrievalMode, embeddingProvider/model, `vectorBackend`, latency fields).  
**Top-level `publishedRevisionId` / `searchIndexGenerationId`는 Public MCP retrieval 응답에 포함되지 않음** (scope는 서버에서만 resolve).  
Cursor 근거 표시를 강화하려면 후속에서 usage/provenance 필드를 노출하는 것이 유리하다 (이번 P8.2에서 contract 변경하지 않음).

---

## 8. vectorBackend

Supporting MCP route evidence: **`vectorBackend = pgvector`** on all A–E samples.  
Production-like run used `JYKSTORE_REQUIRE_PGVECTOR=true`. JSON neighbor fallback not observed.

---

## 9. Cursor 최종 답변 평가

**Not executed** — no Cursor MCP tool calls / answers in this session.

---

## 10. A/B (with vs without MCP)

**Not executed** as Cursor client comparison. Supporting store retrieval alone cannot substitute for client A/B.

---

## 11. Published / Draft Isolation

| Check | Status |
|-------|--------|
| Draft READY + Published PRODUCTION coexist | Confirmed in DB |
| Public resolver code path = PRODUCTION+PROMOTED only | Confirmed in source / P7 tests |
| Cursor MCP query cannot return Draft generation | **Not proven via Cursor** |
| Supporting MCP route results only packId `p431e2ems633k5n` | Yes (titles SpanMerging*) |

---

## 12. Unpublish

**Not executed** in this run (avoid mutating empiric pack without Cursor verification path). Remaining for a follow-up when Cursor MCP is healthy.

---

## 13. Latency Breakdown

| Layer | Observation |
|-------|-------------|
| Store MCP route warm | ~0.4–2.0s depending on query (supporting) |
| Embedding / vector (usage) | e.g. queryEmbedding ~34ms, vectorQuery ~80ms on A sample |
| Cursor/client + LLM answer | **Not measured** |

P8.1.4 warm internal targets are **not** used as Cursor end-to-end PASS criteria.

---

## 14. Auth / Security

| Check | Status |
|-------|--------|
| Local API key scopes include `mcp:invoke` | Yes |
| Secrets not committed (`tmp-p8-2-e2e/`, `~/.cursor/mcp.json`) | Kept out of git |
| MCP route requires MCP scope; channel spoof blocked | Code-confirmed |
| Arbitrary revision override on public MCP | Not exposed in tool schema |

---

## 15. Regression Tests

| Suite | Result |
|-------|--------|
| `npm run mcp:test` | **63 pass / 0 fail** |
| P7 / P8.1.x full matrix | Not fully re-run in this session (no retrieval core code changes beyond docs) |
| tsc/lint/build | Not re-run as primary gate for PENDING docs-only commit |

---

## 16. 변경 파일 (intended commit)

- `docs/JYKStore_P8_2_cursor_mcp_external_client_validation.md` (this report)
- `docs/examples/cursor-mcp.jykstore.example.json`
- `mcp-server/README.md` — retrieval tool path corrected to `/api/v1/mcp/retrieval/query`

Untracked / excluded:

- `tmp-p8-2-e2e/**` (keys, probes)
- `scripts/_p82_*.ts` scratch helpers
- `agent-tools/`, other `tmp-p*-e2e/`
- `%USERPROFILE%\.cursor\mcp.json`

---

## 17. 남은 Gap (PASS 전환 조건)

1. Cursor에서 `user-jykstore` tool discovery 성공
2. 실제 Cursor chat에서 `jykstore_retrieval_query` 호출 증거 (requestId + contexts)
3. A–E에 대한 Cursor grounded 답변 평가
4. A/B (MCP off vs on)
5. Draft isolation을 Cursor 경로에서 확인
6. Unpublish → block → Republish on Cursor/MCP path
7. (Optional) response provenance에 published revision / searchIndexGenerationId 노출

---

## 18. 최종 판정 (재확인)

**P8.2 CURSOR/MCP EXTERNAL CLIENT VALIDATION PENDING**

Store/MCP 서버 경로는 hybrid + E5 + pgvector + Published pack으로 동작함이 확인되었으나, **필수 게이트인 실제 Cursor → JYKStore MCP 호출 증거가 없다.**
