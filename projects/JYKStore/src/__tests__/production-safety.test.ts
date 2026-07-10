import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

const here = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(here, "..", "..");

const RUNTIME_SCAN_DIRS = [
  join(projectRoot, "src", "app", "api"),
  join(projectRoot, "src", "lib"),
  join(projectRoot, "mcp-server"),
];

const SCAN_EXTENSIONS = [".ts", ".tsx"];

const EXCLUDED_FILES = new Set([
  join(projectRoot, "src", "lib", "safe-logging.ts"),
  join(projectRoot, "mcp-server", "errors.ts"),
]);

function walkFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      if (entry === "node_modules" || entry === ".next") continue;
      walkFiles(full, out);
      continue;
    }
    if (!SCAN_EXTENSIONS.some((ext) => full.endsWith(ext))) continue;
    if (EXCLUDED_FILES.has(full)) continue;
    out.push(full);
  }
  return out;
}

function collectRuntimeSources(): string[] {
  const files: string[] = [];
  for (const dir of RUNTIME_SCAN_DIRS) {
    walkFiles(dir, files);
  }
  return files;
}

describe("production safety static scan", () => {
  it("runtime sources avoid raw console.error(error) pattern", () => {
    const pattern = /console\.error\([^\n]*,\s*error\s*\)/;
    const hits: string[] = [];
    for (const file of collectRuntimeSources()) {
      const source = readFileSync(file, "utf8");
      if (pattern.test(source)) {
        hits.push(file.replace(projectRoot + path.sep, "").replace(projectRoot + "/", ""));
      }
    }
    assert.deepEqual(hits, [], `raw console.error(error): ${hits.join(", ")}`);
  });

  it("runtime sources avoid console.error(error) without message", () => {
    const pattern = /console\.error\(\s*error\s*\)/;
    const hits: string[] = [];
    for (const file of collectRuntimeSources()) {
      const source = readFileSync(file, "utf8");
      if (pattern.test(source)) hits.push(file);
    }
    assert.deepEqual(hits, []);
  });

  it("runtime sources do not log process.env directly", () => {
    const pattern = /console\.log\(\s*process\.env/;
    const hits: string[] = [];
    for (const file of collectRuntimeSources()) {
      const source = readFileSync(file, "utf8");
      if (pattern.test(source)) hits.push(file);
    }
    assert.equal(hits.length, 0);
  });

  it("mcp-server does not import Prisma client", () => {
    const files = walkFiles(join(projectRoot, "mcp-server"));
    for (const file of files) {
      if (!file.endsWith(".ts")) continue;
      const source = readFileSync(file, "utf8");
      assert.ok(!source.includes("@prisma/client"), file);
      assert.ok(!source.includes("PrismaClient"), file);
    }
  });

  it("mcp-server runtime avoids forbidden AI provider API strings", () => {
    const forbidden = /chat\.completions|responses\.create/;
    for (const file of walkFiles(join(projectRoot, "mcp-server"))) {
      if (!file.endsWith(".ts")) continue;
      const source = readFileSync(file, "utf8");
      assert.ok(!forbidden.test(source), file);
    }
  });

  it("all admin api routes use Admin Ops or admin session verification", () => {
    const adminDir = join(projectRoot, "src", "app", "api", "v1", "admin");
    const routes = walkFiles(adminDir).filter((f) => f.endsWith("route.ts"));
    const missing: string[] = [];
    for (const file of routes) {
      const source = readFileSync(file, "utf8");
      const hasGuard =
        source.includes("verifyAdminOpsRequest") ||
        source.includes("rejectUnlessAdminOps") ||
        source.includes("rejectUnlessAdmin") ||
        source.includes("requireAdminSession");
      if (!hasGuard) missing.push(file);
    }
    assert.deepEqual(missing, []);
  });
});
