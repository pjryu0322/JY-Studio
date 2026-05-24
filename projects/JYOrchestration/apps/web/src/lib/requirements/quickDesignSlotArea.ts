import type { PlatformMemberRole } from "@/lib/platform-orchestration/types";

export type QuickDesignSlotArea = "planning" | "analysis" | "architecture" | "design";

export type QuickDesignAreaCounts = Readonly<{
  readonly planning: number;
  readonly analysis: number;
  readonly architecture: number;
  readonly design: number;
}>;

export const QUICK_DESIGN_MIN_AREA_COUNTS: QuickDesignAreaCounts = {
  planning: 4,
  analysis: 2,
  architecture: 2,
  design: 2,
};

/** Explicit suffix → area (design.* split between architecture vs design). */
const SUFFIX_TO_AREA: Readonly<Record<string, QuickDesignSlotArea>> = {
  ".planning.servicePurpose": "planning",
  ".planning.coreUsers": "planning",
  ".planning.problem": "planning",
  ".planning.expectedOutcome": "planning",
  ".planning.coreValue": "planning",
  ".planning.mvpScope": "planning",
  ".planning.resolvePriority": "planning",
  ".planning.successCriteria": "planning",
  ".flow.actorTypes": "analysis",
  ".flow.serviceFlow": "analysis",
  ".flow.approvalFlow": "analysis",
  ".flow.exceptionFlow": "analysis",
  ".flow.collaborationFlow": "analysis",
  ".flow.externalIntegration": "analysis",
  ".flow.operationsFlow": "analysis",
  ".flow.permissionRelations": "analysis",
  ".flow.userStateChange": "analysis",
  ".architecture.automationLevel": "architecture",
  ".architecture.prototypeBoundary": "architecture",
  ".design.coreFeatures": "architecture",
  ".design.featurePriority": "architecture",
  ".design.mvpExclusions": "architecture",
  ".design.featureDependencies": "architecture",
  ".design.dataFlow": "architecture",
  ".design.implementationRisk": "architecture",
  ".design.requiredScreens": "design",
  ".design.prototypeScope": "design",
  ".design.userInteractionMode": "design",
  ".design.uiToneAndStyle": "design",
  ".design.informationArchitecture": "design",
};

export function slotSuffixFromKey(slotKey: string): string {
  const parts = String(slotKey ?? "").split(".");
  if (parts.length < 2) return slotKey;
  return `.${parts.slice(-2).join(".")}`;
}

export function classifyQuickDesignSlotArea(slotKey: string): QuickDesignSlotArea | null {
  const suffix = slotSuffixFromKey(slotKey);
  const mapped = SUFFIX_TO_AREA[suffix];
  if (mapped) return mapped;
  const k = String(slotKey ?? "");
  if (k.includes(".planning.")) return "planning";
  if (k.includes(".flow.")) return "analysis";
  if (k.includes(".architecture.")) return "architecture";
  if (k.includes(".design.")) return "design";
  return null;
}

export function countQuickDesignAreaCounts(slotKeys: readonly string[]): QuickDesignAreaCounts {
  let planning = 0;
  let analysis = 0;
  let architecture = 0;
  let design = 0;
  for (const key of slotKeys) {
    const area = classifyQuickDesignSlotArea(key);
    if (area === "planning") planning += 1;
    else if (area === "analysis") analysis += 1;
    else if (area === "architecture") architecture += 1;
    else if (area === "design") design += 1;
  }
  return { planning, analysis, architecture, design };
}

export function buildQuickDesignAreaShortfallWarnings(counts: QuickDesignAreaCounts): readonly string[] {
  const warnings: string[] = [];
  if (counts.planning < QUICK_DESIGN_MIN_AREA_COUNTS.planning) {
    warnings.push(
      `- 기획 후보가 부족합니다(${counts.planning}/${QUICK_DESIGN_MIN_AREA_COUNTS.planning}). 서비스 목적·핵심 사용자·문제 정의·MVP 범위를 추가 확인해야 합니다.`,
    );
  }
  if (counts.analysis < QUICK_DESIGN_MIN_AREA_COUNTS.analysis) {
    warnings.push(
      `- 분석 후보가 부족합니다(${counts.analysis}/${QUICK_DESIGN_MIN_AREA_COUNTS.analysis}). 서비스 액터와 서비스 흐름을 추가 확인해야 합니다.`,
    );
  }
  if (counts.architecture < QUICK_DESIGN_MIN_AREA_COUNTS.architecture) {
    warnings.push(
      `- 설계 후보가 부족합니다(${counts.architecture}/${QUICK_DESIGN_MIN_AREA_COUNTS.architecture}). 핵심 기능·우선순위·아키텍처 경계를 추가 확인해야 합니다.`,
    );
  }
  if (counts.design < QUICK_DESIGN_MIN_AREA_COUNTS.design) {
    warnings.push(
      `- 디자인 후보가 부족합니다(${counts.design}/${QUICK_DESIGN_MIN_AREA_COUNTS.design}). 필수 화면·프로토타입 범위를 추가 확인해야 합니다.`,
    );
  }
  return warnings;
}

export type QuickDesignSlotPatchEntry = Readonly<{
  readonly slotKey: string;
  readonly area: QuickDesignSlotArea;
  readonly status: "candidate" | "assumed_for_prototype" | "partial";
  readonly sourceRole: PlatformMemberRole;
  readonly sourceDraftId: string;
}>;

export function getQuickDesignPatchedSlotKeys(
  patch: { readonly patchedSlotKeys?: readonly string[]; readonly updatedSlotKeys?: readonly string[] } | null | undefined,
): readonly string[] {
  if (!patch) return [];
  const keys = patch.patchedSlotKeys ?? patch.updatedSlotKeys ?? [];
  return [...keys];
}
