import { describe, expect, it } from "vitest";
import {
  applyUserFeedbackPatchToImplementationSeed,
  buildImplementationUserFeedbackAppliedMessage,
  buildImplementationUserFeedbackPatch,
  buildImplementationUserFeedbackPatchIfRelevant,
  classifyImplementationUserFeedback,
  isExplicitImplementationExecutionRequest,
  isImplementationUserFeedbackRelevant,
} from "@/lib/prototype/implementationUserFeedback";
import { buildImplementationSeedFromPlanning } from "@/lib/requirements/implementationSeed";
import {
  buildDynamicServicePlanningSlotDefinitions,
  initialOrchestrationStateFromDefinitions,
} from "@/lib/requirements/singleChatOrchestrationSlots";

const nowIso = "2026-01-01T00:00:00.000Z";

describe("implementationUserFeedback", () => {
  it("classifies file upload and security implementation feedback", () => {
    const kinds = classifyImplementationUserFeedback(
      "허용파일은 MP3, WAV 만 해줘\n임시파일은 바로 삭제 해줘\n첨부파일 용량은 100M 이내로 해줘",
    );

    expect(kinds).toContain("file_upload_policy");
    expect(kinds).toContain("security_policy");
    expect(kinds).toContain("validation_rule");
  });

  it("extracts upload file constraints from implementation user feedback", () => {
    const patch = buildImplementationUserFeedbackPatch({
      text: "허용파일은 MP3, WAV 만 해줘\n임시파일은 바로 삭제 해줘\n첨부파일 용량은 100M 이내로 해줘",
      sourceMessageId: "m1",
      nowIso,
    });

    expect(patch.extractedRules).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: "허용 파일 형식", normalizedValue: "mp3,wav" }),
        expect.objectContaining({ label: "임시파일 처리" }),
        expect.objectContaining({ label: "첨부파일 용량 제한", normalizedValue: "100MB" }),
      ]),
    );
  });

  it("treats implementation requirements as feedback, not execution commands", () => {
    expect(isImplementationUserFeedbackRelevant("허용파일은 MP3, WAV만")).toBe(true);
    expect(isExplicitImplementationExecutionRequest("허용파일은 MP3, WAV만")).toBe(false);
    expect(buildImplementationUserFeedbackPatchIfRelevant({ text: "작업 계획 생성", sourceMessageId: "m2" })).toBeNull();
    expect(isExplicitImplementationExecutionRequest("작업 계획 생성")).toBe(true);
  });

  it("builds feedback applied message with extracted rules and env gate note", () => {
    const patch = buildImplementationUserFeedbackPatch({
      text: "허용파일은 MP3, WAV 만 해줘\n첨부파일 용량은 100M 이내로 해줘",
      sourceMessageId: "m3",
      nowIso,
    });
    const msg = buildImplementationUserFeedbackAppliedMessage({ patch, envOk: false });

    expect(msg.content).toContain("요청하신 구현 기준을 반영했습니다");
    expect(msg.content).toContain("허용 파일 형식");
    expect(msg.content).toContain("100MB");
    expect(msg.content).toContain("Code Agent WIP 작업 요청은 실행 환경 점검이 완료된 뒤");
    expect(msg.content).not.toBe("먼저 실행 환경 점검을 완료해 주세요.");
  });

  it("applies implementation feedback to seed when seed exists", () => {
    const definitions = buildDynamicServicePlanningSlotDefinitions({
      projectId: "p1",
      projectName: "회의록",
    });
    const orchestration = initialOrchestrationStateFromDefinitions(definitions, nowIso);
    const seed = buildImplementationSeedFromPlanning({
      projectId: "p1",
      orchestration,
      definitions,
      lifecycleStatus: "confirmed",
      nowIso,
    });
    const patch = buildImplementationUserFeedbackPatch({
      text: "허용파일은 MP3, WAV 만 해줘",
      sourceMessageId: "m4",
      nowIso,
    });
    const next = applyUserFeedbackPatchToImplementationSeed(seed, patch);
    expect(next?.commonDetailFeatures.some((f) => f.name.includes("허용"))).toBe(true);
  });
});
