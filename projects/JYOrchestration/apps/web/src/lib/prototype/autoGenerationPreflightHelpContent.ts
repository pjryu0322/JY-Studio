import type { SettingsHelpPopoverContent } from "@/lib/prototype/githubProviderPreflightHelp";
import { getGithubPreflightHelpContent } from "@/lib/prototype/githubProviderPreflightHelp";
import type {
  AutoGenerationEnvcheckKeyV1,
  PreviewDeploymentPreflightKeyV1,
} from "@/lib/prototype/autoGenerationSettingsConnectionTest";

export type AutoGenerationHelpKeyV1 =
  | "repo"
  | "token"
  | "cursor"
  | AutoGenerationEnvcheckKeyV1
  | PreviewDeploymentPreflightKeyV1
  | "branch_create"
  | "file_write"
  | "contents_write";

export function getAutoGenerationPreflightHelpContent(
  key: AutoGenerationHelpKeyV1,
): SettingsHelpPopoverContent {
  if (key === "branch_create") {
    return {
      title: "Branch 생성 권한 확인 방법",
      description: "AI 개발자는 CodeTask별 작업 branch와 통합 branch를 생성합니다.",
      checklist: [
        "GitHub Token에 Contents Read/Write 권한이 있는지",
        "저장소에 branch 생성 권한이 있는지",
        "branch protection이 새 branch push를 막고 있지 않은지",
      ],
      actionGuide: [
        "GitHub Token 권한에서 Contents를 Read and write로 설정합니다.",
        "저장소 branch protection 설정을 확인합니다.",
        "연결 테스트를 다시 실행합니다.",
      ],
    };
  }
  if (key === "file_write") {
    return getGithubPreflightHelpContent("contents_write");
  }
  if (key === "pull_request_create_or_update") {
    return {
      title: "Pull Request 권한 확인 방법",
      description: "통합 branch와 변경 내용을 검토하려면 Pull Request 생성/갱신 권한이 필요합니다.",
      checklist: [
        "Pull requests 권한이 Read/Write인지",
        "저장소에 PR 생성 권한이 있는지",
      ],
      actionGuide: [
        "GitHub Token 권한에서 Pull requests를 Read and write로 설정합니다.",
        "연결 테스트를 다시 실행합니다.",
      ],
    };
  }
  if (key === "workflow_file_write") {
    return {
      title: "Workflow 파일 생성 권한 확인 방법",
      description:
        "Preview 배포를 자동화하려면 .github/workflows 경로에 workflow 파일을 생성하거나 갱신해야 합니다.",
      checklist: ["Workflows 권한이 Read/Write인지", "Contents 권한이 Read/Write인지"],
      actionGuide: [
        "GitHub Token 권한에서 Workflows를 Read and write로 설정합니다.",
        "Contents도 Read and write로 설정합니다.",
        "연결 테스트를 다시 실행합니다.",
      ],
    };
  }
  if (key === "actions_workflow_dispatch") {
    return {
      title: "GitHub Actions 실행 권한 확인 방법",
      description: "통합 branch를 빌드하고 GitHub Pages에 배포하려면 GitHub Actions workflow를 실행해야 합니다.",
      checklist: [
        "Actions 권한이 Read/Write인지",
        "Workflows 권한이 Read/Write인지",
        "저장소 Settings → Actions에서 Actions 사용이 허용되어 있는지",
      ],
      actionGuide: [
        "GitHub Token 권한에서 Actions를 Read and write로 설정합니다.",
        "Workflows도 Read and write로 설정합니다.",
        "저장소 Settings → Actions에서 Actions 사용 허용 여부를 확인합니다.",
        "연결 테스트를 다시 실행합니다.",
      ],
    };
  }
  if (key === "gh_pages_branch_write") {
    return getGithubPreflightHelpContent("gh_pages_branch_write");
  }
  if (key === "pages_status_read" || key === "pages_configuration") {
    return getGithubPreflightHelpContent("pages_status_read");
  }
  return getGithubPreflightHelpContent(key as "repo");
}
