import { describe, expect, it } from "vitest";

import { buildHarnessPromptAssemblyPreview } from "@/lib/harness/promptAssembly/buildHarnessPromptAssemblyPreview";
import { HARNESS_PROMPT_SECTION_ORDER } from "@/lib/harness/promptAssembly/harnessPromptAssemblyTypes";
import type { OverlayAssemblyPlanItem } from "@/lib/overlay/overlayContextAssemblyPlan";

describe("buildHarnessPromptAssemblyPreview", () => {
  it("always sets mode === 'dry_run'", () => {
    const preview = buildHarnessPromptAssemblyPreview({});
    expect(preview.mode).toBe("dry_run");
  });

  it("generates role_contract section from overlayIdentity", () => {
    const preview = buildHarnessPromptAssemblyPreview({
      overlayIdentity: {
        roleKey: "planner",
        perspective: "system",
        provider: "openai",
        capabilities: ["plan", "review"],
      },
    });
    const role = preview.sections.find((s) => s.type === "role_contract");
    expect(role).toBeDefined();
    expect(role?.content).toContain("planner");
    expect(role?.content).toContain("openai");
  });

  it("groups assembly plan items into memory/knowledge/project sections", () => {
    const plan: readonly OverlayAssemblyPlanItem[] = [
      {
        type: "memory",
        source: "platform:singleChatOrchestrationV1",
        priority: 10,
        includeReason: "role_default",
        estimatedCost: 100,
        pruningCandidate: false,
        includeMode: "required",
      },
      {
        type: "knowledge",
        source: "pack1",
        priority: 20,
        includeReason: "knowledge_hint",
        estimatedCost: 60,
        pruningCandidate: false,
        includeMode: "recommended",
      },
      {
        type: "workspace",
        source: "screen:ideation",
        priority: 30,
        includeReason: "workspace_default",
        estimatedCost: 20,
        pruningCandidate: false,
        includeMode: "optional",
      },
    ];
    const preview = buildHarnessPromptAssemblyPreview({ overlayAssemblyPlan: plan });
    const sectionTypes = preview.sections.map((s) => s.type);
    expect(sectionTypes).toContain("memory_context");
    expect(sectionTypes).toContain("knowledge_context");
    expect(sectionTypes).toContain("project_context");
  });

  it("orders sections by HARNESS_PROMPT_SECTION_ORDER (deterministic)", () => {
    const plan: readonly OverlayAssemblyPlanItem[] = [
      {
        type: "knowledge",
        source: "pack1",
        priority: 20,
        includeReason: "k",
        estimatedCost: 60,
        pruningCandidate: false,
        includeMode: "recommended",
      },
      {
        type: "memory",
        source: "platform",
        priority: 10,
        includeReason: "m",
        estimatedCost: 100,
        pruningCandidate: false,
        includeMode: "required",
      },
      {
        type: "workspace",
        source: "ws",
        priority: 30,
        includeReason: "w",
        estimatedCost: 20,
        pruningCandidate: false,
        includeMode: "optional",
      },
    ];
    const preview = buildHarnessPromptAssemblyPreview({
      overlayAssemblyPlan: plan,
      overlayIdentity: {
        roleKey: "planner",
        perspective: "system",
        provider: "openai",
        capabilities: [],
      },
      userRequest: "test request",
    });
    const types = preview.sections.map((s) => s.type);
    // role_contract < project_context < memory_context < knowledge_context < current_request < constraints
    const idx = (t: (typeof types)[number]) => HARNESS_PROMPT_SECTION_ORDER.indexOf(t);
    for (let i = 1; i < types.length; i += 1) {
      expect(idx(types[i])).toBeGreaterThanOrEqual(idx(types[i - 1]));
    }
  });

  it("uses userRequest when provided", () => {
    const preview = buildHarnessPromptAssemblyPreview({
      userRequest: "사용자 요청 본문입니다",
    });
    const req = preview.sections.find((s) => s.type === "current_request");
    expect(req?.content).toContain("사용자 요청");
    expect(req?.source).toBe("userRequest");
  });

  it("falls back to existingPromptText excerpt when no userRequest", () => {
    const big = "기존 prompt body ".repeat(200);
    const preview = buildHarnessPromptAssemblyPreview({ existingPromptText: big });
    const req = preview.sections.find((s) => s.type === "current_request");
    expect(req).toBeDefined();
    expect(req?.source).toBe("existingPromptText:excerpt");
  });

  it("propagates overflowRisk from overlayContextBudget", () => {
    const preview = buildHarnessPromptAssemblyPreview({
      overlayContextBudget: {
        estimatedInputTokens: 5000,
        estimatedOutputTokens: 500,
        budgetPolicy: "extended",
        overflowRisk: "high",
      },
    });
    expect(preview.overflowRisk).toBe("high");
    expect(preview.warnings.some((w) => w.includes("높음"))).toBe(true);
  });

  it("emits warnings for missing role/plan/request", () => {
    const preview = buildHarnessPromptAssemblyPreview({});
    expect(preview.warnings.length).toBeGreaterThan(0);
    expect(preview.warnings.some((w) => w.includes("role_contract"))).toBe(true);
    expect(preview.warnings.some((w) => w.includes("context"))).toBe(true);
  });

  it("totalEstimatedCost is sum of section estimatedCost", () => {
    const preview = buildHarnessPromptAssemblyPreview({
      overlayIdentity: {
        roleKey: "r",
        perspective: "p",
        provider: "openai",
        capabilities: [],
      },
      userRequest: "x".repeat(100),
    });
    const sum = preview.sections.reduce((acc, s) => acc + s.estimatedCost, 0);
    expect(preview.totalEstimatedCost).toBe(sum);
  });

  it("always includes constraints section as dry-run policy notice", () => {
    const preview = buildHarnessPromptAssemblyPreview({});
    const constraints = preview.sections.find((s) => s.type === "constraints");
    expect(constraints).toBeDefined();
    expect(constraints?.content).toContain("dry-run");
  });
});
