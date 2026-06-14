import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("provider gateway config (no model-name vision heuristics)", () => {
  it("gateway uses capabilities.vision not modelSupportsVision", () => {
    const path = resolve(process.cwd(), "src/lib/prototype/implementationLlmProviderGateway.ts");
    const src = readFileSync(path, "utf8");
    expect(src).toContain("config.capabilities.vision");
    expect(src).not.toContain("modelSupportsVision");
  });

  it("modelSupportsVision is deprecated stub", async () => {
    const { modelSupportsVision } = await import("@/lib/prototype/implementationLlmProviderTypes");
    expect(modelSupportsVision("gpt-4o-mini")).toBe(false);
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

  it("resolveImplementationLlmProviderConfigRecord reads model from state config", async () => {
    const { resolveImplementationLlmProviderConfigRecord } = await import(
      "@/lib/prototype/implementationLlmProviderConfig.server"
    );
    const prevEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = "test";
    const state = {
      implementationLlmProviderConfigV1: {
        model: "custom-model-from-state",
        capabilities: { text: true, vision: true },
      },
    };
    const out = await resolveImplementationLlmProviderConfigRecord({
      projectId: "no-db-project",
      requirementsStateJson: state,
    });
    expect(out.config?.model).toBe("custom-model-from-state");
    expect(out.config?.capabilities.vision).toBe(true);
    process.env.NODE_ENV = prevEnv;
  });
});
