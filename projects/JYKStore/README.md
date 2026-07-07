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
- 파일 업로드, PDF parsing, embedding, Vector DB/RAG는 아직 제공하지 않습니다.

## 검색 고도화

JYKStore는 DB 기반 keyword/ranking 검색을 제공합니다.

현재 단계:

- 지식팩 카탈로그 keyword ranking
- Context API query ranking
- chunk title/content/section/tags/chunkType 가중치 적용
- Context API metadata에 score/matchReasons 제공
- Admin Chunk Manager에서 chunk 검색 지원
- Admin Chunk Manager 검색은 공백 기준 token 검색을 지원합니다.
- Context API usage log의 query는 100자 이하로 제한해 저장합니다.

정책:

- 현재 검색은 DB 기반 keyword/ranking 방식입니다.
- Vector DB, embedding, RAG 검색은 아직 제공하지 않습니다.
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
- 검색 결과는 Keyword + Metadata Ranking 기반 (Vector/Embedding 미적용)

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
- **Graph API**
  - `GET /api/v1/admin/packs/{packId}/graph` — graph summary (node/edge count, type별 count)
  - `POST /api/v1/admin/packs/{packId}/graph/rebuild` — deterministic rebuild
  - `POST /api/v1/graph/query` — API Key(`context:read` scope) 인증. label/summary/externalId contains 검색으로 node/edge 조회. graph traversal·semantic search·답변 생성은 하지 않습니다.
- **Export Foundation** (신규 라이브러리 없이 JSON/JSONL 응답 기반)
  - `GET /api/v1/admin/packs/{packId}/exports/package` — `JYKSTORE_PACKAGE_JSON` (pack/version/chunk/graph 메타, raw embedding vector 제외)
  - `GET /api/v1/admin/packs/{packId}/exports/rag-jsonl` — 외부 RAG 시스템에 import 가능한 line-delimited JSON (활성 chunk 기준)
  - `GET /api/v1/admin/packs/{packId}/exports/graph` — `JYKSTORE_GRAPH_JSON`
  - `GET /api/v1/admin/packs/{packId}/exports/mcp-manifest` — `JYKSTORE_MCP_READY_MANIFEST`. **실제 MCP Server가 아니라** 향후 MCP 연계용 manifest이며 실제 API Key를 포함하지 않습니다.
  - Export/Graph에는 API Key, 사용자 정보, 과금 정보, audit log 등 민감 정보를 포함하지 않습니다.
- **Admin UX**: 검수 상세 화면에 `KnowledgeGraphPanel`(graph 상태/type별 count/rebuild), `ExportPanel`(4종 export 다운로드)을 추가했습니다. 시각화 라이브러리는 추가하지 않고 table/list UX로 제공합니다.
- JYKStore는 여전히 **답변을 생성하지 않고 context / graph / export data만 제공**합니다.

## 아직 구현하지 않은 기능

- 외부 embedding provider(OpenAI/Claude/Gemini 등) 연동
- pgvector 기반 vector index
- 실제 MCP Server 실행(stdio/websocket/sse runtime) 및 graph traversal/semantic graph search
- 로그인/회원 관리
- 관리자 인증 및 권한 제어

## 다음 단계

1. Phase P16: 이후 단계에서 external embedding provider, vector index, MCP server runtime, graph traversal 확장을 검토합니다.
