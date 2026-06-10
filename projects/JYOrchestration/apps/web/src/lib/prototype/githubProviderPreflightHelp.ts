import type { GithubPreflightCheckKeyV1 } from "@/lib/prototype/githubProviderPreflightTypes";
import type { PrototypeEnvModalRowKey } from "@/lib/project/prototypeEnvSettingsModalRows";

export type SettingsHelpPopoverContent = Readonly<{
  readonly title: string;
  readonly description?: string;
  readonly examples?: readonly { readonly label?: string; readonly value: string }[];
  readonly checklist?: readonly string[];
  readonly actionGuide?: readonly string[];
  readonly footerNote?: string | null;
}>;

export type GithubPreflightHelpKeyV1 = GithubPreflightCheckKeyV1 | PrototypeEnvModalRowKey;

export function getGithubPreflightHelpContent(key: GithubPreflightHelpKeyV1): SettingsHelpPopoverContent {
  if (key === "repo") {
    return {
      title: "GitHub 저장소 확인 방법",
      description: "GitHub 저장소 주소에서 owner/repo 부분만 입력합니다.",
      examples: [
        { value: "https://github.com/pjryu0322/aiprogect → pjryu0322/aiprogect" },
      ],
      checklist: [
        "저장소가 실제로 존재하는지",
        "현재 GitHub 계정이 저장소에 접근 가능한지",
        "private 저장소라면 GitHub Token에 접근 권한이 있는지",
      ],
    };
  }
  if (key === "token") {
    return {
      title: "GitHub Token 권한 확인 방법",
      description:
        "자동 생성과 Preview 배포를 위해 GitHub Token에는 저장소 파일 수정, branch 생성, PR 생성, Actions/Workflows 권한이 필요합니다.",
      checklist: [
        "Token이 만료되지 않았는지",
        "대상 저장소가 Token 허용 범위에 포함되어 있는지",
        "private 저장소라면 해당 저장소 접근 권한이 있는지",
      ],
      actionGuide: [
        "GitHub에서 Token 권한을 수정하거나 새 Token을 발급합니다.",
        "권한 수정 후 이 화면에서 Token을 다시 저장합니다.",
        "연결 테스트를 다시 실행합니다.",
      ],
    };
  }
  if (key === "cursor") {
    return {
      title: "Cursor API 확인 방법",
      description: "AI 개발자가 실제 코드를 생성하려면 Cursor API 연결이 필요합니다.",
      checklist: ["Cursor API Key가 유효한지", "사용량 제한 또는 만료가 없는지"],
      actionGuide: ["Cursor API Key를 다시 발급하거나 저장합니다.", "연결 테스트를 다시 실행합니다."],
    };
  }

  const map: Partial<Record<GithubPreflightCheckKeyV1, SettingsHelpPopoverContent>> = {
    repository_access: getGithubPreflightHelpContent("repo"),
    contents_write: {
      title: "파일 생성/수정 권한이 필요한 이유",
      description: "AI 개발자가 생성한 코드를 GitHub branch에 저장하려면 파일 생성/수정 권한이 필요합니다.",
      checklist: ["Contents 권한이 Read/Write인지", "대상 저장소에 쓰기 권한이 있는지"],
      actionGuide: [
        "GitHub Token 권한에서 Contents를 Read and write로 설정합니다.",
        "다시 연결 테스트를 실행합니다.",
      ],
    },
    branch_create: {
      title: "Branch 생성 권한이 필요한 이유",
      description: "각 CodeTask와 통합 Preview는 별도 branch에서 작업됩니다.",
      checklist: [
        "저장소에 branch 생성 권한이 있는지",
        "branch protection이 생성/푸시를 막고 있지 않은지",
      ],
      actionGuide: [
        "저장소 권한 또는 branch protection 설정을 확인합니다.",
        "GitHub Token에 Contents Read/Write 권한을 부여합니다.",
      ],
    },
    pull_request_create: {
      title: "PR 생성 권한이 필요한 이유",
      description: "통합 branch와 최종 반영을 검토하려면 Pull Request 생성 권한이 필요합니다.",
      checklist: ["Pull requests 권한이 Read/Write인지", "저장소에 PR 생성 권한이 있는지"],
      actionGuide: ["GitHub Token 권한에서 Pull requests를 Read and write로 설정합니다."],
    },
    workflow_file_write: {
      title: "Workflow 파일 생성 권한이 필요한 이유",
      description:
        "GitHub Pages Preview를 자동으로 만들기 위해 `.github/workflows`에 Preview 배포 workflow를 준비해야 합니다.",
      checklist: ["Workflows 권한이 Read/Write인지", "Contents 권한이 Read/Write인지"],
      actionGuide: [
        "GitHub Token 권한에서 Workflows를 Read and write로 설정합니다.",
        "권한 변경 후 연결 테스트를 다시 실행합니다.",
      ],
    },
    actions_workflow_dispatch: {
      title: "GitHub Actions 실행 권한이 필요한 이유",
      description:
        "통합 branch를 빌드하고 GitHub Pages에 배포하려면 GitHub Actions workflow를 실행해야 합니다.",
      checklist: [
        "Actions 권한이 Read/Write인지",
        "Workflows 권한이 Read/Write인지",
        "저장소에서 Actions가 비활성화되어 있지 않은지",
      ],
      actionGuide: [
        "GitHub Token 권한에서 Actions를 Read and write로 설정합니다.",
        "Workflows 권한도 Read and write로 설정합니다.",
        "저장소 Settings → Actions에서 Actions 사용이 허용되어 있는지 확인합니다.",
        "이 화면으로 돌아와 연결 테스트를 다시 실행합니다.",
      ],
    },
    gh_pages_branch_write: {
      title: "GitHub Pages Actions 배포",
      description: "Preview는 GitHub Actions가 통합 branch에서 빌드한 뒤 Pages에 배포합니다. 별도 배포 branch 선택은 필요하지 않습니다.",
      actionGuide: [
        "저장소 Settings → Pages에서 Source를 GitHub Actions로 선택합니다.",
        "다시 통합 및 Preview 준비를 실행합니다.",
      ],
    },
    pages_status_read: {
      title: "GitHub Pages 설정 방법",
      description: "GitHub Pages Source를 GitHub Actions로 설정하면 Preview URL이 외부에서 열립니다.",
      actionGuide: [
        "GitHub 저장소로 이동합니다.",
        "Settings → Pages 메뉴를 엽니다.",
        "Build and deployment의 Source를 GitHub Actions로 선택합니다.",
        "저장 후 통합 및 Preview 준비를 다시 실행합니다.",
      ],
    },
  };

  return (
    map[key as GithubPreflightCheckKeyV1] ?? {
      title: "사전점검 도움말",
      description: "항목 상태가 정상이 아니면 연결 테스트를 다시 실행하거나 GitHub Token 권한을 확인해 주세요.",
    }
  );
}
