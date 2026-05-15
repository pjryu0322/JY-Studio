import { describe, expect, it } from "vitest";

import { resolveHarnessExposureLevel } from "@/lib/harness/maturity/harnessExposurePolicy";

describe("resolveHarnessExposureLevel", () => {
  it("maps message explainability to user_visible_summary", () => {
    expect(resolveHarnessExposureLevel("message_explainability")).toBe("user_visible_summary");
  });

  it("maps execution safety to user_visible_summary", () => {
    expect(resolveHarnessExposureLevel("execution_safety")).toBe("user_visible_summary");
  });

  it("maps prompt assembly preview to operator_visible", () => {
    expect(resolveHarnessExposureLevel("prompt_assembly_preview")).toBe("operator_visible");
  });

  it("maps issue planning to operator_visible", () => {
    expect(resolveHarnessExposureLevel("issue_planning")).toBe("operator_visible");
  });
});
