import {
  evaluateActualPreviewSampleDataFileQuality,
  evaluateActualPreviewSampleDataQuality,
  type ActualPreviewSampleDataQualityResultV1,
} from "@/lib/prototype/actualPreviewSampleDataQualityGate";
import { getRepoUtf8FileIfExists } from "@/lib/prototype/githubRepoUtf8Contents";
import { resolveGithubOwnerRepoStrict } from "@/lib/integration/githubRestCommon";
import { SAMPLE_DATA_PRIMARY_FILE_PATH } from "@/lib/prototype/sampleDataCodeTaskPlanner";

const WORKSPACE_PANEL_PATHS = [
  "src/App.tsx",
  "src/components/LeftPanel.tsx",
  "src/components/CenterPanel.tsx",
  "src/components/RightPanel.tsx",
  "src/components/MeetingFilePanel.tsx",
  "src/components/ParticipantPanel.tsx",
  "src/components/TranscriptPanel.tsx",
  "src/components/SummaryPanel.tsx",
  "src/components/DraftTimelinePanel.tsx",
] as const;

export async function runActualPreviewSampleDataQualityOnIntegrationBranch(input: {
  readonly repoUrl: string;
  readonly githubToken: string;
  readonly integrationBranch: string;
  readonly repositoryFilePaths?: readonly string[] | null;
  /**
   * Integration merge 게이트: sampleData.ts 품질만 검사한다.
   * 패널 플레이스홀더는 화면 CodeTask 연결 책임이므로 통합을 막지 않는다.
   */
  readonly mode?: "integration_merge" | "full_preview";
}): Promise<
  Readonly<{
    readonly result: ActualPreviewSampleDataQualityResultV1;
    readonly sampleDataFileContent: string | null;
    readonly panelPlaceholderWarnings?: readonly string[];
  }>
> {
  const mode = input.mode ?? "integration_merge";
  const branch = input.integrationBranch.trim();
  const token = input.githubToken.trim();
  const repoUrl = input.repoUrl.trim();
  const parsed = resolveGithubOwnerRepoStrict(repoUrl);
  if (!branch || !token || !parsed) {
    return {
      result: evaluateActualPreviewSampleDataQuality({
        repositoryFilePaths: input.repositoryFilePaths,
      }),
      sampleDataFileContent: null,
    };
  }

  const sampleFile = await getRepoUtf8FileIfExists({
    token,
    owner: parsed.owner,
    repo: parsed.repo,
    path: SAMPLE_DATA_PRIMARY_FILE_PATH,
    ref: branch,
  });
  const sampleDataFileContent = sampleFile?.contentUtf8?.trim() ? sampleFile.contentUtf8 : null;

  const workspaceSourceContents: string[] = [];
  for (const path of WORKSPACE_PANEL_PATHS) {
    const listed = input.repositoryFilePaths ?? [];
    if (listed.length && !listed.includes(path)) continue;
    const file = await getRepoUtf8FileIfExists({
      token,
      owner: parsed.owner,
      repo: parsed.repo,
      path,
      ref: branch,
    });
    if (file?.contentUtf8?.trim()) {
      workspaceSourceContents.push(file.contentUtf8);
    }
  }

  console.info(
    JSON.stringify({
      action: "actual_preview_sample_data_quality_checked",
      integrationBranch: branch,
      sampleDataPresent: Boolean(sampleDataFileContent),
      panelFilesRead: workspaceSourceContents.length,
    }),
  );

  const fileResult = evaluateActualPreviewSampleDataFileQuality({
    repositoryFilePaths: input.repositoryFilePaths,
    sampleDataFileContent,
  });

  if (mode === "integration_merge") {
    const panelCheck = evaluateActualPreviewSampleDataQuality({
      repositoryFilePaths: input.repositoryFilePaths,
      sampleDataFileContent,
      workspaceSourceContents,
    });
    const panelPlaceholderWarnings = panelCheck.warning.filter((w) =>
      w.startsWith("placeholder_"),
    );
    return {
      sampleDataFileContent,
      result: fileResult,
      panelPlaceholderWarnings,
    };
  }

  return {
    sampleDataFileContent,
    result: evaluateActualPreviewSampleDataQuality({
      repositoryFilePaths: input.repositoryFilePaths,
      sampleDataFileContent,
      workspaceSourceContents,
    }),
  };
}
