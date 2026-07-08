import type {
  StructureCoverageDocumentInput,
  StructureCoverageRunResult,
  StructureQualityStatus,
  StructureSectionInput,
} from "@/lib/structure-quality/structure-quality-types";

function isEligibleForCoverage(doc: StructureCoverageDocumentInput): boolean {
  return doc.validationStatus !== "FAIL" && doc.validationStatus !== "NOT_CHECKED";
}

function docMatchesSection(
  doc: StructureCoverageDocumentInput,
  section: StructureSectionInput,
): { match: boolean; signals: string[] } {
  if (!isEligibleForCoverage(doc)) {
    return { match: false, signals: [] };
  }

  const signals: string[] = [];
  if (section.sourceTypes.includes(doc.sourceType)) {
    signals.push(`sourceType:${doc.sourceType}`);
  }

  const text = [doc.title, doc.content ?? "", doc.sourceUrl ?? ""].join("\n").toLowerCase();
  for (const keyword of section.keywords) {
    if (text.includes(keyword.toLowerCase())) {
      signals.push(`keyword:${keyword}`);
    }
  }

  if (signals.length === 0) {
    return { match: false, signals: [] };
  }

  if (doc.validationStatus === "WARNING") {
    signals.push("source_validation_warning");
  }

  return { match: true, signals };
}

function coverageStatusFromScore(score: number, hasEligibleDocs: boolean): StructureQualityStatus {
  if (!hasEligibleDocs) {
    return "FAIL";
  }
  if (score >= 90) return "PASS";
  if (score >= 70) return "WARNING";
  return "FAIL";
}

export function runStructureCoverage(input: {
  templateKey: string;
  sections: StructureSectionInput[];
  documents: StructureCoverageDocumentInput[];
}): StructureCoverageRunResult {
  const eligibleDocs = input.documents.filter(isEligibleForCoverage);
  const items = input.sections.map((section) => {
    const matchedDocIds: string[] = [];
    const matchedSignals: string[] = [];

    for (const doc of input.documents) {
      const result = docMatchesSection(doc, section);
      if (result.match) {
        matchedDocIds.push(doc.id);
        for (const signal of result.signals) {
          if (!matchedSignals.includes(signal)) {
            matchedSignals.push(signal);
          }
        }
      }
    }

    const covered = matchedDocIds.length > 0;
    const score = covered ? section.weight : 0;
    let message: string;
    if (covered) {
      message = `섹션 '${section.title}'이(가) ${matchedDocIds.length}개 원천 문서로 충족되었습니다.`;
    } else if (section.required) {
      message = `필수 섹션 '${section.title}'에 해당하는 원천 자료가 없습니다.`;
    } else {
      message = `선택 섹션 '${section.title}'이(가) 비어 있습니다.`;
    }

    return {
      sectionKey: section.sectionKey,
      title: section.title,
      required: section.required,
      covered,
      score,
      matchedDocIds,
      matchedSignals,
      message,
    };
  });

  const requiredItems = items.filter((i) => i.required);
  const optionalItems = items.filter((i) => !i.required);
  const totalRequiredWeight = requiredItems.reduce((sum, i) => {
    const section = input.sections.find((s) => s.sectionKey === i.sectionKey);
    return sum + (section?.weight ?? 10);
  }, 0);
  const coveredRequiredWeight = requiredItems
    .filter((i) => i.covered)
    .reduce((sum, i) => {
      const section = input.sections.find((s) => s.sectionKey === i.sectionKey);
      return sum + (section?.weight ?? 10);
    }, 0);

  const coverageScore =
    totalRequiredWeight > 0
      ? Math.round((coveredRequiredWeight / totalRequiredWeight) * 100)
      : eligibleDocs.length > 0
        ? 100
        : 0;

  const coveredRequiredCount = requiredItems.filter((i) => i.covered).length;
  const missingRequiredCount = requiredItems.length - coveredRequiredCount;
  const coveredOptionalCount = optionalItems.filter((i) => i.covered).length;

  const status = coverageStatusFromScore(coverageScore, eligibleDocs.length > 0);

  let summary: string;
  if (status === "PASS") {
    summary = `구조 커버리지 ${coverageScore}% — 필수 섹션을 충족했습니다.`;
  } else if (status === "WARNING") {
    summary = `구조 커버리지 ${coverageScore}% — 일부 필수 섹션이 부족합니다(누락 ${missingRequiredCount}개).`;
  } else {
    summary = `구조 커버리지 ${coverageScore}% — 필수 섹션 충족이 부족합니다(누락 ${missingRequiredCount}개).`;
  }

  return {
    templateKey: input.templateKey,
    status,
    coverageScore,
    requiredSectionCount: requiredItems.length,
    coveredRequiredCount,
    missingRequiredCount,
    optionalSectionCount: optionalItems.length,
    coveredOptionalCount,
    summary,
    items,
  };
}
