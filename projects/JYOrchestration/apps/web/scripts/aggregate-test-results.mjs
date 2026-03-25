/**
 * Vitest·Playwright 원시 JSON을 latest.json 으로 병합 (JYOrchestration 루트 기준).
 * 실행: JYOrchestration 루트에서 node apps/web/scripts/aggregate-test-results.mjs
 */
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..", "..");
const outDir = join(root, ".artifacts", "test-results");
const vitestPath = join(outDir, "vitest-raw.json");
const pwPath = join(outDir, "playwright-raw.json");

mkdirSync(join(outDir, "history"), { recursive: true });

function parseVitestSuites() {
  if (!existsSync(vitestPath)) return [];
  let raw;
  try {
    raw = JSON.parse(readFileSync(vitestPath, "utf8"));
  } catch {
    return [];
  }
  const testResults = raw.testResults ?? [];
  const out = [];
  for (const file of testResults) {
    const suiteName = String(file.name ?? "api").split(/[/\\]/).pop() ?? "api";
    const cases = (file.assertionResults ?? []).map((a) => {
      const title = String(a.title ?? "");
      const idMatch = title.match(/\[([^\]]+)\]/);
      return {
        id: idMatch ? idMatch[1] : title,
        name: title,
        status:
          a.status === "passed" ? "passed" : a.status === "skipped" ? "skipped" : "failed",
        durationMs: typeof a.duration === "number" ? a.duration : 0,
        message:
          Array.isArray(a.failureMessages) && a.failureMessages.length
            ? a.failureMessages.join("\n")
            : null,
        source: "vitest-api",
      };
    });
    out.push({ suite: `api:${suiteName}`, cases });
  }
  return out;
}

function collectPlaywrightSpecs(suite, acc, prefix) {
  const title = [prefix, suite.title].filter(Boolean).join(" > ") || "e2e";
  for (const spec of suite.specs ?? []) {
    const spTitle = String(spec.title ?? "");
    const idMatch = spTitle.match(/\[([^\]]+)\]/);
    const testEntry = spec.tests?.[0];
    const result = testEntry?.results?.[0];
    let status = "failed";
    if (spec.ok === true || result?.status === "passed") status = "passed";
    else if (result?.status === "skipped") status = "skipped";
    acc.push({
      suite: title,
      case: {
        id: idMatch ? idMatch[1] : spTitle,
        name: spTitle,
        status,
        durationMs: typeof result?.duration === "number" ? result.duration : 0,
        message: result?.error?.message
          ? String(result.error.message)
          : result?.errors?.[0]?.message
            ? String(result.errors[0].message)
            : null,
        source: "playwright",
      },
    });
  }
  for (const child of suite.suites ?? []) {
    collectPlaywrightSpecs(child, acc, title);
  }
}

function parsePlaywrightSuites() {
  if (!existsSync(pwPath)) return [];
  let raw;
  try {
    raw = JSON.parse(readFileSync(pwPath, "utf8"));
  } catch {
    return [];
  }
  const flat = [];
  for (const s of raw.suites ?? []) {
    collectPlaywrightSpecs(s, flat, "");
  }
  const bySuite = new Map();
  for (const { suite, case: c }) {
    if (!bySuite.has(suite)) bySuite.set(suite, []);
    bySuite.get(suite).push(c);
  }
  return [...bySuite.entries()].map(([suite, cases]) => ({ suite, cases }));
}

const startedAt = new Date().toISOString();
const suites = [...parseVitestSuites(), ...parsePlaywrightSuites()];
let passed = 0;
let failed = 0;
let skipped = 0;
let total = 0;
for (const s of suites) {
  for (const c of s.cases) {
    total++;
    if (c.status === "passed") passed++;
    else if (c.status === "skipped") skipped++;
    else failed++;
  }
}

const latest = {
  startedAt,
  finishedAt: new Date().toISOString(),
  summary: { total, passed, failed, skipped },
  suites,
};

const latestPath = join(outDir, "latest.json");
writeFileSync(latestPath, JSON.stringify(latest, null, 2), "utf8");

const histPath = join(outDir, "history", `${Date.now()}.json`);
copyFileSync(latestPath, histPath);

console.log("[aggregate-test-results]", latest.summary, "→", latestPath);
