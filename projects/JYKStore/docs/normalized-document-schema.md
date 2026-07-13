# NormalizedDocument schema

`NormalizedDocument`는 Docling JSON(+ Markdown)을 Store 표준 구조로 정규화한 **재생 가능한** 문서 모델입니다.

## 요약 필드 (DTO)

| 필드 | 설명 |
|------|------|
| `id` | NormalizedDocument ID |
| `bundleId` | DoclingImportBundle ID |
| `adapterType` / `adapterVersion` | 어댑터 식별 |
| `sourceSchemaName` / `sourceSchemaVersion` | Docling schema |
| `title` / `language` | 문서 메타 |
| `fingerprint` | 구조 지문 (`normalized-document-v2` canonical JSON SHA-256) |
| `fingerprintVersion` | Fingerprint 알고리즘 id (`normalized-document-v2`) |
| `warningCount` | 정규화 경고 수 |
| `sourceFileId` / `jsonPayloadFileId` / `markdownPayloadFileId` | 원본 파일 참조 |
| `sourcePayloadChecksum` | 원본 체크섬 요약 |

## Structure payload

`GET .../normalized-document`의 `structure`:

```json
{
  "sections": [],
  "tables": [],
  "figures": [],
  "readingOrder": [],
  "warnings": []
}
```

섹션/테이블/피겨는 Docling adapter normalizer가 생성합니다. Retrieval/MCP 인덱스는 이 구조를 후속 단계에서 소비합니다.

## Capabilities

동일 응답에 `capabilities`가 포함됩니다.

```json
{
  "normalizedDocument": { "supported": true, "status": "READY" },
  "retrieval": { "supported": false, "status": "NOT_BUILT" },
  "mcp": { "supported": false, "status": "NOT_BUILT" }
}
```

- `normalizedDocument.status`: `READY` | `NOT_READY`
- `retrieval` / `mcp`: 현재 `NOT_BUILT` (후속)

## 재생 원칙

원본 3파일은 그대로 두고, adapter 버전 업그레이드 시 NormalizedDocument만 다시 생성할 수 있습니다.
