import type { Project } from "@/components/project-spec/types";

/** 실행 계획 진입 전 요구사항 분석 완료 판단에 쓰는 필드만 */
export type RequirementsAnalysisFieldSlice = Pick<
  Project,
  | "description"
  | "specCoreGoals"
  | "specScopeIn"
  | "specScopeOut"
  | "specTargetUsers"
  | "specSuccessCriteria"
  | "confirmedSpecMarkdown"
>;

export function trimRequirementText(s: string | null | undefined): string {
  return String(s ?? "").trim();
}

/**
 * 요구사항 분석 완료: (요약) + (범위 in/out) + (사용자·성공 기준 또는 확정 스펙 중 하나)
 */
export function projectMeetsRequirementsAnalysisComplete(p: RequirementsAnalysisFieldSlice | null): boolean {
  if (!p) return false;
  const summary = trimRequirementText(p.specCoreGoals) || trimRequirementText(p.description);
  if (summary.length < 1) return false;
  if (trimRequirementText(p.specScopeIn).length < 1 || trimRequirementText(p.specScopeOut).length < 1) {
    return false;
  }
  return (
    trimRequirementText(p.specTargetUsers).length > 0 ||
    trimRequirementText(p.specSuccessCriteria).length > 0 ||
    trimRequirementText(p.confirmedSpecMarkdown).length > 0
  );
}

export const REQUIREMENTS_ANALYSIS_INCOMPLETE_REDIRECT_MESSAGE_KR =
  "먼저 아이디어 구체화를 마쳐야 생성 준비 단계로 진행할 수 있습니다.";

export type RequirementsAnalysisCheckItem = { id: string; label: string; done: boolean };

/** spec-workspace PATCH의 `data` 레코드와 DB 행을 합쳐 분석 완료 여부를 판단할 때 사용 */
export function mergeRequirementsAnalysisSliceFromPatch(
  prior: RequirementsAnalysisFieldSlice | null,
  patch: Record<string, unknown>
): RequirementsAnalysisFieldSlice {
  const base: RequirementsAnalysisFieldSlice = {
    description: prior?.description ?? null,
    specCoreGoals: prior?.specCoreGoals ?? null,
    specScopeIn: prior?.specScopeIn ?? null,
    specScopeOut: prior?.specScopeOut ?? null,
    specTargetUsers: prior?.specTargetUsers ?? null,
    specSuccessCriteria: prior?.specSuccessCriteria ?? null,
    confirmedSpecMarkdown: prior?.confirmedSpecMarkdown ?? null,
  };
  const keys: (keyof RequirementsAnalysisFieldSlice)[] = [
    "description",
    "specCoreGoals",
    "specScopeIn",
    "specScopeOut",
    "specTargetUsers",
    "specSuccessCriteria",
    "confirmedSpecMarkdown",
  ];
  for (const k of keys) {
    if (!(k in patch)) continue;
    const v = patch[k];
    if (v === null) {
      base[k] = null;
    } else if (typeof v === "string") {
      base[k] = v;
    } else {
      base[k] = String(v ?? "");
    }
  }
  return base;
}

export function requirementsAnalysisChecklist(p: RequirementsAnalysisFieldSlice | null): RequirementsAnalysisCheckItem[] {
  const summary = trimRequirementText(p?.specCoreGoals) || trimRequirementText(p?.description);
  const scopeOk =
    trimRequirementText(p?.specScopeIn).length > 0 && trimRequirementText(p?.specScopeOut).length > 0;
  const useOrSpec =
    trimRequirementText(p?.specTargetUsers).length > 0 ||
    trimRequirementText(p?.specSuccessCriteria).length > 0 ||
    trimRequirementText(p?.confirmedSpecMarkdown).length > 0;
  return [
    { id: "summary", label: "프로젝트 요약(핵심 목표 또는 설명)", done: summary.length > 0 },
    { id: "scope", label: "범위(포함·제외)", done: scopeOk },
    { id: "use", label: "사용 맥락 또는 성공 조건(또는 확정 스펙)", done: useOrSpec },
  ];
}
