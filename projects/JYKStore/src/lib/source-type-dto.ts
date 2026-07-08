import type { SourceFormat, SourceType, SourceValidationStatus } from "@prisma/client";

export type SourceTypeOption = {
  value: SourceType;
  label: string;
  description: string;
  recommendedFormats: SourceFormat[];
  requiredFields: string[];
  recommendedFields?: string[];
};

const SOURCE_FIELD_LABELS: Record<string, string> = {
  title: "제목",
  content: "원문",
  sourceUrl: "출처 URL",
  productVersion: "제품 버전",
};

export function formatSourceTypeFieldHints(option: SourceTypeOption): {
  requiredLabel: string;
  recommendedLabel: string | null;
} {
  const required = option.requiredFields
    .map((field) => SOURCE_FIELD_LABELS[field] ?? field)
    .join(", ");
  const recommended = (option.recommendedFields ?? [])
    .map((field) => SOURCE_FIELD_LABELS[field] ?? field)
    .join(", ");
  return {
    requiredLabel: required || "—",
    recommendedLabel: recommended.length > 0 ? recommended : null,
  };
}

export const SOURCE_TYPE_OPTIONS: readonly SourceTypeOption[] = [
  {
    value: "PRODUCT_MANUAL",
    label: "제품 매뉴얼",
    description: "제품 개요, 기능, 사용 방법을 설명하는 문서",
    recommendedFormats: ["PDF", "DOCX", "MARKDOWN", "TEXT"],
    requiredFields: ["title", "content"],
  },
  {
    value: "INTEGRATION_GUIDE",
    label: "연동 가이드",
    description: "외부 시스템 연동 절차, 인증, 흐름을 설명하는 문서",
    recommendedFormats: ["MARKDOWN", "HTML", "TEXT", "PDF"],
    requiredFields: ["title", "content"],
  },
  {
    value: "API_SPEC",
    label: "API 명세",
    description: "Endpoint, request, response, 인증 방식이 포함된 API 문서",
    recommendedFormats: ["OPENAPI_JSON", "OPENAPI_YAML", "JSON", "MARKDOWN", "TEXT"],
    requiredFields: ["title", "content"],
  },
  {
    value: "OPENAPI_SCHEMA",
    label: "OpenAPI 스키마",
    description: "OpenAPI 3.x 규격의 기계가 읽을 수 있는 API 스키마",
    recommendedFormats: ["OPENAPI_JSON", "OPENAPI_YAML", "JSON", "YAML"],
    requiredFields: ["title", "content"],
  },
  {
    value: "ERROR_CODE_TABLE",
    label: "오류코드표",
    description: "오류 코드, 원인, 조치 방법을 정리한 자료",
    recommendedFormats: ["CSV", "XLSX", "MARKDOWN", "TEXT"],
    requiredFields: ["title", "content"],
  },
  {
    value: "SAMPLE_CODE",
    label: "샘플 코드",
    description: "연동 예제 코드 또는 코드 조각",
    recommendedFormats: ["CODE", "TEXT", "MARKDOWN"],
    requiredFields: ["title", "content"],
    recommendedFields: ["productVersion"],
  },
  {
    value: "FAQ",
    label: "FAQ",
    description: "자주 묻는 질문과 답변 모음",
    recommendedFormats: ["MARKDOWN", "TEXT", "HTML"],
    requiredFields: ["title", "content"],
  },
  {
    value: "RELEASE_NOTE",
    label: "릴리스 노트",
    description: "버전별 변경 사항, 신규 기능, 버그 수정 내역",
    recommendedFormats: ["MARKDOWN", "TEXT", "HTML"],
    requiredFields: ["title", "content"],
  },
  {
    value: "SECURITY_GUIDE",
    label: "보안 가이드",
    description: "인증, 권한, 데이터 보호 등 보안 관련 설명 문서",
    recommendedFormats: ["MARKDOWN", "PDF", "TEXT"],
    requiredFields: ["title", "content"],
  },
  {
    value: "TEST_ENV_GUIDE",
    label: "테스트 환경 가이드",
    description: "테스트/샌드박스 환경 접속, 계정, 설정 방법",
    recommendedFormats: ["MARKDOWN", "TEXT", "HTML"],
    requiredFields: ["title", "content"],
  },
  {
    value: "OPERATION_GUIDE",
    label: "운영 가이드",
    description: "배포, 모니터링, 장애 대응 등 운영 절차 문서",
    recommendedFormats: ["MARKDOWN", "PDF", "TEXT"],
    requiredFields: ["title", "content"],
  },
  {
    value: "CALLBACK_GUIDE",
    label: "콜백 가이드",
    description: "callback payload, 검증, retry 정책을 설명하는 문서",
    recommendedFormats: ["MARKDOWN", "JSON", "TEXT"],
    requiredFields: ["title", "content"],
  },
  {
    value: "TROUBLESHOOTING",
    label: "트러블슈팅",
    description: "문제 증상, 원인 분석, 해결 방법을 정리한 자료",
    recommendedFormats: ["MARKDOWN", "TEXT", "HTML"],
    requiredFields: ["title", "content"],
  },
  {
    value: "ETC",
    label: "기타",
    description: "위 유형에 해당하지 않는 기타 자료",
    recommendedFormats: ["TEXT", "MARKDOWN"],
    requiredFields: ["title"],
  },
] as const;

export type SourceFormatOption = {
  value: SourceFormat;
  label: string;
};

export const SOURCE_FORMAT_OPTIONS: readonly SourceFormatOption[] = [
  { value: "TEXT", label: "일반 텍스트" },
  { value: "MARKDOWN", label: "Markdown" },
  { value: "HTML", label: "HTML" },
  { value: "PDF", label: "PDF" },
  { value: "DOCX", label: "Word (DOCX)" },
  { value: "XLSX", label: "Excel (XLSX)" },
  { value: "CSV", label: "CSV" },
  { value: "JSON", label: "JSON" },
  { value: "YAML", label: "YAML" },
  { value: "OPENAPI_JSON", label: "OpenAPI (JSON)" },
  { value: "OPENAPI_YAML", label: "OpenAPI (YAML)" },
  { value: "CODE", label: "소스 코드" },
  { value: "URL", label: "URL 링크" },
  { value: "ETC", label: "기타" },
] as const;

const SOURCE_TYPE_VALUES = new Set<string>(SOURCE_TYPE_OPTIONS.map((o) => o.value));
const SOURCE_FORMAT_VALUES = new Set<string>(SOURCE_FORMAT_OPTIONS.map((o) => o.value));

export function isSourceType(value: string): value is SourceType {
  return SOURCE_TYPE_VALUES.has(value);
}

export function isSourceFormat(value: string): value is SourceFormat {
  return SOURCE_FORMAT_VALUES.has(value);
}

export function getSourceTypeLabel(value: string): string {
  return SOURCE_TYPE_OPTIONS.find((o) => o.value === value)?.label ?? value;
}

export function getSourceFormatLabel(value: string): string {
  return SOURCE_FORMAT_OPTIONS.find((o) => o.value === value)?.label ?? value;
}

export const SOURCE_VALIDATION_LABELS: Record<SourceValidationStatus, string> = {
  NOT_CHECKED: "미검사",
  PASS: "통과",
  WARNING: "주의",
  FAIL: "실패",
};

export type SourceValidationInput = {
  title: string;
  sourceType: SourceType;
  sourceFormat: SourceFormat;
  content?: string | null;
  sourceUrl?: string | null;
  productVersion?: string | null;
};

export type SourceValidationResult = {
  status: SourceValidationStatus;
  summary: string;
  warnings: string[];
};

const OPENAPI_FORMATS = new Set<SourceFormat>(["OPENAPI_JSON", "OPENAPI_YAML", "JSON", "YAML"]);
const ERROR_TABLE_FORMATS = new Set<SourceFormat>(["CSV", "XLSX", "MARKDOWN", "TEXT"]);

/**
 * Deterministic P16-level source document validation.
 * FAIL blocks registration; WARNING is informational only.
 */
export function evaluateSourceValidation(input: SourceValidationInput): SourceValidationResult {
  const title = input.title.trim();
  const content = input.content?.trim() ?? "";
  const sourceUrl = input.sourceUrl?.trim() ?? "";
  const productVersion = input.productVersion?.trim() ?? "";
  const failures: string[] = [];
  const warnings: string[] = [];

  if (!title) {
    failures.push("제목(title)이 필요합니다.");
  }
  if (!input.sourceType) {
    failures.push("자료 유형(sourceType)이 필요합니다.");
  }
  if (!content && !sourceUrl) {
    failures.push("원문(content) 또는 출처 URL(sourceUrl) 중 하나는 필요합니다.");
  }

  if (failures.length > 0) {
    return { status: "FAIL", summary: failures.join(" "), warnings };
  }

  if (input.sourceType === "SAMPLE_CODE" && !productVersion) {
    warnings.push("샘플 코드는 productVersion 입력을 권장합니다.");
  }
  if (input.sourceType === "OPENAPI_SCHEMA" && !OPENAPI_FORMATS.has(input.sourceFormat)) {
    warnings.push("OpenAPI 스키마는 OPENAPI_JSON/OPENAPI_YAML/JSON/YAML 형식을 권장합니다.");
  }
  if (input.sourceType === "ERROR_CODE_TABLE" && !ERROR_TABLE_FORMATS.has(input.sourceFormat)) {
    warnings.push("오류코드표는 CSV/XLSX/MARKDOWN/TEXT 형식을 권장합니다.");
  }

  if (warnings.length > 0) {
    return { status: "WARNING", summary: warnings.join(" "), warnings };
  }

  return { status: "PASS", summary: "필수값을 충족했습니다.", warnings };
}
