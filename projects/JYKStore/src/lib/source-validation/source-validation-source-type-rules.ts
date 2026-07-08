import type { SourceFormat, SourceType } from "@prisma/client";
import type { ValidationIssueDraft } from "@/lib/source-validation/source-validation-types";

function hasAny(text: string, patterns: RegExp[]): boolean {
  return patterns.some((p) => p.test(text));
}

function warn(code: string, message: string, field?: string): ValidationIssueDraft {
  return { severity: "WARNING", code, message, field };
}

function block(code: string, message: string, field?: string): ValidationIssueDraft {
  return { severity: "BLOCKER", code, message, field };
}

export function validateBySourceType(input: {
  sourceType: SourceType;
  sourceFormat: SourceFormat;
  content: string;
  productVersion?: string | null;
}): ValidationIssueDraft[] {
  const text = input.content;
  const issues: ValidationIssueDraft[] = [];
  const lower = text.toLowerCase();

  switch (input.sourceType) {
    case "API_SPEC": {
      if (!hasAny(lower, [/endpoint/i, /path/i, /\/api\//])) {
        issues.push(warn("API_SPEC_ENDPOINT_HINT", "API endpoint 관련 단서가 부족합니다."));
      }
      if (!hasAny(lower, [/method/i, /\bget\b/, /\bpost\b/, /\bput\b/, /\bdelete\b/])) {
        issues.push(warn("API_SPEC_METHOD_HINT", "HTTP method 관련 단서가 부족합니다."));
      }
      if (!hasAny(lower, [/request/i, /response/i, /요청/, /응답/])) {
        issues.push(warn("API_SPEC_REQUEST_RESPONSE_HINT", "request/response 설명이 부족합니다."));
      }
      if (!hasAny(lower, [/auth/i, /authorization/i, /인증/, /bearer/i])) {
        issues.push(warn("API_SPEC_AUTH_HINT", "인증(auth) 관련 설명이 부족합니다."));
      }
      break;
    }
    case "OPENAPI_SCHEMA": {
      if (input.sourceFormat === "OPENAPI_JSON" || input.sourceFormat === "JSON") {
        try {
          const parsed = JSON.parse(text) as Record<string, unknown>;
          if (!("openapi" in parsed) && !("swagger" in parsed)) {
            issues.push(warn("OPENAPI_KEY_MISSING", "openapi 또는 swagger 키가 없습니다."));
          }
          if (!("paths" in parsed)) {
            issues.push(warn("OPENAPI_PATHS_MISSING", "paths 키가 없습니다."));
          }
        } catch {
          issues.push(block("OPENAPI_JSON_PARSE_FAIL", "OpenAPI JSON 파싱에 실패했습니다.", "content"));
        }
      } else if (input.sourceFormat === "OPENAPI_YAML" || input.sourceFormat === "YAML") {
        if (!hasAny(lower, [/openapi:/, /swagger:/])) {
          issues.push(warn("OPENAPI_YAML_HEURISTIC", "YAML 본문에서 openapi/swagger 단서가 없습니다."));
        }
        if (!hasAny(lower, [/paths:/])) {
          issues.push(warn("OPENAPI_PATHS_MISSING", "paths 단서가 없습니다."));
        }
      }
      break;
    }
    case "ERROR_CODE_TABLE": {
      if (!hasAny(text, [/\bE\d{2,}\b/i, /\bERR[_-]?\d+/i, /\b[45]\d{2}\b/])) {
        issues.push(warn("ERROR_CODE_PATTERN_MISSING", "오류 코드 패턴이 감지되지 않았습니다."));
      }
      if (!hasAny(lower, [/cause/i, /reason/i, /action/i, /message/i, /원인/, /조치/, /해결/])) {
        issues.push(warn("ERROR_CODE_ACTION_HINT", "원인/조치 관련 설명이 부족합니다."));
      }
      break;
    }
    case "CALLBACK_GUIDE": {
      if (!hasAny(lower, [/callback/i, /webhook/i, /callbackurl/i])) {
        issues.push(warn("CALLBACK_TOPIC_HINT", "callback/webhook 관련 단서가 부족합니다."));
      }
      if (!hasAny(lower, [/payload/i, /body/i])) {
        issues.push(warn("CALLBACK_PAYLOAD_HINT", "payload/body 설명이 부족합니다."));
      }
      if (!hasAny(lower, [/signature/i, /verify/i, /security/i, /서명/, /검증/])) {
        issues.push(warn("CALLBACK_SECURITY_HINT", "서명/검증 관련 설명이 부족합니다."));
      }
      if (!hasAny(lower, [/retry/i, /timeout/i, /재시도/])) {
        issues.push(warn("CALLBACK_RETRY_HINT", "retry/timeout 정책 단서가 부족합니다."));
      }
      break;
    }
    case "SAMPLE_CODE": {
      if (
        input.sourceFormat !== "CODE" &&
        !hasAny(text, [/[{};]/, /function\s+/, /const\s+/, /class\s+/, /import\s+/])
      ) {
        issues.push(warn("SAMPLE_CODE_FORMAT_HINT", "코드 형식 단서가 부족합니다."));
      }
      if (!input.productVersion?.trim()) {
        issues.push(warn("SAMPLE_CODE_PRODUCT_VERSION", "productVersion 입력을 권장합니다.", "productVersion"));
      }
      if (!hasAny(lower, [/java/i, /python/i, /node/i, /kotlin/i, /spring/i, /javascript/i, /typescript/i])) {
        issues.push(warn("SAMPLE_CODE_LANGUAGE_HINT", "언어/프레임워크 단서가 부족합니다."));
      }
      break;
    }
    case "TEST_ENV_GUIDE": {
      if (!hasAny(lower, [/test/i, /sandbox/i, /staging/i, /테스트/, /샌드박스/])) {
        issues.push(warn("TEST_ENV_HINT", "테스트/샌드박스 환경 단서가 부족합니다."));
      }
      if (!hasAny(lower, [/production/i, /운영/, /prod/i])) {
        issues.push(warn("TEST_ENV_PROD_HINT", "운영 환경과의 구분 설명이 부족합니다."));
      }
      break;
    }
    case "SECURITY_GUIDE": {
      if (!hasAny(lower, [/auth/i, /encrypt/i, /signature/i, /token/i, /권한/, /암호화/, /서명/])) {
        issues.push(warn("SECURITY_GUIDE_TOPIC_HINT", "보안/인증 관련 단서가 부족합니다."));
      }
      break;
    }
    case "RELEASE_NOTE": {
      if (!hasAny(lower, [/version/i, /date/i, /change/i, /fix/i, /add/i, /remove/i, /버전/, /변경/, /수정/])) {
        issues.push(warn("RELEASE_NOTE_STRUCTURE_HINT", "릴리스 노트 구조 단서가 부족합니다."));
      }
      break;
    }
    case "FAQ": {
      if (!hasAny(text, [/\bQ:/i, /\bA:/i, /질문/, /답변/, /\bFAQ\b/i])) {
        issues.push(warn("FAQ_STRUCTURE_HINT", "질문/답변 구조 단서가 부족합니다."));
      }
      break;
    }
    case "PRODUCT_MANUAL":
    case "INTEGRATION_GUIDE":
    case "OPERATION_GUIDE":
    case "TROUBLESHOOTING": {
      if (text.length < 80) {
        issues.push(warn("GUIDE_CONTENT_SHORT", "본문 길이가 짧아 품질이 부족할 수 있습니다."));
      }
      const topicPatterns: Record<string, RegExp[]> = {
        PRODUCT_MANUAL: [/사용/, /기능/, /설명/, /guide/i, /manual/i],
        INTEGRATION_GUIDE: [/연동/, /integration/i, /흐름/, /인증/],
        OPERATION_GUIDE: [/운영/, /배포/, /모니터/, /operation/i],
        TROUBLESHOOTING: [/장애/, /문제/, /해결/, /troubleshoot/i, /error/i],
      };
      const patterns = topicPatterns[input.sourceType] ?? [];
      if (patterns.length > 0 && !hasAny(lower, patterns)) {
        issues.push(warn("GUIDE_TOPIC_HINT", "자료 유형에 맞는 주제 단서가 부족합니다."));
      }
      break;
    }
    default:
      break;
  }

  return issues;
}
