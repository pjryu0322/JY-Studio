import { CANONICAL_SAMPLE_DATA_CODE_TASK_ID } from "@/lib/prototype/codeTaskCanonicalId";
import {
  SAMPLE_DATA_CANONICAL_FILES,
  SAMPLE_DATA_EXPECTED_EXPORTS,
  SAMPLE_DATA_OWNED_FILE_PATHS,
  SAMPLE_DATA_WORK_BRANCH,
} from "@/lib/prototype/sampleDataCodeTaskPlanner";
import type { ImplementationCodeTaskV1 } from "@/lib/prototype/implementationCodeTaskPlan";
import { isSampleDataCodeTaskRef } from "@/lib/prototype/sampleDataCodeTaskPlanner";

export type ArtifactContractRuleKind =
  | "file_exists"
  | "export_exists"
  | "array_min_length"
  | "object_field_non_empty";

export type ArtifactContractRuleV1 =
  | Readonly<{
      readonly kind: "file_exists";
      readonly ruleId: string;
      readonly filePath: string;
    }>
  | Readonly<{
      readonly kind: "export_exists";
      readonly ruleId: string;
      readonly filePath: string;
      readonly exportName: string;
    }>
  | Readonly<{
      readonly kind: "array_min_length";
      readonly ruleId: string;
      readonly exportName: string;
      readonly fieldPath?: string;
      readonly min: number;
      readonly filePath?: string;
    }>
  | Readonly<{
      readonly kind: "object_field_non_empty";
      readonly ruleId: string;
      readonly exportName: string;
      readonly fieldPath: string;
      readonly filePath?: string;
    }>;

export type CodeTaskArtifactContractStageV1 = "codeTask" | "integration" | "preview";

export type CodeTaskArtifactContractV1 = Readonly<{
  readonly codeTaskId: string;
  readonly branchGroup: string;
  readonly artifactKind: "data" | "component" | "screen" | "flow" | "integration" | "unknown";
  readonly stage: CodeTaskArtifactContractStageV1;
  readonly files: readonly string[];
  readonly exports: readonly string[];
  readonly rules: readonly ArtifactContractRuleV1[];
  readonly integrationRequired?: boolean;
  readonly previewRequired?: boolean;
}>;

export function buildSampleDataArtifactContract(
  codeTaskId: string = CANONICAL_SAMPLE_DATA_CODE_TASK_ID,
): CodeTaskArtifactContractV1 {
  return {
    codeTaskId: codeTaskId.trim() || CANONICAL_SAMPLE_DATA_CODE_TASK_ID,
    branchGroup: "data",
    artifactKind: "data",
    stage: "codeTask",
    files: [...SAMPLE_DATA_OWNED_FILE_PATHS],
    exports: [...SAMPLE_DATA_EXPECTED_EXPORTS],
    rules: [
      {
        kind: "file_exists",
        ruleId: "file_sample_data",
        filePath: SAMPLE_DATA_CANONICAL_FILES.sampleData,
      },
      {
        kind: "file_exists",
        ruleId: "file_meeting_types",
        filePath: SAMPLE_DATA_CANONICAL_FILES.meetingTypes,
      },
      {
        kind: "export_exists",
        ruleId: "export_sampleMeetingSummary",
        filePath: SAMPLE_DATA_CANONICAL_FILES.sampleData,
        exportName: "sampleMeetingSummary",
      },
      ...SAMPLE_DATA_EXPECTED_EXPORTS.filter((n) => n !== "sampleMeetingSummary").map((exportName) => ({
        kind: "export_exists" as const,
        ruleId: `export_${exportName}`,
        filePath: SAMPLE_DATA_CANONICAL_FILES.sampleData,
        exportName,
      })),
      {
        kind: "object_field_non_empty",
        ruleId: "summary_overview",
        exportName: "sampleMeetingSummary",
        fieldPath: "overview",
        filePath: SAMPLE_DATA_CANONICAL_FILES.sampleData,
      },
      {
        kind: "array_min_length",
        ruleId: "summary_highlights",
        exportName: "sampleMeetingSummary",
        fieldPath: "highlights",
        min: 2,
        filePath: SAMPLE_DATA_CANONICAL_FILES.sampleData,
      },
      {
        kind: "array_min_length",
        ruleId: "meeting_files_min",
        exportName: "sampleMeetingFiles",
        min: 1,
      },
      {
        kind: "array_min_length",
        ruleId: "participants_min",
        exportName: "sampleParticipants",
        min: 2,
      },
      {
        kind: "array_min_length",
        ruleId: "transcript_min",
        exportName: "sampleTranscriptSegments",
        min: 3,
      },
      {
        kind: "array_min_length",
        ruleId: "action_items_min",
        exportName: "sampleActionItems",
        min: 1,
      },
      {
        kind: "array_min_length",
        ruleId: "draft_timeline_min",
        exportName: "sampleDraftTimeline",
        min: 2,
      },
    ],
    integrationRequired: true,
    previewRequired: false,
  };
}

/** 프로젝트/CodeTask별 산출물 계약 — 알 수 없으면 null */
export function resolveCodeTaskArtifactContract(input: {
  readonly codeTaskId: string;
  readonly codeTask?: ImplementationCodeTaskV1 | null;
}): CodeTaskArtifactContractV1 | null {
  const id = input.codeTaskId.trim();
  if (!id) return null;
  if (
    id === CANONICAL_SAMPLE_DATA_CODE_TASK_ID ||
    isSampleDataCodeTaskRef({
      codeTaskId: id,
      parentTaskId: input.codeTask?.parentTaskId,
      title: input.codeTask?.title,
      changeType: input.codeTask?.changeType,
    })
  ) {
    return buildSampleDataArtifactContract(id);
  }
  const branchGroup = input.codeTask?.branchPlan
    ? String(
        typeof input.codeTask.branchPlan === "object" && "branchGroup" in input.codeTask.branchPlan
          ? (input.codeTask.branchPlan as { branchGroup?: string }).branchGroup
          : "",
      ).trim()
    : "";
  if (branchGroup === "data" && input.codeTask?.changeType === "data") {
    return buildSampleDataArtifactContract(id);
  }
  return null;
}

export function sampleDataContractWorkBranch(): string {
  return SAMPLE_DATA_WORK_BRANCH;
}
