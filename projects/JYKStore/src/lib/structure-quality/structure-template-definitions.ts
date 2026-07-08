export const STRUCTURE_TEMPLATE_KEYS = {
  AUTH_INTEGRATION: "AUTH_INTEGRATION",
  GENERIC_PRODUCT: "GENERIC_PRODUCT",
} as const;

export type StructureTemplateKey =
  (typeof STRUCTURE_TEMPLATE_KEYS)[keyof typeof STRUCTURE_TEMPLATE_KEYS];

export type StructureSectionDefinition = {
  sectionKey: string;
  title: string;
  description: string;
  required: boolean;
  weight: number;
  sourceTypes: string[];
  keywords: string[];
  sortOrder: number;
};

export type StructureTemplateDefinition = {
  templateKey: StructureTemplateKey;
  name: string;
  description: string;
  sections: StructureSectionDefinition[];
};

export const STRUCTURE_TEMPLATE_DEFINITIONS: StructureTemplateDefinition[] = [
  {
    templateKey: STRUCTURE_TEMPLATE_KEYS.AUTH_INTEGRATION,
    name: "인증/간편인증 연동",
    description: "간편인증·OAuth 연동 지식팩 기본 구조",
    sections: [
      {
        sectionKey: "AUTH_OVERVIEW",
        title: "제품/인증 개요",
        description: "서비스 및 인증 흐름 개요",
        required: true,
        weight: 10,
        sourceTypes: ["PRODUCT_MANUAL", "INTEGRATION_GUIDE"],
        keywords: ["overview", "개요", "인증", "로그인"],
        sortOrder: 0,
      },
      {
        sectionKey: "AUTH_REQUEST",
        title: "인증 요청",
        description: "인증 요청 API/절차",
        required: true,
        weight: 10,
        sourceTypes: ["API_SPEC", "INTEGRATION_GUIDE"],
        keywords: ["request", "요청", "인증요청", "endpoint"],
        sortOrder: 1,
      },
      {
        sectionKey: "AUTH_RESULT_CHECK",
        title: "인증 결과 확인",
        description: "인증 결과 조회",
        required: true,
        weight: 10,
        sourceTypes: ["API_SPEC", "INTEGRATION_GUIDE"],
        keywords: ["result", "결과", "확인", "status"],
        sortOrder: 2,
      },
      {
        sectionKey: "CALLBACK_HANDLING",
        title: "Callback 처리",
        description: "콜백/webhook 처리",
        required: true,
        weight: 10,
        sourceTypes: ["CALLBACK_GUIDE", "API_SPEC"],
        keywords: ["callback", "webhook", "payload"],
        sortOrder: 3,
      },
      {
        sectionKey: "ERROR_CODES",
        title: "오류코드",
        description: "오류 코드 및 조치",
        required: true,
        weight: 10,
        sourceTypes: ["ERROR_CODE_TABLE", "TROUBLESHOOTING"],
        keywords: ["error", "code", "오류", "조치"],
        sortOrder: 4,
      },
      {
        sectionKey: "TEST_ENVIRONMENT",
        title: "테스트 환경",
        description: "샌드박스/테스트 환경",
        required: true,
        weight: 10,
        sourceTypes: ["TEST_ENV_GUIDE"],
        keywords: ["sandbox", "test", "테스트"],
        sortOrder: 5,
      },
      {
        sectionKey: "PRODUCTION_ENVIRONMENT",
        title: "운영 환경",
        description: "운영 환경 구분",
        required: true,
        weight: 10,
        sourceTypes: ["OPERATION_GUIDE", "TEST_ENV_GUIDE"],
        keywords: ["production", "운영", "prod"],
        sortOrder: 6,
      },
      {
        sectionKey: "SAMPLE_CODE",
        title: "샘플 코드",
        description: "연동 샘플",
        required: true,
        weight: 10,
        sourceTypes: ["SAMPLE_CODE"],
        keywords: ["java", "spring", "sample", "예제"],
        sortOrder: 7,
      },
      {
        sectionKey: "SECURITY_NOTES",
        title: "보안 주의사항",
        description: "토큰/서명 등 보안",
        required: true,
        weight: 10,
        sourceTypes: ["SECURITY_GUIDE", "INTEGRATION_GUIDE"],
        keywords: ["security", "token", "signature", "서명"],
        sortOrder: 8,
      },
      {
        sectionKey: "TROUBLESHOOTING",
        title: "장애 대응",
        description: "장애/재시도",
        required: false,
        weight: 5,
        sourceTypes: ["TROUBLESHOOTING", "FAQ"],
        keywords: ["장애", "문제", "해결", "retry"],
        sortOrder: 9,
      },
      {
        sectionKey: "VERSION_CHANGELOG",
        title: "버전/변경 이력",
        description: "릴리스 노트",
        required: false,
        weight: 5,
        sourceTypes: ["RELEASE_NOTE"],
        keywords: ["version", "changelog", "변경"],
        sortOrder: 10,
      },
    ],
  },
  {
    templateKey: STRUCTURE_TEMPLATE_KEYS.GENERIC_PRODUCT,
    name: "범용 제품 지식",
    description: "일반 제품지식팩 기본 구조",
    sections: [
      {
        sectionKey: "PRODUCT_OVERVIEW",
        title: "제품 개요",
        description: "제품 소개",
        required: true,
        weight: 10,
        sourceTypes: ["PRODUCT_MANUAL", "INTEGRATION_GUIDE"],
        keywords: ["overview", "개요", "소개", "product"],
        sortOrder: 0,
      },
      {
        sectionKey: "INSTALLATION_OR_SETUP",
        title: "설치/설정",
        description: "설치 및 초기 설정",
        required: true,
        weight: 10,
        sourceTypes: ["PRODUCT_MANUAL", "INTEGRATION_GUIDE", "OPERATION_GUIDE"],
        keywords: ["install", "setup", "설치", "설정"],
        sortOrder: 1,
      },
      {
        sectionKey: "CORE_FEATURES",
        title: "핵심 기능",
        description: "주요 기능 설명",
        required: true,
        weight: 10,
        sourceTypes: ["PRODUCT_MANUAL", "INTEGRATION_GUIDE"],
        keywords: ["feature", "기능", "capability"],
        sortOrder: 2,
      },
      {
        sectionKey: "API_OR_USAGE",
        title: "API/사용법",
        description: "API 또는 사용 방법",
        required: true,
        weight: 10,
        sourceTypes: ["API_SPEC", "OPENAPI_SCHEMA", "INTEGRATION_GUIDE"],
        keywords: ["api", "usage", "사용", "endpoint"],
        sortOrder: 3,
      },
      {
        sectionKey: "CONFIGURATION",
        title: "구성",
        description: "설정/옵션",
        required: true,
        weight: 10,
        sourceTypes: ["OPERATION_GUIDE", "PRODUCT_MANUAL"],
        keywords: ["config", "설정", "option"],
        sortOrder: 4,
      },
      {
        sectionKey: "ERROR_AND_TROUBLESHOOTING",
        title: "오류/장애",
        description: "오류 및 문제 해결",
        required: true,
        weight: 10,
        sourceTypes: ["ERROR_CODE_TABLE", "TROUBLESHOOTING", "FAQ"],
        keywords: ["error", "troubleshoot", "오류", "해결"],
        sortOrder: 5,
      },
      {
        sectionKey: "SAMPLE_OR_EXAMPLE",
        title: "예제",
        description: "샘플/예제",
        required: true,
        weight: 10,
        sourceTypes: ["SAMPLE_CODE", "INTEGRATION_GUIDE"],
        keywords: ["sample", "example", "예제"],
        sortOrder: 6,
      },
      {
        sectionKey: "SECURITY_AND_LIMITATIONS",
        title: "보안/제한",
        description: "보안 및 제한 사항",
        required: true,
        weight: 10,
        sourceTypes: ["SECURITY_GUIDE", "PRODUCT_MANUAL"],
        keywords: ["security", "limit", "보안", "제한"],
        sortOrder: 7,
      },
      {
        sectionKey: "VERSION_CHANGELOG",
        title: "버전/변경",
        description: "변경 이력",
        required: false,
        weight: 5,
        sourceTypes: ["RELEASE_NOTE"],
        keywords: ["version", "changelog", "변경"],
        sortOrder: 8,
      },
      {
        sectionKey: "FAQ",
        title: "FAQ",
        description: "자주 묻는 질문",
        required: false,
        weight: 5,
        sourceTypes: ["FAQ"],
        keywords: ["faq", "질문"],
        sortOrder: 9,
      },
    ],
  },
];

export function getStructureTemplateDefinition(
  templateKey: string,
): StructureTemplateDefinition | undefined {
  return STRUCTURE_TEMPLATE_DEFINITIONS.find((t) => t.templateKey === templateKey);
}
