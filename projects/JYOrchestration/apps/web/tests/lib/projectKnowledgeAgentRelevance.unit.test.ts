import { describe, expect, it } from "vitest";
import {
  clampRelevance,
  getAgentPromptSummary,
  getAgentRelevance,
  hasAgentRelevance,
  mergeAgentRelevanceIntoGraphNodeMetadata,
  normalizeAgentRelevance,
  parseAgentRelevanceFromGraphNodeMetadata,
  resolveAgentRelevanceFromNode,
  sanitizeAgentPromptSummary,
} from "@/lib/project-knowledge/projectKnowledgeAgentRelevance";

describe("projectKnowledgeAgentRelevance", () => {
  it("normalizes agentRelevance with clamped relevance", () => {
    const out = normalizeAgentRelevance({
      planner: {
        relevance: 1.4,
        useAs: "mvp_scope",
        reason: "MVP 범위",
        promptSummary: "핵심 가치 제안이 정리됨",
      },
      bogus: { relevance: 0.5, useAs: "context", reason: "x", promptSummary: "y" },
    });
    expect(out.planner?.relevance).toBe(1);
    expect(out.planner?.useAs).toBe("mvp_scope");
    expect((out as Record<string, unknown>).bogus).toBeUndefined();
  });

  it("returns empty map for missing or invalid metadata", () => {
    expect(normalizeAgentRelevance(null)).toEqual({});
    expect(parseAgentRelevanceFromGraphNodeMetadata(undefined)).toEqual({});
    expect(parseAgentRelevanceFromGraphNodeMetadata({ reference: { lifecycle: "DRAFT" } })).toEqual({});
  });

  it("parses agentRelevance from graph node metadata", () => {
    const meta = {
      agentRelevance: {
        developer: {
          relevance: 0.82,
          useAs: "implementation_hint",
          reason: "화면 구현",
          promptSummary: "로그인 화면 컴포넌트 구조",
        },
      },
    };
    expect(parseAgentRelevanceFromGraphNodeMetadata(meta).developer?.relevance).toBe(0.82);
  });

  it("clamps negative relevance to zero", () => {
    expect(clampRelevance(-0.2)).toBe(0);
    expect(clampRelevance("0.35")).toBe(0.35);
    expect(clampRelevance("nope")).toBe(0);
  });

  it("ignores entries without reason or promptSummary", () => {
    const out = normalizeAgentRelevance({
      analyst: { relevance: 0.9, useAs: "flow_hint", reason: "", promptSummary: "" },
    });
    expect(out.analyst).toBeUndefined();
  });

  it("resolves relevance from snapshot node or metadata", () => {
    const fromSnapshot = resolveAgentRelevanceFromNode({
      agentRelevance: { reviewer: { relevance: 0.6, useAs: "checklist", reason: "검토", promptSummary: "완료 기준" } },
    });
    expect(fromSnapshot.reviewer?.useAs).toBe("checklist");

    const fromMeta = resolveAgentRelevanceFromNode({
      metadata: {
        agentRelevance: {
          security: { relevance: 0.7, useAs: "risk", reason: "권한", promptSummary: "인증 정책" },
        },
      },
    });
    expect(fromMeta.security?.relevance).toBe(0.7);
    expect(hasAgentRelevance({ agentRelevance: fromMeta }, "security", 0.5)).toBe(true);
  });

  it("falls back promptSummary from reason", () => {
    const node = {
      metadata: {
        agentRelevance: {
          planner: { relevance: 0.5, useAs: "context", reason: "요약 대체", promptSummary: "" },
        },
      },
    };
    expect(getAgentPromptSummary(node, "planner")).toBe("요약 대체");
    expect(getAgentRelevance(node, "analyst")).toBeNull();
  });

  it("strips sensitive promptSummary content", () => {
    expect(sanitizeAgentPromptSummary("api_key=sk-live-abcdef1234567890")).toBe("");
    expect(sanitizeAgentPromptSummary("일반적인 구조 요약")).toBe("일반적인 구조 요약");
  });

  it("merges agentRelevance into graph metadata", () => {
    const merged = mergeAgentRelevanceIntoGraphNodeMetadata(
      { eventType: "x" },
      {
        developer: {
          relevance: 0.4,
          useAs: "implementation_hint",
          reason: "r",
          promptSummary: "p",
        },
      },
    );
    expect(merged.eventType).toBe("x");
    expect(parseAgentRelevanceFromGraphNodeMetadata(merged).developer?.promptSummary).toBe("p");

    const cleared = mergeAgentRelevanceIntoGraphNodeMetadata(merged, {});
    expect(cleared.agentRelevance).toBeUndefined();
  });
});
