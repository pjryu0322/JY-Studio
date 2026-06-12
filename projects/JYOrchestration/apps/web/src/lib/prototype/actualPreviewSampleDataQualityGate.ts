import {
  ACTUAL_PREVIEW_SAMPLE_DATA_REQUIRED_USER_MESSAGE,
  SAMPLE_DATA_EXPECTED_EXPORTS,
  SAMPLE_DATA_OWNED_FILE_PATHS,
  SAMPLE_DATA_PRIMARY_FILE_PATH,
} from "@/lib/prototype/sampleDataCodeTaskPlanner";

export type ActualPreviewSampleDataQualityResultV1 = Readonly<{
  readonly ok: boolean;
  readonly missing: readonly string[];
  readonly warning: readonly string[];
}>;

const PLACEHOLDER_UI_PATTERNS = [
  /여기에\s*표시됩니다/u,
  /업로드된\s*회의\s*녹취\s*파일이\s*여기에/u,
  /회의\s*참여자\s*목록이\s*여기에/u,
  /회의록\s*요약이\s*여기에/u,
] as const;

function countArrayLiteralEntries(source: string, exportName: string): number {
  const re = new RegExp(
    `export\\s+const\\s+${exportName}\\s*(?::[^=]+)?=\\s*\\[([\\s\\S]*?)\\];`,
    "m",
  );
  const match = source.match(re);
  if (!match?.[1]) return 0;
  const body = match[1];
  return (body.match(/\{/g) ?? []).length;
}

function readStringField(source: string, field: string): string | null {
  const re = new RegExp(`${field}\\s*:\\s*["'\`]([^"'\`]+)["'\`]`, "m");
  const m = source.match(re);
  return m?.[1]?.trim() ?? null;
}

function countKeyPoints(source: string): number {
  const block = source.match(/keyPoints\s*:\s*\[([\s\S]*?)\]/m)?.[1] ?? "";
  return (block.match(/["'`][^"'`]+["'`]/g) ?? []).length;
}

function evaluateSampleDataFileQuality(input: {
  readonly repositoryFilePaths?: readonly string[] | null;
  readonly sampleDataFileContent?: string | null;
}): { readonly missing: string[]; readonly warning: string[] } {
  const missing: string[] = [];
  const warning: string[] = [];
  const paths = (input.repositoryFilePaths ?? []).map((p) => p.replace(/\\/g, "/"));

  const hasSampleFile =
    paths.includes(SAMPLE_DATA_PRIMARY_FILE_PATH) || Boolean(input.sampleDataFileContent?.trim());

  if (!hasSampleFile) {
    missing.push(SAMPLE_DATA_PRIMARY_FILE_PATH);
  }

  const content = String(input.sampleDataFileContent ?? "").trim();
  if (!content && hasSampleFile) {
    missing.push("sampleData.ts content");
  }

  if (content) {
    for (const exportName of SAMPLE_DATA_EXPECTED_EXPORTS) {
      if (!new RegExp(`export\\s+const\\s+${exportName}\\b`).test(content)) {
        missing.push(`export:${exportName}`);
      }
    }

    if (countArrayLiteralEntries(content, "sampleMeetingFiles") < 1) {
      missing.push("sampleMeetingFiles>=1");
    }
    if (countArrayLiteralEntries(content, "sampleParticipants") < 2) {
      missing.push("sampleParticipants>=2");
    }
    if (countArrayLiteralEntries(content, "sampleTranscriptSegments") < 3) {
      missing.push("sampleTranscriptSegments>=3");
    }

    const overview =
      readStringField(content, "overview") ??
      content.match(/overview\s*:\s*["'`]([^"'`]+)["'`]/s)?.[1]?.trim() ??
      "";
    if (!overview) {
      missing.push("sampleMeetingSummary.overview");
    }
    if (countKeyPoints(content) < 2) {
      missing.push("sampleMeetingSummary.keyPoints>=2");
    }
    if (countArrayLiteralEntries(content, "sampleDraftTimeline") < 2) {
      missing.push("sampleDraftTimeline>=2");
    }
  }

  return { missing, warning };
}

function evaluateWorkspacePanelPlaceholderQuality(
  workspaceSourceContents: readonly string[] | undefined | null,
): { readonly missing: string[]; readonly warning: string[] } {
  const missing: string[] = [];
  const warning: string[] = [];
  const panelSources = (workspaceSourceContents ?? []).filter(Boolean);
  for (const src of panelSources) {
    for (const pattern of PLACEHOLDER_UI_PATTERNS) {
      if (pattern.test(src)) {
        warning.push("placeholder_ui_text_in_workspace");
        break;
      }
    }
  }
  if (warning.includes("placeholder_ui_text_in_workspace")) {
    missing.push("placeholder_only_primary_panels");
  }
  return { missing, warning };
}

/** Sample data CodeTask 산출물·export 품질 (integration merge 게이트와 동일). */
export function evaluateActualPreviewSampleDataFileQuality(input: {
  readonly repositoryFilePaths?: readonly string[] | null;
  readonly sampleDataFileContent?: string | null;
}): ActualPreviewSampleDataQualityResultV1 {
  const file = evaluateSampleDataFileQuality(input);
  const ok = file.missing.length === 0;
  return { ok, missing: file.missing, warning: file.warning };
}

export function evaluateActualPreviewSampleDataQuality(input: {
  readonly repositoryFilePaths?: readonly string[] | null;
  readonly sampleDataFileContent?: string | null;
  readonly workspaceSourceContents?: readonly string[] | null;
}): ActualPreviewSampleDataQualityResultV1 {
  const file = evaluateSampleDataFileQuality(input);
  const panels = evaluateWorkspacePanelPlaceholderQuality(input.workspaceSourceContents);
  const missing = [...file.missing, ...panels.missing];
  const warning = [...file.warning, ...panels.warning];

  const ok = missing.length === 0;
  console.info(
    JSON.stringify({
      action: ok
        ? "actual_preview_sample_data_quality_passed"
        : "actual_preview_sample_data_quality_failed",
      missing,
      warning,
    }),
  );

  return { ok, missing, warning };
}

export function isIntegrationSampleDataArtifactFailure(
  result: ActualPreviewSampleDataQualityResultV1,
): boolean {
  return result.missing.some((m) => m !== "placeholder_only_primary_panels");
}

export function sampleDataQualityUserMessage(): string {
  return ACTUAL_PREVIEW_SAMPLE_DATA_REQUIRED_USER_MESSAGE;
}

export { SAMPLE_DATA_OWNED_FILE_PATHS };
