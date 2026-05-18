import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("PlanningExecutionPageClient dev controls separation", () => {
  it("keeps demo harness behind a dedicated panel helper", () => {
    const p = resolve(__dirname, "../../src/app/planning-execution/PlanningExecutionPageClient.tsx");
    const text = readFileSync(p, "utf8");
    expect(text).toContain("개발 도구");
    expect(text).toContain("function DevControlsPanel");
    expect(text).toContain("데모 고정값");
    expect(text).toContain("마지막 구조 동작");
  });
});

