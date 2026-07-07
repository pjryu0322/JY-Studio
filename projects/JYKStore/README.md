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

## 아직 구현하지 않은 기능

- Vector DB/RAG 검색
- 로그인/회원 관리
- Provider/Admin 실제 기능

## 다음 단계

1. Phase P6: Provider Center 또는 Context API 운영 보강
