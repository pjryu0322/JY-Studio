import { countSourceValidationFromStatuses } from "@/lib/source-validation-readiness";
import type {
  KnowledgeQualityIssueDraft,
  KnowledgeQualityRunResult,
  StructureCoverageRunResult,
  StructureCoverageDocumentInput,
  StructureQualityStatus,
} from "@/lib/structure-quality/structure-quality-types";

function clampScore(value: number): number {
  if (value < 0) return 0;
  if (value > 100) return 100;
  return Math.round(value);
}

export function runKnowledgeQuality(input: {
  documents: StructureCoverageDocumentInput[];
  structureCoverage: StructureCoverageRunResult;
}): KnowledgeQualityRunResult {
  const issues: KnowledgeQualityIssueDraft[] = [];
  const validation = countSourceValidationFromStatuses(
    input.documents.map((d) => d.validationStatus),
  );

  if (validation.failCount > 0) {
    issues.push({
      severity: "BLOCKER",
      code: "SOURCE_VALIDATION_FAIL",
      message: "검증에 실패(FAIL)한 원천 문서가 있습니다.",
      hint: "원천 문서 정합성 검증을 통과한 뒤 다시 평가하세요.",
    });
  }
  if (validation.notCheckedCount > 0) {
    issues.push({
      severity: "BLOCKER",
      code: "SOURCE_VALIDATION_NOT_CHECKED",
      message: "검증되지 않은(NOT_CHECKED) 원천 문서가 있습니다.",
    });
  }

  if (input.structureCoverage.status === "FAIL") {
    issues.push({
      severity: "BLOCKER",
      code: "STRUCTURE_COVERAGE_FAIL",
      message: input.structureCoverage.summary,
    });
  } else if (input.structureCoverage.status === "WARNING") {
    issues.push({
      severity: "WARNING",
      code: "STRUCTURE_COVERAGE_WARNING",
      message: input.structureCoverage.summary,
    });
  }

  const securityBlockers = input.documents.filter((d) => (d.blockingIssueCount ?? 0) > 0);
  if (securityBlockers.length > 0) {
    issues.push({
      severity: "BLOCKER",
      code: "SECURITY_BLOCKER_IN_SOURCE",
      message: "원천 검증에서 차단(BLOCKER) 이슈가 있는 문서가 있습니다.",
    });
  }

  const completenessScore = clampScore(input.structureCoverage.coverageScore);

  let consistencyScore = 100;
  const productVersions = new Set(
    input.documents.map((d) => d.productVersion?.trim()).filter((v): v is string => Boolean(v)),
  );
  if (productVersions.size > 1) {
    consistencyScore -= 20;
    issues.push({
      severity: "WARNING",
      code: "PRODUCT_VERSION_MISMATCH",
      message: "productVersion 값이 문서마다 다릅니다.",
    });
  }
  const checksums = input.documents
    .map((d) => d.checksum?.trim())
    .filter((c): c is string => Boolean(c));
  const checksumSet = new Set(checksums);
  if (checksumSet.size < checksums.length) {
    consistencyScore -= 15;
    issues.push({
      severity: "WARNING",
      code: "CHECKSUM_DUPLICATE_PACK",
      message: "동일 checksum을 가진 원천 문서가 있습니다.",
    });
  }
  consistencyScore = clampScore(consistencyScore);

  let sourceQualityScore = 100;
  sourceQualityScore -= validation.failCount * 40;
  sourceQualityScore -= validation.notCheckedCount * 30;
  sourceQualityScore -= validation.warningCount * 10;
  sourceQualityScore = clampScore(sourceQualityScore);

  let securityScore = securityBlockers.length > 0 ? 0 : 100;
  if (validation.warningCount > 0 && securityBlockers.length === 0) {
    securityScore = clampScore(securityScore - validation.warningCount * 5);
  }

  let freshnessScore = 100;
  const missingVersion = input.documents.filter((d) => !d.productVersion?.trim()).length;
  if (missingVersion > 0) {
    freshnessScore -= Math.min(30, missingVersion * 10);
    issues.push({
      severity: "WARNING",
      code: "PRODUCT_VERSION_MISSING",
      message: "productVersion이 없는 원천 문서가 있습니다.",
    });
  }
  freshnessScore = clampScore(freshnessScore);

  let usabilityScore = 100;
  const urlOnly = input.documents.filter(
    (d) => !d.content?.trim() && Boolean(d.sourceUrl?.trim()),
  ).length;
  if (urlOnly > 0) {
    usabilityScore -= Math.min(25, urlOnly * 10);
    issues.push({
      severity: "WARNING",
      code: "URL_ONLY_SOURCE",
      message: "원문 없이 URL만 있는 문서가 있습니다.",
    });
  }
  const shortContent = input.documents.filter((d) => (d.content?.trim().length ?? 0) < 40).length;
  if (shortContent > 0) {
    usabilityScore -= Math.min(20, shortContent * 5);
  }
  usabilityScore = clampScore(usabilityScore);

  const totalScore = clampScore(
    completenessScore * 0.3 +
      consistencyScore * 0.15 +
      sourceQualityScore * 0.2 +
      securityScore * 0.2 +
      freshnessScore * 0.075 +
      usabilityScore * 0.075,
  );

  const blockingIssueCount = issues.filter((i) => i.severity === "BLOCKER").length;
  const warningIssueCount = issues.filter((i) => i.severity === "WARNING").length;

  let status: StructureQualityStatus = "PASS";
  if (
    blockingIssueCount > 0 ||
    validation.failCount > 0 ||
    validation.notCheckedCount > 0 ||
    input.structureCoverage.status === "FAIL" ||
    totalScore < 70
  ) {
    status = "FAIL";
  } else if (
    totalScore < 85 ||
    input.structureCoverage.status === "WARNING" ||
    validation.warningCount > 0 ||
    warningIssueCount > 0
  ) {
    status = "WARNING";
  }

  let summary: string;
  if (status === "PASS") {
    summary = `지식 품질 점수 ${totalScore} — 제출·검수 기준을 충족합니다.`;
  } else if (status === "WARNING") {
    summary = `지식 품질 점수 ${totalScore} — 제출은 가능하나 개선을 권장합니다.`;
  } else {
    summary = `지식 품질 점수 ${totalScore} — FAIL 이슈를 해결한 뒤 다시 평가하세요.`;
  }

  return {
    status,
    totalScore,
    completenessScore,
    consistencyScore,
    sourceQualityScore,
    securityScore,
    freshnessScore,
    usabilityScore,
    blockingIssueCount,
    warningIssueCount,
    summary,
    issues,
  };
}
