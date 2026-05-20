import type { GovernancePolicyDescriptor } from "@/lib/agents/governancePrecheckDryRunTypes";

export const DEFAULT_GOVERNANCE_POLICIES: readonly GovernancePolicyDescriptor[] = [
  {
    id: "stage.ideation.required",
    name: "아이디어 단계 점검",
    description: "아이디어 구조화 단계에서 목적과 범위가 확인되었는지 점검한다.",
    severity: "info",
    appliesToChecks: ["stage:ideation"],
    enabled: true,
  },
  {
    id: "stage.service-flow.required",
    name: "서비스 흐름 단계 점검",
    description: "액터와 서비스 흐름이 정의되었는지 점검한다.",
    severity: "info",
    appliesToChecks: ["stage:service-flow"],
    enabled: true,
  },
  {
    id: "stage.feature-detail.required",
    name: "기능 상세 단계 점검",
    description: "기능 범위와 구현 단위가 정리되었는지 점검한다.",
    severity: "info",
    appliesToChecks: ["stage:feature-detail"],
    enabled: true,
  },
  {
    id: "connector.cursor.required",
    name: "Cursor Connector 사용 점검",
    description: "Cursor 기반 구현 계획이 필요한 capability인지 점검한다.",
    severity: "warning",
    appliesToChecks: ["connector:cursor"],
    enabled: true,
  },
  {
    id: "registry.guard.required",
    name: "Registry Guard 점검",
    description: "Agent/Capability Registry 정합성 검증이 필요한 경로인지 점검한다.",
    severity: "warning",
    appliesToChecks: ["registry-guard"],
    enabled: true,
  },
] as const;
