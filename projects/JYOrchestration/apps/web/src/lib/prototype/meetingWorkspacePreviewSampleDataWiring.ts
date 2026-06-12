import { SAMPLE_DATA_PRIMARY_FILE_PATH } from "@/lib/prototype/sampleDataCodeTaskPlanner";
import {
  PREVIEW_SAMPLE_DRAFT_TIMELINE_JSX,
  PREVIEW_SAMPLE_FILE_LIST_JSX,
  PREVIEW_SAMPLE_PARTICIPANT_LIST_JSX,
  PREVIEW_SAMPLE_SUMMARY_JSX,
  PREVIEW_SAMPLE_TRANSCRIPT_JSX,
  PREVIEW_SAMPLE_WIRING_VERSION,
} from "@/lib/prototype/meetingWorkspacePreviewSampleDataWiringSnippets";

const SAMPLE_DATA_IMPORT_PATH_FROM_COMPONENTS = "../data/sampleData";

type MeetingPanelWiringRule = Readonly<{
  readonly paths: readonly string[];
  readonly placeholder: RegExp;
  readonly symbols: readonly string[];
  readonly replacementJsx: string;
  readonly legacyBlockPattern?: RegExp;
}>;

/** 전용 패널만 패치 — LeftPanel/RightPanel 복합 파일은 섹션 오염을 피한다 */
const MEETING_PANEL_WIRING_RULES: readonly MeetingPanelWiringRule[] = [
  {
    paths: ["src/components/MeetingFilePanel.tsx"],
    placeholder: /업로드된\s*회의\s*녹취\s*파일이\s*여기에/u,
    symbols: ["sampleMeetingFiles"],
    replacementJsx: PREVIEW_SAMPLE_FILE_LIST_JSX,
    legacyBlockPattern: /<ul className="sample-meeting-files">[\s\S]*?<\/ul>/,
  },
  {
    paths: ["src/components/ParticipantPanel.tsx"],
    placeholder: /회의\s*참여자\s*목록이\s*여기에/u,
    symbols: ["sampleParticipants"],
    replacementJsx: PREVIEW_SAMPLE_PARTICIPANT_LIST_JSX,
    legacyBlockPattern: /<ul className="sample-participants">[\s\S]*?<\/ul>/,
  },
  {
    paths: ["src/components/SummaryPanel.tsx"],
    placeholder: /회의록\s*요약이\s*여기에/u,
    symbols: ["sampleMeetingSummary", "sampleDecisions", "sampleActionItems"],
    replacementJsx: PREVIEW_SAMPLE_SUMMARY_JSX,
    legacyBlockPattern: /<div className="sample-summary">[\s\S]*?<\/div>\s*(?=<\/)/,
  },
  {
    paths: ["src/components/TranscriptPanel.tsx", "src/components/CenterPanel.tsx"],
    placeholder: /업로드,\s*변환,\s*화자\s*분리|여기에\s*표시됩니다/u,
    symbols: ["sampleTranscriptSegments"],
    replacementJsx: PREVIEW_SAMPLE_TRANSCRIPT_JSX,
    legacyBlockPattern: /<ul className="sample-transcript">[\s\S]*?<\/ul>/,
  },
  {
    paths: ["src/components/DraftTimelinePanel.tsx"],
    placeholder: /초안\s*생성\s*단계별\s*진행\s*이력이\s*여기에/u,
    symbols: ["sampleDraftTimeline"],
    replacementJsx: PREVIEW_SAMPLE_DRAFT_TIMELINE_JSX,
    legacyBlockPattern: /<ol className="sample-draft-timeline">[\s\S]*?<\/ol>/,
  },
];

export const MEETING_WORKSPACE_PREVIEW_WIRING_TARGET_PATHS = [
  ...new Set(MEETING_PANEL_WIRING_RULES.flatMap((r) => r.paths)),
] as const;

function ensureSampleDataImports(source: string, symbols: readonly string[]): string {
  const unique = [...new Set(symbols)];
  if (!unique.length) return source;
  const importRe = /import\s*\{([^}]+)\}\s*from\s*['"]\.\.\/data\/sampleData['"]\s*;?/;
  const match = source.match(importRe);
  if (match) {
    const existing = match[1]!
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const merged = [...new Set([...existing, ...unique])];
    if (merged.length === existing.length) return source;
    return source.replace(
      importRe,
      `import { ${merged.join(", ")} } from '${SAMPLE_DATA_IMPORT_PATH_FROM_COMPONENTS}';`,
    );
  }
  const line = `import { ${unique.join(", ")} } from '${SAMPLE_DATA_IMPORT_PATH_FROM_COMPONENTS}';\n`;
  const firstImport = source.match(/^import\s.+$/m);
  if (firstImport?.index !== undefined) {
    return `${source.slice(0, firstImport.index)}${line}${source.slice(firstImport.index)}`;
  }
  return `${line}${source}`;
}

function replacePlaceholderRegion(source: string, placeholder: RegExp, replacementJsx: string): string | null {
  if (!placeholder.test(source)) return null;
  placeholder.lastIndex = 0;

  const tagged = source.replace(
    /<p[^>]*>\s*[^<]*?(?:여기에\s*표시됩니다|업로드,\s*변환)[^<]*?\s*<\/p>/gu,
    replacementJsx,
  );
  if (tagged !== source) return tagged;

  const divTagged = source.replace(
    /<div[^>]*>\s*[^<]*?여기에\s*표시됩니다[^<]*?\s*<\/div>/gu,
    replacementJsx,
  );
  if (divTagged !== source) return divTagged;

  const quoted = source.replace(
    /(["'`])([^"'`]*?(?:여기에\s*표시됩니다|업로드,\s*변환)[^"'`]*?)\1/gu,
    replacementJsx,
  );
  if (quoted !== source) return quoted;

  const bare = source.replace(placeholder, replacementJsx);
  return bare !== source ? bare : null;
}

function upgradeLegacyPreviewBlock(
  source: string,
  rule: MeetingPanelWiringRule,
): string | null {
  if (source.includes(`data-jy-preview-sample="${PREVIEW_SAMPLE_WIRING_VERSION}"`)) {
    return null;
  }
  const legacy =
    rule.legacyBlockPattern ??
    /className="sample-[^"]+"[\s\S]{20,1200}/;
  if (!legacy.test(source)) return null;
  legacy.lastIndex = 0;
  const next = source.replace(legacy, rule.replacementJsx);
  return next !== source ? next : null;
}

export function patchMeetingWorkspacePanelForSampleDataPreview(input: {
  readonly path: string;
  readonly sourceUtf8: string;
}): string | null {
  const path = input.path.replace(/\\/g, "/");
  const rules = MEETING_PANEL_WIRING_RULES.filter((r) => r.paths.includes(path));
  if (!rules.length) return null;

  let next = input.sourceUtf8;
  let changed = false;
  const symbols: string[] = [];

  for (const rule of rules) {
    const upgraded = upgradeLegacyPreviewBlock(next, rule);
    if (upgraded) {
      next = upgraded;
      symbols.push(...rule.symbols);
      changed = true;
      continue;
    }

    if (!rule.placeholder.test(next)) continue;
    rule.placeholder.lastIndex = 0;
    const replaced = replacePlaceholderRegion(next, rule.placeholder, rule.replacementJsx);
    if (!replaced) continue;
    next = replaced;
    symbols.push(...rule.symbols);
    changed = true;
  }

  if (!changed) return null;
  next = ensureSampleDataImports(next, symbols);
  return next;
}

export function integrationBranchNeedsMeetingSampleDataWiring(
  repositoryFilePaths: readonly string[],
): boolean {
  return repositoryFilePaths.includes(SAMPLE_DATA_PRIMARY_FILE_PATH);
}
