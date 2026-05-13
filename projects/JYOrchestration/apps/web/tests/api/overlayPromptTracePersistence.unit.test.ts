import { describe, expect, it } from "vitest";
import { extractOverlayPromptTraceMetadata } from "@/lib/overlay/overlayPromptTraceExtract";
import { validateWorkspaceAiMemberOverlayMappings } from "@/lib/overlay/overlayIdentityFromWorkspace";
import { parseRequirementsStateJson } from "@/lib/requirements/requirementsStateJson";

describe("Overlay prompt trace persistence", () => {
  it("parseRequirementsStateJson keeps overlay fields; extractOverlayPromptTraceMetadata reads them", () => {
    const timelineRow = {
      createdAt: "2026-01-01T00:00:00.000Z",
      action: "requirementsChatOrchestration",
      stage: "ideation",
      source: "llm",
      overlayIdentity: {
        roleKey: "planner",
        perspective: "planning",
        provider: "openai",
        capabilities: ["llm_chat"],
      },
      overlayContextAssembly: {
        usedRole: "planner",
        usedMemoryRefs: [
          { scope: "project", ref: "state:123" },
          { scope: "session", ref: "dialogueExcerpt" },
        ],
        usedKnowledgePacks: ["role-default:test"],
        usedStage: "requirements_ideation · ideation",
        tokenBudgetHint: "not_measured",
      },
      overlayKnowledgeActivationHints: [
        {
          knowledgePackId: "role-default:planner",
          targetRoles: ["planner"],
          activationReason: "role_default",
          priority: 0,
          status: "proposed",
        },
      ],
      overlayPolicyHints: {
        knowledgeHintsEnabled: true,
        contextAssemblyEnabled: true,
        overlayTraceEnabled: true,
        cursorCapabilityAllowed: false,
        cursorCapabilityEnforcement: "not_applied" as const,
      },
      overlayPolicyWarnings: [
        {
          code: "OVERLAY_KNOWLEDGE_HINT_DISABLED",
          severity: "info",
          message: "test",
          source: "singlechat",
          enforcement: "not_applied" as const,
        },
      ],
    };

    const parsed = parseRequirementsStateJson({ promptTimeline: [timelineRow] });
    const entry = parsed.promptTimeline?.[0];
    expect(entry).toBeTruthy();
    expect(entry?.overlayIdentity?.roleKey).toBe("planner");
    expect(entry?.overlayContextAssembly?.usedKnowledgePacks).toContain("role-default:test");
    expect(entry?.overlayKnowledgeActivationHints?.length).toBe(1);
    expect(entry?.overlayPolicyHints?.cursorCapabilityEnforcement).toBe("not_applied");
    expect(entry?.overlayPolicyWarnings?.[0]?.code).toBe("OVERLAY_KNOWLEDGE_HINT_DISABLED");

    const extracted = extractOverlayPromptTraceMetadata(entry!);
    expect(extracted.overlayIdentity?.roleKey).toBe("planner");
    expect(extracted.overlayContextAssembly?.usedStage).toContain("requirements_ideation");
    expect(extracted.overlayKnowledgeActivationHints?.[0]?.status).toBe("proposed");
    expect(extracted.overlayPolicyHints?.overlayTraceEnabled).toBe(true);
    expect(extracted.overlayPolicyWarnings?.[0]?.enforcement).toBe("not_applied");
  });

  it("workspace AI catalog keys have overlay mapping coverage (diagnostic contract)", () => {
    const { mapped, unmapped } = validateWorkspaceAiMemberOverlayMappings();
    expect(mapped.length + unmapped.length).toBeGreaterThan(0);
    expect(unmapped).toEqual([]);
  });
});
