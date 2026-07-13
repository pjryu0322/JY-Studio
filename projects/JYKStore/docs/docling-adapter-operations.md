# Docling adapter operations

## 역할 분리

| 구성요소 | 책임 |
|----------|------|
| 외부 Docling | 원본 → JSON/Markdown 생성 (Store 밖) |
| JYKStore adapter | 검증·origin match·정규화·NormalizedDocument 저장 |
| Provider UX | 3파일 업로드·미리보기·재시도/교체 |
| Admin UX | 근거 열람·다운로드·유통 메타데이터 보정·승인 전 무결성 |

## Adapter Version

서버 런타임 상수 `DOCLING_ADAPTER_VERSION`만 Bundle / NormalizedDocument / ProcessingLog / Snapshot에 기록합니다.
클라이언트 입력 `adapterVersion`은 무시합니다.

## 번들 상태

`UPLOADED → VALIDATING → VALID → NORMALIZING → NORMALIZED → REVIEW_READY`

실패 시:

- `VALIDATION_FAILED`
- `NORMALIZATION_FAILED`

업로드 시 새 Bundle은 비활성으로 스테이징되고, `REVIEW_READY` 성공 후에만 Active로 승격합니다.
검증·정규화 실패 시 기존 Active는 유지되고, **실패한 Staging은 보존**합니다(`storageStatus=ACTIVE`, `stagingReason` 설정).
Provider는 Staging에 대해 재시도·다운로드·삭제가 가능합니다.

`canRetry`가 true이면 Provider가 `/docling-import/retry`(또는 `/docling-import/[bundleId]/retry`)로 재처리할 수 있습니다.
RETRY ProcessingLog는 반드시 SUCCEEDED 또는 FAILED로 완료됩니다.

## Storage Status

`ACTIVE → DELETE_PENDING → DELETED | DELETE_FAILED`

삭제 실패 시 Cleanup Job(`doclingBundleId`/`knowledgePackFileId` 링크)을 재사용하고,
Job 완료 후 Bundle `storageStatus`를 동기화합니다.

교체(promote) 후 Object 정리는 트랜잭션이 반환한 `replacedBundleId`만 대상으로 합니다.

## 승인 전 무결성

Admin detail은 `HEAD_ONLY`(존재·크기), 접수·승인은 `FULL`(본문 SHA)로 Object Storage를 검증합니다.
NormalizedDocument fingerprint는 `normalized-document-v2`로 재계산하여 Snapshot과 일치해야 합니다.
`DOCLING_BUNDLE` 승인은 Legacy release gate를 실행하지 않습니다.

실패 시 Audit `DOCLING_REVIEW_INTEGRITY_FAILED`, 성공 시 `DOCLING_REVIEW_INTEGRITY_VERIFIED`.

## 운영 체크리스트

1. Object storage에 pack-file 키가 정상 기록되는지 확인
2. SHA-256·MIME·확장자·Signature 가드가 역할별로 통과하는지 확인
3. Origin match(파일명/MIME) WARNING/MISMATCH를 검수에서 확인
4. NormalizedDocument `structure` 미리보기(Sections/Tables/Figures/Markdown)
5. 처리 로그(`DoclingProcessingLog`)로 단계별 성공/실패 추적
6. 제출 스냅샷 mode=`DOCLING_BUNDLE` 보존
7. 승인 전 Object Storage 무결성 재검증
8. Version당 Active Bundle 1개·storageStatus 정상

## 재생성

어댑터 버전을 올린 뒤 동일 원본으로 NormalizedDocument를 다시 만들 수 있습니다.
원본 파일 object key와 checksum은 변경하지 않습니다.
Fingerprint는 `normalized-document-v2` canonical JSON hash입니다.

## 비범위

- Store 내 Docling 실행
- Builder 파이프라인 재활성
- Retrieval index / MCP exposure (후속)
