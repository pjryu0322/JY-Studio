import { describe, expect, it } from "vitest";
import { buildIntentRouterSystemPromptForTest } from "@/lib/requirements/requirementsIntentRouterLlm";
import { buildServiceFlowAnalyzeJsonSchemaPromptBlock } from "@/lib/requirements/serviceFlowAnalyzeSchemaPrompt";
import { parseServiceFlowAnalyzeWire } from "@/lib/requirements/serviceFlowAnalyzeParse";

describe("serviceFlowAnalyzeSchemaPrompt", () => {
  it("requires step.purpose not description", () => {
    const block = buildServiceFlowAnalyzeJsonSchemaPromptBlock();
    expect(block).toContain('"purpose"');
    expect(block).toContain("step.description을 쓰지 않는다");
    expect(block).toContain("primaryActorId");
  });

  it("intent router prompt distinguishes feature_planning from service_flow", () => {
    const prompt = buildIntentRouterSystemPromptForTest();
    expect(prompt).toContain("feature_planning");
    expect(prompt).toContain("not service_flow or flow_step_definition");
  });
});

describe("serviceFlowAnalyzeParse", () => {
  const now = "2026-05-19T00:00:00.000Z";

  it("parses steps with required purpose/order/primaryActorId fields", () => {
    const parsed = parseServiceFlowAnalyzeWire(
      {
        assistantMessage: "예상 흐름 1. 업로드 2. 처리 3. 확인",
        updatedFlow: {
          createdAt: now,
          updatedAt: now,
          actors: [
            { id: "actor_user", name: "사용자", kind: "human", description: "업로드" },
            { id: "actor_system", name: "시스템", kind: "system", description: "처리" },
          ],
          steps: [
            {
              id: "step_upload",
              title: "녹취 파일 업로드",
              purpose: "사용자가 파일을 업로드한다.",
              order: 1,
              primaryActorId: "actor_user",
              secondaryActorIds: ["actor_system"],
              approved: false,
              updatedAt: now,
            },
            {
              id: "step_process",
              title: "자동 정리",
              purpose: "시스템이 텍스트를 정리한다.",
              order: 2,
              primaryActorId: "actor_system",
              secondaryActorIds: [],
              approved: false,
              updatedAt: now,
            },
            {
              id: "step_review",
              title: "결과 확인",
              purpose: "사용자가 결과를 확인한다.",
              order: 3,
              primaryActorId: "actor_user",
              secondaryActorIds: [],
              approved: false,
              updatedAt: now,
            },
          ],
        },
        intent: "add_step",
        readiness: {
          score: 30,
          actorsReady: true,
          stepsReady: true,
          mappingReady: true,
          readyForNext: false,
        },
      },
      now,
    );

    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.data.updatedFlow.steps.length).toBe(3);
      expect(parsed.data.updatedFlow.steps[0]?.purpose).toContain("업로드");
    }
  });
});
