export type ArtifactStage = "planning" | "implementation" | "review";

export type ArtifactRequirementLevel = "required" | "recommended" | "optional";

export type ArtifactBoardCatalogItem = Readonly<{
  readonly id: string;
  readonly type: string;
  readonly title: string;
  readonly stage: ArtifactStage;
  readonly requirementLevel: ArtifactRequirementLevel;
  readonly description: string;
  readonly dependsOn?: readonly string[];
  readonly generateAction?: string;
  /** planning: ProjectArtifactType; implementation: ImplementationArtifactType */
  readonly matchType: string;
}>;

export const PLANNING_REQUIRED_ARTIFACT_CATALOG: readonly ArtifactBoardCatalogItem[] = [
  {
    id: "planning-summary",
    type: "summary",
    matchType: "summary",
    title: "프로젝트 요약서",
    stage: "planning",
    requirementLevel: "required",
    description: "프로젝트 목적·범위·핵심 가정을 정리한 기획 산출물입니다.",
  },
  {
    id: "planning-fast-plan",
    type: "fast_prototype_plan",
    matchType: "fast_prototype_plan",
    title: "프로토타입 기획안",
    stage: "planning",
    requirementLevel: "required",
    description: "구현 범위·MVP 우선순위를 정리한 기획 산출물입니다.",
    dependsOn: ["planning-summary"],
  },
  {
    id: "planning-service-flow",
    type: "service-flow-doc",
    matchType: "service-flow-doc",
    title: "서비스 흐름 문서",
    stage: "planning",
    requirementLevel: "required",
    description: "서비스 단계·흐름·주요 프로세스를 정리합니다.",
    dependsOn: ["planning-summary"],
  },
  {
    id: "planning-feature-spec",
    type: "feature-spec",
    matchType: "feature-spec",
    title: "기능 정의서",
    stage: "planning",
    requirementLevel: "required",
    description: "핵심 기능·예외·비기능 요구를 정의합니다.",
    dependsOn: ["planning-service-flow"],
  },
  {
    id: "planning-screen-spec",
    type: "screen-spec",
    matchType: "screen-spec",
    title: "화면 정의서",
    stage: "planning",
    requirementLevel: "required",
    description: "화면별 액션·입력·상태 전이를 정의합니다.",
    dependsOn: ["planning-feature-spec"],
  },
] as const;

export const PLANNING_RECOMMENDED_ARTIFACT_CATALOG: readonly ArtifactBoardCatalogItem[] = [
  {
    id: "planning-api-spec",
    type: "api-spec",
    matchType: "api-spec",
    title: "API 명세서",
    stage: "planning",
    requirementLevel: "recommended",
    description: "주요 API·연동·에러 계약을 정리합니다.",
    dependsOn: ["planning-feature-spec"],
  },
] as const;

export const IMPLEMENTATION_REQUIRED_ARTIFACT_CATALOG: readonly ArtifactBoardCatalogItem[] = [
  {
    id: "impl-seed",
    type: "implementation-seed",
    matchType: "implementation-seed",
    title: "구현 준비정보",
    stage: "implementation",
    requirementLevel: "required",
    description: "기획 산출물을 구현 관점으로 정리한 준비 정보입니다.",
    generateAction: "implementation_seed",
  },
  {
    id: "impl-readiness",
    type: "implementation-readiness-report",
    matchType: "implementation-readiness-report",
    title: "구현 준비도",
    stage: "implementation",
    requirementLevel: "required",
    description: "Implementation Seed 기준 준비도·부족 항목을 점검합니다.",
    dependsOn: ["impl-seed"],
  },
  {
    id: "impl-work-plan",
    type: "implementation-work-plan-draft",
    matchType: "implementation-work-plan-draft",
    title: "구현 작업안",
    stage: "implementation",
    requirementLevel: "required",
    description: "구현 범위·검수·보안 기준을 작업안으로 정리합니다.",
    dependsOn: ["impl-seed"],
    generateAction: "implementation_work_plan",
  },
  {
    id: "impl-code-agent",
    type: "code-agent-work-instruction",
    matchType: "code-agent-work-instruction",
    title: "AI개발자 작업 지시서",
    stage: "implementation",
    requirementLevel: "required",
    description: "확정된 작업안을 Code Agent 실행 단위로 변환합니다.",
    dependsOn: ["impl-work-plan"],
  },
  {
    id: "impl-wip-report",
    type: "wip-result-report",
    matchType: "wip-result-report",
    title: "WIP 작업 결과",
    stage: "implementation",
    requirementLevel: "required",
    description: "Code Agent WIP 실행 결과·diff·테스트 요약입니다.",
    dependsOn: ["impl-code-agent"],
  },
] as const;

export const IMPLEMENTATION_RECOMMENDED_ARTIFACT_CATALOG: readonly ArtifactBoardCatalogItem[] = [
  {
    id: "impl-db-decision",
    type: "db-integration-decision",
    matchType: "db-integration-decision",
    title: "데이터 저장 방식 판단서",
    stage: "implementation",
    requirementLevel: "recommended",
    description: "DB 연동 필요 여부·저장 전략 판단 결과입니다.",
    dependsOn: ["impl-work-plan"],
    generateAction: "review_db_integration",
  },
] as const;

export const REVIEW_RECOMMENDED_ARTIFACT_CATALOG: readonly ArtifactBoardCatalogItem[] = [
  {
    id: "impl-review-criteria",
    type: "review-criteria-summary",
    matchType: "review-criteria-summary",
    title: "검수 기준서",
    stage: "review",
    requirementLevel: "recommended",
    description: "구현 작업안의 검수·수용 기준 요약입니다.",
    dependsOn: ["impl-work-plan"],
  },
  {
    id: "impl-security-criteria",
    type: "security-criteria-summary",
    matchType: "security-criteria-summary",
    title: "보안 기준서",
    stage: "review",
    requirementLevel: "recommended",
    description: "보안·개인정보·파일 처리 점검 기준입니다.",
    dependsOn: ["impl-work-plan"],
  },
] as const;

export function allArtifactBoardCatalogItems(): readonly ArtifactBoardCatalogItem[] {
  return [
    ...PLANNING_REQUIRED_ARTIFACT_CATALOG,
    ...PLANNING_RECOMMENDED_ARTIFACT_CATALOG,
    ...IMPLEMENTATION_REQUIRED_ARTIFACT_CATALOG,
    ...IMPLEMENTATION_RECOMMENDED_ARTIFACT_CATALOG,
    ...REVIEW_RECOMMENDED_ARTIFACT_CATALOG,
  ];
}

export function artifactBoardCatalogForStageFilter(
  filter: "all" | "planning" | "implementation" | "review",
): readonly ArtifactBoardCatalogItem[] {
  const all = allArtifactBoardCatalogItems();
  if (filter === "all") return all;
  if (filter === "review") return all.filter((c) => c.stage === "review");
  return all.filter((c) => c.stage === filter);
}
