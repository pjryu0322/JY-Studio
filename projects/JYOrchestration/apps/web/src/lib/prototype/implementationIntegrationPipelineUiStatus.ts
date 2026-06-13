export type IntegrationPipelineUiPhaseV1 =
  | "integration_idle"
  | "integration_gate_checking"
  | "integration_merging"
  | "integration_building"
  | "integration_pr_ready"
  | "preview_preparing"
  | "preview_ready"
  | "integration_failed";

export function resolveIntegrationPipelineBusyLabel(input: {
  readonly busy: boolean;
  readonly phase?: IntegrationPipelineUiPhaseV1 | null;
  readonly continueBuildPreview?: boolean;
  readonly buttonLabel?: string | null;
}): string | null {
  if (!input.busy) return null;
  const phase = input.phase ?? "integration_gate_checking";
  switch (phase) {
    case "integration_merging":
      return "작업 브랜치 병합 중…";
    case "integration_building":
      return "빌드/정적검사 실행 중…";
    case "integration_pr_ready":
      return "PR 준비 중…";
    case "preview_preparing":
      return "Preview 준비 중…";
    case "preview_ready":
      return "Preview 준비 완료";
    case "integration_failed":
      return "통합 실패";
    case "integration_gate_checking":
      return "통합 준비 중…";
    default:
      break;
  }
  if (input.buttonLabel === "Preview 준비 계속") return "Preview 준비 계속 중…";
  if (input.continueBuildPreview) return "Build 검증 및 Preview 준비 계속 중…";
  return "통합 및 Preview 준비 중…";
}

export function mapIntegrationPipelineStatusToUiPhase(
  status: string | null | undefined,
): IntegrationPipelineUiPhaseV1 {
  const s = String(status ?? "").trim();
  if (!s) return "integration_idle";
  if (s === "integrated_app_preview_ready") return "preview_ready";
  if (s.includes("build") || s === "build_pending" || s === "build_failed") {
    return "integration_building";
  }
  if (s.includes("preview") || s === "app_preview_target_failed" || s === "github_pages_deploy_pending") {
    return "preview_preparing";
  }
  if (s.includes("branch") || s === "integration_branch_failed" || s === "final_wiring_failed") {
    return "integration_merging";
  }
  if (s.endsWith("_failed") || s === "pipeline_blocked" || s === "codetasks_incomplete") {
    return "integration_failed";
  }
  return "integration_merging";
}
