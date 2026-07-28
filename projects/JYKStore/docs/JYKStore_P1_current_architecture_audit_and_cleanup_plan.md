# JYKStore P1 — Current Architecture Audit & Cleanup Plan

> **Mode:** Read-only audit (no production code/DB/Object Storage mutations)  
> **Scope:** `projects/JYKStore/**` only  
> **Baseline HEAD:** `eb3eacc4` — `feat(JYKStore): harden immutable originals with Working Copy execution (correction P1.1)`  
> **Audit date:** 2026-07-28  
> **Method:** Source + reference search (not speculation). Prior p27 docs under `docs/p27-architecture-realignment/` were consulted as history only; judgments below are revalidated against current code.

---

## A. Executive Summary

### 핵심 복잡성

현재 관리자 제작 흐름은 **하나의 업무**를 다음 계층이 동시에 표현한다.

| 계층 | 규모 | 대표 심볼 |
|------|------|-----------|
| UI Step (`?step=`) | 9 ids | `AdminReviewWorkflowStep` |
| Inbox Queue (`?queue=`) | 8 keys | `AdminWorkQueueKey` |
| Inbox Group | 10 groups (일부 dead) | `AdminWorkInboxQueueGroup` |
| Derived Status | 19 values | `StoreWorkflowStatus` |
| Persisted Phase overlays | ZIP / provider review / service validation / supplement | PipelineRun markers + sidecars |
| Channel Gates | API / MCP / DOWNLOAD | `store-workflow-handoff-gates.ts` |

Step · State · Gate가 혼재되어 Rail 진행도, Inbox 필터, CTA, deep-link가 서로 다른 어휘를 쓴다.

### 가장 큰 Workflow 문제

1. **목표 6단계와 어긋난 독립 Rail Step**  
   `quality`, `providerConfirm`, `decision`/`publish` 이중화, `ops`가 pack workbench Step으로 취급됨.  
   `searchValidation` Step id는 실제 라벨이 **서비스 검증**인데 naming drift가 남아 있음.

2. **지식화 대상 확인(KNOWLEDGE_SCOPE) 부재**  
   Inventory는 Worker `inventory.json` + Admin ZIP preflight 제외 목록으로만 존재한다. **Inventory DB 모델이 없다.**  
   P1.1 Working Copy의 `directiveSnapshot.adminPreflightExclusions`가 가장 가까운 동결 구조다.

3. **Legacy Docling/TS knowledge pipeline 병행**  
   ZIP Worker 경로와 Docling 3-file / ND builder / TS chunk 경로가 공존. Provider UI는 flag로 숨기지만 코드·스키마·테스트·410 stub가 대량 잔존.

4. **보정 엔진은 P1.1 기반만 존재**  
   Revision + Working Copy는 구현됨. Correction Assessment / Issue / Draft / Override 재생성 루프는 없음. Correction UI는 대부분 CTA 비활성(API 410).

### 삭제/통합 규모 (후보, 실행 전)

| 범주 | 대략 규모 | 비고 |
|------|-----------|------|
| Docling TS 모듈 (`adapters/docling`, `docling-import`, `docling-knowledge`) | ~68 files | Clean Reset 시 삭제/격리 최우선 |
| 410 Legacy Builder API routes | 다수 | stub만 남은 경로 제거 |
| Admin Step 축소 | 9 → 6 | id rename + panel 재배치 |
| Quality report Prisma models | 8+ model families | Worker 자동품질로 흡수 후 스키마 축소 가능 |
| Unit tests | 263 files | Docling/legacy search-data 계열 대량 재작성·삭제 |
| Object Storage prefix | `payloads/**` (configured bucket) | Clean Reset 시 JYKStore bucket/prefix 전체 삭제 예정 |

### P2에서 가장 먼저 해야 할 작업

1. **단일 Workflow Core 정의** — Step 6 / State / Gate 분리 타입 + 전이 정책 1곳  
2. **Admin Rail/Inbox를 새 Step에 재매핑** (quality·providerConfirm을 Step에서 제거)  
3. **KNOWLEDGE_SCOPE 최소 모델** — Inventory 행(상태·제외사유) + Working Copy directive 연결  
4. Legacy Docling UI/route 호출 경로를 feature-flag 뒤가 아니라 **진입점 차단 목록화** (실제 삭제는 P3+)

---

## B. 현재 관리자 Workflow (코드 기준)

### B.1 Pack detail Steps — `AdminReviewWorkflowStep`

정의: `src/lib/role-workspace/admin-review-rail.ts`

| Step id | Rail 라벨 | 마운트 Panel | 비고 |
|---------|-----------|--------------|------|
| `queue` | 자료 접수 | `AdminMaterialAcceptancePanel` | Inbox queue `accept` |
| `generation` | 생성 | `AdminKnowledgeGenerationPanel` → `AdminWorkerZipGenerationCard` | Worker 실행 |
| `quality` | 점검 | Generation quality mode + `AdminQualityCheckPanel` | **독립 Step (목표에서는 제거)** |
| `correction` | 보정 | `AdminKnowledgeCorrectionPanel` | 대부분 비활성 CTA |
| `providerConfirm` | 제공자 검토 | `AdminProviderReviewPanel` | **독립 Step (목표는 Gate/게시 상태)** |
| `searchValidation` | 서비스 검증 | `AdminServiceValidationWorkbenchPanel` | id≠라벨 |
| `decision` | 승인·게시 (접힘) | `AdminApprovalPublishWorkbenchPanel` | publish와 동일 패널 |
| `publish` | (접힘) | 동일 | |
| `ops` | 공개/운영 | `/admin/ops` 링크 | detail panel 없음 |

라우터: `AdminReviewDetailPageClient.tsx` (`?step=`). step 없으면 rail이 URL에 자동 기록.

### B.2 Inbox Queues — `AdminWorkQueueKey`

`src/lib/routes.ts` + `AdminWorkInboxPageClient.tsx`

`accept` · `generation` · `quality` · `correction` · `provider-review` · `service-validation` · `approval-publish` · `ops`

Detail deep-link 시 kebab ↔ camel 변환 (`provider-review` → `providerConfirm`, `service-validation` → `searchValidation`).

### B.3 Derived Status — `StoreWorkflowStatus` (19)

`src/lib/store-workflow-status.ts` — Prisma enum이 아니라 `deriveStoreWorkflowStatus` 산출값.

**Dead / never returned:** `PROVIDER_REVIEWING`, `APPROVED` (라벨·분기만 존재).

### B.4 Phase overlays (PipelineRun markers)

`src/lib/store-workflow-markers.ts`

| Marker trigger | Phase 의미 |
|----------------|------------|
| Worker ZIP request / import | `AdminWorkerZipPhase` |
| `STORE_PROVIDER_REVIEW` | REQUESTED / CONFIRMED / WITHDRAWN |
| `STORE_SERVICE_VALIDATION` | PASSED (provider CONFIRMED 후에만) |
| `STORE_PROVIDER_SUPPLEMENT` | 보완요청 생명주기 |

### B.5 Gates

| Gate | 파일 | 역할 |
|------|------|------|
| Quality snapshot | `admin-review-rail.ts` | blockers/warnings → quality/correction current |
| Provider handoff | `store-workflow-handoff-gates-policy.ts` | generation COMPLETED + quality pass + not already requested |
| Service channels | `store-workflow-handoff-gates.ts` | API/MCP/DOWNLOAD CURRENT+PASS |
| Approval checklist | `admin-approval-publish-view-model.ts` | decide 차단 |

### B.6 Step/State/Gate 혼합 증거

- Rail `getAdminReviewRailState`가 ZIP phase + quality snapshot + provider phase + pack status를 한 함수에서 `currentStep`으로 합성.
- WARNING만으로도 `current = "correction"` 가능 (진행 차단 정책과 UI current가 불일치).
- Supplement 미해결 시 correction 완료 후에도 `providerConfirm`로 current 강제 → correction queue와 provider-review queue에 동시 노출.
- Inbox `QUALITY_CHECK_REQUIRED` 그룹은 선언·필터만 있고 `mapQueuePresentation`에서 **할당되지 않음** (dead).

### B.7 제공자 / 사용자 Rail (요약)

| 역할 | 모델 | 비고 |
|------|------|------|
| Provider pack rail | `basic/payload/request/adminStatus/generationReview/reviewStatus/publish` | Admin Step id와 불일치 |
| Provider review UI | `ProviderGenerationReviewPanel` (~2k LOC) | Chunk/Knowledge Unit 기술 개념 노출 |
| Consumer | `getConsumerRailState` | 게시 팩 탐색/이용 — 목표와 대체로 정합 |

---

## C. 목표 Workflow와 Gap

목표 관리자 Rail (6):

1. 자료 접수 (RECEIPT)  
2. 지식화 대상 확인 (KNOWLEDGE_SCOPE)  
3. 지식데이터 생성 (GENERATION) — 자동 품질 포함  
4. 보정 (CORRECTION)  
5. 서비스 검증 (SERVICE_VALIDATION)  
6. 게시 (PUBLISH) — 제공자 검토는 **상태/Gate**, Step 아님  

| 현재 | 목표 | 판단 |
|------|------|------|
| `queue` / `accept` | RECEIPT | **재구성** (접수 후 Original+WC+Inventory 확정까지 확장) |
| ZIP preflight 제외 / inventory.json | KNOWLEDGE_SCOPE | **신규 구축** (독립 Step 신설; Inventory DB 없음) |
| `generation` | GENERATION | **유지/단순화** (실행 권한 Admin only 유지) |
| `quality` | GENERATION 내부 자동품질 + CORRECTION 이슈 유입 | **독립 Step 삭제** |
| `correction` | CORRECTION | **유지/재작성** (Override 명령 + WC 재생성; 현재 UI 스텁) |
| `providerConfirm` | PUBLISH 상태 `제공자 검토 대기` + 제공자 UX | **관리자 Step 삭제** (로직→Gate/상태) |
| `searchValidation` | SERVICE_VALIDATION | **재명명 + 순서 유지** (관리자 검증 → 제공자 검토) |
| `decision` + `publish` | PUBLISH | **통합** (단일 Step) |
| `ops` | 제작 Rail 밖 운영 | **제작 Step에서 제거** (`/admin/ops` 유지) |
| Docling 3-file / ND builder | — | **삭제 후보** (ZIP Worker 단일 경로) |
| 410 Builder routes | — | **삭제** |
| `StoreWorkflowStatus` 19 | Step+State 분리 모델 | **재작성** |

### Gap 요약

| 목표 책임 | 현재 구현 수준 |
|-----------|----------------|
| Immutable Original | ✅ `WorkerZipSourceRevision` (P1) |
| Working Copy per run | ✅ `WorkerZipWorkingCopy` (P1.1) |
| Inventory DB + 포함/제외 상태 | ❌ artifact/preflight만 |
| 제공자 지식화 여부 확인 요청 | △ supplement / preflight — Scope Step 아님 |
| Worker 자동 품질 (별도 Rail 없음) | △ Worker validation_report + Store quality runners + **별도 quality Step** |
| Correction Override → 부분 재생성 | ❌ UI stub / CORRECTION_REBUILD purpose만 schema |
| 서비스 검증 → 제공자 검토 순서 | △ 코드상 providerConfirm Step이 SV **앞**에 있음 (목표와 반대) |
| Immutable Release | △ PackStatus PUBLISHED + distribution; release artifact 모델 약함 |

**순서 문제 (중요):** 현재 Rail은 `providerConfirm` → `searchValidation` → `decision`. 목표는 **서비스 검증 → 제공자 검토(상태) → 게시**. P2에서 handoff 순서를 뒤집어야 한다.

---

## D. 파일별 Cleanup Matrix (핵심)

판단: **유지 / 통합 / 재작성 / 삭제**

### D.1 Workflow Core

| 파일/모듈 | 현재 책임 | 참조 | 목표 책임 | 판단 | Phase |
|-----------|-----------|------|-----------|------|-------|
| `admin-review-rail.ts` | 9-step rail | 상세/테스트 | 6-step + gates | **재작성** | P2 |
| `store-workflow-status.ts` | 19 derived status | 광범위 | slim Step/State | **재작성** | P2 |
| `store-workflow-handoff-gates*.ts` | handoff/channel gates | SV/approval | Gate only (순서 수정) | **재작성** | P2 |
| `store-workflow-markers.ts` | PipelineRun phases | API | State persistence | **유지/정리** | P2 |
| `admin-work-inbox-view-model.ts` | queue groups | Inbox | 6 queue keys | **재작성** | P2 |
| `routes.ts` AdminWorkQueueKey | 8 queues | nav | 6(+ops 외부) | **재작성** | P2 |
| `AdminReviewDetailPageClient.tsx` | step router | detail | 6 panels | **재작성** | P2 |
| `AdminWorkInboxPageClient.tsx` | mega inbox | admin home | 분할/단순화 | **재작성** | P2–P3 |

### D.2 Admin Panels

| 파일 | 판단 | Phase | 비고 |
|------|------|-------|------|
| `AdminMaterialAcceptancePanel.tsx` | **유지→확장** | P2 | RECEIPT; Inventory 착수 연결 |
| `AdminZipPreflightInventoryDialog.tsx` | **통합** | P2–P3 | → KNOWLEDGE_SCOPE UI |
| `AdminKnowledgeGenerationPanel.tsx` | **유지** | P2 | thin shell |
| `AdminWorkerZipGenerationCard.tsx` (~1.2k) | **재작성/분할** | P3 | gen vs quality 혼합 |
| `AdminQualityCheckPanel.tsx` | **통합** | P2 | GENERATION 결과 요약 / CORRECTION 이슈 소스 |
| `AdminKnowledgeCorrectionPanel.tsx` | **재작성** | P3+ | Override 엔진 후 |
| `AdminCorrectionQueuePanel.tsx` | **유지** | P2 | inbox adapter |
| `AdminProviderReviewPanel.tsx` | **통합** | P2 | PUBLISH Gate UI로 이동 (Step 삭제) |
| `AdminProviderSupplementPanel.tsx` | **유지/이동** | P2 | CORRECTION 또는 Scope |
| `AdminServiceValidationWorkbenchPanel.tsx` | **유지** | P2 | rename step |
| `AdminServiceValidationOpsPanel.tsx` | **유지** | P3 | nest |
| `AdminApprovalPublishWorkbenchPanel.tsx` | **유지** | P2 | decision+publish 단일화 |
| `AdminReviewAcceptTab.tsx` | **유지** | P2 | |
| `AdminWorkerZipRequestQueue.tsx` | **삭제 후보** | P3 | Inbox로 대체 여부 확인 후 |

### D.3 Provider / User UI

| 파일 | 판단 | Phase |
|------|------|-------|
| `ProviderGenerationReviewPanel.tsx` | **재작성** | P3 | Chunk/Unit 기술 UX 제거 → 서비스 결과 검토 |
| `ProviderWorkerZipImportCard.tsx` | **유지** | P2 | 자료 제출 |
| `ProviderServiceValidationTab.tsx` | **재작성** | P3 | 관리자 SV 이후 검토 |
| `ProviderKnowledgeGenerationTab` / Docling UI | **삭제** | P3 | legacy flag 경로 |
| `TestAccountQuickLogin.tsx` | **유지→단순화** | Clean Reset | 3계정 seed |
| Consumer browse / my-packs | **유지** | — | 게시 팩만 |

### D.4 Legacy Docling / Builder (삭제 최우선 후보군)

| 영역 | 규모 | 판단 | Phase |
|------|------|------|-------|
| `src/lib/adapters/docling/**` | ~16 files | **삭제** | P3–P4 |
| `src/lib/docling-import/**` | ~25 files | **삭제** | P3–P4 |
| `src/lib/docling-knowledge/**` | ~27 files | **삭제** | P3–P4 |
| Provider/Admin 410 Builder routes | 다수 | **삭제** | P3 |
| `docs/docling-*.md`, p27 builder maps | docs | **보관→아카이브** | P4 |
| Docling Prisma models | bundle/file/ND/upload/job | **삭제(migration)** | P4 Clean Reset |
| GitHub auto-collect Builder path | services + 410 | **삭제** | P3 |

### D.5 Worker ZIP (유지 축)

| 파일 | 판단 |
|------|------|
| `worker-zip-source-revision-service.ts` | **유지** |
| `worker-zip-working-copy-service.ts` | **유지/확장** (CORRECTION_REBUILD) |
| `worker-zip-import-provider-service.ts` | **유지/정리** |
| `worker-zip-pipeline-service.ts` | **유지** |
| `worker-source-document-service.ts` | **유지** |
| `worker-output-*` | **유지** |
| `zip-exclusion-policy.ts` + Python twin | **통합** (단일 정책 소스) |
| `worker-zip-quality-refresh-service.ts` | **통합** → GENERATION 후처리 / 자동품질 |

---

## E. DB Cleanup Matrix

### E.1 유지 (새 Workflow 핵심)

| Model | 역할 | 비고 |
|-------|------|------|
| User / Organization* / ProviderProfile | 계정 | Clean Reset 후 3계정 |
| KnowledgePack / Version / Category | 팩 | |
| WorkerZipSourceRevision | Immutable Original | |
| WorkerZipWorkingCopy | 실행본 + directive | |
| PipelineRun / PipelineStepLog | Job/단계 로그 | version/revision/wc FK 유지 |
| SourceDocument | 지식화 문서 | workingCopyId 스코프 |
| KnowledgeChunk / Embedding / SearchIndex* | 검색 세대 | Worker import 경로 |
| PackReview | 제출/승인 이력 | PUBLISH 연계 재정의 가능 |
| PackDistributionMetadata | 배포 메타 | |
| ServiceValidation* | 서비스 검증 | |
| ApiKey / ApiUsageLog / PackInstallation | 사용자 서비스 | |
| AuditLog | 감사 | |
| ObjectStorageCleanupJob | OS 정리 | |

\* Organization은 현재 사용도 확인 후 축소 가능.

### E.2 변경 / 신규 필요

| 항목 | 판단 |
|------|------|
| **InventoryItem (신규)** | KNOWLEDGE_SCOPE용 path/status/reason/preview meta |
| Pack/Version workflow Step+State columns 또는 전용 WorkflowState | derive-only 제거 |
| `WorkerZipWorkingCopyPurpose.CORRECTION_REBUILD` | 보정 루프에 실사용 |
| CorrectionAssessment / Issue / Draft (신규, P2+ 엔진) | 현재 없음 |
| Release / immutable publish artifact | PackStatus만으로는 약함 |

### E.3 삭제 후보 (Clean Reset + schema drop)

| Model family | 이유 |
|--------------|------|
| DoclingImportBundle / KnowledgePackFile / NormalizedDocument / DoclingUpload* / DoclingProcessing* | Legacy 경로 |
| KnowledgeGraphNode/Edge | 제작 Rail 비핵심; 별도 ops로 격리하거나 삭제 |
| SourceValidation* / StructureCoverage* / KnowledgeQuality* / ChunkQuality* / RetrievalEvaluation* / ReleaseGate* | Store 쪽 수동 quality rail 의존; Worker 자동품질로 대체 후 drop 검토 |
| KnowledgeStructureTemplate* | structure quality 전용 — Worker 구조화로 대체 시 축소 |

**P1에서는 migration/데이터 삭제 없음.**

### E.4 Enum 정리 후보

| Enum / union | 조치 |
|--------------|------|
| `AdminReviewWorkflowStep` 9 | → 6 |
| `StoreWorkflowStatus` dead values | 제거 |
| `AdminWorkInboxQueueGroup.QUALITY_CHECK_REQUIRED` | 구현 또는 삭제 |
| `PipelineStatus` 세분값 | Worker stage 매핑 유지하되 Admin Step과 분리 |

---

## F. Object Storage Cleanup Map

### F.1 설정

| Env | 용도 |
|-----|------|
| `JYKSTORE_PAYLOAD_S3_BUCKET` | Bucket (환경별 실값) |
| `JYKSTORE_PAYLOAD_S3_PREFIX` | 기본 `payloads` |
| Driver | S3-compatible (`s3-object-storage.ts`) |

### F.2 Key 패턴 (실제 builder)

| 영역 | Key pattern | 생성 | 읽기 |
|------|-------------|------|------|
| Stable request mirror | `payloads/packs/{pack}/versions/{ver}/worker-request/source.zip` (+ `request.json`) | Provider submit | Legacy/compat only — **authoritative 아님** |
| Original revision | `.../source-revisions/{srev}/source.zip` | Provider/revision service | WC copy source |
| Working Copy | `.../source-revisions/{srev}/working-copies/{swc}/source.zip` | Admin run | Worker input stream |
| Run input | `.../runs/{run}/source/original.zip` | Pipeline | Worker |
| Run output | `.../runs/{run}/worker-output/*` | Pipeline upload | Import |
| RAG export | `.../runs/{run}/exports/rag-export.zip` | Export | SV/download |
| Docling pack files | `payloads/pack-files/{pack}/{ver}/{bundle}/{ROLE}/...` | Docling import | Legacy |
| Legacy payload ZIP | `{prefix}/{pack}/{ver}/{payloadId}.zip` | (schema removed) | cleanup script |

### F.3 Clean Reset 삭제 범위

**JYKStore Object Storage (해당 bucket + prefix) 전부 삭제 예정.**

권장 범위:

```text
s3://{JYKSTORE_PAYLOAD_S3_BUCKET}/{JYKSTORE_PAYLOAD_S3_PREFIX}/
  packs/**
  pack-files/**
  (및 legacy {packId}/{versionId}/*.zip 잔존분)
```

- 외부 별도 보관 원본은 **이 bucket/prefix와 혼동하지 말 것**.  
- DB truncate와 OS wipe는 트랜잭션이 아니므로 **OS wipe → DB reset** 또는 반대 순서를 runbook에 고정하고 재실행 idempotent하게.

현재 “Clean Reset” 명칭 코드는 없음. 최근접: `worker-zip-successor-reset.ts` (DB quality/SV만, **OS 미삭제**).

---

## G. Worker / Store Responsibility Matrix

| 책임 | Python Worker | TypeScript Store | 중복? |
|------|---------------|------------------|-------|
| ZIP parse / inventory | ✅ | preflight CD-only | 정책 JSON 이중 (`zip_exclusion_policy`) |
| 구조화 / chunk / embed | ✅ source of truth | ❌ ZIP 경로에서 재처리 금지 | Docling ND/TS chunk는 **병행 legacy** |
| validation_report | ✅ | quality runners가 별도 report 생성 | **예 — 품질 이중** |
| Object Storage I/O | ❌ | ✅ | |
| Prisma / Workflow / UX | ❌ | ✅ | |
| Docling 3-file import | PDF parser optional | 전체 파이프라인 | **예 — 경로 이중** |
| Query embedding (runtime) | — | ✅ `runtime-query-embedding` | OK |
| Correction override apply | 미구현 | 미구현 | P3+ |

**결론:** ZIP 제작 경로의 지식화 권한은 Python에 두고, Store는 Workflow·Inventory·Import·Gates에 한정. Docling/TS knowledge pipeline은 삭제 후보.

---

## H. UI / Rail Cleanup Matrix

| 현재 UI | 목표 | 조치 |
|---------|------|------|
| Inbox 8 queues | 6(+ops) | queue key rename; quality/provider-review 제거 |
| Detail 9 steps | 6 | `quality`/`providerConfirm`/`ops` 제거; `decision`∪`publish`; `searchValidation`→`serviceValidation` |
| 제공자 검토 Admin Step | PUBLISH 상태 | Panel을 Publish workbench Gate로 |
| Quality Step | GENERATION 결과 | 요약만 |
| Correction | CORRECTION | Override UI 재작성 |
| Provider chunk review | 서비스 결과 검토 | 기술 단위 UX 제거 |
| `/admin/generation` redirect | — | 유지 또는 제거 |
| `/admin/ops` | 운영 | 제작 Rail 밖 유지 |
| BottomTabNav admin tabs | 6 단계 정렬 | 재작성 |

CTA rename: `GO_SEARCH_VALIDATION` → `GO_SERVICE_VALIDATION`; `searchValidationDone` deprecated 제거.

---

## I. Test Cleanup Matrix

총 `src/__tests__` ≈ **263** files.

| 분류 | 예시 | 조치 |
|------|------|------|
| **유지** | `worker-zip-*.test.ts`, `zip-preflight-*`, object-storage, auth role, SV security | 새 Step id에 맞게 최소 수정 |
| **재작성** | `admin-review-rail-ux`, `admin-work-inbox-*`, `store-workflow-status`, provider review workbench | 6-step / 순서 변경 |
| **삭제 (Legacy)** | `docling-*`, `docling-knowledge-*`, `github-auto-collect*` (Builder), 다수 `search-data-generation*` Docling 시대, ND builder tests | Docling 삭제와 동반 |
| **보류** | distribution/RAG export integrity | Release 모델 확정 후 |

P2에서는 Workflow Core 테스트만 신규 golden path로 추가하고, legacy suite는 quarantine 목록으로 관리.

---

## J. Clean Reset 계획 (후속 실행용 — P1에서 실행 금지)

### J.1 목표 상태

- Legacy Docling/Builder 코드·스키마·OS 객체 제거  
- DB: JYKStore app data wipe  
- Object Storage: JYKStore bucket/prefix wipe  
- Seed: **관리자 1 / 제공자 1 / 사용자 1** + categories/templates만  

### J.2 안전 순서

1. **동결** — Public API 변경 금지 창구; feature flag로 Docling/ZIP 외 진입 차단  
2. **백업** — DB dump + (필요 시) 외부 원본 위치 문서화 (JYKStore OS와 분리)  
3. **코드 제거 PR** — Docling modules + 410 routes + dead panels (앱 기동·ZIP path 회귀)  
4. **Object Storage wipe** — configured bucket/prefix list-delete (dry-run → execute)  
5. **DB Reset** — migrate fresh 또는 truncate app tables; Prisma migrate deploy  
6. **Seed 3 accounts** — `prisma/seed.ts` 확장 (현재는 categories/templates만; demo pack 비시드)  
7. **Smoke** — Provider ZIP submit → Admin RECEIPT→…→PUBLISH → Consumer 이용  
8. **Rollback** — DB dump restore + OS는 외부 원본에서만 재적재 (JYKStore OS는 재현 불가 가정)

### J.3 Seed 단순화 제안

| 유지 | 제거 |
|------|------|
| 3 users + roles + 1 ProviderProfile | Quick login의 “전체 사용자 나열” |
| PackCategory + structure templates (필요 시 축소) | 미사용 seedPack helpers / 대량 fixture packs |
| Dev switcher flag | Production switcher |

`TestAccountQuickLogin`은 seed 3계정만 노출하도록 변경.

---

## K. P2 실행 계획 — Workflow Core 재구축

Cursor가 바로 수행할 수 있는 파일 단위 목록.

### K.1 목표

- 단일 `AdminWorkflowStep` = 6  
- State/Phase/Gate 타입 분리  
- Admin Rail + Inbox + Detail router 재매핑  
- **providerConfirm을 Step에서 제거하고** 서비스 검증 이후 PUBLISH 상태로 이동  
- quality를 독립 Step에서 제거  
- Public API response shape 불변 (내부 id rename은 compat alias 단기 허용 후 제거 일정 명시)

### K.2 작업 목록 (순서)

1. **`src/lib/workflow/` (신규) 또는 role-workspace 재편**  
   - `steps.ts`: `RECEIPT | KNOWLEDGE_SCOPE | GENERATION | CORRECTION | SERVICE_VALIDATION | PUBLISH`  
   - `states.ts` / `gates.ts`  
   - 전이 정책 순수 함수 + unit tests  

2. **`admin-review-rail.ts`**  
   - STEP_ORDER 6개  
   - quality/providerConfirm/ops/decision-publish 접힘 제거  
   - `searchValidation` → `serviceValidation` (compat query map)  

3. **`routes.ts` + `BottomTabNav.tsx` + `store-page-chrome.ts`**  
   - queue keys 정렬  

4. **`AdminReviewDetailPageClient.tsx`**  
   - panel switch 6개  
   - Provider review UI를 PUBLISH panel Gate로 편입  

5. **`AdminWorkInboxPageClient.tsx` + `admin-work-inbox-view-model.ts`**  
   - dead `QUALITY_CHECK_REQUIRED` 제거  
   - deep-link 매트릭스 수정  

6. **`store-workflow-status.ts` + markers**  
   - derive를 Step+State로 재정의  
   - handoff 순서: SV pass → provider review requested  

7. **`store-workflow-handoff-gates-policy.ts`**  
   - `canRequestProviderReview`를 SV 이후로  

8. **KNOWLEDGE_SCOPE 최소 골격**  
   - Inventory DTO (DB 테이블은 P2.1에서 additive migration 가능 — 대규모 drop은 Clean Reset)  
   - Preflight dialog를 Scope Step에 연결  

9. **테스트**  
   - rail/inbox/status/handoff 골든 테스트 재작성  
   - Docling tests는 quarantine 목록 문서화만 (삭제 실행은 P3)

### K.3 P2 비범위

- Docling 코드 실삭제 / DB drop / OS wipe  
- Correction Override 엔진 완성  
- Provider UX 전면 리디자인  
- Public API/MCP 변경  

### K.4 완료 기준

- Admin Rail에 quality / providerConfirm / ops / 이중 decision·publish **없음**  
- Step 6 + Gate 문서와 코드 일치  
- ZIP submit→generate→SV→provider confirm→publish 순서 테스트 통과  
- Legacy Docling 진입 UI 기본 비활성 유지  

---

## L. 참조한 주요 경로

```text
src/lib/role-workspace/admin-review-rail.ts
src/lib/store-workflow-status.ts
src/lib/store-workflow-handoff-gates.ts
src/lib/store-workflow-handoff-gates-policy.ts
src/lib/store-workflow-markers.ts
src/lib/admin-work-inbox-view-model.ts
src/lib/routes.ts
src/components/AdminReviewDetailPageClient.tsx
src/components/AdminWorkInboxPageClient.tsx
src/lib/python-worker/worker-output-object-keys.ts
src/lib/python-worker/worker-zip-*-service.ts
src/lib/object-storage/*
prisma/schema.prisma
python-worker/**
docs/p27-architecture-realignment/* (history only)
```

---

## M. P1 완료 보고 체크리스트 (프롬프트 §16)

| # | 항목 | 결과 |
|---|------|------|
| 1 | 조사 주요 경로 | §L |
| 2 | 현재 Workflow | §B — 9 steps + 8 queues + 19 statuses + phases/gates |
| 3 | 주요 복잡성 | Step/State/Gate 혼재; SV↔provider 순서 역전; Inventory DB 부재; Docling 병행 |
| 4 | 삭제 후보 | Docling ~68 files + 410 routes + dead step/queue + (후속) quality model families |
| 5 | 통합/재작성 | Rail/Inbox/Status/Handoff; Generation card 분할; Provider review UX |
| 6 | DB Cleanup | §E — Docling* drop; quality* 검토; Inventory/Correction 신규 |
| 7 | Object Storage | §F — `payloads/**` (및 pack-files) wipe |
| 8 | Worker/Store 중복 | 품질·Docling·exclusion policy |
| 9 | Seed/계정 | categories/templates only; quick login=실DB 사용자; **3계정 seed 미구현** |
| 10 | 본 보고서 | `docs/JYKStore_P1_current_architecture_audit_and_cleanup_plan.md` |
| 11 | P2 범위 | §K Workflow Core only |
| 12 | Git | 아래 |

### Git 상태 (감사 종료 시점)

```text
HEAD: eb3eacc4
branch: main == origin/main
untracked (제외 유지): projects/JYKPackBuilder/, projects/JYKStore/agent-tools/
```

로컬에 `ProviderGenerationReviewPanel.tsx` 수정이 보일 수 있으나 **본 P1 감사 산출물이 아님** — 커밋/삭제하지 않음.

---

**P1 종료 조건 충족:** Legacy 실삭제·DB/OS 초기화 없이, 근거 있는 삭제·통합 목록과 P2 Workflow Core 실행 계획을 확정함.
