import { resolveGithubOwnerRepoStrict } from "@/lib/integration/githubRestCommon";
import { getRepoUtf8FileIfExists, putRepoUtf8File } from "@/lib/prototype/githubRepoUtf8Contents";
import {
  integrationBranchNeedsMeetingSampleDataWiring,
  MEETING_WORKSPACE_PREVIEW_WIRING_TARGET_PATHS,
  patchMeetingWorkspacePanelForSampleDataPreview,
} from "@/lib/prototype/meetingWorkspacePreviewSampleDataWiring";
import { SAMPLE_DATA_PRIMARY_FILE_PATH } from "@/lib/prototype/sampleDataCodeTaskPlanner";

export async function ensureMeetingWorkspaceSampleDataPreviewWiring(input: {
  readonly projectId: string;
  readonly repoUrl: string;
  readonly githubToken: string;
  readonly integrationBranch: string;
  readonly repositoryFilePaths: readonly string[];
}): Promise<{
  readonly ok: boolean;
  readonly changedFiles: readonly string[];
  readonly commitSha: string | null;
  readonly skippedReason: string | null;
}> {
  void input.projectId;
  if (!integrationBranchNeedsMeetingSampleDataWiring(input.repositoryFilePaths)) {
    return { ok: true, changedFiles: [], commitSha: null, skippedReason: "sample_data_file_missing" };
  }

  const parsed = resolveGithubOwnerRepoStrict(input.repoUrl.trim());
  const token = input.githubToken.trim();
  const branch = input.integrationBranch.trim();
  if (!parsed || !token || !branch) {
    return { ok: false, changedFiles: [], commitSha: null, skippedReason: "github_auth_missing" };
  }

  const sampleOnBranch = await getRepoUtf8FileIfExists({
    token,
    owner: parsed.owner,
    repo: parsed.repo,
    path: SAMPLE_DATA_PRIMARY_FILE_PATH,
    ref: branch,
  });
  if (!sampleOnBranch?.contentUtf8?.trim()) {
    return { ok: true, changedFiles: [], commitSha: null, skippedReason: "sample_data_not_on_branch" };
  }

  const pathSet = new Set(input.repositoryFilePaths.map((p) => p.replace(/\\/g, "/")));
  const targets = MEETING_WORKSPACE_PREVIEW_WIRING_TARGET_PATHS.filter((p) => pathSet.has(p));

  const changedFiles: string[] = [];
  let lastCommitSha: string | null = null;

  for (const path of targets) {
    const existing = await getRepoUtf8FileIfExists({
      token,
      owner: parsed.owner,
      repo: parsed.repo,
      path,
      ref: branch,
    });
    if (!existing?.contentUtf8?.trim()) continue;

    const patched = patchMeetingWorkspacePanelForSampleDataPreview({
      path,
      sourceUtf8: existing.contentUtf8,
    });
    if (!patched || patched === existing.contentUtf8) continue;

    const put = await putRepoUtf8File({
      token,
      owner: parsed.owner,
      repo: parsed.repo,
      path,
      branch,
      message: `chore(preview): wire ${path} to sampleData`,
      contentUtf8: patched,
      sha: existing.sha,
    });
    if (!put.ok) {
      return {
        ok: false,
        changedFiles,
        commitSha: lastCommitSha,
        skippedReason: `put_failed:${path}`,
      };
    }
    changedFiles.push(path);
    lastCommitSha = put.commitSha;
  }

  return {
    ok: true,
    changedFiles,
    commitSha: lastCommitSha,
    skippedReason: changedFiles.length ? null : "no_placeholder_panels",
  };
}
