# 01. Current Feature Inventory

소스 기준일: 2026-07-12. 경로 기준: `projects/JYKStore/`.

## 1. 영역별 기능 목록

| 영역 | 기능 | 사용자 역할 | UI Route | API/Action | Service | Prisma 모델 | 테스트 | 현재 상태 |
|---|---|---|---|---|---|---|---|---|
| Auth | 로그인/세션/로그아웃 | USER/PROVIDER/ADMIN | `/login`, `/admin/login` | `/api/v1/auth/{login,logout,session}` | `src/lib/store-auth-service.ts`, `auth-session.ts`, `account-role.ts` | `User` | `auth-session.test.ts`, `account-role.test.ts`, `admin-auth.test.ts` | 동작 |
| Auth | 역할 관리 | ADMIN | `/account` | `/api/v1/admin/accounts/**` | `admin-accounts-service.ts` | `User.accountRole` | `account-role-registration*.test.ts` | 동작(일부 UX 테스트 드리프트) |
| Provider | 제공자 센터 | PROVIDER/ADMIN | `/provider` | profile/packs APIs | `provider-profile-service.ts`, `provider-pack-service.ts` | `ProviderProfile`, `KnowledgePack` | `provider-onboarding-ux.test.ts`, `provider-auth-gate-ux.test.ts` | 동작 |
| Provider | Pack 기본정보 | PROVIDER/ADMIN | `/provider/packs/new`, `/provider/packs/[packId]#basic` | `POST/PATCH /api/v1/provider/packs` | `provider-pack-service.ts` | `KnowledgePack`, `KnowledgePackVersion` | `pack-id-generator.test.ts`, `provider-pack-wizard*.test.ts` | 동작 |
| Provider | GitHub 자동수집 | PROVIDER/ADMIN | source 탭 | `/api/v1/provider/github/repository-discovery`, `.../auto-collect/github/register` | `src/lib/github-auto-collect/**` | `SourceDocument` | `github-*.test.ts` | 동작(Builder) |
| Provider | KU Draft 생성/검토 | PROVIDER/ADMIN | draft 탭 | `.../knowledge-unit-drafts`, `.../auto-collect/github/knowledge-units/draft` | `github-knowledge-unit-draft-*.ts`, `provider-knowledge-unit-draft-service.ts`, `knowledge-unit-draft/**` | `KnowledgeChunk` (`AUTO_KNOWLEDGE_UNIT_DRAFT`) | `*-knowledge-unit-draft*.test.ts`, `ku-draft-ux-pipeline.test.ts` | 동작(Builder) |
| Provider | 검수 준비/제출 | PROVIDER/ADMIN | inspection/review 탭 | `.../inspection/auto-prepare`, `.../submit`, `.../withdraw-review` | `auto-pipeline/**`, `provider-final-review-submit-service.ts` | `PackReview`, `PipelineRun`, quality/gate reports | `provider-final-review-submit*.test.ts`, `provider-review-auto-preparation-service.test.ts` | 동작 |
| Provider | 품질 게이트 UI | PROVIDER/ADMIN | inspection | structure/chunk/retrieval/release-gate evaluate APIs | `structure-quality/**`, `chunk-quality/**`, `retrieval-evaluation/**`, `release-gate/**`, `source-validation/**` | 각 Report 모델 | readiness/runner 계열 테스트 | 동작(Builder+Gate) |
| Admin | 검수 목록/상세 | ADMIN | `/admin/reviews`, `/admin/reviews/[packId]` | `/api/v1/admin/reviews/**` | `admin-review-service.ts`, `admin-review-decision.ts` | `PackReview`, `KnowledgePack` | `admin-review-*.test.ts` | 동작 |
| Admin | 접수/승인/반려 | ADMIN | 상단 판단 카드 | `.../accept`, `.../approve`, `.../reject` | `admin-review-service.ts` | `PackReview`, `KnowledgePack.status` | `admin-review-accept-flow.test.ts`, `pack-review-accept-withdraw.test.ts` | 동작 |
| Admin | 판단 근거 탭 | ADMIN | evidence tabs | review-refresh, quality evaluate | `AdminReviewEvidenceTabs.tsx`, `admin-review-tabs.ts` | snapshot/quality | `admin-review-tabs-ux.test.ts` | 동작 |
| Admin | KU Draft 승인 페이지 | ADMIN | `/admin/knowledge-unit-drafts` | `/api/v1/admin/knowledge-unit-drafts/**` | `admin-knowledge-unit-draft-*.ts` | `KnowledgeChunk` | `admin-knowledge-unit-draft-*.test.ts` | 동작(중복 경로) |
| Admin | Chunk 편집기 | ADMIN | 고급 탭 | `/api/v1/admin/packs/[packId]/chunks/**` | `chunk-pipeline-service.ts` | `KnowledgeChunk`, embeddings | `chunk-ui-utils.test.ts` | 동작(Builder) |
| Admin | Ops 콘솔 | ADMIN | `/admin/ops/**` | `/api/v1/admin/ops/**`, quota, api-keys | `ops-service.ts` | `ApiUsageLog`, `AuditLog`, `ApiKey` | `admin-quota.test.ts`, `safe-logging.test.ts` | 동작(세션 인증) |
| Catalog | 목록/검색/상세 | 공개+로그인 | `/`, `/today`, `/packs`, `/search`, `/categories/**` | (SSR/service) | `pack-catalog-service.ts` | `KnowledgePack` | store UX 테스트 | 동작 |
| Catalog | 내 지식팩 설치 | USER+ | `/my-packs`, connect | `/api/v1/my-packs/**` | `my-packs-service.ts` | `PackInstallation` | (서비스 경로 존재) | 동작 |
| Runtime | Retrieval | API Key | docs + API | `POST /api/v1/retrieval/query` | `src/lib/retrieval/**` | `KnowledgeChunk`, `SourceDocument` | `retrieval-*.test.ts`, `public-api-*.test.ts` | 동작 |
| Runtime | Context/Graph | API Key | docs | `/api/v1/packs/[packId]/context/**`, `/api/v1/graph/query` | `context-service.ts`, graph libs | Chunk/Graph models | `context-*.test.ts` | 동작 |
| Runtime | Export | API Key | docs | `/api/v1/exports/{package,rag-jsonl,graph,openapi,mcp-manifest}` | `src/lib/exports/**` | Chunk/Graph | `export-*.test.ts`, `public-export-route.test.ts` | 동작 |
| Runtime | MCP Bridge | 외부 클라이언트 | `mcp-server/**` | 위 Public APIs 호출 | `mcp-server/tool-handlers.ts`, `jykstore-client.ts` | 없음(HTTP만) | `mcp-*.test.ts` | 동작 |
| Common | API Key/Quota | USER/ADMIN | `/api-keys`, ops | `/api/v1/api-keys/**` | `api-key-service.ts`, quota libs | `ApiKey`, `ApiUsageLog` | `api-key-*.test.ts`, `quota-*.test.ts` | 동작 |
| Common | Health | 운영 | — | `/api/health`, `/api/ready` | `runtime-env.ts`, `runtime-readiness` | — | `runtime-*.test.ts`, `production-safety.test.ts` | 동작 |

## 2. Prisma 모델 전체 (29+)

`prisma/schema.prisma` 기준 주요 모델:

- Distribution: `KnowledgePack`, `KnowledgePackVersion`, `PackCategory`, `PackReview`, `ProviderProfile`, `PackInstallation`
- Builder content: `SourceDocument`, `KnowledgeChunk`, `KnowledgeChunkEmbedding`, `KnowledgeGraphNode`, `KnowledgeGraphEdge`
- Builder quality: `SourceValidationReport/Issue`, `StructureCoverage*`, `KnowledgeQuality*`, `ChunkQuality*`, `RetrievalEvaluation*`, `ReleaseGate*`, `KnowledgeStructureTemplate/Section`
- Ops: `PipelineRun`, `PipelineStepLog`, `ApiKey`, `ApiUsageLog`, `AuditLog`, `User`, `Organization*`

별도 `KnowledgeUnit` 테이블은 없다. Unit은 `KnowledgeChunk.chunkType` (`AUTO_KNOWLEDGE_UNIT_DRAFT` / `AUTO_KNOWLEDGE_UNIT`)로 표현된다.

## 3. PackStatus / PipelineStatus (현재 enum)

`PackStatus`: `DRAFT | REVIEWING | VERIFIED | PUBLISHED | DEPRECATED | SUSPENDED`

`PipelineStatus`: `SOURCE_REGISTERING … READY_FOR_REVIEW | REVIEWING | APPROVED | PUBLISHED | FAILED` (생성 파이프라인 중심)

`accountRole`: `USER | PROVIDER | ADMIN` (`src/lib/account-role.ts`). `GUEST` enum은 없음.

## 4. 환경변수 (`.env.example` + 코드)

- 필수(prod): `DATABASE_URL`, `JYKSTORE_API_KEY_SECRET` (`runtime-env.ts`)
- App: `JYKSTORE_PORT`, `JYKSTORE_APP_NAME`, `JYKSTORE_API_BASE_URL`, `JYKSTORE_BASE_URL`, `JYKSTORE_ADMIN_EMAILS`
- Quota: `JYKSTORE_QUOTA_PER_MINUTE`, `JYKSTORE_QUOTA_PER_DAY`, `JYKSTORE_QUOTA_ENFORCEMENT`
- MCP: `JYKSTORE_MCP_*`, `JYKSTORE_API_KEY`
- Optional: `GITHUB_TOKEN`
- Legacy string only: `JYKSTORE_ADMIN_OPS_TOKEN` (`safe-logging.ts` redaction)

## 5. Feature Flag

코드베이스에서 별도 feature-flag 프레임워크는 확인되지 않았다. 역할/세션 가드가 진입 제어를 담당한다.

## 6. 운영 스크립트 / 문서

- Scripts: `package.json` — `dev`, `build`, `start`, `lint`, `test`, `test:unit`, `mcp:*`, `db:*`
- Docs: `docs/production-deployment-runbook.md`, `docs/mcp-runtime-ops-guide.md`, `docs/p26-github-auto-collect-e2e-checklist.md`
- Untracked local: `scripts/` (감사 범위 외 보조 스크립트 가능)

## 7. 진입점 요약

```text
Provider UI (ProviderPackEditor)
→ provider APIs
→ github-auto-collect / KU draft / auto-pipeline
→ SourceDocument + KnowledgeChunk
→ PackReview.submitSnapshot
→ Admin Review accept/approve
→ KnowledgePack PUBLISHED/VERIFIED
→ Catalog + Retrieval/Export/MCP
```
