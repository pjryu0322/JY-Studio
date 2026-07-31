# JYKStore P8 — Retrieval / MCP External Client Closure

## 최종 판정

**P8 RETRIEVAL / MCP EXTERNAL CLIENT VALIDATION CLOSED**

---

## 1. P8 전체 목표

게시된 Knowledge Pack의 hybrid retrieval을 **semantic 품질 → pgvector production → latency → 실제 Cursor MCP 외부 클라이언트**까지 한 경로로 증명하고, 재발 방지를 위해 launcher·Published lifecycle을 자동 회귀로 고정한 뒤 P8을 종료한다.

Canonical path:

```text
Cursor → MCP stdio → jykstore_retrieval_query
→ authenticate (mcp:invoke)
→ executeRetrievalApiRequest (PUBLIC/MCP)
→ Published PRODUCTION/PROMOTED
→ E5 + pgvector + hybrid
→ grounded contexts → Cursor
```

---

## 2–6. Phase 결과 요약

| Phase | Verdict | Notes |
|-------|---------|-------|
| P8.1 semantic | PASSED | SpanMerging* 회수, OLAPAttribute false-positive 제거 |
| P8.1.3 pgvector | PASSED | production silent JSON fallback 차단; `vectorBackend=pgvector` |
| P8.1.4 latency | PASSED | rerank O(n²) 완화, warm hybrid 대폭 단축 |
| P8.2 Cursor/MCP E2E | PASSED (`d1bf4bad`) | live discovery + tool invocation + unpublish gate |
| P8.2.2 source audit | PASSED WITH FINDINGS (`98f7d232`) | canonical path 유효; 테스트/문서 findings |
| P8.2.3 hardening | this commit | findings 조치 후 Closure |

---

## 7. P8.2.3 findings 조치

| Finding | Action |
|---------|--------|
| Launcher 자동화 테스트 부재 | **Added** `src/__tests__/mcp-stdio-launcher.test.ts` (tmpdir + homedir cwd, real spawn, tools/list, JSON-RPC stdout) |
| Unpublish lifecycle 자동화 부족 | **Added** `src/__tests__/p8-2-3-published-serving-lifecycle.db.test.ts` |
| Cursor example 머신 절대경로 | **Replaced** with `<ABSOLUTE_PATH_TO_JYKSTORE>` placeholder (ops guide + mcp README + example JSON) |
| product `/republish` API | **Not added** — `approvePackReview`는 REVIEWING 전용; 이미 PROMOTED pack 복구는 status restore로 충분 (lifecycle 테스트가 증명) |
| top-level revisionId | **Not added** — packId + requestId + context metadata(`searchIndexGenerationId`, sourcePath, chunkId)로 served generation 추적 가능; contract 확대 불필요 |

---

## 8. Launcher regression

- Arbitrary cwd: `os.tmpdir()`, `os.homedir()`
- Absolute launcher path under project root (no hard-coded `C:/project/...` in launcher source)
- `initialize` + `tools/list` + `jykstore_retrieval_query` present
- stdout must be JSON-RPC only

Covered by `npm run mcp:test` (66 pass including 3 new launcher tests).

---

## 9. Cursor config portability

Example:

```json
"args": ["<ABSOLUTE_PATH_TO_JYKSTORE>/scripts/mcp-stdio-launcher.mjs"]
```

Why launcher: Cursor Windows may ignore `cwd` and spawn under `%USERPROFILE%`.

---

## 10. Published lifecycle regression

Automated DB test:

```text
PUBLISHED → MCP/public retrieval OK
→ unpublishPackReview → DRAFT + PACK_NOT_FOUND
→ generations/source preserved; Draft READY not promoted
→ status restore PUBLISHED → same PRODUCTION generation served
```

No `/republish` route.

---

## 11. Revision provenance 판단

Keep existing contract. Provenance available via:

- `usage.requestId`
- `contexts[].knowledgePackId`
- `contexts[].chunkId` / title / references
- `contexts[].metadata.searchIndexGenerationId` / `sourcePath`

---

## 12. Security

- No auth bypass in hardening
- No silent JSON fallback policy change
- Secrets / personal mcp.json not committed

---

## 13. Regression (P8.2.3 run)

| Suite | Result |
|-------|--------|
| `npm run mcp:test` | **66 pass** |
| P7 + P8.1.2–1.4 | **14 pass** |
| `p8-2-3-published-serving-lifecycle.db.test.ts` | **1 pass** |
| `prisma validate` | PASS |
| `tsc --noEmit` | PASS (0 errors) |

Lint/full `next build` not required for test/docs-only hardening; no app route changes.

---

## 14. 남은 비차단 항목

- Product-level “republish” UX/API (optional future; not required for serving gate)
- Optional top-level revision field if multi-channel clients demand uniform DTO
- Multi-version pack “latest version” selection in `loadPublicRetrievalPack` (pre-existing; out of P8 scope)

---

## 15. 최종 architecture

Unchanged canonical path (section 1). Launcher is spawn-location only; retrieval remains shared Public/MCP core.

---

## 16. Closure checklist

```text
[x] Semantic retrieval 품질 검증 완료
[x] Production pgvector 사용
[x] latency hardening 완료
[x] 실제 Cursor MCP discovery 완료
[x] 실제 Cursor retrieval invocation 완료
[x] Published-only serving
[x] Draft leakage 없음
[x] Unpublish/Publish lifecycle 정상 (+ automated)
[x] launcher 자동 regression 존재
[x] Cursor example portable
[x] auth bypass 없음
[x] silent JSON fallback 없음
[x] 주요 regression 없음
```

**P8 RETRIEVAL / MCP EXTERNAL CLIENT VALIDATION CLOSED**
