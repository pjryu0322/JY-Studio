# JYKStore MCP Server Bridge

P22 MCP Server runtime. This process wraps **JYKStore Public API** as MCP tools/resources.

It is **not** a new knowledge store and does **not** call external AI providers or query Prisma/DB directly.

## Relationship to P15 MCP-ready manifest

| Artifact | Role |
| --- | --- |
| P15 `GET /api/v1/exports/mcp-manifest` | Contract / discovery document for wrappers |
| P22 `mcp-server/` | Running MCP bridge that calls Public API |

## Requirements

- Running JYKStore app (default `http://localhost:3004`)
- API key with `context:read` scope
- Only **PUBLISHED / VERIFIED** packs are returned (enforced by Public API)

## Environment

```text
JYKSTORE_BASE_URL=http://localhost:3004
JYKSTORE_API_KEY=<YOUR_JYKSTORE_API_KEY>
JYKSTORE_MCP_TRANSPORT=stdio
JYKSTORE_MCP_PORT=3014
JYKSTORE_MCP_ALLOWED_PACK_IDS=
JYKSTORE_MCP_ALLOWED_ORIGINS=
JYKSTORE_MCP_MAX_RESPONSE_BYTES=2000000
JYKSTORE_MCP_MAX_EXPORT_SOURCE_BYTES=20000000
```

Do not commit real API keys. Logs mask the key (`abcd…wxyz`).

## Scripts

```powershell
cd C:\project\JY-Studio\projects\JYKStore

$env:JYKSTORE_BASE_URL="http://localhost:3004"
$env:JYKSTORE_API_KEY="<YOUR_JYKSTORE_API_KEY>"

npm run mcp:stdio
# optional HTTP transport
npm run mcp:http
```

## HTTP transport

- stdio is default.
- HTTP transport is optional for remote MCP clients.
- Endpoints:
  - `GET /health`
  - `GET /ready`
  - MCP Streamable HTTP endpoint: `/`
- API key is stored server-side in env and is never returned by health/ready.
- Optional CORS via `JYKSTORE_MCP_ALLOWED_ORIGINS` (comma-separated). Empty allowlist ≈ localhost Origins only. `"*"` is for development only.
- SIGINT / SIGTERM trigger graceful HTTP shutdown.

## Tools

- `jykstore_retrieval_query` → `POST /api/v1/retrieval/query`
- `jykstore_graph_query` → `POST /api/v1/graph/query`
- `jykstore_export_package` → `GET /api/v1/exports/package`
- `jykstore_export_rag_jsonl` → `GET /api/v1/exports/rag-jsonl`
- `jykstore_export_graph` → `GET /api/v1/exports/graph`
- `jykstore_export_openapi` → `GET /api/v1/exports/openapi`
- `jykstore_export_mcp_manifest` → `GET /api/v1/exports/mcp-manifest`

Tools return Public API JSON/text **as-is**. No answer generation or summarization.

## Chunked export tools

Large exports can be read in chunks:

- `jykstore_export_package_chunk`
- `jykstore_export_rag_jsonl_chunk`
- `jykstore_export_graph_chunk`

These tools call Public API chunk endpoints:

```text
GET /api/v1/exports/package/chunk
GET /api/v1/exports/rag-jsonl/chunk
GET /api/v1/exports/graph/chunk
```

P22.3 chunked export는 MCP server 내부 분할 안정화 단계였습니다.
P22.4/P22.5부터 chunked export tools는 Public API chunk endpoints를 호출합니다.

- MCP Server no longer needs to fetch the full package/rag-jsonl/graph export before returning a chunk.
- Public API chunk endpoints remain authoritative for visibility and API key scope.

Input:

```json
{
  "knowledgePackId": "pack-id",
  "offset": 0,
  "limitBytes": 256000
}
```

Response:

```json
{
  "offset": 0,
  "nextOffset": 256000,
  "hasMore": true,
  "byteLength": 256000,
  "content": "..."
}
```

Chunked resource reads도 지원합니다:

```text
jykstore://packs/{knowledgePackId}/rag-jsonl?offset=0&limitBytes=256000
```

Query string이 없으면 기존 full resource 동작을 유지합니다.

## Resources

- `jykstore://openapi`
- `jykstore://packs/{knowledgePackId}/package`
- `jykstore://packs/{knowledgePackId}/rag-jsonl`
- `jykstore://packs/{knowledgePackId}/graph`
- `jykstore://packs/{knowledgePackId}/openapi`
- `jykstore://packs/{knowledgePackId}/mcp-manifest`

## Cursor MCP config example

Paths and keys differ per machine. Use placeholders only.

```json
{
  "mcpServers": {
    "jykstore": {
      "command": "npm",
      "args": ["run", "mcp:stdio"],
      "cwd": "C:/project/JY-Studio/projects/JYKStore",
      "env": {
        "JYKSTORE_BASE_URL": "http://localhost:3004",
        "JYKSTORE_API_KEY": "<YOUR_JYKSTORE_API_KEY>"
      }
    }
  }
}
```

## Desktop MCP client config example

Same shape as Cursor local MCP `mcpServers` entry (stdio + env). Replace `cwd` and API key for your environment.

## Guards

- Optional `JYKSTORE_MCP_ALLOWED_PACK_IDS` allowlist (comma-separated)
- Input validation (`JYKSTORE_MCP_INVALID_INPUT`)
- `jykstore_retrieval_query.query`는 JYKStore Public Retrieval API와 동일하게 최대 2000자입니다.
- 긴 query는 AI Agent의 retrieval intent를 전달하기 위한 용도입니다. 정확한 검색을 위해 핵심 의도와 metadataFilters를 함께 사용하는 것을 권장합니다.
- Response size guard (default 2MB → `JYKSTORE_MCP_RESPONSE_TOO_LARGE`)
- Chunked export source guard (default 20MB → `JYKSTORE_MCP_EXPORT_TOO_LARGE`)
- Chunked export final MCP response is also checked against `JYKSTORE_MCP_MAX_RESPONSE_BYTES`.
- If a chunk response is too large after JSON encoding, reduce `limitBytes` and retry from the same `offset`.
- HTTP error logs are sanitized and do not include API keys, Authorization headers, request bodies, response bodies, or stack traces by default.
- MCP and Public API export routes share the same safe logging policy.
- Public API auth/visibility remain authoritative

## Out of scope (later)

- True upstream stream response using Web Streams
- Full MCP HTTP JSON-RPC integration test
- Production deployment guide
- OAuth / remote MCP auth
- Multi-tenant MCP gateway
- Per-client rate limit / quota hardening
- External embedding providers
