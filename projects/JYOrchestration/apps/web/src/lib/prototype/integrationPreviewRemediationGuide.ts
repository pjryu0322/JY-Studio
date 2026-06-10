export type IntegrationPreviewRemediationKindV1 =
  | "github_preview_permission_required"
  | "github_pages_setup_required"
  | "github_preview_workflow_setup_required"
  | "github_preview_workflow_request_invalid"
  | "github_actions_setup_required"
  | "github_preview_retry_required"
  | "github_preview_operator_review_required";

export type IntegrationPreviewRemediationGuideV1 = Readonly<{
  readonly kind: IntegrationPreviewRemediationKindV1;
  readonly title: string;
  readonly introLine: string;
  readonly actionLines: readonly string[];
  readonly showOpenSettings: boolean;
  readonly showPermissionGuide: boolean;
  readonly showOpenRepository: boolean;
  readonly showPagesSetupGuide: boolean;
  readonly showRetry: boolean;
}>;

const RETRY_STATUSES = new Set<string>([
  "github_preview_permission_required",
  "github_pages_setup_required",
  "github_preview_workflow_setup_required",
  "github_preview_workflow_request_invalid",
  "github_actions_setup_required",
  "github_preview_retry_required",
  "github_preview_operator_review_required",
]);

export function isIntegrationPreviewRemediationPipelineStatus(
  pipelineStatus: string | null | undefined,
): boolean {
  return RETRY_STATUSES.has(String(pipelineStatus ?? "").trim());
}

export function getIntegrationPreviewRemediationGuide(
  pipelineStatus: string | null | undefined,
): IntegrationPreviewRemediationGuideV1 | null {
  const status = String(pipelineStatus ?? "").trim();
  if (status === "github_preview_permission_required") {
    return {
      kind: "github_preview_permission_required",
      title: "실제 앱 Preview 배포 권한이 필요합니다.",
      introLine: "통합 branch는 준비됐지만 Preview 배포 권한이 부족합니다.",
      actionLines: [
        "GitHub Token 권한에서 Actions를 Read and write로 설정합니다.",
        "Workflows도 Read and write로 설정합니다.",
        "저장소 Settings → Actions에서 Actions 사용이 허용되어 있는지 확인합니다.",
        "GitHub에서 권한을 수정했다면 다시 [통합 및 Preview 준비]를 눌러 권한을 재확인하세요.",
      ],
      showOpenSettings: true,
      showPermissionGuide: true,
      showOpenRepository: false,
      showPagesSetupGuide: false,
      showRetry: true,
    };
  }
  if (status === "github_pages_setup_required") {
    return {
      kind: "github_pages_setup_required",
      title: "GitHub Pages 설정이 필요합니다.",
      introLine: "Preview 배포를 위해 GitHub Pages 설정이 필요합니다.",
      actionLines: [
        "GitHub 저장소로 이동합니다.",
        "Settings → Pages 메뉴를 엽니다.",
        "Build and deployment의 Source를 GitHub Actions로 선택합니다.",
        "저장 후 플랫폼에서 다시 [통합 및 Preview 준비]를 실행합니다.",
      ],
      showOpenSettings: false,
      showPermissionGuide: false,
      showOpenRepository: true,
      showPagesSetupGuide: true,
      showRetry: true,
    };
  }
  if (status === "github_preview_workflow_setup_required") {
    return {
      kind: "github_preview_workflow_setup_required",
      title: "Preview 배포 workflow 설정이 필요합니다.",
      introLine: "GitHub Actions workflow 파일 또는 workflow_dispatch 설정을 확인해야 합니다.",
      actionLines: [
        "workflow 파일이 기본 브랜치에 반영되었는지 확인합니다.",
        "workflow에 workflow_dispatch 트리거가 포함되어 있는지 확인합니다.",
        "다시 [통합 및 Preview 준비]를 실행합니다.",
      ],
      showOpenSettings: false,
      showPermissionGuide: false,
      showOpenRepository: true,
      showPagesSetupGuide: false,
      showRetry: true,
    };
  }
  if (status === "github_preview_workflow_request_invalid") {
    return {
      kind: "github_preview_workflow_request_invalid",
      title: "Preview 배포 workflow 실행 조건을 확인해야 합니다.",
      introLine: "workflow dispatch 입력값 또는 실행 branch 설정이 맞지 않습니다.",
      actionLines: [
        "workflow_dispatch inputs(project_id, source_branch, pages_path) 정의를 확인합니다.",
        "integration branch와 workflow ref(기본 브랜치)가 분리되어 있는지 확인합니다.",
        "다시 [통합 및 Preview 준비]를 실행합니다.",
      ],
      showOpenSettings: false,
      showPermissionGuide: false,
      showOpenRepository: true,
      showPagesSetupGuide: false,
      showRetry: true,
    };
  }
  if (status === "github_actions_setup_required") {
    return {
      kind: "github_actions_setup_required",
      title: "GitHub Actions 설정이 필요합니다.",
      introLine: "GitHub Actions 또는 Preview workflow가 비활성화되어 있습니다.",
      actionLines: [
        "저장소 Settings → Actions에서 Actions 사용을 허용합니다.",
        "GitHub Actions 탭에서 Preview workflow가 활성화되어 있는지 확인합니다.",
        "다시 [통합 및 Preview 준비]를 실행합니다.",
      ],
      showOpenSettings: false,
      showPermissionGuide: false,
      showOpenRepository: true,
      showPagesSetupGuide: false,
      showRetry: true,
    };
  }
  if (status === "github_preview_retry_required") {
    return {
      kind: "github_preview_retry_required",
      title: "Preview 배포 권한 확인을 다시 시도해 주세요.",
      introLine: "GitHub 응답이 일시적으로 불안정했습니다.",
      actionLines: ["잠시 후 다시 [통합 및 Preview 준비]를 실행합니다."],
      showOpenSettings: false,
      showPermissionGuide: false,
      showOpenRepository: false,
      showPagesSetupGuide: false,
      showRetry: true,
    };
  }
  if (status === "github_preview_operator_review_required") {
    return {
      kind: "github_preview_operator_review_required",
      title: "Preview 배포 workflow 실행 조건을 확인해야 합니다.",
      introLine: "자동 분류되지 않은 workflow dispatch 결과입니다.",
      actionLines: ["운영자 로그를 확인한 뒤 다시 [통합 및 Preview 준비]를 실행합니다."],
      showOpenSettings: false,
      showPermissionGuide: false,
      showOpenRepository: false,
      showPagesSetupGuide: false,
      showRetry: true,
    };
  }
  return null;
}

export function buildIntegrationPreviewRemediationStatusLines(
  pipelineStatus: string | null | undefined,
): readonly string[] {
  const guide = getIntegrationPreviewRemediationGuide(pipelineStatus);
  if (!guide) return [];
  return [guide.title, ...guide.actionLines.map((line, i) => `${i + 1}. ${line}`)];
}
