# Docling 3-file import

JYKStore는 Docling을 **실행하지 않습니다**. Provider는 외부 Docling으로 생성한 결과물 3파일을 업로드합니다.

## 업로드 파일

| 역할 | 필드명 | 설명 |
|------|--------|------|
| 원본문서 | `sourceFile` | PDF/DOCX 등 원본 |
| Docling JSON | `doclingJsonFile` | DoclingDocument JSON |
| Docling Markdown | `doclingMarkdownFile` | Docling Markdown |

## Adapter Version

`adapterVersion`은 서버 상수(`DOCLING_ADAPTER_VERSION`)만 사용합니다.
클라이언트가 FormData로 보내더라도 무시하며, Bundle·NormalizedDocument·ProcessingLog·검수 Snapshot이 동일 서버 버전을 가집니다.
Snapshot의 adapterVersion은 활성 `NormalizedDocument.adapterVersion`에서 기록합니다.

## 파일 Signature 검증

원본문서는 확장자·클라이언트 MIME·실제 바이트 Signature(및 Office OOXML 내부 구조)를 교차 검증합니다.
불일치 시 `DOCLING_FILE_SIGNATURE_MISMATCH` / `DOCLING_MIME_MISMATCH` 등으로 업로드를 차단합니다.

## Active Bundle · Storage Status

- Version당 Active Bundle은 1개(partial unique index).
- 새 Bundle은 검증·정규화 성공(`REVIEW_READY`) 후에만 Active로 승격합니다.
- **검증·정규화 실패 시 Staging을 보존**합니다(`isActive=false`, `storageStatus=ACTIVE`, `stagingReason` 설정). 즉시 Object 삭제하지 않으며 Provider가 재시도·다운로드·삭제할 수 있습니다.
- 교체 시 이전 Bundle은 `deactivatedAt` / `replacedByBundleId` / `storageStatus=DELETE_PENDING` 후 Object 삭제. Post-TX cleanup은 승격 트랜잭션이 반환한 `replacedBundleId`만 사용합니다.
- Cleanup Job 완료 후 Bundle `storageStatus`를 `DELETED`/`DELETE_FAILED`로 동기화합니다(`doclingBundleId` 링크).
- 검수 제출 이력이 있으면 교체·삭제 금지(`DOCLING_IMMUTABLE_AFTER_SUBMISSION`).

## Provider API

- `GET/POST/DELETE /api/v1/provider/packs/[packId]/docling-import` (`GET`은 `{ bundle, stagingBundle }` 반환)
- `POST /api/v1/provider/packs/[packId]/docling-import/retry` (pack-level facade: staging 우선)
- `POST /api/v1/provider/packs/[packId]/docling-import/[bundleId]/retry`
- `DELETE /api/v1/provider/packs/[packId]/docling-import/[bundleId]`
- `GET /api/v1/provider/packs/[packId]/docling-import/files/[fileId]/download` (Staging도 `storageStatus=ACTIVE`이면 허용)
- `GET /api/v1/provider/packs/[packId]/normalized-document`

## Admin API

- `GET /api/v1/admin/reviews/[packId]/docling-import` (`{ bundle, stagingBundle }`)
- `GET /api/v1/admin/reviews/[packId]/docling-import/files/[fileId]/download`
- `GET /api/v1/admin/reviews/[packId]/normalized-document`
- `PATCH /api/v1/admin/reviews/[packId]/distribution-metadata` (Store 메타데이터 보정)

## 검수 승인 경로 (P0-A.2)

| Snapshot mode | Release Gate | 무결성 |
|---|---|---|
| `DOCLING_BUNDLE` | 실행하지 않음 | detail=`HEAD_ONLY`, accept/approve=`FULL` + fingerprint 재계산 |
| `DISTRIBUTION` | 실행하지 않음 | ZIP/manifest drift |
| Legacy Builder | `evaluateReleaseGateForPack` | 기존 품질 게이트 |

관리자 detail은 DB/Snapshot·Object Presence(HEAD)를 확인하고, 접수·승인 시 Full SHA를 검증합니다.


## 불변성

- 업로드된 원본 3파일은 불변(immutable)입니다.
- NormalizedDocument는 Store가 어댑터로 재생성할 수 있습니다.
- 검수 제출 이력이 있으면 Provider는 삭제할 수 없습니다.

## 레거시 ZIP

레거시 ZIP Payload 업로드는 계속 지원합니다. Payload 탭에서 **레거시 ZIP Payload** 섹션으로 접혀 있습니다.
Docling `REVIEW_READY` bundle이 있으면 ZIP 없이도 검수 요청 조건을 충족할 수 있습니다.

## UX

- Provider Payload 탭: Docling 3파일 업로드가 기본 경로
- Admin 검수: Docling 탭 + 무결성 PASS/BLOCKED 요약
