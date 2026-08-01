/**
 * P11 empty-state / role smoke (read-only against running app).
 * Usage: node --import tsx scripts/p11-role-empty-smoke.ts
 */
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "tmp-p11-clean-reset", "role-smoke.json");

function loadDotEnv(): void {
  const envPath = join(ROOT, ".env");
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
    if (!m || process.env[m[1]]) continue;
    let v = m[2].trim();
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1);
    }
    process.env[m[1]] = v;
  }
}

loadDotEnv();

const baseUrl = process.env.P11_BASE_URL?.trim() || "http://localhost:3004";

type Result = {
  role: string;
  email: string;
  loginOk: boolean;
  checks: Array<{ name: string; ok: boolean; detail?: string }>;
};

async function login(email: string, displayName: string): Promise<string[]> {
  const res = await fetch(`${baseUrl}/api/v1/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, displayName, mode: "login" }),
  });
  if (!res.ok) {
    throw new Error(`login ${email} -> ${res.status}`);
  }
  const raw = res.headers.getSetCookie?.() ?? [];
  if (raw.length) return raw.map((c) => c.split(";")[0]!);
  const single = res.headers.get("set-cookie");
  return single ? [single.split(";")[0]!] : [];
}

function cookieHeader(cookies: string[]): string {
  return cookies.join("; ");
}

async function get(path: string, cookies: string[]) {
  const res = await fetch(`${baseUrl}${path}`, {
    headers: { cookie: cookieHeader(cookies) },
    redirect: "manual",
  });
  const text = await res.text();
  return { status: res.status, text };
}

function pageOk(status: number): boolean {
  return status >= 200 && status < 400;
}

async function smokeRole(
  role: string,
  email: string,
  name: string,
): Promise<Result> {
  const checks: Result["checks"] = [];
  let cookies: string[] = [];
  let loginOk = false;
  try {
    cookies = await login(email, name);
    loginOk = cookies.length > 0;
    checks.push({ name: "login", ok: loginOk, detail: `cookies=${cookies.length}` });
  } catch (e) {
    checks.push({
      name: "login",
      ok: false,
      detail: e instanceof Error ? e.message : String(e),
    });
    return { role, email, loginOk: false, checks };
  }

  if (role === "ADMIN") {
    const inbox = await get("/admin?queue=receipt", cookies);
    checks.push({
      name: "admin-inbox",
      ok: pageOk(inbox.status),
      detail: `status=${inbox.status}`,
    });
    checks.push({
      name: "admin-receipt-label",
      ok: inbox.text.includes("자료 접수"),
      detail: "receipt rail/queue label present",
    });
    const providerPage = await get("/provider", cookies);
    checks.push({
      name: "admin-provider-page-no-crash",
      ok: pageOk(providerPage.status),
      detail: `status=${providerPage.status}`,
    });
  }

  if (role === "PROVIDER") {
    const list = await get("/provider", cookies);
    checks.push({
      name: "provider-home",
      ok: pageOk(list.status),
      detail: `status=${list.status}`,
    });
    const api = await fetch(`${baseUrl}/api/v1/provider/packs`, {
      headers: { cookie: cookieHeader(cookies) },
    });
    let packCount = -1;
    if (api.ok) {
      const body = (await api.json()) as { packs?: unknown[]; items?: unknown[] };
      packCount = (body.packs ?? body.items ?? []).length;
    }
    checks.push({
      name: "provider-pack-count-zero",
      ok: api.status === 200 && packCount === 0,
      detail: `status=${api.status} packs=${packCount}`,
    });
    const admin = await get("/admin", cookies);
    checks.push({
      name: "provider-admin-no-crash",
      ok: pageOk(admin.status) || admin.status === 403,
      detail: `status=${admin.status}`,
    });
  }

  if (role === "USER") {
    const home = await get("/", cookies);
    checks.push({
      name: "public-home",
      ok: pageOk(home.status),
      detail: `status=${home.status}`,
    });
    const packs = await get("/packs", cookies);
    checks.push({
      name: "public-packs",
      ok: pageOk(packs.status) || packs.status === 404,
      detail: `status=${packs.status}`,
    });
    const admin = await get("/admin", cookies);
    checks.push({
      name: "user-admin-gated",
      ok: pageOk(admin.status) || admin.status === 403,
      detail: `status=${admin.status}`,
    });
  }

  const accounts = await fetch(`${baseUrl}/api/v1/dev/test-accounts`, {
    headers: { cookie: cookieHeader(cookies) },
  });
  if (accounts.status === 200) {
    const body = (await accounts.json()) as {
      accounts?: Array<{ email?: string }>;
    };
    const emails = (body.accounts ?? []).map((a) => a.email?.toLowerCase());
    const expected = ["admin@jyk.local", "provider@jyk.local", "user@jyk.local"];
    const onlyThree =
      emails.length === 3 && expected.every((e) => emails.includes(e));
    checks.push({
      name: "quick-login-three-accounts",
      ok: onlyThree,
      detail: `emails=${emails.join(",")}`,
    });
  } else {
    checks.push({
      name: "quick-login-three-accounts",
      ok: accounts.status === 403 || accounts.status === 404,
      detail: `switcher unavailable status=${accounts.status}`,
    });
  }

  return { role, email, loginOk, checks };
}

async function main() {
  const health = await fetch(`${baseUrl}/api/health`);
  if (!health.ok) throw new Error(`app not healthy: ${health.status}`);

  const results = [
    await smokeRole("ADMIN", "admin@jyk.local", "JYKStore Admin"),
    await smokeRole("PROVIDER", "provider@jyk.local", "JYKStore Provider"),
    await smokeRole("USER", "user@jyk.local", "JYKStore User"),
  ];

  const pass = results.every((r) => r.loginOk && r.checks.every((c) => c.ok));
  const report = { at: new Date().toISOString(), baseUrl, pass, results };
  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, JSON.stringify(report, null, 2), "utf8");
  console.log(JSON.stringify(report, null, 2));
  if (!pass) process.exitCode = 2;
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
