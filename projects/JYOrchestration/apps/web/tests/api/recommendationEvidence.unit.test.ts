import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ProjectRailRecommendationButton } from "@/components/layout/platformTopNav/ProjectRailRecommendationButton";
import { RecommendationEvidencePanel } from "@/components/recommendation/RecommendationEvidencePanel";
import { RequirementsMessageExplainability } from "@/components/requirements/RequirementsMessageExplainability";
import {
  buildRecommendationEvidenceItems,
  isInternalRecommendationText,
  showInlineMessageExplainability,
} from "@/lib/recommendation/recommendationEvidence";
import type { RequirementsStateJson } from "@/lib/requirements/requirementsStateJson";

const now = "2026-05-19T12:00:00.000Z";

describe("buildRecommendationEvidenceItems", () => {
  it("builds recommendation evidence items from prompt timeline and artifact orchestration metadata", () => {
    const state: RequirementsStateJson = {
      promptTimeline: [
        {
          stage: "ideation",
          action: "quick_design_confirmed",
          source: "llm",
          aiMember: "AI 기획자",
          createdAt: now,
          responseText: "녹취 기반 회의록 자동 정리와 빠른 프로토타입 범위를 제안했습니다.",
        },
      ],
      projectArtifacts: [
        {
          id: "a1",
          type: "fast_prototype_plan",
          title: "프로토타입 기획안",
          createdAt: now,
          createdBy: "ai",
          sourceStage: "IDEATION",
          content: "# 기획안\n\n본문",
          orchestration: {
            reason: "사용자가 빠른 프로토타입을 우선한다고 명시했습니다.",
            required: true,
            confidence: 0.9,
            sourceRoles: ["planner"],
            sourceSlotKeys: ["scope.mvp"],
            trace: [],
            completenessScore: 0.85,
            hubReadinessLabel: "생성완료",
            plannedAt: now,
          },
        },
      ],
    };
    const items = buildRecommendationEvidenceItems({ requirementsStateJson: state });
    expect(items.length).toBeGreaterThanOrEqual(2);
    const qd = items.find((i) => i.title.includes("Quick Design"));
    expect(qd?.stage).toBe("planning");
    expect(qd?.status).toBe("confirmed");
    expect(qd?.aiMemberLabel).toContain("기획");
    expect(qd?.summary.length).toBeGreaterThan(0);
    expect(qd?.reasons.length).toBeGreaterThan(0);
    const art = items.find((i) => i.title.includes("프로토타입"));
    expect(art?.referencedArtifacts.length).toBeGreaterThan(0);
  });

  it("does not expose internal prompt assembly metadata in recommendation evidence", () => {
    const state: RequirementsStateJson = {
      promptTimeline: [
        {
          stage: "ideation",
          action: "quick_design_requested",
          source: "llm",
          createdAt: now,
          responseText: "참조 맥락 후보 7건 · 조립 계획 단계 6건 · 맥락 예산 압축 정책",
        },
      ],
    };
    const items = buildRecommendationEvidenceItems({ requirementsStateJson: state });
    const blob = JSON.stringify(items);
    expect(isInternalRecommendationText("맥락 예산")).toBe(true);
    expect(blob).not.toMatch(/맥락 예산/);
    expect(blob).not.toMatch(/압축 정책/);
    expect(blob).not.toMatch(/조립 계획/);
    expect(blob).not.toMatch(/rawPrompt/i);
    expect(blob).not.toMatch(/\btoken\b/i);
  });
});

describe("ProjectRailRecommendationButton", () => {
  it("shows recommendation rail item labeled 추천", () => {
    const html = renderToStaticMarkup(
      createElement(ProjectRailRecommendationButton, { effectiveProjectId: "p1" }),
    );
    expect(html).toContain("추천");
    expect(html).toContain('data-testid="platform-recommendation-rail-project"');
  });
});

describe("RecommendationEvidencePanel", () => {
  it("renders recommendation evidence panel when items are provided", () => {
    const html = renderToStaticMarkup(
      createElement(RecommendationEvidencePanel, {
        items: [
          {
            id: "1",
            title: "Quick Design 추천안",
            stage: "planning",
            status: "candidate",
            aiMemberLabel: "AI 기획자",
            createdAt: now,
            summary: "MVP 범위를 제안했습니다.",
            reasons: ["사용자가 빠른 프로토타입을 요청함"],
            sourceInputs: [],
            referencedArtifacts: ["프로토타입 기획안"],
            unresolvedItems: ["파일 업로드 제한"],
            nextActions: ["확인"],
            sourceTraceIds: ["quick_design"],
          },
        ],
      }),
    );
    expect(html).toContain("AI 추천근거");
    expect(html).toContain("Quick Design 추천안");
    expect(html).toContain("확인 필요");
    expect(html).not.toMatch(/맥락 예산/);
  });
});

describe("RequirementsMessageExplainability inline visibility", () => {
  it("does not show inline AI decision summary in normal chat cards", () => {
    expect(showInlineMessageExplainability()).toBe(false);
    const html = renderToStaticMarkup(
      createElement(RequirementsMessageExplainability, {
        message: {
          id: "m1",
          role: "ai",
          speakerType: "AI",
          speakerId: "ai",
          speakerName: "AI",
          visibility: "PUBLIC",
          messageType: "ANSWER",
          content: "테스트",
          createdAt: now,
          meta: {
            stage: "REQUIREMENTS",
            messageOverlayExplainability: {
              overlayIdentity: { roleKey: "planner", perspective: "기획", provider: "p", capabilities: [] },
            },
          },
        },
      }),
    );
    expect(html).toBe("");
    expect(html).not.toContain("AI 판단 보기");
  });
});

describe("recommendation panel stage isolation", () => {
  it("does not change planning or implementation mode when opening recommendation panel", () => {
    const html = renderToStaticMarkup(
      createElement(ProjectRailRecommendationButton, { effectiveProjectId: "p1" }),
    );
    expect(html).toContain('type="button"');
    expect(html).not.toContain("href=");
  });
});
