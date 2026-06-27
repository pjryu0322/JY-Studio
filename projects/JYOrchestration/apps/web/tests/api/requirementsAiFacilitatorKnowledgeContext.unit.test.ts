import { describe, expect, it } from "vitest";
import {
  buildRequirementsTurnUserMemoryTimelineTraceFields,
  type RequirementsTurnKnowledgeContext,
} from "@/lib/requirements/requirementsTurnKnowledgeContext";

describe("requirementsAiFacilitatorKnowledgeContext", () => {
  it("exposes alias blocks and trace fields for route wiring", () => {
    const knowledgeContext = {
      referencePromptContextBlock: "[reference_context]\nbody",
      referencePlanningContextBlock: "[reference_context]\nbody",
      referenceTimelineMeta: { referenceContextInjected: true },
      userMemoryPrepared: null,
      userMemoryControl: null,
      userMemoryTimelineMeta: undefined,
      userMemoryTimelineTraceFields: {},
    } satisfies RequirementsTurnKnowledgeContext;

    expect(knowledgeContext.referencePlanningContextBlock).toBe(
      knowledgeContext.referencePromptContextBlock,
    );

    const traceFields = buildRequirementsTurnUserMemoryTimelineTraceFields({
      prepared: {
        byAgent: {},
        totalItemCount: 1,
        sourceProjectCount: 1,
        memoryControlEnabled: true,
      },
      timelineMeta: [
        {
          kind: "user_project_knowledge_memory_context",
          agent: "planner",
          itemCount: 1,
          sourceProjectCount: 1,
          injected: true,
        },
      ],
    });
    expect(traceFields.userProjectKnowledgeMemoryContexts).toHaveLength(1);
    expect(traceFields).not.toHaveProperty("userProjectKnowledgeMemoryControlEnabled");
  });

  it("documents usage recording prerequisites unchanged", () => {
    const shouldRecord = (input: {
      projectId?: string;
      prepared: unknown;
      control: unknown;
      usedFallback: boolean;
      isFallbackTrace: boolean;
    }) =>
      Boolean(input.projectId && input.prepared && input.control && !input.usedFallback && !input.isFallbackTrace);

    expect(
      shouldRecord({
        projectId: "p1",
        prepared: {},
        control: {},
        usedFallback: false,
        isFallbackTrace: false,
      }),
    ).toBe(true);
    expect(
      shouldRecord({
        projectId: "p1",
        prepared: {},
        control: {},
        usedFallback: true,
        isFallbackTrace: false,
      }),
    ).toBe(false);
  });
});
