# Docling adapter operations

## 역할 분리

| 구성요소 | 책임 |
|----------|------|
| 외부 Docling | 원본 → JSON/Markdown 생성 (Store 밖) |
| JYKStore adapter | 검증·origin match·정규화·NormalizedDocument 저장 |
| Provider UX | 3파일 업로드·미리보기·재시도/교체 |
| Admin UX | 근거 열람·다운로드·유통 메타데이터 보정 |

## 번들 상태

`UPLOADED → VALIDATING → VALID → NORMALIZING → NORMALIZED → REVIEW_READY`

실패 시:

- `VALIDATION_FAILED`
- `NORMALIZATION_FAILED`

`canRetry`가 true이면 Provider가 `/docling-import/retry`로 재처리할 수 있습니다.

## 운영 체크리스트

1. Object storage에 pack-file 키가 정상 기록되는지 확인
2. SHA-256·MIME·확장자 가드가 역할별로 통과하는지 확인
3. Origin match(파일명/MIME) WARNING/MISMATCH를 검수에서 확인
4. NormalizedDocument `structure` 미리보기(Sections/Tables/Figures/Markdown)
5. 처리 로그(`DoclingProcessingLog`)로 단계별 성공/실패 추적
6. 제출 스냅샷 mode=`DOCLING_BUNDLE` 보존

## 재생성

어댑터 버전을 올린 뒤 동일 원본으로 NormalizedDocument를 다시 만들 수 있습니다.
원본 파일 object key와 checksum은 변경하지 않습니다.

## 비범위

- Store 내 Docling 실행
- Builder 파이프라인 재활성
- Retrieval index / MCP exposure (후속)
