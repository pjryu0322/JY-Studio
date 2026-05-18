import { deriveServiceFlowApprovalFromFlow } from "@/components/service-flow/serviceFlowStageDerived";
import type { RequirementsServiceFlowV1 } from "@/lib/requirements/requirementsStateJson";
import { parseRequirementsStateJson } from "@/lib/requirements/requirementsStateJson";

/**
 * 액터·서비스 흐름 정의 화면과 동일한 승인 판정(`deriveServiceFlowApprovalFromFlow`).
 * 기능 정리 LLM·플래너 진입 전에 사용한다.
 */
export function isServiceFlowApprovedForFeaturePlanning(requirementsStateJson: unknown): boolean {
  const state = parseRequirementsStateJson(requirementsStateJson);
  return deriveServiceFlowApprovalFromFlow(state.serviceFlowV1 ?? null).approved;
}

/** 기능 정리 첫 질문에 쓸 대표 단계 제목(정렬 후 첫 단계) */
export function firstFlowStepTitleForFeaturePlanningEntry(flow: RequirementsServiceFlowV1 | null): string {
  if (!flow?.steps?.length) return "서비스";
  const ordered = [...flow.steps].sort((a, b) => a.order - b.order);
  const t = (ordered[0]?.title ?? "").trim();
  return t || "서비스";
}

export const FEATURE_PLANNING_SERVICE_FLOW_INCOMPLETE_MESSAGE = `먼저 액터 및 서비스 흐름 정의를 완료해 주세요.

상단의 [액터 및 서비스 흐름 정의] 단계에서 역할과 서비스 흐름을 확정해 주세요.`;
