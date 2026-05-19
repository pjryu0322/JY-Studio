import { describe, expect, it } from "vitest";
import type { RequirementsServiceFlowV1 } from "@/lib/requirements/requirementsStateJson";
import {
  buildAlternativeCompactAssistantMessage,
  buildAlternativeProposalPayload,
  computeAlternativeProposalComparison,
  inferAlternativeDirectionLabel,
} from "@/lib/requirements/serviceFlowAlternativeProposalPayload";

const now = "2026-05-19T00:00:00.000Z";

function baseFlow(steps: string[], actors: string[]): RequirementsServiceFlowV1 {
  const actorRows = actors.map((name, i) => ({
    id: `a${i + 1}`,
    name,
    kind: /시스템|엔진/.test(name) ? ("system" as const) : ("human" as const),
    description: "",
  }));
  const stepRows = steps.map((title, i) => ({
    id: `s${i + 1}`,
    title,
    purpose: title,
    order: i + 1,
    primaryActorId: actorRows[0]?.id ?? "a1",
    secondaryActorIds: [] as string[],
    approved: false,
    updatedAt: now,
  }));
  return { createdAt: now, updatedAt: now, actors: actorRows, steps: stepRows };
}

describe("serviceFlowAlternativeProposalPayload phase13", () => {
  it("computeAlternativeProposalComparison — added actors/steps", () => {
    const baseline = baseFlow(["업로드", "정리", "요약"], ["사용자", "시스템"]);
    const alt = baseFlow(
      ["업로드", "자동 정리", "검토 요청", "최종 확정"],
      ["사용자", "시스템", "관리자", "검토자"],
    );
    const comp = computeAlternativeProposalComparison(baseline, alt);
    expect(comp.addedActors).toContain("관리자");
    expect(comp.addedSteps.some((s) => /검토/.test(s))).toBe(true);
  });

  it("inferAlternativeDirectionLabel — 협업 강화형", () => {
    const comp = computeAlternativeProposalComparison(
      baseFlow(["A", "B"], ["사용자"]),
      baseFlow(["A", "검토 요청", "승인"], ["사용자", "검토자"]),
    );
    expect(inferAlternativeDirectionLabel(comp)).toBe("협업·검토 강화형");
  });

  it("buildAlternativeProposalPayload + compact assistant — dump 없음", () => {
    const baseline = baseFlow(["업로드", "정리", "요약"], ["사용자", "시스템"]);
    const alt = baseFlow(["업로드", "검토 요청", "확정"], ["사용자", "검토자"]);
    const payload = buildAlternativeProposalPayload({
      baselineFlow: baseline,
      alternativeFlow: alt,
      llmAssistantMessage: "예상 서비스 흐름:\n1. A\n2. B\n\n이 대안은 협업 검토를 강화합니다.",
      proposalId: "alt-test-1",
    });
    const compact = buildAlternativeCompactAssistantMessage(payload);
    expect(compact).toContain("이번 대안은");
    expect(compact).not.toMatch(/예상\s*서비스\s*흐름/);
    expect(payload.comparison.baselineSteps.length).toBeGreaterThan(0);
    expect(payload.steps.length).toBeGreaterThan(0);
  });
});
