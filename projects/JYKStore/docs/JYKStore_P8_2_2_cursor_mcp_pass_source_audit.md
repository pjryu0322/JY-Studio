# JYKStore P8.2.2 — Cursor/MCP PASS Source Audit

## 최종 판정

**P8.2 SOURCE AUDIT PASSED WITH FINDINGS**

`d1bf4bad`의 P8.2 PASS는 **canonical 소스 경로와 재실행된 Cursor MCP 증거**로 유지된다.  
PASS를 무효화하는 인증 bypass / Draft fallback / silent JSON fallback / Cursor-전용 retrieval은 발견되지 않았다.  
아래 Findings는 **잔여 리스크·테스트 공백**이며, 이번 감사에서 코드 수정은 하지 않았다.

---

## 1. Base / HEAD / origin

| Item | Value |
|------|-------|
| HEAD | `d1bf4bad566dc903f031e9ed7c0a87e729e9b116` |
| origin/main | `d1bf4bad566dc903f031e9ed7c0a87e729e9b116` |
| Ancestor of origin/main | Yes |
| Parent / prior PENDING | `a10120f5` |
| Working tree | clean for committed paths; excluded untracked remain |

---

## 2. 실제 변경 파일 (`a10120f5..d1bf4bad`)

| Path | Role |
|------|------|
| `scripts/mcp-stdio-launcher.mjs` | cwd-safe MCP stdio spawn |
| `package.json` | `mcp:stdio` → launcher |
| `docs/examples/cursor-mcp.jykstore.example.json` | Cursor config example |
| `docs/mcp-runtime-ops-guide.md` | ops note |
| `docs/JYKStore_P8_2_*` / P8 summary | PASSED reports |

**무관 혼입 없음.** Retrieval core / auth / schema / Prisma 모델 변경 없음.

---

## 3. Launcher 감사

파일: `scripts/mcp-stdio-launcher.mjs`

| Criterion | Result |
|-----------|--------|
| cwd 무시 시에도 서버 기동 | **PASS** — root = `dirname(import.meta.url)/..` |
| repo 귀속 | **PASS** — launcher 위치 기준 |
| PC hard-code in launcher | **PASS** — 코드에 `C:\...` 없음 (docs example만 예시 경로) |
| USERPROFILE 의존 대체 | **PASS** — 아님 |
| command injection | **LOW** — argv는 `process.execPath` + 고정 tsx/server 경로; `extraArgs` 전달은 존재하나 shell 미사용 |
| exit/signal | **PASS** — child exit/signal 전파 |
| stdio | **PASS** — `stdio: "inherit"` |
| stdout pollution | **PASS** — launcher는 spawn 실패 시만 `console.error` |
| secret 노출 | **PASS** — env 전달만, 로깅 없음 |
| auth/retrieval 우회 | **PASS** — spawn only |

---

## 4. MCP registration

```text
jykstore_retrieval_query
  → parseRetrievalToolInput
  → assertPackAllowed
  → POST /api/v1/mcp/retrieval/query
  → authenticateApiKey(mcp:invoke)
  → executeRetrievalApiRequest({ serviceChannel:"MCP", executionMode:"PUBLIC" })
  → loadPublicRetrievalPack
  → resolvePublicRetrievalGenerationScope
  → retrieveContextsForVersion (shared core)
```

금지 구조 없음: Cursor 전용 retrieval / 직접 Prisma in mcp-server / 인증 bypass / pack·revision hard-code in production path.

---

## 5. Auth

| Check | Result |
|-------|--------|
| `mcp:invoke` on MCP route | Present |
| Channel spoof header blocked | Present |
| Query length validation | Present |
| Quota + usage logging | Present |
| Generation/revision client override | Not in tool schema |
| Auth weakened in d1bf4bad | **No** |

---

## 6. Published scope

`resolvePublicRetrievalGenerationScope`: PRODUCTION + PROMOTED only; missing production → 503.  
`loadCurrentDraftSearchGeneration`는 **PROVIDER_VALIDATION** 전용. Public MCP에 READY fallback 재도입 없음 (P7 assertion도 “fall back to latest READY” 부재 확인).

Empiric pack: Draft READY `p7draftb0b72f45f34fe`와 Published `5a2a0a02-…` 동일 version 공존. Cursor contexts의 `searchIndexGenerationId` = Published only.

---

## 7. pgvector

| Check | Result |
|-------|--------|
| Backend label source | hybrid ranking return value (`vectorBackend: "pgvector"`) |
| Silent JSON fallback in prod/dev | Blocked unless test or explicit allow; `JYKSTORE_REQUIRE_PGVECTOR` forces hard-fail |
| Live Cursor re-smoke (this audit) | `usage.vectorBackend=pgvector`, `vector:similarity` in matchReasons |
| Generation scoped vector query | `searchIndexGenerationId` required path |

---

## 8. Grounding / provenance

Live re-smoke (`req_83adfe44-e80e-41ed-a44c-65ec89dd96ed`):

- titles: SpanMergingField / Summary MergeJsFunction
- `knowledgePackId`: `p431e2ems633k5n`
- `metadata.sourcePath`: `Docs/api/SpanMergingField.html`, `Samples/Summary_MergeJsFunction.html`
- `chunkId`, `score`, `matchReasons`, `searchIndexGenerationId`
- OLAPAttribute not in top contexts

Top-level response에는 `publishedRevisionId` 필드 없음 → generation id는 context metadata에 존재 (**residual**).

---

## 9–10. Draft isolation / Unpublish

| Gate | Source | Evidence |
|------|--------|----------|
| Draft isolation | `resolvePublicRetrievalGenerationScope` + live metadata | Published id only |
| Unpublish | `unpublishPackReview` → status DRAFT, `dataDeleted: false` | P8.2.1 Cursor 404 `PACK_NOT_FOUND` |
| Restore | status-only PUBLISHED (no product republish API) | P8.2.1 Cursor 200 + pgvector |

감사 재실행에서 Unpublish cycle은 **재파괴하지 않음** (상태 보존). 코드 경로와 기존 Cursor requestId로 검증.

---

## 11. Cursor E2E 증거 구분

| Evidence | Type |
|----------|------|
| P8.2.1 CallMcpTool A–E + unpublish block | **Real Cursor MCP** (`user-jykstore`) |
| This audit re-smoke retrieval | **Real Cursor MCP** again |
| `npm run mcp:test` / P7 / P8.1.x | Unit / static — not Cursor E2E |
| Scratch `_p82_*` / `_p821_*` scripts | Untracked supporting probes — not claimed as Cursor |

내부 smoke를 Cursor 실증으로 가장하지 않음.

---

## 12. 테스트 assertion 감사

| Suite | What it actually asserts | Live path? |
|-------|--------------------------|------------|
| `mcp:test` (63) | registration, validation, stdio smoke, pack allowlist, mocked Public API in places | Partial mock |
| P7 (4) | mostly **source-string** multi-channel alignment | Static |
| P8.1.3 (4) | JSON fallback **policy** + source contains diagnostics | Policy unit |
| P8.1.4 (3) | rerank cap / lexical slim select | Unit |
| Launcher | **No dedicated automated test** | Gap |
| Unpublish E2E | **No committed automated test** | Gap (manual P8.2.1) |

Reported counts (63 / 4 / 10) re-verified this session (14 for P7+P8.1.2–1.4 combined).

---

## 13. Security

Secrets not in `d1bf4bad`. Launcher/docs do not log API keys. mcp.json remains local/untracked.

---

## 14. Complexity / legacy

`d1bf4bad`는 launcher + docs만 추가. Duplicate retrieval adapter / legacy route / hard-coded empiric pack in production code **없음**.

---

## 15. 재실행 결과 (this audit)

| Check | Result |
|-------|--------|
| Cursor MCP discovery | `user-jykstore` ready |
| Cursor retrieval smoke | 200, pgvector, SpanMerging* |
| `npm run mcp:test` | 63 pass |
| P7 + P8.1.2–1.4 | 14 pass |
| `prisma validate` | PASS |
| Unpublish cycle | not re-run (preserve pack); code+prior Cursor evidence OK |

TypeScript full project / `next build`는 이번 감사에서 전체 재실행하지 않음 (d1bf4bad에 app 코드 변경 없음).

---

## 16. Findings (non-blocking)

1. **Launcher / Unpublish 자동화 테스트 부재** — 수동·Cursor 실증에 의존.
2. **Docs example의 머신 절대경로** — 사용자가 cwd를 자신의 경로로 바꿔야 함 (launcher 자체는 portable).
3. **Product republish API 부재** — unpublish 후 복구는 status restore ops 패턴.
4. **Response top-level publishedRevisionId 미노출** — metadata에 generation id는 있음.
5. **`loadPublicRetrievalPack`이 version을 `createdAt desc` 최신 1개로 선택** — 본 empiric pack은 version 단일·Draft gen 동일 version이라 leakage 없음. 다중 version 팩에 대한 장기 리스크는 P8.2 범위 밖 pre-existing 패턴.

코드 결함으로 판정할 우회/회귀는 없어 **수정 없음**.

---

## 17. Remaining risk

- Cursor GUI chat grounding은 tool output + agent 합성에 의존 (Store는 answer 미생성).
- Windows Cursor `cwd` 무시 회귀 시 launcher 미사용 설정은 다시 discovery FAIL.
- Multi-version pack의 “latest version” 선택이 Published version과 어긋날 잠재 리스크 (기존 설계).

---

## 18. Checklist

```text
[x] d1bf4bad 실제 origin/main 확인
[x] launcher가 경로 문제만 해결
[x] MCP stdio 규약 정상
[x] jykstore_retrieval_query가 shared retrieval core 사용
[x] 인증 우회 없음
[x] Published-only scope 유지
[x] Draft leakage 없음 (live metadata)
[x] 실제 pgvector 사용
[x] provenance 정상
[x] Unpublish serving gate 정상 (prior Cursor + code)
[x] Republish 복구 정상 (prior Cursor + code)
[x] hard-coded 실증 로직 없음 (production)
[x] 주요 regression 없음
[~] 자동화 테스트 공백 → WITH FINDINGS
```

---

## 최종 판정 (재확인)

**P8.2 SOURCE AUDIT PASSED WITH FINDINGS**

Canonical path:

```text
Cursor → MCP stdio → jykstore_retrieval_query
→ authenticated shared retrieval → Published PRODUCTION/PROMOTED
→ E5 → pgvector → grounded contexts → Cursor
```

이 경로가 테스트용 우회로 대체되었다는 증거는 없다. P8.2 PASS는 유지한다.
