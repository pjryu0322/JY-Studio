export type IntegrationPreviewRemediationKindV1 =
  | "github_preview_permission_required"
  | "github_pages_setup_required";

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
        "Source를 Deploy from a branch로 설정합니다.",
        "Branch를 gh-pages, Folder를 /(root)로 선택합니다.",
        "다시 [통합 및 Preview 준비]를 눌러 주세요.",
      ],
      showOpenSettings: false,
      showPermissionGuide: false,
      showOpenRepository: true,
      showPagesSetupGuide: true,
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
