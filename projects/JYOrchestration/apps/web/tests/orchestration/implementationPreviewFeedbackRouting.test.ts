import { describe, expect, it } from "vitest";
import {
  IMPLEMENTATION_USER_MESSAGE_WITH_PREVIEW_CAPTURE_INTERNAL_TYPE,
  buildUserMessageWithPreviewCaptureAttachment,
  extractPreviewCaptureContextFromUserMessage,
  hasPreviewRegionCaptureAttachment,
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

  it("detects attachments array", () => {
    expect(
      hasPreviewRegionCaptureAttachment({
        attachments: [{ type: "preview_region_capture" }],
      }),
    ).toBe(true);
  });

  it("detects regionCaptureId in meta", () => {
    expect(
      hasPreviewRegionCaptureAttachment({
        meta: { regionCaptureId: "reg-1" },
      }),
    ).toBe(true);
  });
});

describe("preview capture operational send routing", () => {
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

  it("routes capture + text to working queue with preview feedback intent", () => {
    const userMsg = buildUserMessageWithPreviewCaptureAttachment({
      userId: "me",
      content: "스크립트 탭에 클릭이벤트를 적용해줘",
      attachment,
    });
    const result = resolveImplementationWorkingQueueOperationalSend({
      text: "스크립트 탭에 클릭이벤트를 적용해줘",
      userMsg,
      projectId: "proj-1",
      requirementsStateJson: baseState,
      isDraftGenerationComplete: false,
      parsedRequirementsState: baseState,
      implementationBootstrapInput: null,
    });
    expect(result).not.toBeNull();
    expect(result && typeof result === "object" && result.kind).toBe("apply_conversation");
    if (!result || typeof result !== "object" || result.kind !== "apply_conversation") return;
    const item = result.orchestration.implementationWorkingQueueV1?.items[0];
    expect(item?.status).toBe("pending");
    expect(item?.affectedArea).toBe("ui");
    expect(item?.riskLevel).toBe("low");
    expect(item?.regionCaptureId).toBe("reg-1");
    expect(item?.sourceCaptureId).toBe("cap-1");
    expect(item?.previewUrl).toBe("https://demo.github.io/app");
    expect(item?.rect).toEqual({ x: 1, y: 2, width: 10, height: 12 });
    const ai = result.messages[result.messages.length - 1];
    expect(ai?.meta?.intent).toBe(IMPLEMENTATION_PREVIEW_FEEDBACK_INTENT);
    expect(ai?.content).toContain("작업대기에 등록");
    expect(ai?.content).not.toContain("어떤 종류");
  });

  it("blocks queue when capture meta present but text empty", () => {
    const userMsg = buildUserMessageWithPreviewCaptureAttachment({
      userId: "me",
      content: "",
      attachment,
    });
    const result = resolveImplementationWorkingQueueOperationalSend({
      text: "",
      userMsg,
      projectId: "proj-1",
      requirementsStateJson: baseState,
      isDraftGenerationComplete: false,
      parsedRequirementsState: baseState,
      implementationBootstrapInput: null,
    });
    expect(result?.kind).toBe("assistant_reply");
    if (!result || typeof result !== "object" || result.kind !== "assistant_reply") return;
    expect(result.aiMessage.content).toContain("보완 내용");
  });

  it("extracts capture context from user message", () => {
    const userMsg = buildUserMessageWithPreviewCaptureAttachment({
      userId: "me",
      content: "사용자가 클릭하면 스크립트 내용을 보여줘",
      attachment,
    });
    const ctx = extractPreviewCaptureContextFromUserMessage(userMsg);
    expect(ctx?.regionCaptureId).toBe("reg-1");
    expect(ctx?.sourceCaptureId).toBe("cap-1");
  });
});
