import type { AdminReviewDetailDto } from "@/lib/admin-review-dto";
import {
  isLicenseLikeSourceDocument,
} from "@/lib/python-worker/worker-license-like";
import type { AdminQualityGateSnapshot } from "@/lib/role-workspace/admin-review-rail";

export type CorrectionQueueIssueSeverity = "block" | "warning";
export type CorrectionQueueIssueCategory =
  | "knowledgeUnit"
  | "chunk"
  | "searchData"
  | "provider"
  | "sourceDocument"
  | "other";

export type CorrectionQueueIssue = {
  readonly id: string;
  readonly title: string;
  readonly severity: CorrectionQueueIssueSeverity;
  readonly category: CorrectionQueueIssueCategory;
  readonly targetId: string | null;
  readonly sourceLocation: string;
  readonly recommendedAction: string;
  readonly raw: string;
  readonly contentPreview: string | null;
};

const SOURCE_WARNING_SUMMARY_RE = /^원천 문서 \d+개가 WARNING/;

function classifyMessage(message: string): {
  category: CorrectionQueueIssueCategory;
  recommendedAction: string;
  targetId: string | null;
} {
  const lower = message.toLowerCase();
  const idMatch =
    message.match(/\b(?:knowledgeUnitId|chunkId|searchDataId|ku|chunk)[=:\s]*([A-Za-z0-9_-]+)/i) ??
    null;
  const targetId = idMatch?.[1] ?? null;

  if (/제공자|manufacturer|provider/i.test(message)) {
    return {
      category: "provider",
      recommendedAction: "제공자 보완요청",
      targetId,
    };
  }
  if (/chunk|청크/i.test(message) || lower.includes("chunk")) {
    if (/짧|short|tiny/i.test(message)) {
      return {
        category: "chunk",
        recommendedAction: "이전/다음 Chunk와 병합 검토",
        targetId,
      };
    }
    if (/긴|long|oversize|길이/i.test(message)) {
      return {
        category: "chunk",
        recommendedAction: "Chunk 분리 검토",
        targetId,
      };
    }
    return {
      category: "chunk",
      recommendedAction: "Chunk 병합·분리 또는 검색 제외 검토",
      targetId,
    };
  }
  if (/검색|retrieval|search.?data|index/i.test(message)) {
    return {
      category: "searchData",
      recommendedAction: "검색 제외 또는 메타데이터 확인",
      targetId,
    };
  }
  if (/지식단위|knowledge.?unit|제목|title|중복/i.test(message)) {
    return {
      category: "knowledgeUnit",
      recommendedAction: "부모/인접 지식단위와 병합 검토",
      targetId,
    };
  }
  return {
    category: "other",
    recommendedAction: "품질 결과 확인 후 재생성 또는 제공자 검토",
    targetId,
  };
}

function sourceDocumentWarningRaw(doc: {
  readonly title: string;
  readonly validationSummary: string | null;
  readonly validationIssues: readonly {
    readonly severity: string;
    readonly message: string;
  }[];
}): string {
  const issueLines = doc.validationIssues
    .filter((issue) => {
      const severity = issue.severity.toUpperCase();
      return severity === "WARNING" || severity === "WARN";
    })
    .map((issue) => issue.message.trim())
    .filter(Boolean);
  const summary = doc.validationSummary?.trim() ?? "";
  const parts = [summary, ...issueLines].filter(Boolean);
  if (parts.length > 0) return parts.join("\n");
  return `원천 문서 "${doc.title}"가 WARNING 상태입니다.`;
}

/**
 * Builds the admin correction queue from quality-gate blockers/warnings.
 * Source-validation WARNING documents are expanded one row each (e.g. 39 docs → 39 items),
 * instead of a single "원천 문서 N개가 WARNING" summary line.
 */
export function buildCorrectionQueueIssues(
  quality: AdminQualityGateSnapshot,
  detail?: AdminReviewDetailDto | null,
): CorrectionQueueIssue[] {
  const blockers = quality.blockers.map((raw, index) => {
    const classified = classifyMessage(raw);
    return {
      id: `block-${index}`,
      title: raw.slice(0, 120) || "차단 이슈",
      severity: "block" as const,
      category: classified.category,
      targetId: classified.targetId,
      sourceLocation: "품질점검 · 차단 이슈",
      recommendedAction: classified.recommendedAction,
      raw,
      contentPreview: null,
    };
  });

  const sourceWarnings: CorrectionQueueIssue[] = [];
  if (detail) {
    for (const version of detail.versions) {
      for (const doc of version.sourceDocuments) {
        if (doc.validationStatus !== "WARNING") continue;
        // License / review-only files are not knowledge or quality-check targets
        // (Admin 사전정리 제외 또는 Worker license_review).
        if (isLicenseLikeSourceDocument({ title: doc.title })) continue;
        sourceWarnings.push({
          id: `src-warn-${doc.id}`,
          title: doc.title.slice(0, 120) || "원천 문서 WARNING",
          severity: "warning",
          category: "sourceDocument",
          targetId: doc.id,
          sourceLocation: `품질점검 · 원천 검증 (${version.version})`,
          recommendedAction: "원천 문서 확인 후 재검증 또는 제공자 보완요청",
          raw: sourceDocumentWarningRaw(doc),
          contentPreview: doc.contentPreview,
        });
      }
    }
  }

  const summaryWarnings = quality.warnings
    .filter((raw) => {
      if (sourceWarnings.length > 0 && SOURCE_WARNING_SUMMARY_RE.test(raw)) return false;
      return true;
    })
    .map((raw, index) => {
      const classified = classifyMessage(raw);
      return {
        id: `warn-${index}`,
        title: raw.slice(0, 120) || "주의 이슈",
        severity: "warning" as const,
        category: classified.category,
        targetId: classified.targetId,
        sourceLocation: "품질점검 · 주의 이슈",
        recommendedAction: classified.recommendedAction,
        raw,
        contentPreview: null,
      };
    });

  return [...blockers, ...sourceWarnings, ...summaryWarnings];
}
