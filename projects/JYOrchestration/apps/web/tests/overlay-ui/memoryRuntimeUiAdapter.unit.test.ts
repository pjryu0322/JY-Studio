import { describe, expect, it } from "vitest";

import { buildMemoryRuntimePlan } from "@/lib/harness/memoryRuntime/buildMemoryRuntimePlan";
import {
  MEMORY_RUNTIME_PLAN_DISCLAIMER,
  buildMemoryRuntimePlanVM,
  memoryRuntimeFreshnessLabel,
  memoryRuntimeFreshnessTone,
  memoryRuntimeScopeLabel,
  memoryRuntimeScopeTone,
} from "@/lib/overlay-ui/memoryRuntimeUiAdapter";

const NOW = new Date("2026-05-14T00:00:00Z").getTime();

describe("memoryRuntimeUiAdapter labels", () => {
  it("exposes Korean scope labels and tones", () => {
    expect(memoryRuntimeScopeLabel("project")).toBe("프로젝트");
    expect(memoryRuntimeScopeLabel("role")).toBe("역할");
    expect(memoryRuntimeScopeLabel("session")).toBe("세션");
    expect(memoryRuntimeScopeLabel("working")).toBe("작업 컨텍스트");
    expect(memoryRuntimeScopeLabel("platform")).toBe("플랫폼");
    expect(memoryRuntimeScopeTone("working")).toBe("positive");
  });

  it("exposes Korean freshness labels and tones", () => {
    expect(memoryRuntimeFreshnessLabel("fresh")).toBe("최신");
    expect(memoryRuntimeFreshnessLabel("aging")).toBe("유의");
    expect(memoryRuntimeFreshnessLabel("stale")).toBe("오래됨");
    expect(memoryRuntimeFreshnessTone("stale")).toBe("warning");
    expect(memoryRuntimeFreshnessTone("fresh")).toBe("positive");
  });
});

describe("buildMemoryRuntimePlanVM", () => {
  it("returns hasData=false with disclaimer for null plan", () => {
    const vm = buildMemoryRuntimePlanVM(null);
    expect(vm.hasData).toBe(false);
    expect(vm.disclaimer).toBe(MEMORY_RUNTIME_PLAN_DISCLAIMER);
    expect(vm.disclaimer).toContain("실제 장기 기억이 아니라");
    expect(vm.references).toEqual([]);
    expect(vm.findings).toEqual([]);
  });

  it("rejects plans with invalid mode", () => {
    const vm = buildMemoryRuntimePlanVM({
      mode: "apply" as unknown as "dry_run",
      roleKey: null,
      references: [],
      findings: [],
    });
    expect(vm.hasData).toBe(false);
  });

  it("renders Korean header and stats from a real plan", () => {
    const plan = buildMemoryRuntimePlan({
      roleKey: "planner",
      now: NOW,
      recentTimelineEntries: [
        { text: "사용자 목표 명세", source: "ChatMessage", memoryId: "a", at: NOW - 60 * 1000 },
        { text: "기획 방향 결정", source: "ChatMessage", memoryId: "b", at: NOW - 120 * 1000 },
      ],
      workingContext: { workspaceScreenKey: "/workspace/plan", recentUserText: "ux 정리" },
    });
    const vm = buildMemoryRuntimePlanVM(plan);
    expect(vm.hasData).toBe(true);
    expect(vm.totalLabel).toMatch(/^후보 \d+개$/);
    expect(vm.freshLabel).toMatch(/^최신 \d+/);
    expect(vm.agingLabel).toMatch(/^유의 \d+/);
    expect(vm.staleLabel).toMatch(/^오래됨 \d+/);
    expect(vm.scopeBreakdownText).toContain("·");
    expect(vm.references.length).toBeGreaterThan(0);
    for (const r of vm.references) {
      expect(r.scopeLabel.length).toBeGreaterThan(0);
      expect(r.freshnessLabel.length).toBeGreaterThan(0);
      expect(r.selectedReasonLabel.startsWith("사유:")).toBe(true);
      expect(r.selectedByLabel.startsWith("선택자:")).toBe(true);
      expect(r.estimatedImportanceLabel.startsWith("중요도 ")).toBe(true);
    }
  });

  it("surfaces findings with Korean severity labels", () => {
    const plan = buildMemoryRuntimePlan({ roleKey: "planner", now: NOW });
    const vm = buildMemoryRuntimePlanVM(plan);
    expect(vm.findings.length).toBeGreaterThan(0);
    expect(vm.findings.every((f) => f.severityLabel === "안내" || f.severityLabel === "주의")).toBe(true);
  });

  it("formats scope breakdown text as a single line", () => {
    const plan = buildMemoryRuntimePlan({
      roleKey: "planner",
      now: NOW,
      workingContext: { workspaceScreenKey: "/x", recentUserText: "abcdefg working" },
      recentTimelineEntries: [
        { text: "긴 텍스트 sample", source: "ChatMessage", memoryId: "a", at: NOW },
      ],
    });
    const vm = buildMemoryRuntimePlanVM(plan);
    expect(vm.scopeBreakdownText).not.toBe("후보 없음");
  });
});
