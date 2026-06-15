export type PreviewSampleDataRenderedCheckStatus =
  | "rendered"
  | "missing_dom_marker"
  | "empty_list"
  | "placeholder_only"
  | "preview_unreachable"
  | "check_failed";

export type PreviewSampleDataRenderedCheckResult = Readonly<{
  readonly ok: boolean;
  readonly status: PreviewSampleDataRenderedCheckStatus;
  readonly foundMarkers: readonly string[];
  readonly missingMarkers: readonly string[];
  readonly issues: readonly string[];
}>;

export const PREVIEW_SAMPLE_DATA_READY_ATTR = 'data-sample-data-ready="true"' as const;

export const PREVIEW_SAMPLE_DATA_ENTITY_MARKERS = [
  'data-sample-entity="meeting-file"',
  'data-sample-entity="participant"',
] as const;

export const PREVIEW_SAMPLE_DATA_JY_WIRING_MARKERS = [
  "data-jy-preview-sample=",
  "jy-preview-file-list",
  "jy-preview-participant-list",
] as const;

export const PREVIEW_SAMPLE_DATA_PLACEHOLDER_ONLY_PATTERNS = [
  /업로드된\s*회의\s*녹취\s*파일이\s*여기에/u,
  /회의\s*참여자\s*목록이\s*여기에/u,
  /회의록\s*요약이\s*여기에/u,
  /데이터가\s*없습니다/u,
  /샘플\s*준비\s*중/u,
  /여기에\s*표시됩니다/u,
] as const;

const DEFAULT_EXPECTED_MARKERS = [
  PREVIEW_SAMPLE_DATA_READY_ATTR,
  ...PREVIEW_SAMPLE_DATA_ENTITY_MARKERS,
  ...PREVIEW_SAMPLE_DATA_JY_WIRING_MARKERS,
] as const;

function markerPresent(html: string, marker: string): boolean {
  return html.includes(marker);
}

export function evaluatePreviewSampleDataRenderedFromDocumentText(input: {
  readonly documentText: string;
  readonly expectedMarkers?: readonly string[];
}): PreviewSampleDataRenderedCheckResult {
  const text = String(input.documentText ?? "");
  const expected = input.expectedMarkers ?? DEFAULT_EXPECTED_MARKERS;
  const foundMarkers = expected.filter((m) => markerPresent(text, m));
  const missingMarkers = expected.filter((m) => !markerPresent(text, m));

  const hasReadyAttr = markerPresent(text, PREVIEW_SAMPLE_DATA_READY_ATTR);
  const hasJyFile = markerPresent(text, "jy-preview-file-list");
  const hasJyParticipant = markerPresent(text, "jy-preview-participant-list");
  const hasEntityFile = markerPresent(text, 'data-sample-entity="meeting-file"');
  const hasEntityParticipant = markerPresent(text, 'data-sample-entity="participant"');

  const wiredPreview =
    hasReadyAttr ||
    (hasJyFile && hasJyParticipant) ||
    (hasEntityFile && hasEntityParticipant);

  const placeholderHits = PREVIEW_SAMPLE_DATA_PLACEHOLDER_ONLY_PATTERNS.filter((p) => p.test(text));
  const placeholderOnly = placeholderHits.length > 0 && !wiredPreview;

  if (!text.trim()) {
    return {
      ok: false,
      status: "empty_list",
      foundMarkers,
      missingMarkers,
      issues: ["preview_document_empty"],
    };
  }

  if (placeholderOnly) {
    return {
      ok: false,
      status: "placeholder_only",
      foundMarkers,
      missingMarkers,
      issues: ["placeholder_ui_without_sample_markers", ...placeholderHits.map(String)],
    };
  }

  if (!wiredPreview) {
    return {
      ok: false,
      status: "missing_dom_marker",
      foundMarkers,
      missingMarkers,
      issues: ["sample_data_dom_markers_missing"],
    };
  }

  return {
    ok: true,
    status: "rendered",
    foundMarkers,
    missingMarkers,
    issues: [],
  };
}

export async function checkPreviewSampleDataRendered(input: {
  readonly previewUrl: string;
  readonly expectedMarkers?: readonly string[];
  readonly timeoutMs?: number;
  readonly fetchHtml?: (url: string, timeoutMs: number) => Promise<string | null>;
}): Promise<PreviewSampleDataRenderedCheckResult> {
  const url = input.previewUrl.trim();
  if (!url) {
    return {
      ok: false,
      status: "preview_unreachable",
      foundMarkers: [],
      missingMarkers: [...DEFAULT_EXPECTED_MARKERS],
      issues: ["missing_preview_url"],
    };
  }

  const timeoutMs = input.timeoutMs ?? 12_000;
  const fetchHtml =
    input.fetchHtml ??
    (async (target: string, ms: number) => {
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), ms);
        const res = await fetch(target, { signal: controller.signal, redirect: "follow" });
        clearTimeout(timer);
        if (!res.ok) return null;
        return await res.text();
      } catch {
        return null;
      }
    });

  const html = await fetchHtml(url, timeoutMs);
  if (html == null) {
    return {
      ok: false,
      status: "preview_unreachable",
      foundMarkers: [],
      missingMarkers: [...DEFAULT_EXPECTED_MARKERS],
      issues: ["preview_fetch_failed"],
    };
  }

  return evaluatePreviewSampleDataRenderedFromDocumentText({
    documentText: html,
    expectedMarkers: input.expectedMarkers,
  });
}
