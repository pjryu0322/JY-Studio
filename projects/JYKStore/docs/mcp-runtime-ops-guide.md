# JYKStore MCP Runtime Ops Guide

P22.6/P26 operational guide for the JYKStore MCP Server Bridge.

## Overview

JYKStore MCP Server Bridge는 JYKStore Public API를 MCP tools/resources로 노출하는 bridge이다.
MCP server는 답변을 생성하지 않고, JYKStore Public API의 context/graph/export/chunk 응답을 전달한다.

- No Prisma/DB access inside `mcp-server/`
- No external AI / LLM provider calls
- Only PUBLISHED / VERIFIED packs are returned (enforced by Public API)

## Runtime modes

| Mode | Use case |
| --- | --- |
| `stdio` | Local MCP client (Cursor / desktop). Default and recommended for local use. |
| `http` | Local/remote HTTP MCP runtime verification and controlled network operation. |

## Required environment variables

### Required

| Variable | Example | Description |
| --- | --- | --- |
| `JYKSTORE_BASE_URL` | `http://localhost:3004` | Reachable JYKStore app base URL |
| `JYKSTORE_API_KEY` | `<API_KEY>` | API key with `context:read` scope |

### Optional

| Variable | Example | Description |
| --- | --- | --- |
| `JYKSTORE_MCP_TRANSPORT` | `stdio` or `http` | Transport mode (default `stdio`) |
| `JYKSTORE_MCP_PORT` | `3014` | HTTP listen port (HTTP mode only) |
| `JYKSTORE_MCP_ALLOWED_PACK_IDS` | `pack-a,pack-b` | Optional pack allowlist (comma-separated). Empty = no MCP-side restriction beyond Public API. |
| `JYKSTORE_MCP_ALLOWED_ORIGINS` | `https://app.example` | CORS allowlist for HTTP mode. Empty ≈ localhost Origins only. `"*"` is development-only. |
| `JYKSTORE_MCP_MAX_RESPONSE_BYTES` | `2000000` | Max MCP response size before `JYKSTORE_MCP_RESPONSE_TOO_LARGE` |
| `JYKSTORE_MCP_MAX_EXPORT_SOURCE_BYTES` | `20000000` | Max export source size before `JYKSTORE_MCP_EXPORT_TOO_LARGE` |

### Secrets handling

- `JYKSTORE_API_KEY`는 서버 환경변수로만 관리한다.
- Client 설정 파일에 실제 운영 key를 커밋하지 않는다.
- Browser `localStorage` / `sessionStorage`에 저장하지 않는다.
- Docs/examples는 `<API_KEY>` placeholder만 사용한다.

## API Key create / rotate / revoke

1. JYKStore UI (`/api-keys`) 또는 Provider Connect 패널에서 API Key를 생성한다.
2. 생성 응답의 **`rawKey`** 필드(1회만)를 MCP 서버 env `JYKSTORE_API_KEY`에 넣는다. (`plainKey` 필드는 사용하지 않음)
3. MCP용 key에는 **`context:read` scope**가 필요하다 (기본 발급 scope에 포함).
4. 목록/Admin에서는 `maskedKey`만 보인다. DB에는 hash만 저장된다.
5. 유출·교체 시:
   - 새 key를 발급 → MCP env를 교체 → 기존 key를 revoke
6. Admin 운영 콘솔 `/admin/ops/api-keys`에서 전체 key 상태·폐기 가능 (raw key 조회 불가).
7. Admin API는 관리자 계정(`JYKSTORE_ADMIN_EMAILS` → accountRole=`ADMIN`) 로그인이 필요하다.
8. Admin UI에 입력한 token은 브라우저 저장소에 두지 않고, 요청 header `X-JYKStore-Admin-Token`으로만 전달한다.

## Local stdio run

```powershell
cd C:\project\JY-Studio\projects\JYKStore

$env:JYKSTORE_BASE_URL="http://localhost:3004"
$env:JYKSTORE_API_KEY="<API_KEY>"
npm run mcp:stdio
```

Prerequisites: JYKStore app must be reachable at `JYKSTORE_BASE_URL`.

## Local HTTP run

```powershell
cd C:\project\JY-Studio\projects\JYKStore

$env:JYKSTORE_BASE_URL="http://localhost:3004"
$env:JYKSTORE_API_KEY="<API_KEY>"
$env:JYKSTORE_MCP_TRANSPORT="http"
$env:JYKSTORE_MCP_PORT="3014"
npm run mcp:http
```

Health checks:

```text
GET http://localhost:3014/health
GET http://localhost:3014/ready
```

Expected:

- `/health` → `{ "ok": true, "transport": "http", ... }`
- `/ready` → `{ "ok": true, "apiKeyConfigured": true, ... }` without the raw API key

MCP Streamable HTTP endpoint: `POST http://localhost:3014/`

## MCP client examples

### Cursor local stdio

Cursor on Windows may spawn MCP servers **without honoring `cwd`** (process starts under `%USERPROFILE%`). Use the absolute-path launcher so the process does not depend on Cursor’s working directory:

```json
{
  "mcpServers": {
    "jykstore": {
      "command": "node",
      "args": [
        "<ABSOLUTE_PATH_TO_JYKSTORE>/scripts/mcp-stdio-launcher.mjs"
      ],
      "env": {
        "JYKSTORE_BASE_URL": "http://localhost:3004",
        "JYKSTORE_API_KEY": "<API_KEY>"
      }
    }
  }
}
```

Replace `<ABSOLUTE_PATH_TO_JYKSTORE>` with your checkout (forward slashes are fine on Windows).  
Also see [`docs/examples/cursor-mcp.jykstore.example.json`](./examples/cursor-mcp.jykstore.example.json). Never commit a real API key.

### HTTP mode

HTTP mode는 reverse proxy / internal network 환경에서만 사용한다.
Remote auth / OAuth는 아직 후속 단계(P23/P27)다.
공개 인터넷에 MCP HTTP endpoint를 직접 노출하지 않는 것을 권장한다.

## Process / deploy runbook

Dockerfile 추가는 본 단계 범위가 아니다. Process manager로 HTTP transport를 운영할 때의 최소 흐름:

```bash
npm ci
npm run build
npm run mcp:http
```

`systemd` 또는 `pm2`로 프로세스를 관리할 수 있다. 이 저장소에 pm2 dependency는 추가하지 않는다.

Ensure before start:

1. JYKStore app is up and reachable from the MCP host
2. Env vars are injected by the process manager / secret store (not from git)
3. Port `JYKSTORE_MCP_PORT` is bound only on the intended interface (prefer localhost behind a proxy)

## Reverse proxy guide

Nginx example (documentation only):

```nginx
location /mcp/ {
  proxy_pass http://127.0.0.1:3014/;
  proxy_http_version 1.1;
  proxy_set_header Host $host;
  proxy_set_header X-Request-ID $request_id;
}
```

Notes:

- Authorization header에는 MCP client 인증 토큰을 넣는 구조가 아직 없다.
- `JYKSTORE_API_KEY`는 MCP server env에만 있다.
- Remote public exposure는 OAuth / auth hardening 이후 권장한다.

## Logging policy

Allowed in logs:

- method
- path
- status
- durationMs
- requestId
- tool name
- error code

Never log:

- API key
- Authorization header
- request body
- response body
- chunk content
- `DATABASE_URL`
- stack trace

Logs may mask keys (for example `abcd…wxyz`) but must never print the full secret.

## Deployment checklist

- [ ] `JYKSTORE_BASE_URL` points to a reachable JYKStore app
- [ ] `JYKSTORE_API_KEY` has `context:read` scope
- [ ] API key is not committed to git or client config samples
- [ ] `GET /health` returns `ok`
- [ ] `GET /ready` returns `apiKeyConfigured: true` without key value
- [ ] stdio `tools/list` works with the local MCP client
- [ ] HTTP `tools/list` works when HTTP mode is enabled
- [ ] Chunked export tool returns `content` / `nextOffset` / `hasMore`
- [ ] Logs do not contain API key or response body
- [ ] `JYKSTORE_MCP_ALLOWED_PACK_IDS` configured when restricting packs
- [ ] `JYKSTORE_MCP_ALLOWED_ORIGINS` configured for HTTP mode

## Troubleshooting

| Symptom / code | Likely cause | Action |
| --- | --- | --- |
| `PACK_NOT_FOUND` | Pack id wrong, not published/verified, or filtered by Public API | Confirm pack status in JYKStore; use a PUBLISHED/VERIFIED id |
| `UNAUTHORIZED` | Missing/invalid API key or unknown key | Re-check env; reissue key; never log raw key |
| `API_KEY_REVOKED` | Key was revoked | Issue a new key and update MCP env; revoke is irreversible |
| `API_KEY_EXPIRED` | `expiresAt` is in the past | Issue a new key (optionally with new expiry) and rotate env |
| `INSUFFICIENT_SCOPE` / `FORBIDDEN` | Key lacks `context:read` (or request rejected) | Reissue with default scopes including `context:read` |
| `JYKSTORE_MCP_RESPONSE_TOO_LARGE` | Tool/export response exceeds `JYKSTORE_MCP_MAX_RESPONSE_BYTES` | Lower `topK` / use chunk tools with smaller `limitBytes` |
| `JYKSTORE_MCP_EXPORT_TOO_LARGE` | Full export source exceeds `JYKSTORE_MCP_MAX_EXPORT_SOURCE_BYTES` | Use chunked export tools; avoid full export for large packs |
| `JYKSTORE_MCP_INVALID_INPUT` | Schema validation failed (pack id, query length, offset/limitBytes, etc.) | Fix tool arguments; retrieval `query` max is 2000 characters |
| CORS blocked origin | Origin not allowed by `JYKSTORE_MCP_ALLOWED_ORIGINS` | Add the client origin, or keep empty allowlist for localhost-only |
| HTTP 404 on MCP endpoint | Wrong path/port or reverse proxy misconfiguration | Hit `/` on MCP port; ensure proxy strips/rewrites path correctly |

## Runtime verification

From `projects/JYKStore`:

```powershell
npm run mcp:test
npm run mcp:test:runtime
npm test
```

These tests cover registration snapshots, HTTP JSON-RPC runtime (mocked Public API), and stdio smoke startup. They do not require a live database for MCP runtime coverage when using the mock helpers.

## Public API quota (P24/P25)

- Public API quota는 인증된 API Key의 `clientId`(없으면 `apiKeyId`)를 tenantKey로 사용한다.
- 기본 FREE: per-minute 30 / per-day 1000 (`JYKSTORE_QUOTA_*`로 override).
- 초과 시 Public API는 `429 QUOTA_EXCEEDED` + `retryAfterSeconds`를 반환한다.
- MCP Server는 quota를 DB에서 직접 계산하지 않고 Public API 429를 그대로 중계한다.
- `QUOTA_EXCEEDED` 발생 시 `topK`/`limitBytes` 축소 또는 호출 빈도를 낮춘다.
- Admin quota page `/admin/ops/quota`에서 client별 사용량·429를 확인한다 (관리자 계정 로그인 필요).
- UsageLog quota metadata는 Public API gateway 기준으로 기록된다.
- 운영 점검 시 `quotaWarning`, `quotaMinuteCount`, `quotaDayCount`, `quotaPerMinuteLimit`, `quotaPerDayLimit` 필드를 활용한다.
- P24.2 refactor는 운영 동작을 바꾸지 않고 Public API gateway 내부 구조만 정리했다.

## MCP HTTP health / ready (P25)

- `GET /health`: process alive (`transport`, no secrets).
- `GET /ready`: `baseUrlConfigured`, `apiKeyConfigured`, `allowedPackIdsConfigured`만 반환 (base URL·API Key 원문 미노출).

## P25.1 polish

- App `GET /api/health`는 DB/Prisma probe 없이 process alive만 확인합니다.
- App `GET /api/ready`는 env `errors`/`warnings`에 secret 없이 env 이름만 포함합니다.

## Out of scope (later)

- OAuth / remote MCP auth
- Paid billing / payment charge
- tenant-isolated MCP gateway beyond Public API quota
- Web Streams true streaming
