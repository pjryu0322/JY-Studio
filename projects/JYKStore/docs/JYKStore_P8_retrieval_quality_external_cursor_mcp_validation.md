# JYKStore P8 — Retrieval Semantic Quality + External Cursor/MCP Validation

## 최종 판정

| Phase | Verdict |
|-------|---------|
| P8.1 | **P8.1 RETRIEVAL SEMANTIC QUALITY PASSED** |
| P8.2 | **P8.2 CURSOR/MCP EXTERNAL CLIENT VALIDATION PASSED** — [`JYKStore_P8_2_cursor_mcp_external_client_validation.md`](./JYKStore_P8_2_cursor_mcp_external_client_validation.md) / [`JYKStore_P8_2_1_cursor_mcp_live_e2e_completion.md`](./JYKStore_P8_2_1_cursor_mcp_live_e2e_completion.md) |

## 1. Base / Work Commit

| Item | Value |
|------|-------|
| Base | `21371fd8` — P7 published revision multi-channel E2E |
| Work | (this commit) |

## 2. 실증 Pack / Published Revision

| Field | Value |
|-------|-------|
| packId | `p431e2ems633k5n` |
| versionId | `cms633k7p0002unqsjrdlmm5g` |
| versionLabel | `v6.0-e2e` |
| Published Revision | `5a2a0a02-15a5-4531-8155-4079498f0de2` (PRODUCTION / PROMOTED) |
| ZIP | `C:\doc\JYKStore\rMateGridH5Web_v6.0_EN_Trial.zip` |

## 3. OLAPAttribute 분석

대표 질문: `셀 병합과 관련된 기능이나 API를 찾아줘`

### Before (P7 / 보정 전)

| Field | Value |
|-------|-------|
| Top-1 | **OLAPAttribute** (score 10) |
| source path | `Docs/api/OLAPAttribute.html` |
| matchReasons | `query:관련된` |
| 원문 요지 | OLAPDimension의 attribute 클래스 (큐브 flat data ↔ level). **셀 병합과 무관** |

### 적정성 판정

**부적절 (false positive).** 이름은 오류가 아니라 원문이 OLAP용이며, 셀 병합 질문의 근거로 부적합.

적절한 근거 (원문 확인):

| Title | Path | 근거 |
|-------|------|------|
| SpanMergingField | `Docs/api/SpanMergingField.html` | “DataGrid에서 병합할 개별 필드를 정의” |
| SpanSummaryCollection | `Docs/api/SpanSummaryCollection.html` | `mergingFields` / SpanMergingField |
| SpanArrayCollection | `Docs/api/SpanArrayCollection.html` | “병합정보를 포함하는 배열…” |
| Summary MergeJsFunction | `Samples/Summary_MergeJsFunction.html` | SpanMergingField + mergingJsFunction 예제 |

### After (보정 후)

Top 결과: `Summary MergeJsFunction`, `SpanMergingField` (Published Revision 동일). OLAPAttribute는 셀 병합 Top-K에서 제외.

## 4. 문제 분류

| Layer | 내용 |
|-------|------|
| **QUERY** | 공백 토큰화가 조사 부착 (`병합과`, `api를`) / 대화형 stopword 미제거 (`관련된`이 OLAP 본문 우연 매칭) |
| **INDEX** | `sortOrder` 앞쪽 스캔(≤1000)으로 Span* 고득점 청크 미수집 |
| **RANKING** | Index/DataGrid가 일반 토큰(`api`, `grid`)에 과도 매칭 |

`SOURCE / STRUCTURE / CHUNK / LABEL / DUPLICATE` 는 이번 대표 오답의 주원인이 아님 (원문·청크는 정상, 검색 경로 문제).

## 5. 평가 질문 / Ground Truth

12문항 (기능/API, 속성, 이벤트, 코드, 문제해결, 유사개념, KO/EN).  
GT는 Published Pack 원문(`Docs/api/*`, `Samples/*`) 기준.

드라이버: `scripts/p8-retrieval-quality-eval.ts`  
산출: `tmp-p8-e2e/p8-eval-report.json` (로컬, 커밋 제외)

## 6. Before 지표

대표 질문 + 동일 keyword 경로 기준 (보정 전 probe):

| Metric | Before |
|--------|-------:|
| Hit@1 (대표 병합 질문) | 0 (OLAPAttribute) |
| Hit@3 / Hit@5 (대표) | 0 |
| Wrong-pack | 0 |
| 비고 | SpanMergingField keyword score = 0 (`병합과` 불일치) |

## 7. 보정

Published Gate / Correction Workbench 재게시 없이 **QUERY + INDEX 수집** 최소 수정:

1. `src/lib/search-utils.ts`
   - 한국어 조사/`할` strip
   - 일반 stopword (관련/기능/api/grid 등)
   - 소규모 한·영 synonym (`병합`↔`merge`/`merging`)
   - `?` 등 구두점 정규화
2. `src/lib/retrieval/retrieval-candidate-store.ts`
   - query token DB prefilter
   - **title/tag 우선** 수집 후 content 보강 (sortOrder 편향 완화)
3. `retrieval-service.ts` — `queryTokens` 전달

질문 hard-code / rMate 전용 랭커 / threshold 임의 조정 / Published Gate 우회 없음.

## 8. After 지표 / 회귀

| Metric | Before (대표) | After (12문항 suite) |
|--------|-------------:|---------------------:|
| Hit@1 | 0 | **1.00** |
| Hit@3 | 0 | **1.00** |
| Hit@5 | 0 | **1.00** |
| MRR | 0 | **1.00** |
| No-hit | 1 (대표) | **0** |
| Wrong-pack | 0 | **0** |

전체 suite 악화 없음. OLAP 전용 질문(`OLAPAttribute displayName`)은 계속 OLAPAttribute를 적중.

## 9. MCP 구성

| Item | Status |
|------|--------|
| Bridge | `mcp-server/` stdio/http → `POST /api/v1/mcp/retrieval/query` |
| Adapter | `executeRetrievalApiRequest(serviceChannel=MCP, PUBLIC)` |
| Docs | `docs/mcp-runtime-ops-guide.md` |
| 인증 | API key (`context:read` / `mcp:invoke`) — 값 미기록 |

## 10. Cursor 연결

이 환경에서 Cursor `mcpServers.jykstore` 설정·실제 MCP tool invocation **확인되지 않음** (MCP tools catalog에 JYKStore 서버 없음).

따라서 외부 Cursor A/B를 성공으로 기록하지 않음.

## 11. A/B 결과

| Arm | 상태 |
|-----|------|
| A — Cursor 자체 지식 | **미실시** (외부 Cursor 세션 없음) |
| B — Cursor → JYKStore MCP | **미실시** |

In-process MCP 채널 smoke (동일 Published Revision):

- query: 대표 병합 질문
- titles: Summary MergeJsFunction / SpanMergingField
- servedRevision: `5a2a0a02-15a5-4531-8155-4079498f0de2`
- latency ~2.3–2.4s

## 12. MCP 호출 증거

| 증거 | 결과 |
|------|------|
| Cursor MCP request log | 없음 → PENDING 사유 |
| In-process MCP adapter | PASS (`serviceChannel=MCP`) |
| pack/version/revision | 실증 Pack + Published Revision |

## 13. Revision / Pack isolation

- MCP smoke servedRevision = Published Revision
- Wrong-pack = 0 (GT suite)
- Draft/READY 미사용

## 14. Hallucination

외부 Cursor 답변 미실시로 SUPPORTED 분류표는 보류.  
Store 검색 Top 근거는 원문 API/Sample과 대조해 **SUPPORTED** (SpanMergingField / Summary MergeJsFunction).

## 15. 실패 원인 분류 (P8.2)

| Code | Count | Note |
|------|------:|------|
| STORE_RETRIEVAL | 0 (after) | P8.1에서 보정 |
| STORE_CONTEXT | 0 | — |
| LLM_REASONING | 0 | 미실시 |
| CLIENT_INTEGRATION | 1 | Cursor MCP 미연결 → PENDING |

## 16. 성능 / 보안

| Item | Value |
|------|-------|
| 대표 MCP latency | ~2.3s |
| 대표 API keyword | ~2.3–3.7s |
| Auth / Published-only / channel flags | 유지 |
| Secrets in git/report | 없음 |

## 17. Tests

- `src/__tests__/p8-retrieval-quality-tokenize.test.ts`
- `scripts/p8-retrieval-quality-eval.ts` / `scripts/p8-olap-probe.ts`
- TS / lint / build / Prisma validate

## 18. 변경 파일

- `src/lib/search-utils.ts`
- `src/lib/retrieval/retrieval-candidate-store.ts`
- `src/lib/retrieval/retrieval-types.ts`
- `src/lib/retrieval-service.ts`
- `src/__tests__/p8-retrieval-quality-tokenize.test.ts`
- `scripts/p8-*.ts`
- `docs/JYKStore_P8_retrieval_quality_external_cursor_mcp_validation.md`

## 19. 남은 Gap

- Cursor에 JYKStore MCP 등록 후 A/B·hallucination 실증
- Hybrid retrieval (embedding worker) 미사용 — keyword 경로만
- 일부 질의 latency (대량 ILIKE) 추가 최적화 여지

## 20. P8.1 / P8.2 판정

- **P8.1 RETRIEVAL SEMANTIC QUALITY PASSED**
- **P8.2 EXTERNAL CLIENT VALIDATION PENDING**
