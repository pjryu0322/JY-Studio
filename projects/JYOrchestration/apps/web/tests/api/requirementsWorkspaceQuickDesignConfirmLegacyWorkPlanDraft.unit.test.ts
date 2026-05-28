import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

describe("RequirementsWorkspace Quick Design confirm legacy work plan draft regression", () => {
  it("does not reference buildGenerateImplementationWorkPlanDraftResult or autoDraftResult", () => {
    const abs = path.join(process.cwd(), "src", "components", "requirements", "RequirementsWorkspace.tsx");
    const source = fs.readFileSync(abs, "utf8");
    expect(source).not.toContain("buildGenerateImplementationWorkPlanDraftResult");
    expect(source).not.toContain("autoDraftResult");
    expect(source).not.toContain("implementationWorkPlanDraftV1: autoDraftResult");
  });
});

