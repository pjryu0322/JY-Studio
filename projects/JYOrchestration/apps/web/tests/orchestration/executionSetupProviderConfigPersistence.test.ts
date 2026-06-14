import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("executionSetupProviderConfigPersistence", () => {
  it("patchExecutionSetup client type includes implementationLlmProviderConfig", async () => {
    const mod = await import("@/lib/prototype/executionSetupClient");
    type Body = Parameters<typeof mod.patchExecutionSetup>[1];
    const sample: Body = {
      implementationLlmProviderConfig: {
        provider: "openai",
        model: "gpt-4o-mini",
        capabilities: { text: true, vision: true, jsonMode: true },
      },
    };
    expect(sample.implementationLlmProviderConfig?.model).toBe("gpt-4o-mini");
  });

  it("execution-setup route handles implementationLlmProviderConfig", () => {
    const path = resolve(
      process.cwd(),
      "src/app/api/projects/[projectId]/execution-setup/route.ts",
    );
    const src = readFileSync(path, "utf8");
    expect(src).toContain("implementationLlmProviderConfig");
  });
});

describe("userProviderConfigPersistence", () => {
  it("user implementation-llm-provider-config API exists", () => {
    const path = resolve(process.cwd(), "src/app/api/me/implementation-llm-provider-config/route.ts");
    const src = readFileSync(path, "utf8");
    expect(src).toContain("implementationLlmProviderConfigJson");
  });
});

describe("providerConfigPriority", () => {
  it("pickImplementationLlmProviderConfig prefers project over user", async () => {
    const { pickImplementationLlmProviderConfig, parseImplementationLlmProviderConfigWire } = await import(
      "@/lib/prototype/implementationLlmProviderConfigWire"
    );
    const project = parseImplementationLlmProviderConfigWire({
      model: "proj",
      capabilities: { text: true, vision: false },
      enabled: true,
    });
    const user = parseImplementationLlmProviderConfigWire({
      model: "user",
      capabilities: { text: true, vision: false },
      enabled: true,
    });
    const picked = pickImplementationLlmProviderConfig({ projectDb: project, stateInline: null, userDb: user });
    expect(picked.config?.model).toBe("proj");
  });
});

describe("codeTaskRefinementProviderGateway", () => {
  it("implementationCodeTaskPlanLlmProvider uses config record not ENV model", () => {
    const path = resolve(process.cwd(), "src/lib/prototype/implementationCodeTaskPlanLlmProvider.ts");
    const src = readFileSync(path, "utf8");
    expect(src).toContain("resolveImplementationLlmProviderConfigRecord");
    expect(src).not.toContain("resolveOpenAiModelFromEnv");
  });

  it("refinement defaultLlmCaller uses Provider Gateway", () => {
    const path = resolve(process.cwd(), "src/lib/prototype/implementationCodeTaskPlanLlmRefinement.ts");
    const src = readFileSync(path, "utf8");
    expect(src).toContain("invokeImplementationLlmProviderJson");
    expect(src).toContain("implementation_code_task_refinement");
    expect(src).not.toContain("resolveOpenAiModelFromEnv");
  });
});

describe("providerGatewayConnectionTest", () => {
  it("provider-test API route exists", () => {
    const path = resolve(process.cwd(), "src/app/api/prototype/implementation/provider-test/route.ts");
    const src = readFileSync(path, "utf8");
    expect(src).toContain("provider-test");
    expect(src).toContain("capabilitySource");
  });
});

describe("ExecutionSetupPanel provider UI", () => {
  it("embeds ImplementationLlmProviderSettingsBlock", () => {
    const path = resolve(process.cwd(), "src/components/project-spec/ExecutionSetupPanel.tsx");
    const src = readFileSync(path, "utf8");
    expect(src).toContain("ImplementationLlmProviderSettingsBlock");
  });
});
