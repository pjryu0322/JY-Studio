import { describe, expect, it } from "vitest";
import {
  buildAlternativeBaselineFailureUserMessage,
  buildRequirementsServiceFlowFromProposalText,
  resolveAlternativeBaseline,
} from "@/lib/requirements/serviceFlowAlternativeBaseline";
import { synthesizeBootstrapUserMessageFromProposalDraft } from "@/lib/requirements/requirementsBootstrapProposalDraft";
import { applyQuickReplyAwareAssistantPresentation } from "@/lib/requirements/serviceFlowAssistantPresentation";

const now = "2026-05-19T00:00:00.000Z";

const bootstrapProposalText = [
  "서비스 초안입니다.",
  "",
  "예상 서비스 흐름:",
  "1. 요청 접수",
  "2. 처리",
  "3. 결과 전달",
  "",
  "예상 액터:",
  "- 사용자",
  "- 시스템",
].join("\n");

describe("serviceFlowAlternativeBaseline phase12", () => {
  it("buildRequirementsServiceFlowFromProposalText — bootstrap proposal에서 flow 생성", () => {
    const flow = buildRequirementsServiceFlowFromProposalText(bootstrapProposalText, now);
    expect(flow).not.toBeNull();
    expect(flow?.steps?.length).toBeGreaterThanOrEqual(2);
    expect(flow?.actors?.length).toBeGreaterThanOrEqual(2);
  });

  it("resolveAlternativeBaseline — currentFlow empty + ideation asset", () => {
    const baseline = resolveAlternativeBaseline({
      currentFlow: null,
      ideationAssets: [{ type: "proposal", content: bootstrapProposalText }],
    });
    expect(baseline).not.toBeNull();
    expect(baseline?.source).toBe("bootstrapProposalDraft");
    expect(baseline?.flow.steps?.length).toBeGreaterThanOrEqual(1);
  });

  it("resolveAlternativeBaseline — currentFlow with steps 우선", () => {
    const flow = buildRequirementsServiceFlowFromProposalText(bootstrapProposalText, now)!;
    const baseline = resolveAlternativeBaseline({
      currentFlow: flow,
      ideationAssets: [{ content: "other" }],
    });
    expect(baseline?.source).toBe("currentFlow");
  });

  it("resolveAlternativeBaseline — baseline 없으면 null", () => {
    expect(
      resolveAlternativeBaseline({
        currentFlow: null,
        recentMessages: "",
        ideationAssets: [],
      }),
    ).toBeNull();
  });

  it("buildAlternativeBaselineFailureUserMessage — 재시도-only 문구 없음", () => {
    const msg = buildAlternativeBaselineFailureUserMessage();
    expect(msg).toContain("추천안 적용");
    expect(msg).not.toMatch(/다시\s*시도/);
  });

  it("synthesizeBootstrapUserMessageFromProposalDraft — enumerated CTA 없음", () => {
    const msg = synthesizeBootstrapUserMessageFromProposalDraft({
      summary: "초안",
      actors: ["사용자", "시스템"],
      workflow: ["입력", "처리", "출력"],
      stages: [],
      capabilities: [],
    });
    expect(msg).not.toMatch(/다음:\s*추천안 적용/);
    expect(msg).toContain("추천안을 검토해 주세요");
  });

  it("applyQuickReplyAwareAssistantPresentation — 추천: enumeration 제거", () => {
    const chips = ["추천안 적용", "일부 수정", "다른 대안 보기"];
    const msg = `요약\n\n추천: 위 초안을 기준으로 세부를 맞춰 가면 됩니다.\n다음: 추천안 적용 / 일부 수정 / 다른 대안 보기 중 하나를 골라 주세요.`;
    const out = applyQuickReplyAwareAssistantPresentation(msg, chips);
    expect(out).not.toMatch(/다음:\s*추천안/);
    expect(out).not.toMatch(/추천:\s*위 초안/);
    expect(out).toContain("요약");
  });
});
