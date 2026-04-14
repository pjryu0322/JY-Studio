import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("PlanningExecutionPageClient dev controls separation", () => {
  it("keeps demo harness behind a dedicated panel helper", () => {
    const p = resolve(__dirname, "../../src/app/planning-execution/PlanningExecutionPageClient.tsx");
    const text = readFileSync(p, "utf8");
    expect(text).toContain("Dev controls");
    expect(text).toContain("function DevControlsPanel");
    expect(text).toContain("Demo fixtures");
    expect(text).toContain("Last structural action");
  });
});

