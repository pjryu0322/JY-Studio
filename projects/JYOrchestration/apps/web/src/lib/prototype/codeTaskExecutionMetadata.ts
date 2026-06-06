import type { CodeTaskExecutionRunV1 } from "@/lib/prototype/codeTaskExecutionRun";
import {
  CODE_TASK_DEVELOPER_PROMPT_VERSION,
  formatDeveloperPromptHashSha256,
} from "@/lib/prototype/codeTaskDeveloperPromptDelivery";

/** DB Runtime Execution Record(JSON)에 저장되는 CodeTask 실행 추적 메타 — Prisma 변경 없이 run + promptMeta에 매핑 */
export type CodeTaskExecutionMetadataV1 = Readonly<{
  readonly projectId: string;
  readonly processTaskId: string;
  readonly codeTaskId: string;
  readonly runId: string;
  readonly targetRepository: string;
  readonly baseBranch: string;
  readonly workBranch: string;
  readonly developerPromptVersion: string;
  readonly developerPromptHash: string;
  readonly developerPromptBuiltAt: string;
  readonly cursorJobId?: string | null;
  readonly commitSha?: string | null;
  readonly changedFiles?: readonly string[] | null;
  readonly status: CodeTaskExecutionRunV1["status"];
  readonly qualityGateResult?: "passed" | "failed" | "not_run" | null;
  readonly integrationIncluded?: boolean | null;
  readonly previewScopeIncluded?: boolean | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}>;

export function buildCodeTaskExecutionMetadataFromRun(input: {
  readonly run: CodeTaskExecutionRunV1;
  readonly developerPrompt: string;
  readonly developerPromptBuiltAt: string;
  readonly targetRepository: string;
  readonly baseBranch: string;
  readonly workBranch: string;
  readonly qualityGateResult?: CodeTaskExecutionMetadataV1["qualityGateResult"];
  readonly integrationIncluded?: boolean | null;
  readonly previewScopeIncluded?: boolean | null;
}): CodeTaskExecutionMetadataV1 {
  const run = input.run;
  return {
    projectId: run.projectId,
    processTaskId: run.processTaskId,
    codeTaskId: run.codeTaskId,
    runId: run.runId,
    targetRepository: input.targetRepository.trim(),
    baseBranch: input.baseBranch.trim(),
    workBranch: input.workBranch.trim(),
    developerPromptVersion: CODE_TASK_DEVELOPER_PROMPT_VERSION,
    developerPromptHash: formatDeveloperPromptHashSha256(input.developerPrompt),
    developerPromptBuiltAt: input.developerPromptBuiltAt,
    cursorJobId: run.cursorRunId ?? run.cursorRequestId ?? null,
    commitSha: run.commitSha ?? null,
    changedFiles: run.changedFiles ?? null,
    status: run.status,
    qualityGateResult: input.qualityGateResult ?? null,
    integrationIncluded: input.integrationIncluded ?? null,
    previewScopeIncluded: input.previewScopeIncluded ?? null,
    createdAt: run.createdAt,
    updatedAt: run.updatedAt,
  };
}
