import { describe, expect, it } from "vitest";
import {
  buildCompactBootstrapSlotCatalogForLlm,
  buildDynamicServicePlanningSlotDefinitions,
  isBootstrapPhase1CatalogSlotKey,
} from "@/lib/requirements/singleChatOrchestrationSlots";
import { formatBootstrapAxisRotationBlock, pickBootstrapDecisionAxisRotation } from "@/lib/requirements/requirementsBootstrapOrchestrationHints";
import { repairBootstrapQuestionFromContext } from "@/lib/requirements/requirementsBootstrapInterviewQuality";
import { parseBootstrapInitializerJsonFromModelText } from "@/lib/project/requirementsAiFacilitatorOpenAI";

describe("bootstrap multi-agent orchestration", () => {
  it("phase1 compact catalog에 planner·analyst·architect·design 그룹이 함께 노출된다", () => {
    const defs = buildDynamicServicePlanningSlotDefinitions({
      projectName: "OrchBal",
      projectDescription: "x",
      projectType: "web",
      servicePlanningAgentCatalogKeys: ["designer"],
    });
    const rows = buildCompactBootstrapSlotCatalogForLlm(defs);
    const groups = new Set(rows.map((r) => r.group));
    expect(groups.has("planning")).toBe(true);
    expect(groups.has("flow")).toBe(true);
    expect(groups.has("architecture")).toBe(true);
    expect(groups.has("design")).toBe(true);
    const owners = new Set(rows.map((r) => r.ownerAgent));
    expect(owners.has("planner")).toBe(true);
    expect(owners.has("analyst")).toBe(true);
    expect(owners.has("architect")).toBe(true);
    expect(owners.has("designer")).toBe(true);
  });

  it("bootstrap phase1은 협업·승인·자동화·프로토타입 경계 슬롯 suffix를 포함한다", () => {
    const defs = buildDynamicServicePlanningSlotDefinitions({
      projectName: "Sfx",
      projectDescription: "",
      projectType: null,
    });
    const keys = defs.map((d) => d.slotKey);
    expect(keys.some((k) => k.endsWith(".flow.collaborationFlow"))).toBe(true);
    expect(keys.some((k) => k.endsWith(".architecture.automationLevel"))).toBe(true);
    expect(keys.some((k) => k.endsWith(".architecture.prototypeBoundary"))).toBe(true);
    expect(isBootstrapPhase1CatalogSlotKey(keys.find((k) => k.endsWith(".planning.servicePurpose"))!)).toBe(true);
    expect(isBootstrapPhase1CatalogSlotKey(keys.find((k) => k.endsWith(".planning.problem"))!)).toBe(false);
  });

  it("axis rotation은 결정적이며 문맥에 따라 축이 바뀐다", () => {
    const a = pickBootstrapDecisionAxisRotation({ projectName: "A", projectDescription: "회의록" });
    const b = pickBootstrapDecisionAxisRotation({ projectName: "A", projectDescription: "회의록" });
    const c = pickBootstrapDecisionAxisRotation({
      projectName: "完全不同的項目名称",
      projectDescription: "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
    });
    expect(a.preferredAxis).toBe(b.preferredAxis);
    expect(JSON.stringify(a)).not.toBe(JSON.stringify(c));
    expect(formatBootstrapAxisRotationBlock({ projectName: "A", projectDescription: "회의록" })).toContain("primary=");
  });

  it("repair는 primaryDecisionAxis에 따라 문구 축이 달라질 수 있다", () => {
    const qAuto = repairBootstrapQuestionFromContext({
      projectName: "T",
      projectDescription: "서비스",
      orchestrationBootstrap: { primaryDecisionAxis: "automation-level" },
    });
    const qCollab = repairBootstrapQuestionFromContext({
      projectName: "T",
      projectDescription: "서비스",
      orchestrationBootstrap: { primaryDecisionAxis: "collaboration-boundary" },
    });
    expect(qAuto.includes("실시간") || qAuto.includes("배치") || qAuto.includes("자동")).toBe(true);
    expect(qCollab.includes("협업") || qCollab.includes("책임")).toBe(true);
  });

  it("bootstrap JSON parse는 fence/prefix/suffix가 있어도 복구한다", () => {
    const raw = `아래는 결과입니다.\n\n\`\`\`json\n{ \"question\": \"회의록은 누가 최종 확인하나요?\", \"suggestions\": [\"작성자만\"], \"allowCustomInput\": true, \"suggestedSlots\": [] }\n\`\`\`\n감사합니다.`;
    const p = parseBootstrapInitializerJsonFromModelText(raw);
    expect(p.ok).toBe(true);
    if (p.ok) {
      expect(typeof p.parsed.question).toBe("string");
      expect(String(p.parsed.question)).toContain("회의록");
    }
  });
});
