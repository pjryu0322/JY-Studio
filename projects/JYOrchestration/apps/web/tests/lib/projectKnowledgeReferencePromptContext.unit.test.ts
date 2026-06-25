import { describe, expect, it } from "vitest";
import {
  formatReferencePromptContextSectionText,
  referencePromptContextTimelineFields,
  wrapReferenceContextForOrchestrationLlm,
} from "@/lib/project-knowledge/projectKnowledgeReferencePromptContext";
import { resolveReferencePromptContextBlockForOrchestration } from "@/lib/requirements/singleChatOrchestrationOpenAI";

describe("reference prompt context section", () => {
  it("builds prompt text with header and without internal ids", () => {
    const text = formatReferencePromptContextSectionText({
      summarySections: [{ title: "주요 액터", content: "- 고객" }],
      selectedNodes: [
        {
          title: "승인 흐름",
          nodeType: "ServiceFlow",
          reusableAs: ["SERVICE_FLOW"],
          reason: "검토 표현과 관련됨",
          score: 4,
        },
      ],
    });
    expect(text).toContain("[참조 프로젝트 컨텍스트]");
    expect(text).toContain("승인 흐름");
    expect(text).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-/i);
    expect(text).not.toContain("entityKey");
  });

  it("wraps orchestration reference section", () => {
    const wrapped = wrapReferenceContextForOrchestrationLlm("[참조 프로젝트 컨텍스트]\n본문");
    expect(wrapped).toContain("[reference_context]");
  });

  it("does not merge reference block into projectDescription", () => {
    const block = resolveReferencePromptContextBlockForOrchestration({
      referencePromptContextBlock: "[참조 프로젝트 컨텍스트]\nActor",
    });
    expect(block).toContain("[reference_context]");
    const description = "새 프로젝트 설명";
    expect(description).not.toContain("참조");
  });

  it("emits timeline diagnostics when reference is active", () => {
    const fields = referencePromptContextTimelineFields({
      hasReference: true,
      sourceSnapshotIds: ["internal-only"],
      mode: "SUMMARY_AND_RELEVANT_NODES",
      summarySections: [],
      selectedNodes: [],
      promptText: "x",
      diagnostics: {
        selectedNodeCount: 2,
        candidateNodeCount: 5,
        selectionQuery: "고객",
        selectionReason: "matched",
      },
    });
    expect(fields.referenceContextInjected).toBe(true);
    expect(fields.referenceContextSelectedNodeCount).toBe(2);
    expect(JSON.stringify(fields)).not.toContain("internal-only");
  });
});
