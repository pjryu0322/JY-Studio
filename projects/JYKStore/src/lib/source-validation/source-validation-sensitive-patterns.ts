import type { ValidationIssueDraft } from "@/lib/source-validation/source-validation-types";

const BLOCKER_PATTERNS: { code: string; pattern: RegExp; message: string }[] = [
  {
    code: "SENSITIVE_SECRET_DETECTED",
    pattern: /BEGIN\s+PRIVATE\s+KEY/i,
    message: "PRIVATE KEY 블록이 감지되었습니다. 공개 지식팩에 포함할 수 없습니다.",
  },
  {
    code: "SENSITIVE_SECRET_DETECTED",
    pattern: /\bapi_key\s*=/i,
    message: "api_key= 형태의 비밀 값이 감지되었습니다. 검토가 필요합니다.",
  },
  {
    code: "SENSITIVE_SECRET_DETECTED",
    pattern: /\bapiKey\s*:\s*["'][^"']{4,}["']/i,
    message: "apiKey에 실제 값이 할당된 형태가 감지되었습니다. 검토가 필요합니다.",
  },
  {
    code: "SENSITIVE_SECRET_DETECTED",
    pattern: /\bsecret\s*=/i,
    message: "secret= 형태의 비밀 값이 감지되었습니다. 검토가 필요합니다.",
  },
  {
    code: "SENSITIVE_SECRET_DETECTED",
    pattern: /\bclient_secret\s*=\s*\S+/i,
    message: "client_secret에 실제 값이 할당된 형태가 감지되었습니다. 검토가 필요합니다.",
  },
  {
    code: "SENSITIVE_SECRET_DETECTED",
    pattern: /\baccess_token\s*[:=]\s*["']?[^\s"']{8,}/i,
    message: "access_token에 실제 값이 할당된 형태가 감지되었습니다. 검토가 필요합니다.",
  },
  {
    code: "SENSITIVE_SECRET_DETECTED",
    pattern: /\brefresh_token\s*=\s*["']?[^\s"']+/i,
    message: "refresh_token에 실제 값이 할당된 형태가 감지되었습니다. 검토가 필요합니다.",
  },
  {
    code: "SENSITIVE_SECRET_DETECTED",
    pattern: /Authorization:\s*Bearer\s+\S{20,}/i,
    message: "Authorization Bearer 토큰으로 보이는 문자열이 감지되었습니다.",
  },
  {
    code: "SENSITIVE_SECRET_DETECTED",
    pattern: /\bpassword\s*=/i,
    message: "password= 형태의 비밀 값이 감지되었습니다. 검토가 필요합니다.",
  },
  {
    code: "SENSITIVE_SECRET_DETECTED",
    pattern: /\bpasswd\s*=/i,
    message: "passwd= 형태의 비밀 값이 감지되었습니다. 검토가 필요합니다.",
  },
];

const OAUTH_FIELD_DOC_WARNING: {
  fieldPattern: RegExp;
  valuePattern: RegExp;
  message: string;
}[] = [
  {
    fieldPattern: /\bclient_secret\b/i,
    valuePattern: /\bclient_secret\s*=\s*\S+/i,
    message: "client_secret 필드명이 언급되었습니다. 실제 비밀 값이 포함되지 않았는지 확인하세요.",
  },
  {
    fieldPattern: /\baccess_token\b/i,
    valuePattern: /\baccess_token\s*[:=]\s*["']?[^\s"']{8,}/i,
    message: "access_token 필드명이 언급되었습니다. 실제 토큰 값이 포함되지 않았는지 확인하세요.",
  },
  {
    fieldPattern: /\brefresh_token\b/i,
    valuePattern: /\brefresh_token\s*=\s*["']?[^\s"']+/i,
    message: "refresh_token 필드명이 언급되었습니다. 실제 토큰 값이 포함되지 않았는지 확인하세요.",
  },
];

const WARNING_PATTERNS: { code: string; pattern: RegExp; message: string }[] = [
  {
    code: "POTENTIAL_PERSONAL_DATA",
    pattern: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/,
    message: "이메일 주소로 보이는 문자열이 포함되어 있습니다. 검토가 필요합니다.",
  },
  {
    code: "POTENTIAL_PERSONAL_DATA",
    pattern: /\b01[016789]-?\d{3,4}-?\d{4}\b/,
    message: "전화번호로 보이는 패턴이 포함되어 있습니다. 검토가 필요합니다.",
  },
  {
    code: "POTENTIAL_PERSONAL_DATA",
    pattern: /\b\d{6}-?\d{7}\b/,
    message: "개인식별번호로 보이는 패턴이 포함되어 있습니다. 검토가 필요합니다.",
  },
  {
    code: "POTENTIAL_PERSONAL_DATA",
    pattern: /(테스트\s*계정|test\s+account|sandbox\s+account)/i,
    message: "테스트 계정 관련 문구가 포함되어 있습니다. 검토가 필요합니다.",
  },
];

function pushUnique(
  issues: ValidationIssueDraft[],
  seen: Set<string>,
  issue: ValidationIssueDraft,
) {
  const key = `${issue.code}:${issue.severity}:${issue.message}`;
  if (seen.has(key)) return;
  seen.add(key);
  issues.push(issue);
}

export function scanSensitivePatterns(text: string): ValidationIssueDraft[] {
  const issues: ValidationIssueDraft[] = [];
  const seen = new Set<string>();

  for (const rule of BLOCKER_PATTERNS) {
    if (rule.pattern.test(text)) {
      pushUnique(issues, seen, {
        severity: "BLOCKER",
        code: rule.code,
        message: rule.message,
        hint: "민감정보 제거 후 재등록하거나 비공개 필드로 관리하세요.",
      });
    }
  }

  for (const rule of OAUTH_FIELD_DOC_WARNING) {
    if (rule.fieldPattern.test(text) && !rule.valuePattern.test(text)) {
      pushUnique(issues, seen, {
        severity: "WARNING",
        code: "OAUTH_FIELD_NAME_MENTION",
        message: rule.message,
        hint: "API 문서의 필드 설명만 포함된 경우 일반적으로 허용됩니다. 실제 값은 제거하세요.",
      });
    }
  }

  for (const rule of WARNING_PATTERNS) {
    if (rule.pattern.test(text)) {
      pushUnique(issues, seen, {
        severity: "WARNING",
        code: rule.code,
        message: rule.message,
        hint: "공개 지식팩에 개인정보가 포함되지 않았는지 확인하세요.",
      });
    }
  }

  return issues;
}
