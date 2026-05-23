/**
 * Git Repository Provisioning API smoke helpers (operator / Cursor proxy).
 * Never log raw GitHub tokens or session secrets.
 */

import { execSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const _LIB_DIR = dirname(fileURLToPath(import.meta.url));
const JYO_ROOT = join(_LIB_DIR, "..", "..", "..", "..");

export const SMOKE_RESULT_DOC = join(
  JYO_ROOT,
  "docs",
  "git-repository-provisioning-smoke-result.md"
);

const SENSITIVE_PATTERNS = [
  /\bghp_[a-z0-9]{20,}/i,
  /\bgithub_pat_/i,
  /\bjyo_session=/i,
  /session-token=/i,
];

/** @param {unknown} value */
export function redactForEvidence(value) {
  let text = typeof value === "string" ? value : JSON.stringify(value ?? null);
  for (const p of SENSITIVE_PATTERNS) {
    text = text.replace(p, "[REDACTED]");
  }
  return text.slice(0, 800);
}

/** @param {Response} res */
export function cookieFromResponse(res) {
  const headers = res.headers;
  if (typeof headers.getSetCookie === "function") {
    return headers
      .getSetCookie()
      .map((c) => c.split(";")[0]?.trim())
      .filter(Boolean)
      .join("; ");
  }
  const single = headers.get("set-cookie");
  if (!single) return "";
  return single
    .split(/,(?=[^;]+?=)/)
    .map((s) => s.trim().split(";")[0]?.trim())
    .filter(Boolean)
    .join("; ");
}

/**
 * @param {NodeJS.ProcessEnv} processEnv
 */
export function parseSmokeEnv(processEnv = process.env) {
  const env = (k, fb = "") => String(processEnv[k] ?? fb).trim();
  const stamp = new Date()
    .toISOString()
    .replace(/[-:TZ.]/g, "")
    .slice(0, 14);
  return {
    baseUrl: env("JYO_BASE_URL", env("TEST_BASE_URL", "http://127.0.0.1:3000")).replace(/\/$/, ""),
    projectId: env("JYO_PROJECT_ID"),
    sessionCookie: env("JYO_SESSION_COOKIE"),
    owner: env("JYO_GITHUB_OWNER"),
    newRepo: env("JYO_NEW_REPO", `jyo-provision-smoke-${stamp}`),
    existingRepo: env("JYO_EXISTING_REPO"),
    skipCreate: env("GIT_PROVISIONING_SKIP_CREATE") === "1",
    loginEmail: env("JYO_LOGIN_EMAIL", "owner@jyo.local"),
    loginPassword: env("JYO_LOGIN_PASSWORD", "JyoTest!123"),
    seedProjectName: env("JYO_SEED_PROJECT_NAME", "Web Meeting MVP"),
    outputPath: env("JYO_SMOKE_OUTPUT_MD", SMOKE_RESULT_DOC),
  };
}

/**
 * @param {string} baseUrl
 * @param {string} email
 * @param {string} password
 */
export async function smokeLogin(baseUrl, email, password) {
  const res = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    const j = await res.json().catch(() => ({}));
    throw new Error(`login failed ${res.status}: ${j.message ?? res.statusText}`);
  }
  return cookieFromResponse(res);
}

/**
 * @param {{ baseUrl: string; cookie: string; path: string; body: object }} input
 */
export async function provisionPost(input) {
  const res = await fetch(`${input.baseUrl}${input.path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: input.cookie,
    },
    body: JSON.stringify(input.body),
  });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, json };
}

/**
 * @param {string} baseUrl
 * @param {string} cookie
 * @param {string} seedProjectName
 */
export async function resolveProjectId(baseUrl, cookie, seedProjectName) {
  const res = await fetch(`${baseUrl}/api/projects`, { headers: { Cookie: cookie } });
  const json = await res.json();
  if (!res.ok || !json.success || !Array.isArray(json.data)) {
    throw new Error("projects list failed — run npm run seed:test");
  }
  const p = json.data.find((x) => x.name === seedProjectName);
  if (!p) throw new Error(`seed project "${seedProjectName}" not found`);
  return p.id;
}

/** @typedef {{ no: number; scenario: string; result: string; evidence: string; notes: string }} SmokeRow */

/**
 * @param {{
 *   env: ReturnType<typeof parseSmokeEnv>;
 *   git: { branch: string; commit: string };
 *   rows: SmokeRow[];
 *   issues: string[];
 *   blocked: string[];
 *   recommendation: { userTest: string; cursorFix: string };
 * }} input
 */
export function buildSmokeResultMarkdown(input) {
  const { env, git, rows, issues, blocked, recommendation } = input;
  const pass = rows.filter((r) => r.result === "PASS").length;
  const fail = rows.filter((r) => r.result === "FAIL").length;
  const blockedCount = rows.filter((r) => r.result === "BLOCKED").length;

  const table = [
    "| No | Scenario | Result | Evidence | Notes |",
    "|---:|---|---|---|---|",
    ...rows.map(
      (r) => `| ${r.no} | ${r.scenario} | ${r.result} | ${r.evidence} | ${r.notes} |`
    ),
  ].join("\n");

  return `# Git Repository Provisioning Smoke Result

## 환경
- Date: ${new Date().toISOString()}
- Branch: ${git.branch}
- Commit: ${git.commit.slice(0, 12)}
- Base URL: ${env.baseUrl}
- Project ID: ${env.projectId || "(auto)"}
- Owner: ${env.owner || "(not set)"}
- New repo: ${env.newRepo}
- DB migration applied: (run \`npm run db:migrate\` before smoke — not auto-verified here)
- GitHub token source: ExecutionSetup or peer (value not recorded)
- Live API: ${blocked.length ? "partial/blocked" : "attempted"}

## 결과 요약

| Metric | Count |
|--------|------:|
| PASS | ${pass} |
| FAIL | ${fail} |
| BLOCKED | ${blockedCount} |

${table}

## BLOCKED / prerequisites
${blocked.length ? blocked.map((b) => `- ${b}`).join("\n") : "- (none)"}

## 발견 이슈
${issues.length ? issues.map((i) => `- ${i}`).join("\n") : "- (none)"}

## 수정 필요 여부
- Cursor fix needed: ${recommendation.cursorFix}
- User/UI test can proceed: ${recommendation.userTest}

## 후속 제안
- UI: wire \`ProjectExecutionEnvironmentPanel\` to provision API
- Org repo creation: not in MVP
- Created smoke repos: manual delete on GitHub if no longer needed
`;
}

export function readGitMeta(cwd = JYO_ROOT) {
  try {
    return {
      branch: execSync("git rev-parse --abbrev-ref HEAD", { cwd, encoding: "utf8" }).trim(),
      commit: execSync("git rev-parse HEAD", { cwd, encoding: "utf8" }).trim(),
    };
  } catch {
    return { branch: "(unknown)", commit: "(unknown)" };
  }
}

/**
 * @param {string} path
 * @param {string} markdown
 */
export function writeSmokeResult(path, markdown) {
  writeFileSync(path, markdown, "utf8");
}
