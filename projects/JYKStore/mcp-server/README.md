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
```

Do not commit real API keys. Logs mask the key (`abcd…wxyz`).

## Scripts

```powershell
cd C:\project\JY-Studio\projects\JYKStore

$env:JYKSTORE_BASE_URL="http://localhost:3004"
$env:JYKSTORE_API_KEY="<YOUR_JYKSTORE_API_KEY>"

npm run mcp:stdio
# optional HTTP transport (experimental Streamable HTTP)
npm run mcp:http
```

## Tools

- `jykstore_retrieval_query` → `POST /api/v1/retrieval/query`
- `jykstore_graph_query` → `POST /api/v1/graph/query`
- `jykstore_export_package` → `GET /api/v1/exports/package`
- `jykstore_export_rag_jsonl` → `GET /api/v1/exports/rag-jsonl`
- `jykstore_export_graph` → `GET /api/v1/exports/graph`
- `jykstore_export_openapi` → `GET /api/v1/exports/openapi`
- `jykstore_export_mcp_manifest` → `GET /api/v1/exports/mcp-manifest`

Tools return Public API JSON/text **as-is**. No answer generation or summarization.

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
- Public API auth/visibility remain authoritative

## Out of scope (later)

- Streaming/chunked large exports
- OAuth / admin auth redesign
- MCP prompts
- External embedding providers
