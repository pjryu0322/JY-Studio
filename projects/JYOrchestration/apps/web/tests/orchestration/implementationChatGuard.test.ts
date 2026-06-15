import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { buildUserMessageWithPreviewCaptureAttachment } from "@/lib/prototype/previewCaptureSingleChatBridge";
import { resolveImplementationWorkingQueueOperationalSend } from "@/lib/prototype/implementationWorkingQueueOperationalSend";
import { resolveImplementationChatAvailability } from "@/lib/prototype/implementationChatAvailability";
import { shouldBlockImplementationSupplementChat } from "@/lib/prototype/implementationChatAvailabilityGuard";
import type { RequirementsStateJson } from "@/lib/requirements/requirementsStateJson";
import { IMPLEMENTATION_CHAT_AVAILABILITY_BLOCKED_INTERNAL_TYPE } from "@/lib/prototype/implementationChatAvailabilityGuard";

describe("implementationChatGuard", () => {
  const lockedAvailability = resolveImplementationChatAvailability({
    implementationStarted: true,
    codeTasksCompleted: false,
    githubVerified: false,
    integrationCompleted: false,
    previewUrl: null,
    previewReady: false,
    sampleDataRequired: true,
    sampleDataQualityOk: false,
    sampleDataRenderedOk: false,
    hasFailedTasks: false,
    board: null,
    integrationPipelineUnlocked: false,
    activeTaskCursorRunning: true,
    taskCursorGithubVerifying: false,
  });

  it("blocks when chat is not available", () => {
    expect(shouldBlockImplementationSupplementChat(lockedAvailability)).toBe(true);
  });

  it("working queue operational send applies availability guard at entry", () => {
    const src = readFileSync(
      resolve(process.cwd(), "src/lib/prototype/implementationWorkingQueueOperationalSend.ts"),
      "utf8",
    );
    const fnStart = src.indexOf("export async function resolveImplementationWorkingQueueOperationalSend");
    const fnBody = src.slice(fnStart, fnStart + 400);
    expect(fnBody).toContain("blockWhenImplementationChatUnavailable");
    expect(fnBody.indexOf("blockWhenImplementationChatUnavailable")).toBeLessThan(
      fnBody.indexOf("hasPreviewRegionCaptureAttachment"),
    );
  });
});

describe("implementationChatGuard blocked send", () => {
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
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("does not call Preview analyzer or Provider when canChat is false", async () => {
    const state = {
      implementationSeedV1: { version: "v1" },
    } as unknown as RequirementsStateJson;
    const userMsg = buildUserMessageWithPreviewCaptureAttachment({
      userId: "me",
      content: "보완 요청",
      attachment,
    });
    const chatAvailability = resolveImplementationChatAvailability({
      implementationStarted: true,
      codeTasksCompleted: false,
      githubVerified: false,
      integrationCompleted: false,
      previewUrl: "https://demo.github.io/app",
      previewReady: false,
      previewOpenTargetReady: true,
      sampleDataRequired: true,
      sampleDataQualityOk: false,
      sampleDataRenderedOk: false,
      hasFailedTasks: false,
      board: null,
      integrationPipelineUnlocked: false,
      activeTaskCursorRunning: true,
      taskCursorGithubVerifying: false,
    });
    const result = await resolveImplementationWorkingQueueOperationalSend({
      text: "보완 요청",
      userMsg,
      projectId: "proj-1",
      requirementsStateJson: state,
      isDraftGenerationComplete: false,
      parsedRequirementsState: state,
      implementationBootstrapInput: { projectId: "proj-1" } as never,
      chatAvailability,
    });
    expect(fetch).not.toHaveBeenCalled();
    expect(result?.kind).toBe("assistant_reply");
    if (result?.kind === "assistant_reply") {
      expect(result.aiMessage.meta?.internalType).toBe(IMPLEMENTATION_CHAT_AVAILABILITY_BLOCKED_INTERNAL_TYPE);
      expect(result.aiMessage.content).toContain("Preview");
    }
  });
});

describe("implementationComposerDisabled wiring", () => {
  it("single chat workspace blocks input when preview not ready", () => {
    const src = readFileSync(
      resolve(process.cwd(), "src/components/preview/useImplementationSingleChatWorkspaceController.ts"),
      "utf8",
    );
    expect(src).toContain("implementationChatAvailability");
    expect(src).toContain("captureAttachEnabled");
    expect(src).toContain("buildImplementationChatAvailabilityBlockedOperationalResult");
  });

  it("stage panel shows locked notice", () => {
    const panel = readFileSync(
      resolve(process.cwd(), "src/components/preview/PrototypeImplementationStagePanel.tsx"),
      "utf8",
    );
    expect(panel).toContain("ImplementationChatLockedNotice");
    expect(panel).toContain("inputDisabled={isMessageInputBlocked}");
  });
});
