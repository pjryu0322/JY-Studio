export const GITHUB_TOKEN_CORE_PERMISSION_LINES = [
  "Actions: Read and write",
  "Workflows: Read and write",
  "Contents: Read and write",
  "Pull requests: Read and write",
  "Metadata: Read-only",
] as const;

export const GITHUB_TOKEN_PREVIEW_AUTO_CONFIGURE_PERMISSION_LINES = [
  "Pages: Read and write",
  "Administration: Read and write",
] as const;

export const GITHUB_TOKEN_PREVIEW_AUTO_CONFIGURE_GUIDE_INTRO =
  "Preview 배포 설정을 플랫폼이 자동으로 처리하려면 GitHub Token에 Pages와 Administration 권한이 필요합니다.\n권한을 추가하지 않아도 수동으로 Settings → Pages에서 Source를 GitHub Actions로 설정할 수 있습니다." as const;
