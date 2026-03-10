import type { LayoutProfile } from "@/lib/template/templateDetector";
import type { TemplateSchema } from "@/lib/template/schema";
import { normalizeLabel } from "@/lib/templateAuto/normalize";
import type { DriftItem, DriftResult } from "./driftTypes";
import { driftConfig } from "./driftConfig";
import { matchSections, type SectionLike } from "./sectionMatcher";
import { matchTableHeaders } from "./tableMatcher";

interface DetectTemplateDriftInput {
  templateSchema: TemplateSchema;
  layoutProfile: LayoutProfile;
  docId?: string;
  docType?: TemplateSchema["docType"];
  extractedTemplateDraft?: unknown;
}

/**
 * Placeholder drift detector.
 * The scoring/rules engine will be implemented in follow-up tasks.
 */
export function detectTemplateDrift(
  input: DetectTemplateDriftInput
): DriftResult {
  const items: DriftItem[] = [];
  const templateSections: SectionLike[] = input.templateSchema.sections.map((section, idx) => ({
    id: section.id,
    title: section.title,
    orderHint: section.orderHint ?? idx + 1,
  }));
  const draftFromTemplate = (() => {
    if (
      !input.extractedTemplateDraft ||
      typeof input.extractedTemplateDraft !== "object"
    ) {
      return null;
    }
    const raw = input.extractedTemplateDraft as {
      sections?: Array<{ id?: string; title?: string; orderHint?: number }>;
    };
    if (!Array.isArray(raw.sections)) return null;
    return raw.sections
      .filter((section) => typeof section?.title === "string" && section.title.trim().length > 0)
      .map((section, idx) => ({
        id: section.id || `draft_sec_${idx + 1}`,
        title: section.title!.trim(),
        orderHint: section.orderHint ?? idx + 1,
      }));
  })();
  const draftSections: SectionLike[] =
    draftFromTemplate && draftFromTemplate.length > 0
      ? draftFromTemplate
      : input.layoutProfile.sectionCandidates.map((section, idx) => ({
          id: `layout_sec_${idx + 1}`,
          title: section.title,
          orderHint: section.order + 1,
        }));

  const matchResult = matchSections(templateSections, draftSections);
  const lowMatches = matchResult.matched.filter((item) => item.score < 0.65);
  const goodMatches = matchResult.matched.filter((item) => item.score >= 0.65);

  for (const match of goodMatches) {
    const tNorm = normalizeLabel(match.templateSection.title);
    const dNorm = normalizeLabel(match.draftSection.title);
    if (tNorm !== dNorm) {
      items.push({
        kind: "SECTION_RENAMED",
        severity: match.score >= driftConfig.titleSimilarityThreshold ? "low" : "medium",
        message: `섹션 제목 변경 감지: "${match.templateSection.title}" → "${match.draftSection.title}"`,
        reason:
          match.score >= driftConfig.titleSimilarityThreshold
            ? "섹션 제목은 다르지만 유사도가 높고 순서가 유사합니다."
            : "섹션 제목 유사도는 중간 수준이며 문서 구조 변화 가능성이 있습니다.",
        recommendedAction: "기존 섹션으로 유지할지 확인하세요.",
        ref: {
          sectionId: match.templateSection.id,
        },
        metrics: {
          matchScore: match.score,
          reason: match.reason,
        },
      });
    }
  }

  const removedSections = [
    ...matchResult.unmatchedTemplate,
    ...lowMatches.map((item) => item.templateSection),
  ];
  const addedSections = [
    ...matchResult.unmatchedDraft,
    ...lowMatches.map((item) => item.draftSection),
  ];

  for (const section of removedSections) {
    items.push({
      kind: "SECTION_REMOVED",
      severity: "medium",
      message: `템플릿 섹션 누락: "${section.title}"`,
      reason: "기존 템플릿의 섹션이 새 문서에서 탐지되지 않았습니다.",
      recommendedAction: "문서 구조 변경 여부를 확인하고 필요 시 새 버전으로 저장하세요.",
      ref: { sectionId: section.id },
    });
  }
  for (const section of addedSections) {
    items.push({
      kind: "SECTION_ADDED",
      severity: "medium",
      message: `새 섹션 감지: "${section.title}"`,
      reason: "기존 템플릿에 없는 섹션이 문서에서 새롭게 탐지되었습니다.",
      recommendedAction: "신규 섹션이 반복적으로 등장하면 템플릿 섹션으로 추가하세요.",
      ref: { sectionId: section.id },
    });
  }

  const draftTablesFromTemplate = (() => {
    if (
      !input.extractedTemplateDraft ||
      typeof input.extractedTemplateDraft !== "object"
    ) {
      return null;
    }
    const raw = input.extractedTemplateDraft as {
      tables?: Array<{ headerLabels?: string[]; name?: string }>;
    };
    if (!Array.isArray(raw.tables)) return null;
    return raw.tables.map((table, idx) => ({
      id: `draft_tbl_${idx + 1}`,
      headerLabels: Array.isArray(table.headerLabels) ? table.headerLabels : [],
      name: table.name ?? `표 ${idx + 1}`,
    }));
  })();
  const draftTables =
    draftTablesFromTemplate && draftTablesFromTemplate.length > 0
      ? draftTablesFromTemplate
      : input.layoutProfile.tableCandidates.map((table, idx) => ({
          id: `layout_tbl_${idx + 1}`,
          headerLabels: table.headerLabels ?? [],
          name: `표 ${idx + 1}`,
        }));
  const templateTables = input.templateSchema.tables;
  const tableCount = Math.min(templateTables.length, draftTables.length);
  for (let i = 0; i < tableCount; i += 1) {
    const t = templateTables[i]!;
    const d = draftTables[i]!;
    const headerMatch = matchTableHeaders(t.headerLabels, d.headerLabels);
    if (headerMatch.missingHeaders.length === 0 && headerMatch.addedHeaders.length === 0) {
      if (headerMatch.orderChanged) {
        items.push({
          kind: "TABLE_HEADER_CHANGED",
          severity: "low",
          message: `표 헤더 순서 변경: ${t.id}`,
          reason: "표 헤더 구성은 유사하지만 컬럼 순서가 변경되었습니다.",
          recommendedAction: "순서 변경만이라면 그대로 진행하고 미리보기 결과를 확인하세요.",
          ref: { tableId: t.id },
          metrics: {
            orderChanged: true,
          },
        });
      }
      continue;
    }

    const missingCount = headerMatch.missingHeaders.length;
    const addedCount = headerMatch.addedHeaders.length;
    const hasSemanticMatch = headerMatch.matchedHeaders.some(
      (m) => m.reason === "canonical" || m.reason === "fuzzy"
    );
    const severity =
      missingCount >= 2
        ? "high"
        : missingCount === 1
          ? "medium"
          : addedCount <= 1
            ? "low"
            : hasSemanticMatch
              ? "low"
              : "medium";
    items.push({
      kind: "TABLE_HEADER_CHANGED",
      severity,
      message: `표 헤더 변경 감지: ${t.id}`,
      reason: "표 헤더 이름 또는 순서가 변경되었습니다.",
      recommendedAction: "표 컬럼 구조를 검토하세요.",
      ref: { tableId: t.id },
      metrics: {
        missingHeaders: missingCount,
        addedHeaders: addedCount,
        orderChanged: headerMatch.orderChanged,
      },
    });
  }
  if (templateTables.length > draftTables.length) {
    for (let i = draftTables.length; i < templateTables.length; i += 1) {
      const table = templateTables[i]!;
      items.push({
        kind: "TABLE_REMOVED",
        severity: "medium",
        message: `템플릿 표 누락: ${table.id}`,
        reason: "기존 템플릿의 표가 새 문서에서 확인되지 않았습니다.",
        recommendedAction: "표가 삭제된 문서 유형인지 확인하고 필요 시 템플릿을 갱신하세요.",
        ref: { tableId: table.id },
      });
    }
  } else if (draftTables.length > templateTables.length) {
    for (let i = templateTables.length; i < draftTables.length; i += 1) {
      const table = draftTables[i]!;
      items.push({
        kind: "TABLE_ADDED",
        severity: "low",
        message: `새 표 감지: ${table.name}`,
        reason: "템플릿에 없던 추가 표가 문서에서 탐지되었습니다.",
        recommendedAction: "추가 표가 고정 구조라면 템플릿 표 정의에 반영하세요.",
        ref: { tableId: table.id },
      });
    }
  }

  const summary = {
    added: items.filter((item) => item.kind === "SECTION_ADDED" || item.kind === "TABLE_ADDED").length,
    removed: items.filter((item) => item.kind === "SECTION_REMOVED" || item.kind === "TABLE_REMOVED").length,
    modified: items.filter((item) => item.kind === "SECTION_RENAMED" || item.kind === "TABLE_HEADER_CHANGED").length,
    anchorsMissing: 0,
    layoutShifts: 0,
  };
  const weighted =
    (summary.modified + summary.added + summary.removed) * driftConfig.weights.sections +
    items.filter((item) => item.kind.startsWith("TABLE_")).length * driftConfig.weights.tables +
    summary.layoutShifts * driftConfig.weights.repeats +
    summary.anchorsMissing;
  const normalizationBase = Math.max(1, 10 * driftConfig.titleSimilarityThreshold);
  const score = Number(Math.max(0, Math.min(1, weighted / normalizationBase)).toFixed(2));
  const severity =
    score >= driftConfig.scoreThresholdHigh
      ? "high"
      : score >= driftConfig.scoreThresholdMedium
        ? "medium"
        : "low";

  return {
    templateId: input.templateSchema.templateId,
    version: input.templateSchema.version,
    docId: input.docId ?? "unknown",
    docType: input.docType ?? input.layoutProfile.docType,
    severity,
    score,
    items,
    summary,
  };
}
