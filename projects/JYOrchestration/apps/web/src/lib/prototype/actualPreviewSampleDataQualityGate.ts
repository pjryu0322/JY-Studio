import {
  ACTUAL_PREVIEW_SAMPLE_DATA_REQUIRED_USER_MESSAGE,
  SAMPLE_DATA_OWNED_FILE_PATHS,
} from "@/lib/prototype/sampleDataCodeTaskPlanner";
import { buildSampleDataArtifactContract } from "@/lib/prototype/implementationArtifactContract";
import { evaluateSampleDataFileContentAgainstSpec, type SampleDataSpecV1 } from "@/lib/featurePlanning/sampleDataSpecV1";
import {
  evaluateCodeTaskArtifactContractQuality,
  type ArtifactContractQualityStatusV1,
  type QualityIssueV1,
} from "@/lib/prototype/implementationArtifactContractQuality";

export type ActualPreviewSampleDataQualityResultV1 = Readonly<{
  readonly ok: boolean;
  readonly missing: readonly string[];
  readonly warning: readonly string[];
  readonly status?: ArtifactContractQualityStatusV1;
  readonly issues?: readonly QualityIssueV1[];
  readonly passedChecks?: readonly string[];
  readonly integrationRequired?: readonly string[];
}>;

const PLACEHOLDER_UI_PATTERNS = [
  /여기에\s*표시됩니다/u,
  /업로드된\s*회의\s*녹취\s*파일이\s*여기에/u,
  /회의\s*참여자\s*목록이\s*여기에/u,
  /회의\s*요약이\s*여기에/u,
] as const;

function evaluateWorkspacePanelPlaceholderQuality(
  workspaceSourceContents: readonly string[] | undefined | null,
): { readonly integrationRequired: string[]; readonly warning: string[] } {
  const warning: string[] = [];
  const integrationRequired: string[] = [];
  const panelSources = (workspaceSourceContents ?? []).filter(Boolean);
  for (const src of panelSources) {
    for (const pattern of PLACEHOLDER_UI_PATTERNS) {
      if (pattern.test(src)) {
        warning.push("placeholder_ui_text_in_workspace");
        integrationRequired.push(
          "LeftPanel/RightPanel 연결은 Integration 단계에서 확인",
        );
        break;
      }
    }
  }
  return { integrationRequired, warning };
}

function evaluateSampleDataFileQuality(input: {
  readonly repositoryFilePaths?: readonly string[] | null;
  readonly sampleDataFileContent?: string | null;
  readonly githubHeadCommitVerified?: boolean;
  readonly sampleDataSpecV1?: SampleDataSpecV1 | null;
}): ActualPreviewSampleDataQualityResultV1 {
  const contract = buildSampleDataArtifactContract();
  const contractResult = evaluateCodeTaskArtifactContractQuality({
    contract,
    repositoryFilePaths: input.repositoryFilePaths,
    sampleDataFileContent: input.sampleDataFileContent,
    githubHeadCommitVerified: input.githubHeadCommitVerified,
    stage: "codeTask",
  });

  const specMissing: string[] = [];
  if (contractResult.ok && input.sampleDataSpecV1 && input.sampleDataFileContent?.trim()) {
    const specCheck = evaluateSampleDataFileContentAgainstSpec({
      spec: input.sampleDataSpecV1,
      sampleDataFileContent: input.sampleDataFileContent,
    });
    if (!specCheck.ok) specMissing.push(...specCheck.missing);
  }

  const ok = contractResult.ok && specMissing.length === 0;

  return {
    ok,
    missing: [...contractResult.missing, ...specMissing],
    warning: contractResult.warning,
    status: contractResult.status,
    issues: contractResult.issues,
    passedChecks: contractResult.passedChecks,
    integrationRequired: contractResult.integrationRequired,
  };
}

/** Sample data CodeTask 산출물·export 품질 (integration merge 게이트와 동일). */
export function evaluateActualPreviewSampleDataFileQuality(input: {
  readonly repositoryFilePaths?: readonly string[] | null;
  readonly sampleDataFileContent?: string | null;
  readonly githubHeadCommitVerified?: boolean;
  readonly sampleDataSpecV1?: SampleDataSpecV1 | null;
}): ActualPreviewSampleDataQualityResultV1 {
  return evaluateSampleDataFileQuality(input);
}

export function evaluateActualPreviewSampleDataQuality(input: {
  readonly repositoryFilePaths?: readonly string[] | null;
  readonly sampleDataFileContent?: string | null;
  readonly workspaceSourceContents?: readonly string[] | null;
  readonly githubHeadCommitVerified?: boolean;
  readonly sampleDataSpecV1?: SampleDataSpecV1 | null;
}): ActualPreviewSampleDataQualityResultV1 {
  const file = evaluateSampleDataFileQuality(input);
  const panels = evaluateWorkspacePanelPlaceholderQuality(input.workspaceSourceContents);

  const integrationRequired = [...(file.integrationRequired ?? []), ...panels.integrationRequired];
  const warning = [...file.warning, ...panels.warning];
  const issues: QualityIssueV1[] = [
    ...(file.issues ?? []),
    ...integrationRequired.map((message) => ({
      level: "integration_required" as const,
      ruleId: "preview_panel_wiring",
      message,
    })),
  ];

  const ok = file.ok;

  console.info(
    JSON.stringify({
      action: ok
        ? "actual_preview_sample_data_quality_passed"
        : file.status === "pending"
          ? "actual_preview_sample_data_quality_pending"
          : "actual_preview_sample_data_quality_failed",
      missing: file.missing,
      warning,
      integrationRequired,
      passedChecks: file.passedChecks,
    }),
  );

  return {
    ok,
    missing: file.missing,
    warning,
    status: file.status,
    issues,
    passedChecks: file.passedChecks,
    integrationRequired,
  };
}

export function isIntegrationSampleDataArtifactFailure(
  result: ActualPreviewSampleDataQualityResultV1,
): boolean {
  if (result.status === "pending") return false;
  return result.missing.length > 0;
}

export function sampleDataQualityUserMessage(): string {
  return ACTUAL_PREVIEW_SAMPLE_DATA_REQUIRED_USER_MESSAGE;
}

export { SAMPLE_DATA_OWNED_FILE_PATHS };
