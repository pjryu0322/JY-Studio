import { describe, expect, it } from "vitest";

import {
  PROVIDER_CAPABILITY_MATRIX,
  listProviderCapabilityMatrix,
  providerSupportsCapability,
  resolveRecommendedProviderForCapability,
} from "@/lib/harness/executionRouting/providerCapabilityMatrix";

describe("providerCapabilityMatrix", () => {
  it("recommends openai for review/planning/analysis", () => {
    expect(resolveRecommendedProviderForCapability("planning")).toBe("openai");
    expect(resolveRecommendedProviderForCapability("analysis")).toBe("openai");
    expect(resolveRecommendedProviderForCapability("security_review")).toBe("openai");
    expect(resolveRecommendedProviderForCapability("quality_review")).toBe("openai");
    expect(resolveRecommendedProviderForCapability("design_review")).toBe("openai");
  });

  it("recommends cursor for code_generation and cursor_execution", () => {
    expect(resolveRecommendedProviderForCapability("code_generation")).toBe("cursor");
    expect(resolveRecommendedProviderForCapability("cursor_execution")).toBe("cursor");
  });

  it("recommends github for github_operation", () => {
    expect(resolveRecommendedProviderForCapability("github_operation")).toBe("github");
  });

  it("providerSupportsCapability matches matrix", () => {
    expect(providerSupportsCapability("openai", "planning")).toBe(true);
    expect(providerSupportsCapability("openai", "code_generation")).toBe(false);
    expect(providerSupportsCapability("cursor", "cursor_execution")).toBe(true);
    expect(providerSupportsCapability("cursor", "planning")).toBe(false);
    expect(providerSupportsCapability("github", "github_operation")).toBe(true);
    expect(providerSupportsCapability("unknown", "planning")).toBe(false);
  });

  it("listProviderCapabilityMatrix returns sorted entries", () => {
    const list = listProviderCapabilityMatrix();
    const providers = list.map((entry) => entry.provider);
    expect(providers).toEqual([...providers].sort());
    expect(providers).toContain("openai");
    expect(providers).toContain("cursor");
    expect(providers).toContain("github");
  });

  it("matrix capability arrays are sorted", () => {
    for (const key of Object.keys(PROVIDER_CAPABILITY_MATRIX) as Array<
      keyof typeof PROVIDER_CAPABILITY_MATRIX
    >) {
      const arr = PROVIDER_CAPABILITY_MATRIX[key];
      expect(arr).toEqual([...arr].sort());
    }
  });
});
