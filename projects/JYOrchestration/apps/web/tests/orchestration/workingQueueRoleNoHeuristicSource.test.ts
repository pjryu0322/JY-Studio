import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { ImplementationWorkingQueueRoleRoutingSource } from "@/lib/prototype/implementationWorkingQueueTypes";

const FORBIDDEN_SOURCES = ["keyword", "regex", "rule", "heuristic"] as const;

describe("workingQueueRoleNoHeuristicSource", () => {
  it("roleRoutingSource type allows only llm and fallback", () => {
    const allowed: ImplementationWorkingQueueRoleRoutingSource[] = ["llm", "fallback"];
    expect(allowed).toHaveLength(2);
    for (const bad of FORBIDDEN_SOURCES) {
      expect(allowed.includes(bad as ImplementationWorkingQueueRoleRoutingSource)).toBe(false);
    }
  });

  it("role workflow module has no regex-based role inference", () => {
    const src = readFileSync(
      resolve(process.cwd(), "src/lib/prototype/implementationWorkingQueueRoleWorkflow.ts"),
      "utf8",
    );
    expect(src).not.toContain("inferPrimaryRoleFromSignals");
    expect(src).not.toMatch(/\/.*권한/);
    expect(src).not.toMatch(/\/.*타이틀/);
    expect(src).not.toMatch(/inferRoleFrom/);
  });
});
