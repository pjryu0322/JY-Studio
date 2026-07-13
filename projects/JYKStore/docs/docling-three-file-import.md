# Docling 3-file import

JYKStore는 Docling을 **실행하지 않습니다**. Provider는 외부 Docling으로 생성한 결과물 3파일을 업로드합니다.

## 업로드 파일

| 역할 | 필드명 | 설명 |
|------|--------|------|
| 원본문서 | `sourceFile` | PDF/DOCX 등 원본 |
| Docling JSON | `doclingJsonFile` | DoclingDocument JSON |
| Docling Markdown | `doclingMarkdownFile` | Docling Markdown |

## Provider API

- `GET/POST/DELETE /api/v1/provider/packs/[packId]/docling-import`
- `POST /api/v1/provider/packs/[packId]/docling-import/retry`
- `GET /api/v1/provider/packs/[packId]/docling-import/files/[fileId]/download`
- `GET /api/v1/provider/packs/[packId]/normalized-document`

## Admin API

- `GET /api/v1/admin/reviews/[packId]/docling-import`
- `GET /api/v1/admin/reviews/[packId]/docling-import/files/[fileId]/download`
- `GET /api/v1/admin/reviews/[packId]/normalized-document`
- `PATCH /api/v1/admin/reviews/[packId]/distribution-metadata` (Store 메타데이터 보정)

## 불변성

- 업로드된 원본 3파일은 불변(immutable)입니다.
- NormalizedDocument는 Store가 어댑터로 재생성할 수 있습니다.
- 검수 제출 이력이 있으면 Provider는 삭제할 수 없습니다.

## 레거시 ZIP

레거시 ZIP Payload 업로드는 계속 지원합니다. Payload 탭에서 **레거시 ZIP Payload** 섹션으로 접혀 있습니다.
Docling `REVIEW_READY` bundle이 있으면 ZIP 없이도 검수 요청 조건을 충족할 수 있습니다.

## UX

- Provider Payload 탭: Docling 3파일 업로드가 기본 경로
- Admin 검수: Docling 근거 탭에서 다운로드·NormalizedDocument 미리보기·유통 메타데이터 보정
