import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { buildUserMessageWithPreviewCaptureAttachment } from "@/lib/prototype/previewCaptureSingleChatBridge";
import { resolveImplementationWorkingQueueOperationalSend } from "@/lib/prototype/implementationWorkingQueueOperationalSend";
import type { RequirementsStateJson } from "@/lib/requirements/requirementsStateJson";

describe("preview capture gate priority", () => {
  const attachment = {
    id: "reg-1",
    type: "preview_region_capture" as const,
    projectId: "proj-1",
    stage: "implementation" as const,
    previewUrl: "https://demo.github.io/app",
    captureId: "cap-1",
    regionCaptureId: "reg-1",
    imageDataUrl: "data:image/png;base64,abcd",
    rect: { x: 0, y: 0, width: 10, height: 10 },
    viewport: { width: 1440, height: 900 },
    createdAt: "2026-06-14T00:00:00.000Z",
  };

  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            success: true,
            data: {
              analysis: {
                intent: "implementation_preview_feedback",
                title: "LLM title",
                description: "LLM desc",
                desiredBehavior: "LLM behavior",
                affectedArea: "ui",
                riskLevel: "low",
                needsClarification: false,
                confidence: "high",
                reason: "mock",
              },
              trace: { source: "llm_vision", usedVision: true },
            },
          }),
          { status: 200 },
        ),
      ),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("enters preview analyzer when isDraftGenerationComplete is true (no seed gate)", async () => {
    const state = {} as unknown as RequirementsStateJson;
    const userMsg = buildUserMessageWithPreviewCaptureAttachment({
      userId: "me",
      content: "스크립트 탭에 클릭이벤트를 적용해줘",
      attachment,
    });
    const result = await resolveImplementationWorkingQueueOperationalSend({
      text: "스크립트 탭에 클릭이벤트를 적용해줘",
      userMsg,
      projectId: "proj-1",
      requirementsStateJson: state,
      isDraftGenerationComplete: true,
      parsedRequirementsState: state,
      implementationBootstrapInput: null,
    });
    expect(result && typeof result === "object" && result.kind).toBe("apply_conversation");
    expect(fetch).toHaveBeenCalled();
  });
});
