import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import {
  buildUserMessageWithPreviewCaptureAttachment,
  hasPreviewRegionCaptureAttachment,
  IMPLEMENTATION_USER_MESSAGE_WITH_PREVIEW_CAPTURE_INTERNAL_TYPE,
} from "@/lib/prototype/previewCaptureSingleChatBridge";
import { resolveImplementationWorkingQueueOperationalSend } from "@/lib/prototype/implementationWorkingQueueOperationalSend";
import { IMPLEMENTATION_PREVIEW_FEEDBACK_INTENT } from "@/lib/prototype/implementationWorkingQueuePreviewFeedback";
import type { RequirementsStateJson } from "@/lib/requirements/requirementsStateJson";

describe("hasPreviewRegionCaptureAttachment", () => {
  it("detects meta internalType", () => {
    expect(
      hasPreviewRegionCaptureAttachment({
        meta: { internalType: IMPLEMENTATION_USER_MESSAGE_WITH_PREVIEW_CAPTURE_INTERNAL_TYPE },
      }),
    ).toBe(true);
  });
});

describe("preview capture operational send routing (LLM)", () => {
  const baseState = {
    implementationSeedV1: { version: "implementation_seed_v1" },
  } as unknown as RequirementsStateJson;

  const attachment = {
    id: "reg-1",
    type: "preview_region_capture" as const,
    projectId: "proj-1",
    stage: "implementation" as const,
    previewUrl: "https://demo.github.io/app",
    captureId: "cap-1",
    regionCaptureId: "reg-1",
    imageDataUrl: "data:image/png;base64,abcd",
    rect: { x: 1, y: 2, width: 10, height: 12 },
    viewport: { width: 1440, height: 900 },
    createdAt: "2026-06-14T00:00:00.000Z",
  };

  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init?: RequestInit) => {
        const body = JSON.parse(String(init?.body ?? "{}")) as { mode?: string };
        if (body.mode === "preview_feedback") {
          return new Response(
            JSON.stringify({
              success: true,
              data: {
                analysis: {
                  intent: "implementation_preview_feedback",
                  title: "스크립트 탭 클릭 이벤트 적용",
                  description: "스크립트 탭 클릭 시 내용 표시",
                  targetUi: "결과 패널의 스크립트 탭",
                  desiredBehavior: "클릭하면 스크립트 내용 표시",
                  affectedArea: "ui",
                  riskLevel: "low",
                  needsClarification: false,
                  confidence: "high",
                  reason: "llm mock",
                },
                trace: { source: "llm_vision", model: "gpt-4o-mini" },
              },
            }),
            { status: 200 },
          );
        }
        return new Response(JSON.stringify({ success: true, data: { result: { intent: "none", confidence: "low", reason: "mock" }, trace: { source: "llm" } } }), {
          status: 200,
        });
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("routes capture + text to working queue via LLM analysis", async () => {
    const userMsg = buildUserMessageWithPreviewCaptureAttachment({
      userId: "me",
      content: "스크립트 탭에 클릭이벤트를 적용해줘",
      attachment,
    });
    const result = await resolveImplementationWorkingQueueOperationalSend({
      text: "스크립트 탭에 클릭이벤트를 적용해줘",
      userMsg,
      projectId: "proj-1",
      requirementsStateJson: baseState,
      isDraftGenerationComplete: false,
      parsedRequirementsState: baseState,
      implementationBootstrapInput: null,
    });
    expect(result && typeof result === "object" && result.kind).toBe("apply_conversation");
    if (!result || typeof result !== "object" || result.kind !== "apply_conversation") return;
    const item = result.orchestration.implementationWorkingQueueV1?.items[0];
    expect(item?.title).toContain("스크립트");
    expect(item?.targetUi).toContain("스크립트");
    expect(item?.regionCaptureId).toBe("reg-1");
    const ai = result.messages[result.messages.length - 1];
    expect(ai?.meta?.intent).toBe(IMPLEMENTATION_PREVIEW_FEEDBACK_INTENT);
  });
});
