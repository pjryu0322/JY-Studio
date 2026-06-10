import { evaluateActualPreviewSampleDataQuality } from "@/lib/prototype/actualPreviewSampleDataQualityGate";
import { getRepoUtf8FileIfExists } from "@/lib/prototype/githubRepoUtf8Contents";
import { resolveGithubOwnerRepoStrict } from "@/lib/integration/githubRestCommon";

const SAMPLE_DATA_PATHS = [
  "src/data/sampleData.ts",
  "src/data/sample/sampleData.ts",
] as const;

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
}): Promise<
  Readonly<{
    readonly result: ReturnType<typeof evaluateActualPreviewSampleDataQuality>;
    readonly sampleDataFileContent: string | null;
  }>
> {
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

  let sampleDataFileContent: string | null = null;
  for (const path of SAMPLE_DATA_PATHS) {
    const file = await getRepoUtf8FileIfExists({
      token,
      owner: parsed.owner,
      repo: parsed.repo,
      path,
      ref: branch,
    });
    if (file?.contentUtf8?.trim()) {
      sampleDataFileContent = file.contentUtf8;
      break;
    }
  }

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

  return {
    sampleDataFileContent,
    result: evaluateActualPreviewSampleDataQuality({
      repositoryFilePaths: input.repositoryFilePaths,
      sampleDataFileContent,
      workspaceSourceContents,
    }),
  };
}
