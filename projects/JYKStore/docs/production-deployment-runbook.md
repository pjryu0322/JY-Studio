# JYKStore Production Deployment Runbook

## 1. Scope and non-goals

This runbook covers deploying the JYKStore Next.js app and optional MCP HTTP bridge. It does not cover OAuth/SSO, paid billing, or external AI provider integration.

## 2. Required environment variables

Production **required**:

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | PostgreSQL connection for Prisma |
| `JYKSTORE_API_KEY_SECRET` | API Key hashing secret (do not use dev SHA-256-only fallback in production) |
| `JYKSTORE_ADMIN_OPS_TOKEN` | Protects `/api/v1/admin/**` (header `X-JYKStore-Admin-Token`) |

See `projects/JYKStore/.env.example` for quota and MCP optional variables.

## 3. Secret handling policy

- Never commit real secrets to git.
- Do not log `DATABASE_URL`, API keys, Admin Ops Token, or `Authorization: Bearer` values.
- Admin UI stores Ops Token in React state only (no localStorage/sessionStorage).
- MCP server stores `JYKSTORE_API_KEY` in process env only; health/ready must not return key material.

## 4. Build commands

```powershell
cd C:\project\JY-Studio\projects\JYKStore
npm ci
npm run build
```

## 5. Prisma validation / generate / migrate deploy

```powershell
npx prisma validate
npx prisma generate
npx prisma migrate deploy
```

- Use **`migrate deploy`** in production (not `npm run db:migrate`, which runs `migrate dev`).
- Do not auto-run `db:seed` in production unless you intentionally seed non-production data.

## 6. Startup commands

App:

```powershell
npm run start
```

Default port: **3004** (`JYKSTORE_PORT` / Next config).

MCP HTTP (optional):

```powershell
npm run mcp:http
```

## 7. Health / readiness checks

| Endpoint | Purpose |
|----------|---------|
| `GET /api/health` | Process alive (no DB probe) |
| `GET /api/ready` | Env + DB `SELECT 1` (503 if not ready) |
| MCP `GET /health` | MCP bridge alive |
| MCP `GET /ready` | MCP config flags only (no base URL or API key body) |

## 8. Admin Ops Token setup

1. Set `JYKSTORE_ADMIN_OPS_TOKEN` to a long random value.
2. Call admin APIs with header: `X-JYKStore-Admin-Token: <token>`.
3. Use `/admin/ops/quota` UI — token is entered per session in the browser only.

## 9. API Key create / revoke / rotate

- Create keys via Provider/Admin UI or admin API (masked after creation).
- Revoke via Admin API Key UI or `POST .../revoke`.
- Rotate by creating a new key, updating clients, then revoking the old key.

## 10. Quota policy and override

Defaults: 30/min, 1000/day, `ENFORCE` (429 `QUOTA_EXCEEDED`).

Override via:

```text
JYKSTORE_QUOTA_PER_MINUTE
JYKSTORE_QUOTA_PER_DAY
JYKSTORE_QUOTA_ENFORCEMENT=ENFORCE|WARN_ONLY
```

Invalid values fall back at runtime but `/api/ready` reports env issues in production.

## 11. MCP stdio / HTTP runtime

- `JYKSTORE_MCP_TRANSPORT=stdio|http`
- `JYKSTORE_BASE_URL` or `JYKSTORE_API_BASE_URL` → upstream JYKStore app
- `JYKSTORE_API_KEY` → Public API key with `context:read`
- See `docs/mcp-runtime-ops-guide.md` for CORS, pack allowlist, and size limits.

## 12. Reverse proxy notes

- Terminate TLS at the proxy; forward `Host` and `X-Forwarded-*` as needed.
- Do not expose Admin Ops Token or API keys in access logs.
- Rate-limit public export endpoints if needed at the edge.

## 13. Logging policy

- Use `logSafeRouteError()` for route catch blocks where implemented.
- Never pass raw `error` objects to `console.error`.
- MCP bridge logs request metadata only (no bodies, no Authorization).

## 14. Troubleshooting

| Symptom | Check |
|---------|--------|
| DB down | `/api/ready` → `checks.database.ok=false` |
| missing `DATABASE_URL` | `/api/ready` 503, env missing |
| missing `JYKSTORE_API_KEY_SECRET` | `/api/ready` 503 in production |
| missing `JYKSTORE_ADMIN_OPS_TOKEN` | Admin API 403; `/api/ready` 503 in production |
| invalid quota env | `/api/ready` env errors in production |
| invalid API key | Public API 401 |
| expired/revoked API key | `API_KEY_EXPIRED` / revoked codes |
| insufficient scope | `INSUFFICIENT_SCOPE` |
| quota exceeded | 429 `QUOTA_EXCEEDED`, `Retry-After` |
| pack not found | 404 `PACK_NOT_FOUND` (non-published packs) |
| MCP HTTP ready failed | MCP `/ready`, `baseUrlConfigured`, `apiKeyConfigured` |

## 15. Rollback / recovery notes

- Roll back app deployment to previous image/build.
- `migrate deploy` is forward-only; plan DB rollback separately if a bad migration shipped.
- Keep previous `JYKSTORE_API_KEY_SECRET` only if you must verify old keys; rotating secrets invalidates existing key hashes.
