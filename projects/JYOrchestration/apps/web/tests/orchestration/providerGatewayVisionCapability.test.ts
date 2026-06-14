import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseImplementationLlmProviderConfigWire } from "@/lib/prototype/implementationLlmProviderConfigWire";

describe("provider gateway vision capability", () => {
  it("gateway uses capabilities.vision only", () => {
    const path = resolve(process.cwd(), "src/lib/prototype/implementationLlmProviderGateway.ts");
    const src = readFileSync(path, "utf8");
    expect(src).toContain("config.capabilities.vision");
    expect(src).not.toContain("modelSupportsVision");
  });

  it("vision=true + image path is gated by config flag in gateway source", () => {
    const path = resolve(process.cwd(), "src/lib/prototype/implementationLlmProviderGateway.ts");
    const src = readFileSync(path, "utf8");
    expect(src).toContain("capabilitySource: \"provider_config\"");
  });
});

describe("provider settings wire persistence shape", () => {
  it("accepts project override config payload", () => {
    const parsed = parseImplementationLlmProviderConfigWire({
      provider: "openai",
      model: "gpt-4o",
      capabilities: { text: true, vision: true, jsonMode: true },
      enabled: true,
    });
    expect(parsed?.model).toBe("gpt-4o");
    expect(parsed?.capabilities.vision).toBe(true);
  });

  it("rejects disabled config", () => {
    expect(
      parseImplementationLlmProviderConfigWire({
        provider: "openai",
        model: "gpt-4o",
        capabilities: { text: true, vision: false },
        enabled: false,
      }),
    ).toBeNull();
  });
});
