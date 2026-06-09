import { describe, expect, it } from "vitest";
import { mergePackageJsonBuildScript } from "@/lib/prototype/staticAppBuildContractScaffoldService";

describe("staticAppBuildContractScaffoldService", () => {
  it("7. preserves existing package.json and adds build script", () => {
    const merged = mergePackageJsonBuildScript(
      JSON.stringify({ name: "app", scripts: { dev: "vite" }, dependencies: { react: "18" } }),
    );
    const parsed = JSON.parse(merged) as { scripts: Record<string, string>; dependencies: Record<string, string> };
    expect(parsed.scripts.build).toBe("vite build");
    expect(parsed.scripts.dev).toBe("vite");
    expect(parsed.dependencies.react).toBe("18");
  });
});
