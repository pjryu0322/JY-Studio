import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

describe("implementation control plane complexity summary", () => {
  const parentPath = join(
    __dirname,
    "../../src/components/preview/usePrototypeImplementationStagePanel.tsx",
  );

  it("keeps implementation control plane split into named controllers", () => {
    const parent = readFileSync(parentPath, "utf8");

    const controllerCount = (parent.match(/useImplementation[A-Za-z0-9]+Controller/g) ?? []).length;

    expect(controllerCount).toBeGreaterThanOrEqual(22);
  });

  it("keeps parent hook below final assembly complexity budget", () => {
    const parent = readFileSync(parentPath, "utf8");

    const useMemoCount = (parent.match(/useMemo\(/g) ?? []).length;
    const useEffectCount = (parent.match(/useEffect\(/g) ?? []).length;
    const useCallbackCount = (parent.match(/useCallback\(/g) ?? []).length;

    expect(useMemoCount).toBeLessThanOrEqual(4);
    expect(useEffectCount).toBeLessThanOrEqual(5);
    expect(useCallbackCount).toBeLessThanOrEqual(4);
  });
});
