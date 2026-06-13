import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

describe("implementation control plane complexity summary", () => {
  it("keeps implementation control plane split into named controllers", () => {
    const parent = readFileSync(
      join(__dirname, "../../src/components/preview/usePrototypeImplementationStagePanel.tsx"),
      "utf8",
    );

    const controllerCount = (parent.match(/useImplementation[A-Za-z0-9]+Controller/g) ?? []).length;

    expect(controllerCount).toBeGreaterThanOrEqual(18);
  });
});
