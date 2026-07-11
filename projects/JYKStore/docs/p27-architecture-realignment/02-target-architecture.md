# 02. Target Architecture

JYKStore 목표: 외부에서 생성된 지식 데이터를 원본 그대로 등록·검수·공개·다운로드·AI 접근을 관리하는 **지식팩 유통 플랫폼**.

## 1. Provider Center

책임:

- 계정/역할 연결 (`ProviderProfile` ↔ `User`)
- Pack 기본정보(이름, 카테고리, 설명, 태그)
- 외부 Payload 등록(불변 원본)
- 유통정보(출처, 라이선스, 버전, 공개 범위)
- 자동검증 결과 확인
- 검수요청 / 회수(접수 전)

현재 대응:

- KEEP: `/provider`, pack CRUD, profile APIs (`provider-pack-service.ts`, `provider-profile-service.ts`)
- REMOVE/REPLACE: source/draft/inspection Builder 탭, GitHub auto-collect, KU draft UI

목표 Provider 흐름:

```text
기본정보 → 외부 Payload 등록 → 유통정보 입력 → 자동검증 → 검수요청
```

## 2. Distribution Core

책임:

- Pack/Version 메타데이터
- 원본 Payload 저장·무결성(향후 checksum)
- 라이선스·출처·다운로드/Export
- Distribution 상태머신

현재 대응:

- `KnowledgePack`, `KnowledgePackVersion`, Export services (`src/lib/exports/**`)
- Publish는 Admin approve로 `PUBLISHED`/`VERIFIED`

## 3. Admin Review

책임:

- 접수(`PENDING`→`IN_REVIEW`)
- 유통정보·Payload·검증결과 확인
- 판단: APPROVED / CHANGES_REQUESTED / REJECTED
- AuditLog

현재 대응:

- KEEP 골격: `AdminReviewDetailPageClient`, accept/approve/reject APIs
- REMOVE/REPLACE: Advanced의 Chunk/Structure/재생성 편집, Admin KU drafts 페이지

목표 Admin 흐름:

```text
접수 → 유통정보 → Payload → 검증결과 → 판단
```

## 4. Catalog

책임:

- 공개 Pack 검색/상세
- 설치(`PackInstallation`)
- 연결 가이드

현재 대응:

- `pack-catalog-service.ts`, `/packs`, `/my-packs` — Builder 테이블을 직접 읽지 않음(상태+메타만)

## 5. Runtime Gateway

책임:

- Retrieval / Context / Graph / Export Public API
- MCP Bridge (`mcp-server/**`)
- API Key, Quota, UsageLog

현재:

- Retrieval/Export는 `KnowledgeChunk.content`에 직접 의존
- MCP는 Prisma 없이 Public API만 호출 (`mcp-server/jykstore-client.ts`)

목표:

- Payload/Index Adapter로 교체 후 Chunk 생성 파이프라인 제거
- Distribution 상태와 Runtime 상태 분리

## 6. 공통 인증·권한·로그

KEEP:

- `account-role.ts`, session cookie, admin route guard
- `ApiKey`, `ApiUsageLog`, `AuditLog`
- `/api/health`, `/api/ready`, production hardening (`runtime-env.ts`)

## 7. 외부 생성기와의 책임 경계

| 외부(ChunkStudio 등) | JYKStore |
|---|---|
| 문서수집, 분석, Unit/Chunk 생성 | Payload 수신, 검증, 유통, Runtime 제공 |
| 콘텐츠 재작성 | 원본 불변 원칙 |

## 8. Payload 불변 원칙

- 등록된 원본은 JYKStore 내부에서 재청킹/재작성하지 않는다.
- 검수는 유통 적합성(메타·라이선스·출처·공개범위) 중심.
- Runtime Index는 원본을 복사·가공할 수 있으나 Distribution 원본과 분리한다.

## 9. 상태 분리

### 목표 Distribution 상태

```text
DRAFT → VALIDATING → READY_TO_SUBMIT → SUBMITTED → UNDER_REVIEW
→ APPROVED → PUBLISHED → SUSPENDED / ARCHIVED
```

### 목표 Runtime 상태

```text
NOT_SUPPORTED → SUPPORTED → INDEX_PENDING → INDEXING → READY | FAILED | DISABLED
```

### 현재 enum과의 차이

| 현재 | 목표 매핑 |
|---|---|
| `PackStatus.DRAFT` | DRAFT |
| (없음, pipeline으로 분산) | VALIDATING / READY_TO_SUBMIT |
| `PackStatus.REVIEWING` + `PackReview.PENDING` | SUBMITTED |
| `PackReview.IN_REVIEW` | UNDER_REVIEW |
| `PackStatus.PUBLISHED` / `VERIFIED` | APPROVED+PUBLISHED (Verified는 정책) |
| `DEPRECATED` / `SUSPENDED` | ARCHIVED / SUSPENDED |
| `PipelineStatus.*` | Distribution에서 제거, Runtime Index 상태로 이전 |

신규 enum/Migration은 P27에서 구현하지 않는다. P28+에서 Adapter 도입 시 설계.

## 10. 단계별 전환 전략

1. **P27 (현재)**: 감사·분류·삭제 계획
2. **P28-A/B**: Builder UI/신규 생성 API 차단(읽기 유지)
3. **P28-C/D**: 미사용 서비스 정리, Published Pack/Retrieval 회귀 방지
4. **P28-E / P29**: Payload Import + Runtime Adapter
5. **이후**: Chunk 생성 경로 DB 정리(Migration)
