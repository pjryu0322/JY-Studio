# JYKStore Production Deployment Runbook

## 1. Scope and non-goals

This runbook covers deploying the JYKStore Next.js app and optional MCP HTTP bridge. It does not cover OAuth/SSO, paid billing, or external AI provider integration.

## 2. Required environment variables

Production **required**:

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | PostgreSQL connection for Prisma |
| `JYKSTORE_API_KEY_SECRET` | API Key hashing secret (do not use dev SHA-256-only fallback in production) |

Optional for admin bootstrap:

| Variable | Purpose |
|----------|---------|
| `JYKSTORE_ADMIN_EMAILS` | Comma-separated emails that receive `accountRole=ADMIN` on login |

See `projects/JYKStore/.env.example` for quota and MCP optional variables.

## 3. Secret handling policy

- Never commit real secrets to git.
- Do not log `DATABASE_URL`, API keys, or `Authorization: Bearer` values.
- Admin console requires a logged-in ADMIN account session (cookie); do not store admin secrets in localStorage/sessionStorage.
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
| `GET /api/health` | Process alive only (no DB/Prisma probe; imports `runtime-metadata` only) |
| `GET /api/ready` | Env + DB `SELECT 1` (503 if not ready). `checks.env.errors` lists env names/codes only (no secrets). |
| MCP `GET /health` | MCP bridge alive |
| MCP `GET /ready` | MCP config flags only (no base URL or API key body) |

## 8. Admin account setup

1. Set `JYKSTORE_ADMIN_EMAILS` to one or more admin emails (comma-separated).
2. Open `/admin/login` and sign in with an allowlisted email.
3. Use `/admin/reviews` and `/admin/ops/*` with the admin session cookie.

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
- Do not expose API keys in access logs.
- Rate-limit public export endpoints if needed at the edge.

## 13. Logging policy

- Never pass raw `error` objects to `console.error`.
- Use `logSafeRouteError()` in route catch blocks (Admin/Provider/API routes).
- MCP bridge logs request metadata only (no bodies, no Authorization).

## 14. Troubleshooting

| Symptom | Check |
|---------|--------|
| DB down | `/api/ready` → `checks.database.ok=false` |
| missing `DATABASE_URL` | `/api/ready` 503, env missing |
| missing `JYKSTORE_API_KEY_SECRET` | `/api/ready` 503 in production |
| missing admin account / not ADMIN | Admin API 401/403; use `/admin/login` with `JYKSTORE_ADMIN_EMAILS` |
| invalid quota env | `/api/ready` → `checks.env.errors` (e.g. `Invalid env: JYKSTORE_QUOTA_PER_MINUTE`) |
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
