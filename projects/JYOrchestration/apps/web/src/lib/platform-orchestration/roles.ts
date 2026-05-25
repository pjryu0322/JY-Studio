import type { PlatformFlowId, PlatformMemberRole } from "@/lib/platform-orchestration/types";

export type PlatformCapability =
  | "planning"
  | "analysis"
  | "architecture"
  | "design"
  | "implementation"
  | "review"
  | "security_review"
  | "scm"
  | "data_modeling"
  | "integration"
  | "media_analysis";

export type PlatformRoleDefinition = Readonly<{
  readonly role: PlatformMemberRole;
  readonly labelKo: string;
  readonly description: string;
  readonly defaultCapabilities: readonly PlatformCapability[];
  readonly requiredForFlows?: readonly PlatformFlowId[];
  /** Phase 1: core roles are on by default; extended roles are optional. */
  readonly defaultEnabled: boolean;
}>;

export const PLATFORM_CORE_MEMBER_ROLES: readonly PlatformMemberRole[] = [
  "planner",
  "analyst",
  "architect",
  "designer",
  "developer",
  "reviewer",
  "security",
  "scm",
] as const;

export const PLATFORM_EXTENDED_MEMBER_ROLES: readonly PlatformMemberRole[] = [
  "aa",
  "da",
  "etl",
  "eai",
  "vlm_analyst",
] as const;

export const PLATFORM_ROLE_DEFINITIONS: readonly PlatformRoleDefinition[] = [
  {
    role: "planner",
    labelKo: "AI기획자",
    description: "서비스 목적·범위·서비스 정의와 산출물 초안을 담당한다.",
    defaultCapabilities: ["planning"],
    requiredForFlows: ["fast_plan_draft", "fast_plan_generation"],
    defaultEnabled: true,
  },
  {
    role: "analyst",
    labelKo: "분석가",
    description: "요구·액터·서비스 흐름 분석과 슬롯 정제를 담당한다.",
    defaultCapabilities: ["analysis"],
    requiredForFlows: ["service_flow", "planning_slots"],
    defaultEnabled: true,
  },
  {
    role: "architect",
    labelKo: "설계자",
    description: "기능·화면·구조 설계와 아키텍처 슬롯을 담당한다.",
    defaultCapabilities: ["architecture"],
    requiredForFlows: ["feature_design"],
    defaultEnabled: true,
  },
  {
    role: "designer",
    labelKo: "디자이너",
    description: "화면·UX·프로토타입 UI 관점의 슬롯과 초안을 담당한다.",
    defaultCapabilities: ["design"],
    defaultEnabled: true,
  },
  {
    role: "developer",
    labelKo: "AI개발자",
    description: "프로토타입 구현·실행 런타임·코드 산출을 담당한다.",
    defaultCapabilities: ["implementation"],
    requiredForFlows: ["prototype_generation", "execution_runtime"],
    defaultEnabled: true,
  },
  {
    role: "reviewer",
    labelKo: "검수자",
    description: "산출물·실행 결과에 대한 품질 검토를 담당한다.",
    defaultCapabilities: ["review"],
    requiredForFlows: ["review_security_scm"],
    defaultEnabled: true,
  },
  {
    role: "security",
    labelKo: "보안관",
    description: "보안·컴플라이언스 관점 검토를 담당한다.",
    defaultCapabilities: ["security_review"],
    requiredForFlows: ["review_security_scm"],
    defaultEnabled: true,
  },
  {
    role: "scm",
    labelKo: "SCM",
    description: "브랜치·PR·머지 등 형상 관리 흐름을 담당한다.",
    defaultCapabilities: ["scm"],
    requiredForFlows: ["execution_runtime", "review_security_scm"],
    defaultEnabled: true,
  },
  {
    role: "aa",
    labelKo: "AA",
    description: "애플리케이션 아키텍처 확장 역할(선택).",
    defaultCapabilities: ["architecture", "integration"],
    defaultEnabled: false,
  },
  {
    role: "da",
    labelKo: "DA",
    description: "데이터 아키텍처 확장 역할(선택).",
    defaultCapabilities: ["data_modeling", "architecture"],
    defaultEnabled: false,
  },
  {
    role: "etl",
    labelKo: "ETL",
    description: "데이터 파이프라인·ETL 확장 역할(선택).",
    defaultCapabilities: ["data_modeling", "integration"],
    defaultEnabled: false,
  },
  {
    role: "eai",
    labelKo: "EAI",
    description: "시스템 연동·EAI 확장 역할(선택).",
    defaultCapabilities: ["integration"],
    defaultEnabled: false,
  },
  {
    role: "vlm_analyst",
    labelKo: "VLM 분석가",
    description: "이미지·미디어 분석 확장 역할(선택).",
    defaultCapabilities: ["media_analysis", "analysis"],
    defaultEnabled: false,
  },
] as const;

export function getPlatformRoleDefinition(
  role: PlatformMemberRole,
): PlatformRoleDefinition | undefined {
  return PLATFORM_ROLE_DEFINITIONS.find((d) => d.role === role);
}

export function roleHasCapability(
  role: PlatformMemberRole,
  capability: PlatformCapability,
  overrides?: readonly PlatformCapability[],
): boolean {
  const caps = overrides?.length
    ? overrides
    : (getPlatformRoleDefinition(role)?.defaultCapabilities ?? []);
  return caps.includes(capability);
}
