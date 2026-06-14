import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("provider settings UI persistence (API contract)", () => {
  it("execution-setup route exposes implementationLlmProviderConfig", () => {
    const path = resolve(
      process.cwd(),
      "src/app/api/projects/[projectId]/execution-setup/route.ts",
    );
    const src = readFileSync(path, "utf8");
    expect(src).toContain("implementationLlmProviderConfig");
    expect(src).toContain("implementationLlmProviderConfigJson");
  });

  it("user default provider config API exists", () => {
    const path = resolve(process.cwd(), "src/app/api/me/implementation-llm-provider-config/route.ts");
    const src = readFileSync(path, "utf8");
    expect(src).toContain("implementationLlmProviderConfigJson");
  });
});
