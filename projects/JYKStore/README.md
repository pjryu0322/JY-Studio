# JYKStore

JYKStore는 AI가 활용할 수 있는 제품·솔루션·API 연동 지식을 지식팩 형태로 제공하는 앱스토어형 지식팩 스토어입니다.

## 실행

```bash
npm install
npm run dev
```

접속:

```text
http://localhost:3004
```

## 핵심 원칙

- JYKStore는 독립 서비스입니다.
- JYKStore 이외 프로젝트를 수정하지 않습니다.
- 실행 포트는 3004입니다.
- UX는 모바일 앱스토어형 지식팩 스토어를 기준으로 합니다.
- 사용자는 지식팩 선택 → 내 지식팩에 추가 → 연동하기 흐름으로 사용할 수 있어야 합니다.

## 현재 구현 범위

- 모바일 앱스토어형 Today 화면
- 검색 진입 화면
- 카테고리 화면
- 계정 화면 Scaffold
- Mock 지식팩 데이터

## Phase 2 구현 범위

- 전체 지식팩 목록
- 지식팩 상세 화면
- 카테고리별 지식팩 목록
- Mock 데이터 기반 검색
- 앱스토어형 지식팩 상세 UX

## Phase 3 구현 범위

- 내 지식팩 추가·목록·연동하기 UX (저장은 Phase P2에서 서버 DB로 전환)
- Pack ID / Endpoint / Mock API Key 복사
- cURL, JavaScript, Java/Spring, Python 예시 코드 복사
- Cursor Prompt, Generic LLM Prompt 예시 복사

## Database Foundation

JYKStore는 제품 데이터 저장소로 PostgreSQL을 사용합니다.

### 환경변수

```env
DATABASE_URL="postgresql://jykstore:jykstore@localhost:5432/JYKStore?schema=public"
```

`.env.example`을 참고해 `projects/JYKStore/.env`에 `DATABASE_URL`을 설정한 뒤 마이그레이션과 seed를 실행합니다.

### Prisma 명령

```bash
npm run db:generate
npm run db:migrate
npm run db:seed
npm run db:studio
```

### 제품화 데이터 원칙

- 내 지식팩, API Key, 사용량, 지식팩 버전, 원천자료, 청크는 서버 DB에 저장합니다.
- 내 지식팩은 `PackInstallation`과 anonymous `clientId` cookie로 관리합니다.
- 기존 mock 데이터는 후속 단계에서 DB/API 조회로 제거합니다.

## Phase P2 구현 범위

- anonymous `clientId` httpOnly cookie
- `GET/POST /api/v1/my-packs`, `DELETE /api/v1/my-packs/[packId]`
- `PackInstallation` DB 저장
- `MyPacksProvider` 및 API 기반 `useMyPacks`

## Pack Catalog DB 전환

- 지식팩 목록, 상세, 카테고리, 검색은 DB 기준으로 조회합니다.
- `mock-packs.ts`, `mock-categories.ts`는 seed 호환용으로만 유지합니다.

### Pack Catalog 공개/설치 정책

- 일반 사용자 화면에는 `PUBLISHED`, `VERIFIED` 상태 지식팩만 노출합니다.
- 내 지식팩 추가도 `PUBLISHED`, `VERIFIED` 상태만 허용합니다.
- `DRAFT`, `REVIEWING`, `DEPRECATED`, `SUSPENDED` 상태는 일반 사용자 화면과 설치 대상에서 제외합니다.
- 검색은 검색어 없이 chip만 선택해도 DB 기준으로 필터링됩니다.

## API Key 정책

- API Key 원문은 생성 직후 1회만 표시합니다.
- DB에는 `keyPrefix`, `keyHash`만 저장합니다.
- API Key 원문은 LocalStorage/sessionStorage에 저장하지 않습니다.
- 폐기된 API Key는 인증에 사용할 수 없습니다.
- Context API는 `Authorization: Bearer <API_KEY>` 방식으로 인증합니다.

## Context API

외부 AI 도구는 API Key를 사용해 지식팩 context를 조회할 수 있습니다.

### 인증

```http
Authorization: Bearer <JYKSTORE_API_KEY>
```

### Context 조회

```bash
curl -X GET "http://localhost:3004/api/v1/packs/easy-auth/context?limit=10" \
  -H "Authorization: Bearer <JYKSTORE_API_KEY>"
```

### 응답

- pack metadata
- context summary
- ordered knowledge chunks
- requestId
- chunkCount

### 제한

- 현재 단계는 DB 기반 chunk 조회입니다.
- Vector DB/RAG 검색은 이후 Phase에서 제공합니다.
- API Key에는 `context:read` scope가 필요합니다.

## Context API Usage Logging

Context API 호출은 `ApiUsageLog`에 기록됩니다.

기록 항목:

- requestId
- apiKeyId
- packId
- endpoint
- method
- query
- usedChunks
- statusCode
- latencyMs
- metadata

보안 정책:

- API Key 원문은 로그에 저장하지 않습니다.
- Authorization 헤더 전체는 로그에 저장하지 않습니다.
- keyHash는 응답과 로그에 저장하지 않습니다.
- 민감한 metadata key는 `[REDACTED]` 처리합니다.

오류 응답의 `usage.requestId`와 DB의 `ApiUsageLog.requestId`를 통해 문제를 추적할 수 있습니다.

## Provider Center

Provider Center는 지식팩 제공자가 프로필을 등록하고 지식팩 초안을 작성하는 공간입니다.

현재 단계:

- clientId cookie 기준 임시 제공자 식별
- ProviderProfile 등록/수정
- DRAFT 지식팩 생성
- SourceDocument 메타데이터 등록
- REVIEWING 상태로 검수 요청

제한:

- Admin 승인/반려는 Admin Console에서 처리합니다.
- 파일 업로드와 자동 청킹은 Phase P8에서 구현합니다.
- DRAFT/REVIEWING 지식팩은 일반 카탈로그와 Context API에 노출되지 않습니다.

## Context API Test Console

JYKStore는 지식팩 연동 화면에서 Context API 테스트 콘솔을 제공합니다.

테스트 위치:

- `/my-packs/[packId]/connect`

확인 가능한 항목:

- API Key 유효성
- `context:read` scope 여부
- packId 유효성
- HTTP status
- requestId
- chunkCount
- 응답 JSON

보안 정책:

- API Key 원문은 테스트 입력 중 React state에만 보관합니다.
- API Key 원문은 LocalStorage/sessionStorage에 저장하지 않습니다.
- API Key 원문은 URL query로 전달하지 않습니다.
- 새로고침하면 입력한 API Key는 사라집니다.

## Selected Pack API Key Issue & Test Console

JYKStore는 지식팩 연동 화면에서 선택한 지식팩 기준으로 API Key를 발급하고 Context API를 테스트할 수 있습니다.

위치:

- `/my-packs/[packId]/connect`

흐름:

1. 지식팩을 내 지식팩에 추가합니다.
2. 연동 화면으로 이동합니다.
3. “이 지식팩 연동용 API Key 발급”을 선택합니다.
4. 발급된 API Key를 복사합니다.
5. 같은 화면의 Context API 테스트 패널에서 바로 호출합니다.

확인 가능한 항목:

- API Key 유효성
- `context:read` scope 여부
- packId 유효성
- HTTP status
- requestId
- chunkCount
- elapsedMs
- 응답 JSON

보안 정책:

- API Key 원문은 생성 직후 1회만 표시합니다.
- 테스트 패널의 API Key는 React state에만 보관합니다.
- API Key 원문은 LocalStorage/sessionStorage에 저장하지 않습니다.
- API Key 원문은 URL query로 전달하지 않습니다.
- 새로고침하면 입력한 API Key는 사라집니다.

제한:

- 현재 API Key는 clientId 기준이며 packId 전용 권한 바인딩은 아닙니다.
- packId 전용 API Key 정책은 이후 별도 Phase에서 검토합니다.

## Admin 검증 체계

JYKStore는 Provider Center에서 제출된 REVIEWING 지식팩을 Admin Console에서 검수할 수 있습니다.

위치:

- `/admin`
- `/admin/reviews/[packId]`

현재 단계:

- REVIEWING 지식팩 목록 조회
- 검수 상세 확인
- SourceDocument preview 확인
- 승인 처리
- 반려 처리
- 검수 메모 및 AuditLog 기록

상태 전환:

- 승인: `REVIEWING → PUBLISHED` (또는 `VERIFIED`)
- 반려: `REVIEWING → DRAFT`

노출 정책:

- `PUBLISHED`, `VERIFIED` 지식팩만 일반 카탈로그와 Context API에 노출됩니다.
- `DRAFT`, `REVIEWING` 지식팩은 일반 카탈로그와 Context API에 노출되지 않습니다.

제한:

- 현재 Admin Console은 MVP 내부 검증 도구입니다.
- 실제 운영 환경에서는 관리자 인증과 권한 제어가 필요합니다.

## Ingestion & Chunk Pipeline

JYKStore는 SourceDocument content를 KnowledgeChunk로 변환해 Context API에서 사용할 수 있도록 관리합니다.

현재 단계:

- SourceDocument content 기반 규칙 청킹
- 수동 chunk 생성
- chunk 수정
- chunk 비활성화
- Admin Console에서 chunk 품질 확인
- Admin Console에서 chunk의 section, tags, sortOrder, 활성 상태를 수정할 수 있습니다.
- Context API는 활성 chunk만 반환

위치:

- `/admin/reviews/[packId]`

정책:

- `KnowledgeChunk.isActive = true`인 chunk만 Context API에 노출됩니다.
- 비활성 chunk는 삭제하지 않고 Context API에서 제외합니다.
- SourceDocument content가 없는 경우 chunk를 생성할 수 없습니다.
- 파일 업로드·PDF 파싱은 아직 제공하지 않습니다. 검색용 embedding은 local-hash foundation(P14)로 제공하며, 외부 embedding API·pgvector·RAG 답변 생성은 포함하지 않습니다.

## 검색 고도화

JYKStore는 DB 기반 keyword/metadata 검색과 local-hash embedding hybrid retrieval foundation을 제공합니다.

현재 검색 구성:

- keyword retrieval
- metadata filter AND candidate 제한
- local-hash embedding 기반 hybrid retrieval foundation (`KnowledgeChunkEmbedding`, `retrievalMode`: `keyword` | `hybrid`)
- embedding rebuild Admin API/UI

현재 단계:

- 지식팩 카탈로그 keyword ranking
- Context API query ranking
- chunk title/content/section/tags/chunkType 가중치 적용
- Context API metadata에 score/matchReasons 제공
- Admin Chunk Manager에서 chunk 검색 지원
- Admin Chunk Manager 검색은 공백 기준 token 검색을 지원합니다.
- Context API usage log의 query는 100자 이하로 제한해 저장합니다.

정책:

- hybrid ranking은 keyword/metadata score와 cosine similarity를 결합합니다(P14 foundation).
- external embedding provider, pgvector index, answer generation(RAG)은 아직 제공하지 않습니다.
- 검색 ranking은 설명 가능한 score와 matchReasons를 우선합니다.
- `includeMetadata=false`이면 score/matchReasons/source 등 metadata성 정보는 응답에서 제외됩니다.

## API 문서/SDK

JYKStore는 지식팩을 외부 서비스에서 사용할 수 있도록 Context API 문서와 TypeScript SDK 샘플을 제공합니다.

위치:

- `/docs`
- `/docs/api`
- `/docs/api/context`
- `/docs/sdk`

현재 단계:

- Context API GET/POST 사용 문서
- API Key 인증 방식 문서
- 요청/응답 JSON 예제
- 오류 코드 표
- curl/fetch 예제
- TypeScript SDK 샘플 (`sdk/typescript/`)

정책:

- SDK는 현재 npm package가 아니라 복사해 사용할 수 있는 샘플 코드입니다.
- API Key는 서버 환경변수에 저장해야 합니다.
- API Key를 LocalStorage/sessionStorage 또는 URL query에 저장하거나 전달하지 않습니다.

## 보안·운영·관측성

JYKStore는 내부 운영자가 API 사용량, AuditLog, Health 상태를 확인할 수 있는 운영 콘솔을 제공합니다.

위치:

- `/admin/ops`
- `/admin/ops/usage`
- `/admin/ops/audit`
- `/admin/ops/health`

현재 단계:

- API UsageLog summary
- UsageLog 목록 조회
- AuditLog 목록 조회
- DB/Context API Health 상태
- 오류율 및 평균 latency 확인
- endpoint별 호출 수 확인
- soft rate limit 정책 표시

정책:

- 현재 Admin Ops Console은 MVP 내부 운영 도구입니다.
- 실제 운영 환경에서는 관리자 인증과 권한 제어가 필요합니다.
- API Key 원문과 Authorization header는 저장하거나 표시하지 않습니다.
- 현재 rate limit은 전체 무료 정책에 맞춰 soft policy로 표시하며 API 호출을 차단하지 않습니다.

## Free Plan & Billing Foundation

JYKStore는 현재 전체 무료 정책을 기본으로 합니다.

위치:

- `/account/plan`
- `/admin/ops/plans`

현재 단계:

- Free Plan policy
- 전체 무료 이용 상태 표시
- Context API 사용량 summary
- soft warning 기준 표시
- billing/payment disabled 상태 표시
- 향후 유료화 확장 필드 준비

정책:

- 현재 모든 사용자는 Free Plan입니다.
- API 호출은 사용량 초과로 차단하지 않습니다.
- 실제 결제, 카드 등록, PG 연동은 제공하지 않습니다.
- 사용량은 운영 참고용으로만 집계합니다.
- 현재 P12는 DB billing model이 아니라 Free Plan policy foundation입니다.
- 실제 결제/청구/사용자별 plan assignment는 향후 별도 단계에서 확장합니다.

## Knowledge Retrieval Engine Foundation

JYKStore는 답변을 생성하지 않고 context를 반환하는 Context / Retrieval Provider입니다.

- Metadata Filter 기반 Retrieval API 추가
- `POST /api/v1/retrieval/query`
- Context API는 간단한 context 제공용으로 유지
- Retrieval API는 metadata 기반 고급 검색 제어용
- Chunk metadata(JSON) 필드 추가로 metadata filter 지원
- 검색 결과는 keyword + metadata ranking과 hybrid vector similarity foundation(P14)을 지원합니다. external embedding provider·pgvector·답변 생성은 미포함입니다.

위치:

- `/docs/api/retrieval`
- `POST /api/v1/retrieval/query`

요청 필드:

- `knowledgePackId` (필수)
- `query` (선택, keyword ranking)
- `filters` (선택, 허용된 metadata key만 허용, 그 외 key는 400)
- `topK` (선택, 기본 8, 1~20)
- `includeMetadata` (선택, 기본 true)

정책:

- filters는 점수 가산 조건이 아니라 후보 제한(AND) 조건입니다. filters가 지정되면 모든 metadata 조건을 만족한 chunk만 ranking 대상이 됩니다.
- query가 있어도 metadata filter를 통과하지 못한 chunk는 결과에 포함되지 않습니다.
- metadata는 허용된 key만, string 또는 string[] 값으로만 저장/조회합니다. alias(`language`, `version`)는 canonical key로 정규화합니다.
- chunk metadata는 Admin Chunk Manager에서 JSON으로 입력·수정·조회할 수 있습니다.
- Retrieval API request는 잘못된 타입/필드일 경우 400 `INVALID_RETRIEVAL_REQUEST`로 응답합니다.
- 비활성 chunk는 Retrieval API에서도 노출하지 않습니다.
- API 인증은 Context API와 동일하게 Bearer API Key를 사용합니다.
- packId 전용 API Key 권한은 향후 확장 예정입니다.

### P13.2 — Metadata 일괄 편집 / 후보 limit 개선

- Admin Chunk Manager에서 chunk를 선택해 metadata를 일괄 적용할 수 있습니다. (`PATCH /api/v1/admin/packs/{packId}/chunks/bulk-metadata`)
- 적용 모드: `merge`(병합) / `replace`(교체) / `clear`(제거). sensitive/허용 외 key는 저장되지 않습니다.
- Retrieval 후보 수집을 paging 방식으로 개선해 metadata filter 조건이 앞쪽 500개 밖에 있어도 누락을 완화합니다.
- usage log에 `scannedCandidateCount`, `filteredCandidateCount`를 남깁니다.

### P14 — Vector Retrieval Extension (foundation)

- `KnowledgeChunkEmbedding` 모델 추가 (chunk별 vector 저장, JSONB).
- local-hash embedding provider(`local-hash-v1`)로 deterministic vector를 생성합니다. **외부 embedding API 호출이 아니라 dev/foundation provider입니다.**
- Admin Chunk Manager의 embedding 상태 카드에서 missing/stale embedding을 확인하고 재생성할 수 있습니다. (`GET /api/v1/admin/packs/{packId}/embeddings`, `POST .../embeddings/rebuild`)
- chunk의 title/content/section/tags/metadata 기준 `contentHash`로 stale embedding을 판정합니다.
- Retrieval API는 `retrievalMode`(`keyword` | `hybrid`)를 지원합니다. 미지정 시 query가 있으면 hybrid로 동작합니다.
- 처리 순서: metadata filter(AND) → keyword score → (hybrid) vector similarity → topK. metadata filter는 항상 vector ranking보다 먼저 적용됩니다.
- hybrid score = keywordScore + metadataScore + cosineSimilarity × 100. embedding이 없는 chunk는 keyword/metadata score로 fallback합니다.
- P14는 외부 LLM/embedding API 호출, pgvector, RAG/답변 생성을 포함하지 않습니다.

### P14.1 — Retrieval Quality Polish

- query-only / hybrid 검색도 첫 500개 chunk에 한정하지 않고 candidate paging scan(최대 5,000개)을 수행합니다.
- filters는 metadata AND 조건으로 ranking 전에 선적용됩니다.
- candidate 수집 방식을 `candidateCollectionMode`(`default-page` / `metadata-filter` / `query-scan`)로 usage에 기록합니다. `scannedCandidateCount`/`filteredCandidateCount`도 함께 기록됩니다.
- hybrid는 embedding이 있는 chunk에 vector similarity를 가산하고, embedding이 없으면 keyword/metadata score로 fallback합니다. embedding 미생성 상태에서도 Retrieval API는 실패하지 않습니다.
- embedding contentHash는 title/content/section/tags 기준으로만 계산합니다. metadata는 filter 조건으로만 사용되므로 embedding stale 판정에서 제외합니다. (metadata만 변경해도 stale로 표시되지 않음)

### P15 — Knowledge Graph / Export Foundation

- **Knowledge Graph Foundation**: `KnowledgeGraphNode` / `KnowledgeGraphEdge` 모델을 추가하고, 기존 pack/version/source/chunk/tag/metadata를 deterministic 방식으로 node/edge 그래프로 재구성합니다. 외부 LLM/AI 호출 없이 DB 데이터만 사용합니다.
  - node type: `PACK` / `VERSION` / `SOURCE_DOCUMENT` / `CHUNK` / `TAG` / `METADATA_VALUE`
  - edge type: `PACK_HAS_VERSION` / `VERSION_HAS_SOURCE_DOCUMENT` / `VERSION_HAS_CHUNK` / `SOURCE_DOCUMENT_HAS_CHUNK` / `CHUNK_HAS_TAG` / `CHUNK_HAS_METADATA` / `CHUNK_REFERENCES_SOURCE_DOCUMENT`
  - deterministic externalId(`pack:` / `version:` / `chunk:` / `tag:` / `metadata:` 등)로 중복 생성을 방지하며, metadata는 허용 canonical key + string/string[] 값만(민감 key 제외) graph에 반영합니다.
  - graph rebuild는 transaction 기반으로 기존 `AUTO_DETERMINISTIC` node/edge를 삭제 후 재생성합니다. 기존 pack/version/source/chunk/embedding 데이터는 수정하지 않습니다.
- **외부 AI 호출 방향 정리**: JYKStore 서버는 OpenAI/Claude/Gemini/EXAONE 같은 외부 AI Provider를 **직접 호출하지 않습니다.** 반대로 외부 AI 도구·LLM Agent·OpenAI GPTs·Cursor/Copilot·타 플랫폼이 JYKStore public API를 Bearer API Key로 호출해 context/graph/export data를 가져가는 구조는 지원합니다.
- **Graph API**
  - `GET /api/v1/admin/packs/{packId}/graph` — graph summary (node/edge count, type별 count)
  - `POST /api/v1/admin/packs/{packId}/graph/rebuild` — deterministic rebuild
  - `POST /api/v1/graph/query` — (public) API Key(`context:read` scope) 인증. label/summary/externalId contains 검색으로 node/edge 조회. graph traversal·semantic search·답변 생성은 하지 않습니다.
- **Export Foundation** (신규 라이브러리 없이 JSON/JSONL 응답 기반)
  - Public API (외부 클라이언트 호출용, Bearer API Key `context:read`):
    - `GET /api/v1/exports/package?knowledgePackId={packId}` — `JYKSTORE_PACKAGE_JSON`
    - `GET /api/v1/exports/rag-jsonl?knowledgePackId={packId}` — 외부 RAG 시스템 import용 line-delimited JSON
    - `GET /api/v1/exports/graph?knowledgePackId={packId}` — `JYKSTORE_GRAPH_JSON`
    - `GET /api/v1/exports/mcp-manifest?knowledgePackId={packId}` — `JYKSTORE_MCP_READY_MANIFEST`
    - `knowledgePackId`가 없거나 비어 있으면 400(`INVALID_EXPORT_REQUEST`), 인증 실패 시 401/403을 반환합니다.
  - Admin UI API (관리자 화면 다운로드용): `GET /api/v1/admin/packs/{packId}/exports/{package|rag-jsonl|graph|mcp-manifest}`
  - **MCP-ready Manifest는 실제 MCP Server가 아니라** 외부 Agent/MCP wrapper가 JYKStore API 호출 시 참조하는 계약서(manifest)이며 실제 API Key를 포함하지 않습니다.
  - package export는 raw embedding vector 제외, chunk content/metadata는 포함. Export/Graph에는 API Key, 사용자 정보, 과금 정보, audit log 등 민감 정보를 포함하지 않습니다.
- **Admin UX**: 검수 상세 화면에 `KnowledgeGraphPanel`(graph 상태/type별 count/rebuild), `ExportPanel`(4종 export 다운로드)을 추가했습니다. 시각화 라이브러리는 추가하지 않고 table/list UX로 제공합니다.
- JYKStore는 여전히 **답변을 생성하지 않고 context / graph / export data만 제공**합니다.

### P15.1 — Public API Security Polish

- 모든 public API(Retrieval / Graph Query / Export)는 **`PUBLISHED` 또는 `VERIFIED` 상태의 지식팩만** 반환합니다. `DRAFT` / `REVIEW` / `REJECTED` / `ARCHIVED` 등 비공개 상태는 존재 여부를 노출하지 않기 위해 `PACK_NOT_FOUND`(404)로 처리합니다(403 미사용).
  - 공개 상태 기준은 `src/lib/knowledge-pack-public.ts`의 `PUBLIC_PACK_STATUSES`로 통일했으며, Retrieval API의 published 기준과 동일합니다.
  - 적용 함수: `queryKnowledgeGraph`, `exportKnowledgeGraph`, `buildPackageExport`, `buildRagJsonlExport`, `buildGraphExport`(exportKnowledgeGraph 경유), `buildMcpReadyManifest`.
  - Admin graph summary/rebuild(`/api/v1/admin/packs/{packId}/graph`, `/graph/rebuild`)는 내부 관리 기능이므로 기존 client cookie 흐름을 유지합니다(DRAFT 상태에서도 rebuild 가능).
- **MCP-ready manifest self resource**: `resources`에 자기 자신(`mcp-manifest`, `/api/v1/exports/mcp-manifest?knowledgePackId=...`, `Bearer API Key`)을 추가했습니다.

### P15.2 — OpenAPI Schema Export

- 외부 GPT Actions / Gemini function calling / Cursor·MCP wrapper / 일반 Agent가 JYKStore Public API를 쉽게 연동할 수 있도록 OpenAPI 3.1 schema를 제공합니다.
  - `GET /api/v1/openapi.json` — JYKStore Public API 공통 schema. **schema discovery 용도로 인증이 필요 없습니다.** schema 내 각 operation에는 `BearerAuth`(http bearer, `bearerFormat: JYKStore API Key`) 보안 스키마가 명시됩니다.
  - `GET /api/v1/exports/openapi?knowledgePackId={packId}` — 특정 지식팩 특화 schema. Bearer API Key(`context:read`) 인증이 필요하고 PUBLISHED/VERIFIED pack만 반환하며(비공개는 `PACK_NOT_FOUND` 404), `info.title`/example에 packId가 반영됩니다.
  - 포함 paths: `POST /api/v1/retrieval/query`, `POST /api/v1/graph/query`, `GET /api/v1/exports/{package,rag-jsonl,graph,mcp-manifest}`.
- schema에는 실제 API Key를 포함하지 않고 dummy(`jyk_live_xxx`)만 사용하며, API Key는 Authorization 헤더로만 문서화합니다.
- 연동 예:
  - Custom GPT Actions / Gemini function calling: 위 schema를 등록해 JYKStore API를 호출하고 반환된 context로 답변을 생성합니다.
  - Cursor / MCP wrapper: OpenAPI schema 또는 MCP-ready manifest 기반 wrapper 구성이 가능합니다. **현재 제공**: MCP-ready manifest. **아직 미제공**: 실제 MCP Server runtime. **후속 예정**: P22 MCP Server Bridge.
- JYKStore는 여전히 답변을 생성하지 않고 외부 LLM Provider API를 직접 호출하지 않습니다.

### P15.3 — OpenAPI Schema & External AI Actions Docs Polish

- **Export response schema 정교화**: OpenAPI `components.schemas`에 `PackageExport`(+ manifest/pack/version/sourceDocument/chunk/graph/embedding 하위 schema), `GraphExport`, `KnowledgeGraphSummary`, `RagJsonlLine`, `McpReadyManifest`(+ tool/resource) schema를 추가하고, `/exports/package`·`/exports/graph`·`/exports/mcp-manifest`의 200 응답을 `additionalProperties` 대신 구체 schema(`$ref`)로 연결했습니다. `rag-jsonl`은 `application/x-ndjson` string을 유지하되 description에서 `RagJsonlLine` 준수를 명시합니다.
- **operationId 정리**(외부 AI tool 친화적 camelCase): `queryKnowledgePackContext`, `queryKnowledgePackGraph`, `exportKnowledgePackPackage`, `exportKnowledgePackRagJsonl`, `exportKnowledgePackGraph`, `exportKnowledgePackMcpManifest`, `exportKnowledgePackOpenApi`, (discovery) `getJYKStoreOpenApiSchema`.
- **외부 AI 도구 연동 방법 문서화**(README/`docs/api/retrieval`):
  1. **Custom GPT Actions**: 공개 pack packId 확인 → API Key(`context:read`) 발급 → OpenAPI schema(`/api/v1/openapi.json` 또는 `/api/v1/exports/openapi?knowledgePackId=...`) 등록 → Bearer 인증 설정 → `queryKnowledgePackContext` 호출 → GPT가 반환된 contexts로 답변 생성. API Key는 브라우저 스토리지에 저장하지 않습니다.
  2. **Gemini Function Calling**: 애플리케이션 레이어에서 OpenAPI schema를 function declaration/tool wrapper로 변환해 사용. JYKStore는 Gemini API를 직접 호출하지 않습니다.
  3. **Cursor / MCP wrapper**: OpenAPI schema 또는 MCP-ready manifest 기반 wrapper 구성. **현재 제공**: MCP-ready manifest. **아직 미제공**: 실제 MCP Server runtime. **후속 예정**: P22 MCP Server Bridge.
- 보안 문구 유지: Public API는 PUBLISHED/VERIFIED pack만 반환(비공개는 404 `PACK_NOT_FOUND`), 모든 operation은 Bearer API Key 사용, API Key 원문은 schema/manifest/export 응답에 포함하지 않음.

### P16 — Source Type & Pipeline Foundation

JYKStore를 검증된 제품지식팩 생산·검증·배포 플랫폼으로 발전시키기 위한 **제품화 파이프라인 foundation** 단계입니다. P16은 source type/format, 기본 source validation status, pipeline status, pipeline run/step log 기반을 구현하며, 고급 source validation·structure quality·chunk quality·retrieval evaluation·release gate 완성은 **P17~P21**에서 진행합니다.

**제품화 파이프라인 개요** (전체 목표 공정, P16은 상태/기록 기반만 구현):

```text
자료 등록 → 자료 유형 분류 → 원문 정합성 검증 → 구조화 → 구조 커버리지 검증
→ 지식 품질 검수 → 청킹 → 청킹 품질 평가 → 검색 데이터 구축 → 검색 품질 평가
→ 검토 제출 → 관리자 승인 → PUBLISHED / VERIFIED → Retrieval API 제공
```

- **자료 유형 표준화(SourceType enum)**: `PRODUCT_MANUAL`, `INTEGRATION_GUIDE`, `API_SPEC`, `OPENAPI_SCHEMA`, `ERROR_CODE_TABLE`, `SAMPLE_CODE`, `FAQ`, `RELEASE_NOTE`, `SECURITY_GUIDE`, `TEST_ENV_GUIDE`, `OPERATION_GUIDE`, `CALLBACK_GUIDE`, `TROUBLESHOOTING`, `ETC`. 기존 자유 문자열 `sourceType`은 enum으로 마이그레이션하며 원문은 `legacySourceType`에 보존합니다(알 수 없는 값은 `ETC`).
- **자료 형식 표준화(SourceFormat enum)**: `TEXT`/`MARKDOWN`/`HTML`/`PDF`/`DOCX`/`XLSX`/`CSV`/`JSON`/`YAML`/`OPENAPI_JSON`/`OPENAPI_YAML`/`CODE`/`URL`/`ETC`.
- **SourceDocument 확장**: `sourceFormat`, `fileName`, `mimeType`, `productVersion`, `documentVersion`, `licenseStatus`, `validationStatus`(NOT_CHECKED/PASS/WARNING/FAIL), `validationSummary`, `registeredByClientId`, `registeredAt`를 저장합니다.
- **기본 정합성 검증(deterministic)**: 등록 시 `title`·`sourceType` 필수, `content`/`sourceUrl` 중 하나 필수. 위반 시 `FAIL`로 등록을 차단합니다. `SAMPLE_CODE`의 `productVersion` 누락 등은 `WARNING`(등록 허용). 외부 AI/고급 검증은 P17에서 다룹니다.
- **PipelineStatus**: `KnowledgePack.pipelineStatus`로 공정 상태를 관리합니다. 값: `SOURCE_REGISTERING`, `SOURCE_VALIDATING`, `STRUCTURING`, `STRUCTURE_VALIDATING`, `KNOWLEDGE_CHECKING`, `CHUNKING`, `CHUNK_EVALUATING`, `INDEXING`, `SEARCH_EVALUATING`, `RELEASE_CHECKING`, `READY_FOR_REVIEW`, `REVIEWING`, `APPROVED`, `PUBLISHED`, `FAILED`.
- **PipelineRun / PipelineStepLog**: 공정 실행과 단계별 로그를 기록합니다(triggerType: `SOURCE_DOCUMENT_REGISTERED`, `SUBMIT_FOR_REVIEW`, `ADMIN_APPROVE`, `ADMIN_REJECT`).
  - SourceDocument 등록 → `SOURCE_REGISTERING` 단계 기록, `pipelineStatus=SOURCE_REGISTERING`.
  - 검수 제출 → `READY_FOR_REVIEW`/`REVIEWING` 단계 기록, `pipelineStatus=REVIEWING`.
  - 관리자 승인 → `APPROVED`/`PUBLISHED` 단계 기록, `pipelineStatus=PUBLISHED`.
  - 반려 → `REVIEWING` FAIL 단계 기록, `pipelineStatus=SOURCE_REGISTERING`.
- **Provider UI**: SourceDocument 등록 폼에 자료 유형/형식 선택과 유형별 설명, 부가 필드(URL/파일명/MIME/제품·문서 버전/라이선스/원문)를 추가했습니다. 상세 화면에 공정 상태·유형별 개수·검증 요약·검수 요청 가능 여부를 표시합니다.
- **Admin UI**: 검수 상세의 readiness에 `pipelineStatus`, source validation 요약(pass/warning/fail/notChecked), `sourceTypeCoverage`를 추가했습니다. `validationStatus=FAIL` 또는 `NOT_CHECKED` 문서가 있으면 제출·승인이 제한됩니다. `WARNING`은 제출·승인 가능하나 UI에 주의로 표시합니다. 구조화/청킹/검색 품질 gate는 P17~P21에서 강화 예정입니다.
- **Public API 영향 없음**: Retrieval / Graph / Export / OpenAPI public API의 path·응답 구조는 변경하지 않습니다. pipeline 필드는 Provider/Admin 내부 관리용입니다.

**이후 단계 예정**: P17 Source Validation, P18 Structure Coverage & Knowledge Quality, P19 Chunk Quality Evaluation, P20 Retrieval Evaluation, P21 Release Gate & Approval Hardening, **P22 MCP Server Bridge**.

### P16.1 — Documentation & Gate Polish

- README·API docs의 검색/MCP 단계 설명을 P14 hybrid retrieval foundation 및 P22 MCP Server Bridge 계획에 맞게 정리했습니다.
- 제출/승인 gate: `FAIL`·`NOT_CHECKED` 원천 문서는 차단, `WARNING`은 허용(주의 표시). legacy migrated `NOT_CHECKED` 방어 gate입니다.
- `SOURCE_TYPE_OPTIONS`에서 `requiredFields`와 `recommendedFields`를 분리(`SAMPLE_CODE`의 `productVersion`은 권장).
- pipeline 기록 실패 시 structured log(`[pipeline]`, packId, triggerType, targetStatus, error)를 남깁니다. main transaction rollback은 P21에서 재검토합니다.

### P17 — Source Validation Foundation

- **SourceValidationReport / SourceValidationIssue**: 원천 문서별 검증 실행 결과와 이슈 목록을 DB에 저장합니다.
- **sourceType/sourceFormat별 deterministic validation**: API 스펙·OpenAPI·오류 코드표·콜백 가이드·샘플 코드 등 유형별 규칙과 공통 정합성 검사를 수행합니다.
- **checksum 중복 검증**, **sourceUrl 형식 검증**(`new URL()`, 외부 fetch 없음), **content 최소 길이** 등 품질 힌트를 제공합니다.
- **민감정보/비밀키 패턴 1차 검출**: regex 기반 BLOCKER/WARNING(이메일·전화 등).
- **legacy `NOT_CHECKED` 재검증**: Provider·Admin API 및 UI에서 단건/전체 재검증 후 `validationStatus`/`validationSummary`를 갱신합니다.
- **Provider/Admin 검증 report UI**: 점수·이슈 건수·이슈 목록 표시, 재검증 버튼.
- **FAIL / NOT_CHECKED gate 유지**(P16.1): 제출·승인 차단 정책 동일, `WARNING` 허용.
- **외부 AI/LLM/API 호출 없음**, Public Retrieval/Graph/Export/OpenAPI 계약 변경 없음.

### P17.1 — Source Validation Precision & UI Polish

- **민감정보 패턴 정밀화**: OAuth/API 문서의 `client_secret`·`access_token`·`refresh_token` 필드명 설명은 BLOCKER 오탐을 줄이고 WARNING으로 안내. 실제 값 할당·PRIVATE KEY·Bearer 토큰 등은 BLOCKER 유지.
- **Provider issue 상세**: 원천 문서 목록에 최신 검증 이슈(severity/code/message/hint) 표시, `SourceValidationReportPanel` 재사용.
- **전체 재검증 pipeline**: pack 단위 1회 `PipelineRun`만 기록(문서별 `recordPipeline: false`), summary에 total/pass/warning/fail 집계.
- **checksum duplicate 테스트** 및 **재검증 버튼** 모바일 `min-h-[44px]` 보정.

### P18 — Structure Coverage & Knowledge Quality

- **KnowledgeStructureTemplate / Section**: `AUTH_INTEGRATION`, `GENERIC_PRODUCT` 기본 템플릿(seed/ensure).
- **StructureCoverageReport / Item**, **KnowledgeQualityReport / Issue**: deterministic 평가 결과 저장.
- **구조 커버리지**: sourceType·키워드 매칭, FAIL/NOT_CHECKED 원천 제외, WARNING signal 표시.
- **지식 품질**: 완전성·일관성·원천·보안·신선도·활용 점수(규칙 기반, LLM 없음).
- **Provider/Admin UI**: 구조/품질 점검 패널, 재평가 API.
- **Gate**: 최신 structure/knowledge report 없거나 FAIL이면 제출·승인 차단, WARNING 허용.
- **Pipeline**: pack당 1회 `STRUCTURE_QUALITY_EVALUATE`, `STRUCTURE_VALIDATING` + `KNOWLEDGE_CHECKING` step.
- P19 Chunk Quality, P20 Retrieval Evaluation, P21 Release Gate는 후속 단계.

### P18.1 — Structure Quality Stale Guard

- **StructureCoverageReport / KnowledgeQualityReport** 최신성 판정(`MISSING` / `STALE` / `CURRENT`).
- **SourceDocument** 변경, **SourceValidationReport** 갱신, 최신 **version** 변경, **template** 변경 시 stale 처리.
- stale report는 검수 **제출·승인** gate에서 차단; `CURRENT`이면 WARNING은 허용.
- Provider/Admin UI에 재평가 필요 사유 표시.
- P19 Chunk Quality Evaluation 전 필수 안정화 단계.

### P19 — Chunk Quality Evaluation

- **KnowledgeChunk** 품질 평가 report(`ChunkQualityReport` / Issue / ChunkMetric) 추가.
- **SourceDocument** coverage, traceability, size, duplicate, metadata, structure alignment 평가(규칙 기반, LLM 없음).
- **ChunkQuality freshness** guard(`MISSING` / `STALE` / `CURRENT`).
- Provider/Admin UI에서 청킹 품질 점검 및 재평가, 제출·승인 gate 반영.
- **Pipeline**: `CHUNK_QUALITY_EVALUATE`, `CHUNK_EVALUATING` step.
- P20 Retrieval Evaluation은 후속 단계.

### P19.1 — Chunk Quality Precision Polish

- exact duplicate뿐 아니라 **near-duplicate** chunk를 deterministic rule로 감지합니다.
- 같은 sourceDocument/section bucket 내 word shingle Jaccard, prefix overlap, title+section signal을 활용합니다.
- duplicate issue code를 세분화하고 hint에 비교 chunk와 유사도 요약을 표시합니다.
- structure alignment 테스트를 보강했습니다.
- DB schema/public API 변경 없음.

### P20 — Retrieval Evaluation

- **RetrievalEvaluationSet / Case / Run / Result / Issue** 모델 추가.
- expected chunk/source/section/tag/metadata 기반 deterministic retrieval 평가.
- keyword/hybrid mode를 기존 retrieval service로 내부 평가(DRAFT 포함).
- hitRate, MRR, firstHitRank, totalScore 산출.
- Retrieval evaluation freshness guard 적용.
- Provider/Admin UI에서 case 생성 및 평가 실행.
- 제출/승인 gate에 retrieval evaluation 반영.
- P21 Release Gate Hardening은 후속 단계.

### P20.1 — Retrieval Evaluation Aggregation Polish

- mixed mode 평가에서 **케이스 기준 지표**와 **결과 기준 지표**를 분리했습니다.
- UI에서 “케이스 수”와 “keyword/hybrid 결과 수”를 별도로 표시합니다.
- keyword/hybrid mode별 hitRate, MRR, PASS/WARNING/FAIL 요약을 제공합니다.
- Admin 검색 품질 평가 실행은 DRAFT/REVIEWING 상태로 제한합니다.
- DB schema/public API 계약 변경 없음.

### P21 — Release Gate Hardening

- Source/Structure/Chunk/Retrieval 품질 gate를 최종 **Release Gate**로 통합했습니다.
- Admin 승인 직전에 최신 Release Gate를 재평가하여 stale report 기반 공개를 차단합니다.
- `SourceDocument.validationStatus`와 최신 `SourceValidationReport`의 존재/최신성/상태 일치를 검증합니다.
- `ReleaseGateRun` / `ReleaseGateIssue`로 최종 품질 판정 이력을 저장합니다.
- `ReleaseGatePanel`에서 BLOCKER/WARNING 항목을 확인할 수 있습니다.
- Provider 제출 gate는 유지하고, Admin 승인 gate만 최종 release gate로 강화했습니다.
- P22 MCP Server Bridge는 후속 단계입니다.

### P21.1 — Release Gate Warning Polish

- SourceDocument validationStatus가 WARNING인 경우 ReleaseGate 전체 status도 WARNING으로 반영합니다.
- `SOURCE_VALIDATION_WARNING` issue를 추가해 Admin UI에서 원천 문서 경고를 확인할 수 있습니다.
- WARNING은 승인 가능하되 보완 권장으로 표시됩니다.
- README 다음 단계를 P22 MCP Server Bridge로 정정했습니다.
- DB schema/public API 계약 변경 없음.

### P22 — MCP Server Bridge

- JYKStore Public API를 MCP tools/resources로 노출하는 MCP Server runtime(`mcp-server/`)을 추가했습니다.
- stdio transport 기반으로 MCP client에서 JYKStore 지식팩을 호출할 수 있습니다. HTTP transport도 선택 제공합니다.
- MCP tools: `jykstore_retrieval_query`, `jykstore_graph_query`, `jykstore_export_package`, `jykstore_export_rag_jsonl`, `jykstore_export_graph`, `jykstore_export_openapi`, `jykstore_export_mcp_manifest`
- MCP resources: `jykstore://packs/{knowledgePackId}/{package|rag-jsonl|graph|openapi|mcp-manifest}`, `jykstore://openapi`
- MCP Server는 JYKStore Public API만 호출하며 DB를 직접 조회하지 않습니다.
- JYKStore는 최종 답변을 생성하지 않고 검증된 context/export만 반환합니다.
- P15 MCP-ready manifest는 계약 문서이고, P22는 실행 runtime bridge입니다. 자세한 설정은 `mcp-server/README.md`를 참고하세요.
- 외부 AI provider 호출 없음. Public API 계약 변경 없음.

### P22.1 — MCP Contract Alignment

- MCP retrieval query maxLength를 Public Retrieval API 계약과 동일하게 100자로 정렬했습니다.
- MCP server zod schema, tool definition schema, pure validation을 동일한 상수 기준으로 맞췄습니다.
- Graph query maxLength는 기존 2000자를 유지합니다.
- DB schema/public API 계약/dependency 변경 없음.

### P22.2 — Retrieval Query Length Expansion

- Public Retrieval API `RETRIEVAL_QUERY_MAX_LENGTH`를 2000자로 확장했습니다.
- MCP / OpenAPI / Retrieval Test UI / docs를 동일한 2000자 계약으로 정렬했습니다.
- MCP는 Public API 상수를 재사용하므로 별도 maxLength 하드코딩이 없습니다.
- Graph query maxLength 2000은 유지합니다.
- 검색 ranking 알고리즘은 변경하지 않았습니다.
- DB schema/dependency 변경 없음. Public API 응답 구조 변경 없음.

### P22.3 — MCP HTTP Transport & Streaming Export Stabilization

- MCP HTTP transport에 health/ready endpoint와 graceful shutdown을 추가했습니다.
- API key를 노출하지 않는 readiness 응답을 제공합니다.
- 큰 export를 위한 chunked export tools를 추가했습니다.
- UTF-8 safe byte chunking을 적용했습니다.
- 기존 stdio transport와 기존 tools/resources는 유지됩니다.
- MCP Server는 계속 Public API만 호출하며 DB를 직접 조회하지 않습니다.
- 외부 AI 호출 없음. Public API 응답 구조 변경 없음.

### P22.3.1 — MCP Logging & Chunk Response Guard Polish

- Chunked export 최종 MCP response text에도 maxResponseBytes guard를 적용했습니다.
- JSON encoding 후 응답이 커지는 경우 `JYKSTORE_MCP_RESPONSE_TOO_LARGE`로 차단합니다.
- HTTP transport catch logging을 safe error logging으로 축소했습니다.
- API key, Authorization header, request/response body, stack trace가 운영 로그에 직접 남지 않도록 보정했습니다.
- 기존 tools/resources/Public API 응답 구조 변경 없음.

### P22.4/P22.5 — Streaming Export Foundation

- Public API export chunk endpoints를 추가했습니다.
- package/rag-jsonl/graph export를 offset/limitBytes 단위로 조회할 수 있습니다.
- MCP chunked export tools가 MCP server 내부 chunking 대신 Public API chunk endpoints를 호출하도록 전환했습니다.
- MCP resource query string chunking도 Public API chunk endpoint를 사용합니다.
- 기존 full export endpoints/tools/resources는 유지됩니다.
- Public API visibility/security 정책은 기존 export와 동일합니다.
- DB schema/dependency 변경 없음. 외부 AI 호출 없음.

### P22.5.1 — Public API Export Logging Polish

- Public API export/chunk export route의 catch logging을 safe logging으로 통일했습니다.
- API key, Authorization header, DATABASE_URL, request/response body, stack trace가 운영 로그에 직접 남지 않도록 보정했습니다.
- 기존 export endpoints, MCP tools/resources, Public API response shape는 변경하지 않았습니다.

### P22.6/P26 — MCP Runtime Verification & Ops Guide

- MCP HTTP JSON-RPC runtime integration test를 추가했습니다.
- stdio transport smoke test를 추가했습니다.
- MCP tools/resources registration snapshot test를 추가했습니다.
- 운영 배포 가이드를 `docs/mcp-runtime-ops-guide.md`에 정리했습니다.
- health/readiness, env, safe logging, reverse proxy, troubleshooting 기준을 문서화했습니다.
- 인증/멀티테넌시/쿼터는 후속 P23/P27, P24/P25 범위로 유지합니다.

### P23/P27 — Auth & API Key Hardening

- API Key 생성/목록/회수 흐름을 정리했습니다.
- API Key raw value는 생성 시 1회만 반환하고, 이후에는 maskedKey만 표시합니다.
- Public API 인증에서 ACTIVE/REVOKED/EXPIRED 상태와 scope를 검증합니다.
- API Key lastUsedAt을 갱신하고 UsageLog/AuditLog와 연결했습니다.
- Provider/Admin API Key 관리 UI를 보강했습니다.
- OAuth/remote MCP auth, multi-tenant gateway, rate limit/quota는 후속 단계로 유지합니다.

### P23.1 — Auth & API Key Hardening Polish

- API Key 생성 응답의 raw key 필드를 `rawKey` 하나로 정리했습니다.
- API Key/Admin/Context route catch logging을 safe logging으로 통일했습니다.
- Admin API Key 관리 API에 최소 Admin Ops Token 보호를 추가했습니다.
- Admin Ops Token은 환경변수와 `X-JYKStore-Admin-Token` header로만 사용하며, localStorage/sessionStorage에 저장하지 않습니다.
- OAuth/SSO/remote MCP auth는 후속 단계로 유지합니다.

### P24/P25 — Multi-tenant Gateway & Quota

- Public API 요청을 clientId/apiKeyId 기준으로 quota gate에 연결했습니다.
- 기본 FREE quota 정책을 per-minute/per-day 기준으로 적용했습니다.
- quota 초과 시 429 `QUOTA_EXCEEDED`를 반환합니다.
- UsageLog에 clientId/tenantKey와 quota metadata를 기록합니다.
- Admin quota summary API/UI를 추가했습니다.
- MCP Server는 별도 DB 접근 없이 Public API quota 결과를 그대로 중계합니다.
- OAuth/remote MCP auth와 유료 결제/과금은 후속 단계로 유지합니다.

### P24.1 — Public API Gateway Logging & Quota Metadata Polish

- retrieval/query와 graph/query route의 raw error logging을 safe logging으로 통일했습니다.
- context GET/POST route의 auth/quota/usage logging을 Public API gateway helper로 정리했습니다.
- export full/chunk UsageLog에도 quota warning/count metadata가 일관되게 기록되도록 보정했습니다.
- Public API success response shape와 MCP tools/resources는 변경하지 않았습니다.

### P24.2 — Public API Gateway Complexity Reduction

- Public API route wrapper를 추가해 retrieval/graph/context route의 인증·quota·safe logging 반복을 줄였습니다.
- full export route factory를 추가해 package/rag-jsonl/graph/openapi/mcp-manifest export route의 중복을 줄였습니다.
- quota summary aggregation을 quota check 로직과 분리했습니다.
- Admin quota UI를 작은 컴포넌트로 분리했습니다.
- API response shape, MCP tools/resources, DB schema는 변경하지 않았습니다.

### P24.2.1 — Export Route Factory Null Guard Polish

- full export route factory의 not-found 판정을 `data === null`로 보정했습니다.
- rag-jsonl export가 빈 문자열을 반환해도 `PACK_NOT_FOUND`로 오판하지 않도록 회귀 테스트를 추가했습니다.
- API response shape, MCP tools/resources, DB schema는 변경하지 않았습니다.

## 아직 구현하지 않은 기능

- 외부 embedding provider(OpenAI/Claude/Gemini 등) 연동
- 파일 업로드 parser(PDF/DOCX/XLSX 등) 및 외부 URL fetch/crawling
- 고급 구조화 품질 검증(P18/P18.1 완료), 청킹 품질 평가(P19/P19.1 완료), 검색 품질 평가(P20/P20.1 완료), release gate hardening(P21/P21.1 완료), 실제 MCP Server runtime(P22~P22.6/P26 완료), Auth & API Key Hardening(P23/P27~P23.1 완료), Multi-tenant Gateway & Quota(P24/P25 완료)
- Web Streams true streaming, OAuth / remote MCP auth 등은 후속 개선
- pgvector 기반 vector index
- 로그인/회원 관리
- 관리자 인증 및 권한 제어

## 다음 단계

1. OAuth / remote MCP auth
2. True upstream stream response using Web Streams
3. Production deployment hardening