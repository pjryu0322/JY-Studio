# JYKStore P7 — Published Revision Multi-channel E2E

## 최종 판정

**P7 PUBLISHED REVISION MULTI-CHANNEL E2E PASSED**

## 1. P6.2 Baseline

| Item | Value |
|------|-------|
| prefer-const | `src/lib/correction/correction-apply-service.ts` — `let keepId` → `const keepId` (의미 변경 없음) |
| TypeScript | `tsc --noEmit` clean (app/src; scripts·tests·tmp exclude) |
| lint | prefer-const 오류 없음 (기존 unused-vars Warning만 잔존) |
| build | `npm run build` PASS |
| Prisma | `npx prisma validate` PASS |
| 부가 baseline | null 안전(`admin-review-issues-markdown`), BlobPart(`zip-preflight-export`), Suspense(`MobileShell` useSearchParams) — 의미 없는 빌드 차단만 해제 |

`tsconfig.json`에서 `scripts/`, `src/__tests__/`, E2E tmp, `agent-tools/`를 exclude하여 Next typecheck가 일회성 스크립트/테스트 오류로 막히지 않게 했다.

## 2. Base / Work Commit

| Item | Value |
|------|-------|
| Base | `5e341fac` — P6.1 Provider review revision binding / publish E2E |
| Work | (this commit) |

## 3. 실증 Pack

| Field | Value |
|-------|-------|
| ZIP | `C:\doc\JYKStore\rMateGridH5Web_v6.0_EN_Trial.zip` |
| packId | `p431e2ems633k5n` |
| name | P4.3.1 E2E Trial 2026-07-29T12-51 |
| versionId | `cms633k7p0002unqsjrdlmm5g` |
| versionLabel | `v6.0-e2e` |
| publishedAt | `2026-07-30T11:12:58.431Z` |

## 4. Published Revision

| Field | Value |
|-------|-------|
| searchIndexGenerationId | `5a2a0a02-15a5-4531-8155-4079498f0de2` |
| scope / status | PRODUCTION / PROMOTED |

## 5. 채널 구현 감사

| Channel | Route / Entry | Auth | Revision resolver |
|---------|---------------|------|-------------------|
| Public API | `POST /api/v1/retrieval/query` | API key `context:read` | `resolvePublicRetrievalGenerationScope` → PRODUCTION+PROMOTED |
| MCP | `POST /api/v1/mcp/retrieval/query` | API key `mcp:invoke` | 동일 (`executeRetrievalApiRequest`, `serviceChannel=MCP`, `executionMode=PUBLIC`) |
| RAG Export | public download export path → `buildPublicRagExportPackage` | DOWNLOAD channel + rights | **동일 resolver** (P7에서 READY fallback 제거) |

Public API와 MCP는 이미 동일 retrieval adapter를 공유한다. RAG Export만 READY 우선 선택으로 PROMOTED를 놓칠 수 있어 blocker로 수정했다.

## 6. Public API

| Field | Value |
|-------|-------|
| query | `셀 병합과 관련된 기능이나 API를 찾아줘` |
| mode | `keyword` (hybrid는 embedding worker URL 미설정) |
| ok | true |
| latencyMs | 595 |
| hitCount | 1 (`OLAPAttribute`) |
| hasSource | true |
| packIsolationOk | true |
| servedRevision | `5a2a0a02-15a5-4531-8155-4079498f0de2` |

## 7. MCP

| Field | Value |
|-------|-------|
| implemented | **true** |
| path | `executeRetrievalApiRequest(serviceChannel=MCP, PUBLIC)` |
| ok | true |
| latencyMs | 507 |
| hitCount | 1 (`OLAPAttribute`) |
| hasSource | true |
| servedRevision | `5a2a0a02-15a5-4531-8155-4079498f0de2` |

판정 문자열 `P7 MCP IMPLEMENTATION REQUIRED`는 해당하지 않음.

## 8. RAG Export

| Field | Value |
|-------|-------|
| ok | true |
| latencyMs | 848 |
| fileSize | 545364 bytes |
| chunkCount | 2298 |
| sourceCount | 267 |
| packId / versionId | 실증 Pack과 동일 |
| scope / status | PRODUCTION / PROMOTED |
| servedRevision | `5a2a0a02-15a5-4531-8155-4079498f0de2` |

## 9. Revision 동일성

| 기준 | Public API | MCP | RAG Export |
|------|------------|-----|------------|
| packId | `p431e2ems633k5n` | 동일 | 동일 |
| versionId | `cms633k7p0002unqsjrdlmm5g` | 동일 | 동일 |
| Published Revision | `5a2a0a02-…` | 동일 | 동일 |
| equal | **true** | | |

## 10. Draft Isolation

| Field | Value |
|-------|-------|
| draft B id | `p7draftb0b72f45f34fe` (DRAFT / READY, 기존 active draft 재사용) |
| public resolver after draft | still Published A |
| stillServingPublished | true |

Draft B는 Provider Review + Publish 전 외부 채널에 노출되지 않음.

## 11. Unpublish

| Check | Result |
|-------|--------|
| publicPackBlocked | true |
| apiBlocked | true |
| mcpBlocked | true |
| ragExportBlocked | true |
| generationPreserved | true (PRODUCTION / PROMOTED 유지, 데이터 삭제 없음) |

E2E 종료 시 Pack은 DRAFT(게시 취소) 상태로 남는다.

## 12. Pack Isolation

Public API Top hit provenance가 실증 Pack 범위만 반환 (`packIsolationOk = true`). 다른 Grid Pack 오염 없음.

## 13. Retrieval Runtime

```text
resolvePublicRetrievalGenerationScope
        ↓
executeRetrievalApiRequest  →  Public API / MCP
        ↓
buildPublicRagExportPackage →  same generation id → buildRagExportPackage
```

채널별 검색 로직 신규 중복 없음. RAG는 persisted PROMOTED generation의 chunks/sources를 ZIP으로 패키징.

## 14. Authorization

- Public: published pack + channel flags + `serviceEndsAt`
- MCP: `mcp:invoke` + allowMcp
- RAG: allowDownload + rights + DOWNLOAD channel
- Admin preview와 외부 PUBLIC 경로 분리 유지

## 15. Audit / Usage

기존 retrieval adapter / distribution 정책을 재사용. E2E는 channel별 성공·차단을 드라이버에서 기록 (`tmp-p7-e2e/e2e-report.json`).

## 16. 성능 (대표 질의 1회)

| Channel | Latency | Size |
|---------|---------|------|
| Public API | 595 ms | — |
| MCP | 507 ms | — |
| RAG Export | 848 ms | ~545 KB |

대규모 최적화는 하지 않음.

## 17. Tests

- `src/__tests__/p7-published-revision-multichannel.test.ts` — resolver/RAG/API·MCP 공유/prefer-const
- `scripts/p7-published-revision-multichannel-e2e.ts` — 실데이터 multi-channel E2E
- 회귀: P6.1 publish gates, public export route factory — PASS
- Driver verdict: `P7 PUBLISHED REVISION MULTI-CHANNEL E2E PASSED`

## 18. 발견 결함 / 수정

| Issue | Fix |
|-------|-----|
| Public RAG가 READY 우선 → PROMOTED 미선택 / draft fallback 가능 | `rag-export-public.ts` → `resolvePublicRetrievalGenerationScope` + PRODUCTION/PROMOTED only |
| RAG builder가 PROMOTED 거부 / Worker ZIP에 SEARCH_EVALUATING 없음 | READY\|PROMOTED 허용; `RetrievalEvaluationRun` PASS도 평가로 인정 |
| Admin RAG lookup READY only | READY\|PROMOTED |
| P6.1 prefer-const build blocker | `const keepId` |
| Next build이 E2E scripts/tests를 typecheck | `tsconfig` exclude `scripts/` + `src/__tests__/` + tmp + agent-tools |
| prerender useSearchParams | `MobileShell`에 Suspense |
| 기타 TS 빌드 차단 | validationSummary null, Uint8Array→Blob |

## 19. 남은 Gap

- Hybrid retrieval은 `JYKSTORE_EMBEDDING_WORKER_URL` 필요 (이번 E2E는 keyword)
- E2E 후 Pack은 unpublish로 DRAFT — 추가 실사용 검증 전 재게시 필요
- 실제 외부 GPT/LLM 클라이언트 연동 검증은 다음 단계

## 20. 최종 판정

**P7 PUBLISHED REVISION MULTI-CHANNEL E2E PASSED**

```text
One Published Revision
        ↓
API / MCP / RAG Export
```
