import { describe, expect, it } from "vitest";
import { modelSupportsVision } from "@/lib/prototype/implementationLlmProviderTypes";

describe("provider gateway vision capability", () => {
  it("detects vision-capable models", () => {
    expect(modelSupportsVision("gpt-4o-mini")).toBe(true);
    expect(modelSupportsVision("gpt-3.5-turbo")).toBe(false);
  });

  it("production blocks env-only provider path in refinement resolver", async () => {
    const { resolveLlmCodeTaskRefinementProviderContext } = await import(
      "@/lib/prototype/implementationCodeTaskPlanLlmProvider"
    );
    const prevEnv = process.env.NODE_ENV;
    const prevKey = process.env.OPENAI_API_KEY;
    process.env.NODE_ENV = "production";
    process.env.OPENAI_API_KEY = "sk-test-only";
    try {
      const ctx = await resolveLlmCodeTaskRefinementProviderContext({ projectId: "nonexistent-project" });
      expect(ctx.providerSource).not.toBe("env_fallback");
      expect(ctx.apiKey).toBeNull();
    } finally {
      process.env.NODE_ENV = prevEnv;
      process.env.OPENAI_API_KEY = prevKey;
    }
  });
});
