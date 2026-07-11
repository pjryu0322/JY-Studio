# 04. KEEP / REMOVE / REPLACE_THEN_REMOVE Matrix

분류 기준은 P27 목표 아키텍처(유통 플랫폼) 기준이다. 현재 런타임이 의존하면 즉시 REMOVE로 확정하지 않는다.

## 1. 종합 표 (주요 대상)

| 대상 | 분류 | 근거 | 현재 의존성 | 선행 대체 작업 | 삭제 가능 단계 |
|---|---|---|---|---|---|
| Auth session/login | KEEP | 유통 플랫폼 필수 | 전 영역 | — | — |
| accountRole USER/PROVIDER/ADMIN | KEEP | 권한 모델 | UI/API guards | — | — |
| ProviderProfile auto-link | KEEP | 제공자 연결 | pack ownership | 별도 입력 UI만 축소 | P28-A |
| Pack 기본정보 CRUD | KEEP | Distribution Core | Catalog/Review | — | — |
| Catalog / my-packs | KEEP | 공개·설치 | Pack status | — | — |
| Admin accept/approve/reject 골격 | KEEP | 유통 심사 | PackReview | 판단 기준을 유통정보로 축소 | P28-A |
| API Key / Quota / ApiUsageLog | KEEP | Runtime Gateway | Public APIs | — | — |
| AuditLog | KEEP | 운영 감사 | 다수 actions | Builder action은 신규 중단 | P28-B |
| Public Retrieval/Export/MCP | KEEP (계약) | Runtime 핵심 | Chunk content | Payload Runtime Adapter | P28-E 이후 shape 유지 |
| Health/Ready/hardening | KEEP | 배포 | env | — | — |
| GitHub Auto Collect UI/API | REMOVE | 내부 Builder | SourceDocument 생성 | 외부 Payload Import | P28-A/B (신규 생성 차단) |
| Document Discovery/Classification | REMOVE | Builder | GitHub path | 외부 생성기 | P28-A/B |
| KU Draft UI (provider draft tab) | REMOVE | Builder | inactive chunks | Payload Import | P28-A |
| KU Draft generation APIs | REPLACE_THEN_REMOVE | 현재 제출 경로 | auto-pipeline | Payload Import + submit 재설계 | P28-B→E |
| Unit Queue / Merge UI | REMOVE | 목표 밖 | KU draft metadata | — | P28-A (미구현 단독 UI면 코드만) |
| Admin KU drafts page | REMOVE | 중복 경로 | activation | auto-pipeline/pack review로 충분 | P28-A/B |
| Chunk Ingestion / auto-regen | REPLACE_THEN_REMOVE | Retrieval 공급 | KnowledgeChunk | Runtime Index Adapter | P28-E |
| AdminChunkManager / chunk edit APIs | REMOVE | 내부 편집 | chunks | 읽기 전용 유지 가능 | P28-A/B |
| Structure/Chunk/Retrieval eval UI | REPLACE_THEN_REMOVE | approve gate | report tables | 유통 검증으로 교체 | P28-A→C |
| Release gate evaluate | REPLACE_THEN_REMOVE | approve blocker | ReleaseGateRun | 유통 적합성 체크로 교체 | P28-C |
| PipelineRun progress UI | REMOVE | Builder 진행관리 | PipelineStatus | Audit 보존 | P28-A; DB는 보류 |
| ProviderProfile 별도 강제 등록 화면 | REMOVE | 이미 계정 자동연결 | header editor 유지 | — | done/KEEP editor |
| Ops Token UI | REMOVE | 미구현(이미 제거됨) | — | Account ADMIN | 완료 |
| Guest 역할 enum | REMOVE | 미구현 | dead copy | — | P28-A copy/test 정리 |
| Advanced 과다 재생성 | REMOVE | 심사 방해 | admin advanced | 조회만 남김 | P28-A |
| KnowledgeChunk 모델 | REPLACE_THEN_REMOVE | Runtime 본문 | retrieval/export | Adapter+이중쓰기 | Migration 이후 |
| SourceDocument 생성 파이프라인 | REPLACE_THEN_REMOVE | 출처/검증 | reviews/gates | Payload manifest | P28-E |
| PipelineRun/StepLog | REPLACE_THEN_REMOVE | Audit/ops | 다수 writers | Audit 이벤트 정규화 | DB 보류 |
| Structure template seed | DEFER | 게이트 대체 전 | structure quality | — | P28-C |
| 유료 과금 고도화 | DEFER | 실증 외 | plans UI scaffold | — | — |
| 다중 Vector DB / LLM | DEFER | 미구현 | embeddings optional | — | — |
| ZIP Payload Upload / Checksum | DEFER | P27 비구현 | — | P28-E | — |

## 2. 삭제 후보 체크리스트 (프롬프트 필수)

| 항목 | 상태 | 분류 |
|---|---|---|
| GitHub Auto Collect | 구현됨 | REMOVE (신규) / REPLACE_THEN_REMOVE(데이터 경로) |
| Document Discovery | GitHub 하위 구현 | REMOVE |
| Document Classification | GitHub classifier | REMOVE |
| Source Analysis | source-validation + structure | REPLACE_THEN_REMOVE |
| Unit Draft Generation | chunkType draft | REPLACE_THEN_REMOVE |
| Unit Queue | draft list UX | REMOVE |
| Unit Merge | `ku-draft-dedup.ts` | REMOVE (생성 경로와 함께) |
| Chunk Ingestion | auto-pipeline / chunk-pipeline | REPLACE_THEN_REMOVE |
| Chunk Editor | AdminChunkManager | REMOVE |
| Chunk Review | quality panels | REPLACE_THEN_REMOVE |
| Rechunk | 전용명 없음, overwrite/regen | REPLACE_THEN_REMOVE |
| Pipeline Progress UI | readiness/pipeline labels | REMOVE |
| ProviderProfile 별도 입력 화면 | 대부분 제거됨, editor 잔존 | KEEP editor / REMOVE 중복 CTA |
| Ops Token 직접 입력 UI | 미구현 | REMOVE(완료) |
| Guest 역할 | 미구현(enum 없음) | REMOVE dead copy |
| 불필요한 Advanced 탭 | 구현됨 | REMOVE 생성성 CTA, KEEP 조회 |

## 3. 유지 후보 체크리스트

| 항목 | 경로 | 분류 |
|---|---|---|
| Auth | `store-auth-service.ts`, auth routes | KEEP |
| Role | `account-role.ts` | KEEP |
| Account/Profile | `/account`, provider profile editor | KEEP |
| Catalog | `pack-catalog-service.ts` | KEEP |
| Provider Pack 기본정보 | basic tab | KEEP |
| Admin Review 골격 | accept/approve/reject | KEEP |
| Publish | approve → PUBLISHED | KEEP |
| API Key | `api-key-service.ts` | KEEP |
| UsageLog | `ApiUsageLog` | KEEP |
| AuditLog | `AuditLog` | KEEP |
| Export | `src/lib/exports/**` | KEEP (계약) |
| Quota | quota libs | KEEP |
| Deployment hardening | `runtime-env.ts`, health | KEEP |

## 4. 대체 후 삭제 후보

| 항목 | 대체물 | 비고 |
|---|---|---|
| Chunk Retrieval | Runtime Index over Payload | response shape 유지 |
| MCP Chunk 검색 | 동일 Public API Adapter | MCP 계약 유지 |
| Publish↔Unit/Chunk 연결 | Manifest + validation report | approve 정책 변경 |
| SourceDocument 생성 파이프라인 | Payload Import | 기존 rows 읽기 유지 |
| PipelineRun 감사 | AuditLog 정규화 이벤트 | DB drop 보류 |
