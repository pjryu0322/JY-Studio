import type { SourceValidationStatus } from "@prisma/client";
import { scanSensitivePatterns } from "@/lib/source-validation/source-validation-sensitive-patterns";
import { validateBySourceType } from "@/lib/source-validation/source-validation-source-type-rules";
import type {
  SourceValidationContext,
  SourceValidationDocumentInput,
  SourceValidationRunResult,
  ValidationIssueDraft,
} from "@/lib/source-validation/source-validation-types";

const MIN_CONTENT_LENGTH = 20;

function isValidHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export function aggregateValidationResult(issues: ValidationIssueDraft[]): Omit<
  SourceValidationRunResult,
  "issues"
> & { issues: ValidationIssueDraft[] } {
  const blockingIssueCount = issues.filter((i) => i.severity === "BLOCKER").length;
  const warningIssueCount = issues.filter((i) => i.severity === "WARNING").length;
  const issueCount = issues.length;

  let score = 100;
  score -= blockingIssueCount * 40;
  score -= warningIssueCount * 10;
  if (score < 0) score = 0;
  if (score > 100) score = 100;

  let status: SourceValidationStatus = "PASS";
  if (blockingIssueCount > 0) {
    status = "FAIL";
  } else if (warningIssueCount > 0) {
    status = "WARNING";
  }

  let summary: string;
  if (status === "PASS") {
    summary = "기본 정합성 검증을 통과했습니다.";
  } else if (status === "WARNING") {
    const samples = issues
      .filter((i) => i.severity === "WARNING")
      .slice(0, 2)
      .map((i) => i.message);
    summary = `주의 ${warningIssueCount}건: ${samples.join(" ")}`;
  } else {
    const sample = issues.find((i) => i.severity === "BLOCKER");
    summary = `차단 이슈 ${blockingIssueCount}건: ${sample?.message ?? "검증에 실패했습니다."}`;
  }

  return {
    status,
    score,
    summary,
    issues,
    issueCount,
    blockingIssueCount,
    warningIssueCount,
  };
}

export function validateSourceDocumentContent(
  doc: SourceValidationDocumentInput,
  context?: SourceValidationContext,
): SourceValidationRunResult {
  const issues: ValidationIssueDraft[] = [];
  const title = doc.title.trim();
  const content = doc.content?.trim() ?? "";
  const sourceUrl = doc.sourceUrl?.trim() ?? "";
  const combinedText = [title, content, sourceUrl].filter(Boolean).join("\n");

  if (!title) {
    issues.push({
      severity: "BLOCKER",
      code: "TITLE_REQUIRED",
      message: "제목(title)이 필요합니다.",
      field: "title",
    });
  }
  if (!doc.sourceType) {
    issues.push({
      severity: "BLOCKER",
      code: "SOURCE_TYPE_REQUIRED",
      message: "자료 유형(sourceType)이 필요합니다.",
      field: "sourceType",
    });
  }
  if (!doc.sourceFormat) {
    issues.push({
      severity: "BLOCKER",
      code: "SOURCE_FORMAT_REQUIRED",
      message: "자료 형식(sourceFormat)이 필요합니다.",
      field: "sourceFormat",
    });
  }
  if (!content && !sourceUrl) {
    issues.push({
      severity: "BLOCKER",
      code: "CONTENT_OR_URL_REQUIRED",
      message: "원문(content) 또는 출처 URL(sourceUrl) 중 하나는 필요합니다.",
    });
  }
  if (sourceUrl && !isValidHttpUrl(sourceUrl)) {
    issues.push({
      severity: "BLOCKER",
      code: "SOURCE_URL_INVALID",
      message: "sourceUrl 형식이 올바르지 않습니다. http/https URL을 입력해 주세요.",
      field: "sourceUrl",
    });
  }
  if (content && content.length < MIN_CONTENT_LENGTH) {
    issues.push({
      severity: "WARNING",
      code: "CONTENT_TOO_SHORT",
      message: "원문이 짧아 품질이 부족할 수 있습니다.",
      field: "content",
    });
  }

  const checksum = doc.checksum?.trim();
  if (checksum && context?.siblingChecksums?.includes(checksum)) {
    issues.push({
      severity: "WARNING",
      code: "CHECKSUM_DUPLICATE",
      message: "동일 pack/version 내 checksum 중복이 감지되었습니다.",
      field: "checksum",
    });
  }

  if (doc.sourceType === "ETC") {
    issues.push({
      severity: "WARNING",
      code: "ONLY_ETC_TYPE",
      message: "자료 유형이 ETC입니다. 구체적인 유형 분류를 권장합니다.",
      field: "sourceType",
    });
  }

  if (combinedText) {
    issues.push(...scanSensitivePatterns(combinedText));
  }

  if (content) {
    issues.push(
      ...validateBySourceType({
        sourceType: doc.sourceType,
        sourceFormat: doc.sourceFormat,
        content,
        productVersion: doc.productVersion,
      }),
    );
  }

  return aggregateValidationResult(issues);
}
