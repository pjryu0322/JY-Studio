import { findLatestRunForCodeTask, type CodeTaskExecutionRunV1 } from "@/lib/prototype/codeTaskExecutionRun";
import { readCodeTaskRunCommitSha } from "@/lib/prototype/codeTaskRunPreviewPolicy";
import { evaluateActualPreviewSampleDataQuality } from "@/lib/prototype/actualPreviewSampleDataQualityGate";
import { getRepoUtf8FileIfExists } from "@/lib/prototype/githubRepoUtf8Contents";
import { resolveGithubOwnerRepoStrict } from "@/lib/integration/githubRestCommon";
import { parseCodeTaskBranchPlanV1 } from "@/lib/prototype/implementationBranchPlan";
import type {
  ImplementationCodeTaskPlanV1,
  ImplementationCodeTaskV1,
} from "@/lib/prototype/implementationCodeTaskPlan";
import {
  CANONICAL_SAMPLE_DATA_CODE_TASK_ID,
  isLegacySampleDataCodeTaskId,
  LEGACY_SAMPLE_DATA_CODE_TASK_ID,
  resolveCanonicalCodeTaskForQueuedRun,
  resolveCanonicalSampleDataCodeTaskId,
} from "@/lib/prototype/codeTaskCanonicalId";
import {
  isSampleDataCodeTaskRef,
  areSampleDataOwnedFilesOnBranch,
  SAMPLE_DATA_OWNED_FILE_PATHS,
  SAMPLE_DATA_PARENT_PROCESS_TASK_ID,
  SAMPLE_DATA_PRIMARY_FILE_PATH,
  SAMPLE_DATA_WORK_BRANCH,
} from "@/lib/prototype/sampleDataCodeTaskPlanner";

export function isSampleDataCodeTaskIdAlias(codeTaskId: string): boolean {
  return isLegacySampleDataCodeTaskId(codeTaskId);
}

export function findLatestSampleDataExecutionRun(input: {
  readonly runs: readonly CodeTaskExecutionRunV1[] | null | undefined;
  readonly preferredCodeTaskIds?: readonly string[] | null;
}): CodeTaskExecutionRunV1 | null {
  const preferred = new Set(
    (input.preferredCodeTaskIds ?? [])
      .map((id) => id.trim())
      .filter(Boolean),
  );
  preferred.add(CANONICAL_SAMPLE_DATA_CODE_TASK_ID);
  preferred.add(LEGACY_SAMPLE_DATA_CODE_TASK_ID);

  const matches = (input.runs ?? []).filter((run) => {
    const id = run.codeTaskId.trim();
    const branch = String(run.workBranch ?? "").trim();
    return (
      preferred.has(id) ||
      branch === SAMPLE_DATA_WORK_BRANCH ||
      /\/sample-data$/i.test(branch)
    );
  });
  if (!matches.length) return null;

  return [...matches].sort((a, b) => {
    const attemptA = Number.isFinite(a.attemptNo) ? a.attemptNo : 0;
    const attemptB = Number.isFinite(b.attemptNo) ? b.attemptNo : 0;
    if (attemptA !== attemptB) return attemptB - attemptA;
    return (b.updatedAt ?? "").localeCompare(a.updatedAt ?? "");
  })[0] ?? null;
}

function buildSampleDataCodeTaskStub(input: {
  readonly codeTaskId: string;
  readonly run: CodeTaskExecutionRunV1 | null;
}): ImplementationCodeTaskV1 {
  const branchPlan = {
    branchGroup: "data" as const,
    workBranch: input.run?.workBranch?.trim() || SAMPLE_DATA_WORK_BRANCH,
    baseBranch: "wip/foundation/app-shell",
    executionMode: "sequential" as const,
  };
  return {
    codeTaskId: input.codeTaskId.trim(),
    parentTaskId: input.run?.processTaskId?.trim() || SAMPLE_DATA_PARENT_PROCESS_TASK_ID,
    title: "샘플 데이터 구현",
    description: "",
    changeType: "data",
    targetHints: ["data"],
    dependencies: [],
    acceptanceCriteria: [],
    verificationHints: [],
    forbiddenPaths: [],
    priority: "P0",
    status: "done",
    blockers: [],
    branchPlan,
  };
}

export type SampleDataArtifactFileV1 = Readonly<{
  readonly path: string;
  readonly contentUtf8: string | null;
  readonly found: boolean;
}>;

export type SampleDataArtifactsFetchResultV1 = Readonly<{
  readonly ok: boolean;
  readonly codeTaskId: string;
  readonly workBranch: string;
  readonly gitRef: string;
  readonly commitSha: string | null;
  readonly repositoryFullName: string | null;
  readonly files: readonly SampleDataArtifactFileV1[];
  readonly quality: ReturnType<typeof evaluateActualPreviewSampleDataQuality>;
  readonly userMessage: string | null;
}>;

export function resolveSampleDataCodeTaskFromPlan(
  plan: ImplementationCodeTaskPlanV1 | null | undefined,
  codeTaskId?: string | null,
  runs?: readonly CodeTaskExecutionRunV1[] | null,
): ImplementationCodeTaskV1 | null {
  const tasks = plan?.tasks ?? [];
  const requested = String(codeTaskId ?? "").trim();

  const findSampleInPlan = (): ImplementationCodeTaskV1 | null =>
    tasks.find((t) =>
      isSampleDataCodeTaskRef({
        codeTaskId: t.codeTaskId,
        parentTaskId: t.parentTaskId,
        title: t.title,
        changeType: t.changeType,
      }),
    ) ?? null;

  if (requested) {
    const direct = tasks.find((t) => t.codeTaskId.trim() === requested);
    if (direct) return direct;

    const canonical = resolveCanonicalCodeTaskForQueuedRun({
      queuedCodeTaskId: requested,
      codeTasks: tasks,
      branchGroup: "data",
      workBranch: SAMPLE_DATA_WORK_BRANCH,
    });
    if (canonical.status === "matched" || canonical.status === "repaired") {
      return canonical.codeTask;
    }

    if (isSampleDataCodeTaskIdAlias(requested) || isSampleDataCodeTaskRef({ codeTaskId: requested })) {
      const sampleInPlan = findSampleInPlan();
      if (sampleInPlan) return sampleInPlan;
      const run = findLatestSampleDataExecutionRun({
        runs,
        preferredCodeTaskIds: [
          resolveCanonicalSampleDataCodeTaskId({ codeTaskId: requested, codeTasks: tasks }),
          requested,
          CANONICAL_SAMPLE_DATA_CODE_TASK_ID,
        ],
      });
      return buildSampleDataCodeTaskStub({
        codeTaskId: resolveCanonicalSampleDataCodeTaskId({ codeTaskId: requested, codeTasks: tasks }),
        run,
      });
    }

    return null;
  }

  return findSampleInPlan();
}

export function resolveSampleDataArtifactGitRef(input: {
  readonly codeTask: ImplementationCodeTaskV1;
  readonly runs: readonly CodeTaskExecutionRunV1[] | null | undefined;
}): Readonly<{ readonly workBranch: string; readonly gitRef: string; readonly commitSha: string | null }> {
  const run =
    findLatestRunForCodeTask(input.runs ?? [], input.codeTask.codeTaskId) ??
    findLatestSampleDataExecutionRun({
      runs: input.runs,
      preferredCodeTaskIds: [input.codeTask.codeTaskId, CANONICAL_SAMPLE_DATA_CODE_TASK_ID],
    });
  const branchPlan = parseCodeTaskBranchPlanV1(input.codeTask.branchPlan);
  const workBranch =
    run?.workBranch?.trim() ||
    branchPlan?.workBranch?.trim() ||
    SAMPLE_DATA_WORK_BRANCH;
  const commitSha = run ? readCodeTaskRunCommitSha(run) : null;
  const gitRef = commitSha?.trim() || workBranch;
  return { workBranch, gitRef, commitSha: commitSha?.trim() || null };
}

export async function fetchSampleDataArtifactsFromGithub(input: {
  readonly repoUrl: string;
  readonly githubToken: string;
  readonly codeTask: ImplementationCodeTaskV1;
  readonly runs: readonly CodeTaskExecutionRunV1[] | null | undefined;
}): Promise<SampleDataArtifactsFetchResultV1> {
  const parsed = resolveGithubOwnerRepoStrict(input.repoUrl.trim());
  const token = input.githubToken.trim();
  let { workBranch, gitRef, commitSha } = resolveSampleDataArtifactGitRef({
    codeTask: input.codeTask,
    runs: input.runs,
  });

  if (!parsed || !token) {
    return {
      ok: false,
      codeTaskId: input.codeTask.codeTaskId,
      workBranch,
      gitRef,
      commitSha,
      repositoryFullName: parsed ? `${parsed.owner}/${parsed.repo}` : null,
      files: [],
      quality: { ok: false, missing: ["github_not_configured"], warning: [] },
      userMessage: "GitHub 저장소 또는 Token이 설정되어 있지 않습니다.",
    };
  }

  const pathsToFetch = [...SAMPLE_DATA_OWNED_FILE_PATHS];

  const loadAtRef = async (ref: string) => {
    const seen = new Set<string>();
    const files: SampleDataArtifactFileV1[] = [];
    for (const path of pathsToFetch) {
      if (seen.has(path)) continue;
      seen.add(path);
      const file = await getRepoUtf8FileIfExists({
        token,
        owner: parsed.owner,
        repo: parsed.repo,
        path,
        ref,
      });
      files.push({
        path,
        contentUtf8: file?.contentUtf8 ?? null,
        found: Boolean(file?.contentUtf8?.trim()),
      });
    }
    return files;
  };

  let files = await loadAtRef(gitRef);
  let primarySample =
    files.find((f) => f.path === SAMPLE_DATA_PRIMARY_FILE_PATH && f.found)?.contentUtf8 ?? null;

  if (!primarySample && commitSha && workBranch && gitRef !== workBranch) {
    const branchFiles = await loadAtRef(workBranch);
    const branchPrimary =
      branchFiles.find((f) => f.path === SAMPLE_DATA_PRIMARY_FILE_PATH && f.found)?.contentUtf8 ??
      null;
    if (branchPrimary) {
      files = branchFiles;
      primarySample = branchPrimary;
      gitRef = workBranch;
    }
  }

  const quality = evaluateActualPreviewSampleDataQuality({
    repositoryFilePaths: files.filter((f) => f.found).map((f) => f.path),
    sampleDataFileContent: primarySample,
    githubHeadCommitVerified: Boolean(commitSha?.trim()),
  });

  const ownedPresent = areSampleDataOwnedFilesOnBranch(
    files.filter((f) => f.found).map((f) => f.path),
  );

  let userMessage: string | null = null;
  if (!commitSha?.trim() && !primarySample) {
    userMessage = null;
  } else if (!primarySample) {
    userMessage = `GitHub branch \`${workBranch}\` (${gitRef})에서 sampleData.ts를 찾지 못했습니다. CodeTask 실행 branch와 커밋을 확인해 주세요.`;
  } else if (!ownedPresent) {
    userMessage =
      "일부 샘플 데이터 파일이 branch에 없습니다. src/data/sampleData.ts와 src/types/meeting.ts를 확인해 주세요.";
  } else if (quality.status === "pending") {
    userMessage = null;
  } else if (!quality.ok) {
    userMessage =
      "산출물 계약 품질 기준을 만족하지 않습니다. export·필드·내용을 확인해 주세요.";
  }

  const fetchOk =
    quality.status === "pending"
      ? Boolean(primarySample) || Boolean(commitSha?.trim())
      : Boolean(primarySample) && quality.ok;

  return {
    ok: fetchOk,
    codeTaskId: input.codeTask.codeTaskId,
    workBranch,
    gitRef,
    commitSha,
    repositoryFullName: `${parsed.owner}/${parsed.repo}`,
    files,
    quality,
    userMessage,
  };
}
