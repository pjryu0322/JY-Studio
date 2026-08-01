/**
 * P9.1 Browser Role E2E (Playwright) — Case A / B / C.
 *
 * Prerequisites:
 * - PostgreSQL accepting connections
 * - `npm run dev` on http://localhost:3004
 * - Env: P91_ADMIN_EMAIL, P91_ADMIN_PASSWORD (or session cookie bootstrap)
 * - Env: P91_PACK_ID (published pack with PRODUCTION generation)
 *
 * Run:
 *   npx playwright install chromium
 *   node --import tsx scripts/p9-1-browser-role-e2e.ts
 *
 * Without credentials/DB this script exits NON-ZERO (does not fake PASS).
 */
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const outDir = join(dirname(fileURLToPath(import.meta.url)), "..", "tmp-p9-1-browser-e2e");
const baseUrl = process.env.P91_BASE_URL?.trim() || "http://localhost:3004";
const packId = process.env.P91_PACK_ID?.trim() || "";
const adminEmail = process.env.P91_ADMIN_EMAIL?.trim() || "";
const adminPassword = process.env.P91_ADMIN_PASSWORD?.trim() || "";

type CaseResult = {
  caseId: "A" | "B" | "C";
  result: "PASS" | "FAIL" | "BLOCKED";
  detail: string;
  evidence?: Record<string, unknown>;
};

async function main() {
  mkdirSync(outDir, { recursive: true });
  const results: CaseResult[] = [];

  if (!packId || !adminEmail || !adminPassword) {
    const blocked: CaseResult[] = [
      {
        caseId: "A",
        result: "BLOCKED",
        detail: "Missing P91_PACK_ID / P91_ADMIN_EMAIL / P91_ADMIN_PASSWORD — browser E2E not run",
      },
      {
        caseId: "B",
        result: "BLOCKED",
        detail: "Missing credentials/pack — browser E2E not run",
      },
      {
        caseId: "C",
        result: "BLOCKED",
        detail: "Missing credentials/pack — browser E2E not run",
      },
    ];
    writeFileSync(join(outDir, "report.json"), JSON.stringify({ baseUrl, results: blocked }, null, 2));
    console.error(JSON.stringify({ baseUrl, results: blocked }, null, 2));
    process.exitCode = 1;
    return;
  }

  let chromium: typeof import("playwright").chromium;
  try {
    ({ chromium } = await import("playwright"));
  } catch {
    results.push({
      caseId: "A",
      result: "BLOCKED",
      detail: "playwright package not importable — run npx playwright install chromium",
    });
    writeFileSync(join(outDir, "report.json"), JSON.stringify({ results }, null, 2));
    process.exitCode = 1;
    return;
  }

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  try {
    // Health
    const health = await page.goto(baseUrl, { waitUntil: "domcontentloaded", timeout: 15000 });
    if (!health || !health.ok()) {
      throw new Error(`App not reachable at ${baseUrl}`);
    }

    // Login — adapt to actual login route/selectors used by JYKStore
    await page.goto(`${baseUrl}/login`, { waitUntil: "domcontentloaded" });
    const email = page.locator('input[type="email"], input[name="email"]').first();
    const password = page.locator('input[type="password"], input[name="password"]').first();
    if ((await email.count()) === 0 || (await password.count()) === 0) {
      results.push({
        caseId: "A",
        result: "BLOCKED",
        detail: "Login form selectors not found — update script to match live auth UI",
      });
      results.push({ caseId: "B", result: "BLOCKED", detail: "Blocked by login" });
      results.push({ caseId: "C", result: "BLOCKED", detail: "Blocked by login" });
      process.exitCode = 1;
      return;
    }
    await email.fill(adminEmail);
    await password.fill(adminPassword);
    await page.locator('button[type="submit"]').first().click();
    await page.waitForTimeout(1500);

    // Case A — open publish workbench, unpublish, restore existing
    await page.goto(`${baseUrl}/admin/reviews/${encodeURIComponent(packId)}?step=publish`, {
      waitUntil: "domcontentloaded",
    });
    const unpublish = page.getByRole("button", { name: "게시 중단" });
    const restore = page.getByRole("button", { name: "기존 게시본 다시 게시" });
    const newRev = page.getByRole("button", { name: "새 Revision 게시" });

    if ((await unpublish.count()) > 0) {
      await unpublish.click();
      await page.waitForTimeout(1000);
    }
    if ((await restore.count()) > 0) {
      await restore.click();
      await page.waitForTimeout(1500);
      results.push({
        caseId: "A",
        result: "PASS",
        detail: "Clicked 게시 중단 → 기존 게시본 다시 게시 (verify DB identity separately)",
        evidence: { packId, route: `/admin/reviews/${packId}?step=publish` },
      });
    } else {
      results.push({
        caseId: "A",
        result: "FAIL",
        detail: "Restore Existing CTA not visible after unpublish",
      });
    }

    // Case B — requires Draft B present; assert New Revision CTA not Restore
    await page.goto(`${baseUrl}/admin/reviews/${encodeURIComponent(packId)}?step=publish`, {
      waitUntil: "domcontentloaded",
    });
    const hasNew = (await newRev.count()) > 0;
    const hasRestore = (await restore.count()) > 0;
    results.push({
      caseId: "B",
      result: hasNew && !hasRestore ? "PASS" : "FAIL",
      detail: hasNew
        ? "New Revision CTA visible (Draft B path)"
        : "Expected 새 Revision 게시 when Draft B exists — fixture may lack Draft B",
      evidence: { hasNew, hasRestore },
    });

    // Case C — public pack page must not expose DRAFT-only signals; public API check via page fetch
    const publicRes = await page.request.get(
      `${baseUrl}/api/v1/retrieval/query`,
      {
        data: undefined,
        failOnStatusCode: false,
      },
    );
    results.push({
      caseId: "C",
      result: "FAIL",
      detail:
        "Case C requires authenticated retrieval against published pack + assert servedGeneration is PRODUCTION — wire pack-specific request in follow-up once DB fixture ready",
      evidence: { sampleStatus: publicRes.status() },
    });
  } catch (error) {
    results.push({
      caseId: "A",
      result: "FAIL",
      detail: error instanceof Error ? error.message : String(error),
    });
    process.exitCode = 1;
  } finally {
    await browser.close();
    writeFileSync(
      join(outDir, "report.json"),
      JSON.stringify({ baseUrl, packId, results, wroteAt: new Date().toISOString() }, null, 2),
    );
    console.log(JSON.stringify({ results }, null, 2));
    if (results.some((r) => r.result !== "PASS")) process.exitCode = 1;
  }
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
