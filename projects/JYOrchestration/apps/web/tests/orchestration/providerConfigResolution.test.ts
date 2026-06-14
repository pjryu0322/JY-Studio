import { describe, expect, it } from "vitest";
import {
  isProductionNodeEnv,
  parseImplementationLlmProviderConfigWire,
  pickImplementationLlmProviderConfig,
} from "@/lib/prototype/implementationLlmProviderConfigWire";

describe("provider config resolution (pure)", () => {
  const projectCfg = parseImplementationLlmProviderConfigWire({
    provider: "openai",
    model: "project-model",
    capabilities: { text: true, vision: true },
    enabled: true,
  });
  const userCfg = parseImplementationLlmProviderConfigWire({
    provider: "openai",
    model: "user-model",
    capabilities: { text: true, vision: false },
    enabled: true,
  });

  it("prefers project DB over user and inline state", () => {
    const picked = pickImplementationLlmProviderConfig({
      projectDb: projectCfg,
      stateInline: userCfg,
      userDb: userCfg,
    });
    expect(picked.scope).toBe("project");
    expect(picked.config?.model).toBe("project-model");
  });

  it("falls back to user when project missing", () => {
    const picked = pickImplementationLlmProviderConfig({
      projectDb: null,
      stateInline: null,
      userDb: userCfg,
    });
    expect(picked.scope).toBe("user");
    expect(picked.config?.model).toBe("user-model");
  });

  it("production node env detection", () => {
    expect(isProductionNodeEnv("production")).toBe(true);
    expect(isProductionNodeEnv("development")).toBe(false);
  });
});

describe("provider config resolution (gateway missing)", () => {
  it("production blocks env-only path in refinement resolver", async () => {
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

  it("returns provider_config_missing when no config model in production-like resolution", async () => {
    const { resolveImplementationLlmProviderConfigRecord } = await import(
      "@/lib/prototype/implementationLlmProviderConfig.server"
    );
    const prevEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";
    try {
      const out = await resolveImplementationLlmProviderConfigRecord({
        projectId: "nonexistent-project",
      });
      expect(out.status).toBe("provider_config_missing");
      expect(out.envFallback).toBe(false);
    } finally {
      process.env.NODE_ENV = prevEnv;
    }
  });
});
