import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseImplementationLlmProviderConfigWire } from "@/lib/prototype/implementationLlmProviderConfigWire";

describe("provider connection test UI", () => {
  it("calls project implementation-llm-provider test route", () => {
    const path = resolve(process.cwd(), "src/components/project/ImplementationLlmProviderSettingsBlock.tsx");
    const src = readFileSync(path, "utf8");
    expect(src).toContain("/implementation-llm-provider/test");
    expect(src).not.toContain("/api/prototype/implementation/provider-test");
    expect(src).toContain("json.success !== true");
  });

  it("test API returns success/message/data shape", () => {
    const path = resolve(
      process.cwd(),
      "src/app/api/projects/[projectId]/implementation-llm-provider/test/route.ts",
    );
    const src = readFileSync(path, "utf8");
    expect(src).toContain("ImplementationLlmProviderTestResponse");
    expect(src).toContain("success:");
    expect(src).toContain("capabilitySource");
  });
});

describe("user default API key persistence API", () => {
  it("PATCH me route supports openaiApiKey and hasDefaultOpenaiApiKey", () => {
    const path = resolve(process.cwd(), "src/app/api/me/implementation-llm-provider-config/route.ts");
    const src = readFileSync(path, "utf8");
    expect(src).toContain("openaiApiKey");
    expect(src).toContain("clearOpenaiApiKey");
    expect(src).toContain("hasDefaultOpenaiApiKey");
    expect(src).not.toMatch(/defaultOpenaiApiKey:\s*state\.defaultOpenaiApiKey/);
    expect(src).toContain("defaultOpenaiApiKeyMasked");
  });
});

describe("refine code task plan prompt gateway", () => {
  it("prompt route uses callCodeTaskRefinementLlmPrompt not postOpenAiChatCompletion", () => {
    const path = resolve(process.cwd(), "src/app/api/prototype/planning/refine-code-task-plan/route.ts");
    const src = readFileSync(path, "utf8");
    expect(src).toContain("callCodeTaskRefinementLlmPrompt");
    expect(src).not.toContain("postOpenAiChatCompletion");
  });
});

describe("provider config no plaintext key", () => {
  it("strips apiKey fields from config wire parse", () => {
    const parsed = parseImplementationLlmProviderConfigWire({
      model: "gpt-4o",
      apiKey: "sk-secret-should-drop",
      capabilities: { text: true, vision: false },
      enabled: true,
    });
    expect(parsed?.model).toBe("gpt-4o");
    expect(parsed).not.toHaveProperty("apiKey");
  });
});
