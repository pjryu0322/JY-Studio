import { describe, expect, it } from "vitest";

import {
  coerceHarnessPromptAssemblyMetadata,
  parseHarnessPromptAssemblyPreviewFromUnknown,
  parseHarnessPromptPreviewDiffFromUnknown,
} from "@/lib/harness/promptAssembly/harnessPromptAssemblyCoerce";

describe("harnessPromptAssemblyCoerce", () => {
  it("rejects preview without mode === 'dry_run'", () => {
    expect(parseHarnessPromptAssemblyPreviewFromUnknown(null)).toBeNull();
    expect(parseHarnessPromptAssemblyPreviewFromUnknown({})).toBeNull();
    expect(parseHarnessPromptAssemblyPreviewFromUnknown({ mode: "live", sections: [] })).toBeNull();
  });

  it("parses round-trip dry_run preview", () => {
    const raw = {
      mode: "dry_run",
      sections: [
        {
          id: "role_contract",
          type: "role_contract",
          title: "역할 계약",
          content: "Role: planner",
          source: "overlayIdentity",
          includeReason: "role_resolved",
          priority: 0,
          estimatedCost: 30,
        },
      ],
      totalEstimatedCost: 30,
      overflowRisk: "medium",
      warnings: ["sample warning"],
    };
    const parsed = parseHarnessPromptAssemblyPreviewFromUnknown(raw);
    expect(parsed).not.toBeNull();
    expect(parsed?.sections.length).toBe(1);
    expect(parsed?.sections[0].type).toBe("role_contract");
    expect(parsed?.overflowRisk).toBe("medium");
    expect(parsed?.totalEstimatedCost).toBe(30);
    expect(parsed?.warnings).toEqual(["sample warning"]);
  });

  it("drops invalid section types and missing required fields", () => {
    const raw = {
      mode: "dry_run",
      sections: [
        { id: "x", type: "unknown_type", title: "x", content: "x", source: "s", includeReason: "r" },
        { id: "y", type: "role_contract", title: "", content: "x", source: "s", includeReason: "r" },
        { id: "z", type: "role_contract", title: "ok", content: "c", source: "src", includeReason: "rea" },
      ],
      totalEstimatedCost: -5,
      overflowRisk: "unknown",
      warnings: [42, "valid", ""],
    };
    const parsed = parseHarnessPromptAssemblyPreviewFromUnknown(raw);
    expect(parsed?.sections.length).toBe(1);
    expect(parsed?.sections[0].id).toBe("z");
    expect(parsed?.totalEstimatedCost).toBe(0);
    expect(parsed?.overflowRisk).toBe("low");
    expect(parsed?.warnings).toEqual(["valid"]);
  });

  it("parses preview diff round-trip", () => {
    const raw = {
      existingPromptLength: 100,
      previewLength: 200,
      sectionCount: 4,
      missingSectionTypes: ["role_contract", "knowledge_context"],
      extraSectionTypes: ["diagnostic"],
      warnings: ["missing 2"],
    };
    const parsed = parseHarnessPromptPreviewDiffFromUnknown(raw);
    expect(parsed?.existingPromptLength).toBe(100);
    expect(parsed?.previewLength).toBe(200);
    expect(parsed?.missingSectionTypes).toEqual(["role_contract", "knowledge_context"]);
    expect(parsed?.extraSectionTypes).toEqual(["diagnostic"]);
  });

  it("returns empty object for non-object input in coerceHarnessPromptAssemblyMetadata", () => {
    expect(coerceHarnessPromptAssemblyMetadata(null)).toEqual({});
    expect(coerceHarnessPromptAssemblyMetadata(undefined)).toEqual({});
  });

  it("dispatches both preview and diff fields", () => {
    const raw: Record<string, unknown> = {
      harnessPromptAssemblyPreview: {
        mode: "dry_run",
        sections: [
          {
            id: "constraints",
            type: "constraints",
            title: "제약/정책",
            content: "dry-run only",
            source: "harness_default",
            includeReason: "policy",
            priority: 0,
            estimatedCost: 5,
          },
        ],
        totalEstimatedCost: 5,
        overflowRisk: "low",
        warnings: [],
      },
      harnessPromptPreviewDiff: {
        existingPromptLength: 0,
        previewLength: 5,
        sectionCount: 1,
        missingSectionTypes: [],
        extraSectionTypes: [],
        warnings: [],
      },
    };
    const out = coerceHarnessPromptAssemblyMetadata(raw);
    expect(out.harnessPromptAssemblyPreview?.sections.length).toBe(1);
    expect(out.harnessPromptPreviewDiff?.previewLength).toBe(5);
  });
});
