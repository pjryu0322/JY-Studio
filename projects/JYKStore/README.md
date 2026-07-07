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

## 아직 구현하지 않은 기능

- Vector DB/RAG 검색
- 로그인/회원 관리
- 관리자 인증 및 권한 제어

## 다음 단계

1. Phase P13: Knowledge Retrieval Engine Foundation
   - Knowledge Pack metadata schema 확장
   - Chunk metadata 확장
   - Retrieval API v1 설계
   - Metadata Filter 기반 검색 구조 정리
   - Vector/Embedding은 P14에서 분리 검토
