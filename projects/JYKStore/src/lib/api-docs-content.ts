export const samplePackId = "easy-auth";
export const sampleApiKey = "jyk_live_xxx";

export const apiBaseUrls = {
  development: "http://localhost:3004",
  production: "배포 환경의 JYKStore origin",
} as const;

export const contextApiEndpoints = [
  {
    method: "GET",
    path: "/api/v1/packs/{packId}/context",
    description: "지식팩의 활성 chunk context를 조회합니다.",
  },
  {
    method: "POST",
    path: "/api/v1/packs/{packId}/context/query",
    description: "query 기반 keyword/ranking 검색으로 관련 chunk를 조회합니다.",
  },
] as const;

export const contextApiErrorCodes = [
  { status: 401, code: "UNAUTHORIZED", description: "API Key가 없거나 유효하지 않습니다." },
  { status: 403, code: "FORBIDDEN", description: "API Key scope가 부족합니다." },
  { status: 404, code: "PACK_NOT_FOUND", description: "공개된 지식팩을 찾을 수 없습니다." },
  { status: 400, code: "INVALID_REQUEST", description: "요청 본문 또는 파라미터가 올바르지 않습니다." },
  { status: 500, code: "INTERNAL_SERVER_ERROR", description: "서버 처리 중 오류가 발생했습니다." },
] as const;

export const contextQueryParameters = [
  { name: "q", type: "string", required: false, description: "chunk 검색어" },
  { name: "limit", type: "number", required: false, description: "반환 chunk 수, 기본 20, 최대 50" },
  {
    name: "includeMetadata",
    type: "boolean",
    required: false,
    description: "metadata 포함 여부, 기본 true",
  },
] as const;

export const securityPolicies = [
  "API Key는 서버 환경변수에 저장합니다.",
  "브라우저 localStorage/sessionStorage 저장을 금지합니다.",
  "URL query로 API Key를 전달하지 않습니다.",
  "로그에 API Key 원문을 저장하지 않습니다.",
  "유출 시 즉시 revoke 합니다.",
] as const;

export const authHeaderExample = `Authorization: Bearer ${sampleApiKey}`;

export const getContextCurlExample = `curl -X GET "${apiBaseUrls.development}/api/v1/packs/${samplePackId}/context?q=callback&limit=5&includeMetadata=true" \\
  -H "Authorization: Bearer ${sampleApiKey}"`;

export const getContextFetchExample = `const res = await fetch(
  "${apiBaseUrls.development}/api/v1/packs/${samplePackId}/context?q=callback&limit=5&includeMetadata=true",
  {
    method: "GET",
    headers: {
      Authorization: \`Bearer \${process.env.JYKSTORE_API_KEY}\`,
    },
  },
);

if (!res.ok) {
  throw new Error(\`Context API error: \${res.status}\`);
}

const data = await res.json();
console.log(data);`;

export const postQueryRequestBody = `{
  "query": "callback 오류",
  "limit": 5,
  "includeMetadata": true
}`;

export const postQueryCurlExample = `curl -X POST "${apiBaseUrls.development}/api/v1/packs/${samplePackId}/context/query" \\
  -H "Authorization: Bearer ${sampleApiKey}" \\
  -H "Content-Type: application/json" \\
  --data '{
    "query": "callback 오류",
    "limit": 5,
    "includeMetadata": true
  }'`;

export const postQueryFetchExample = `const res = await fetch(
  "${apiBaseUrls.development}/api/v1/packs/${samplePackId}/context/query",
  {
    method: "POST",
    headers: {
      Authorization: \`Bearer \${process.env.JYKSTORE_API_KEY}\`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      query: "callback 오류",
      limit: 5,
      includeMetadata: true,
    }),
  },
);

if (!res.ok) {
  throw new Error(\`Context API error: \${res.status}\`);
}

const data = await res.json();
console.log(data);`;

export const successResponseExample = `{
  "pack": {
    "packId": "${samplePackId}",
    "name": "간편인증 연동 지식팩",
    "version": "1.0.0",
    "status": "PUBLISHED",
    "provider": "JYKStore",
    "category": "인증"
  },
  "context": {
    "summary": "간편인증 연동에 필요한 API, Callback, 오류 대응 지식입니다.",
    "instructions": [
      "지식팩에 포함된 청크를 우선 근거로 답변합니다."
    ],
    "chunks": [
      {
        "chunkId": "ck_xxx",
        "title": "Callback 오류 처리",
        "content": "Callback 처리 중 오류가 발생하면...",
        "chunkType": "SOURCE_DOCUMENT",
        "section": "Callback",
        "tags": ["callback", "오류"],
        "source": {
          "documentId": "doc_xxx",
          "title": "간편인증 연동 가이드",
          "sourceType": "MANUAL"
        },
        "metadata": {
          "sortOrder": 1,
          "score": 50,
          "matchReasons": [
            {
              "field": "title",
              "token": "callback",
              "weight": 40,
              "reason": "제목 부분 일치"
            }
          ]
        }
      }
    ]
  },
  "usage": {
    "requestId": "req_xxx",
    "chunkCount": 1
  }
}`;

export const errorResponseExample = `{
  "error": {
    "code": "UNAUTHORIZED",
    "message": "API Key가 필요합니다."
  },
  "usage": {
    "requestId": "req_xxx"
  }
}`;

export const includeMetadataExcludedFields = [
  "section",
  "tags",
  "source",
  "metadata.sortOrder",
  "metadata.score",
  "metadata.matchReasons",
] as const;

export const sdkClientUsageExample = `import { JYKStoreClient } from "./jykstore-client";

const client = new JYKStoreClient({
  baseUrl: process.env.JYKSTORE_BASE_URL ?? "${apiBaseUrls.development}",
  apiKey: process.env.JYKSTORE_API_KEY ?? "",
});

const result = await client.queryContext({
  packId: "${samplePackId}",
  query: "callback 오류",
  limit: 5,
  includeMetadata: true,
});

console.log(JSON.stringify(result, null, 2));`;

export const sdkGetContextExample = `const context = await client.getContext({
  packId: "${samplePackId}",
  q: "callback",
  limit: 5,
  includeMetadata: true,
});`;

export const sdkErrorHandlingExample = `import { JYKStoreClient, JYKStoreApiError } from "./jykstore-client";

const client = new JYKStoreClient({
  baseUrl: process.env.JYKSTORE_BASE_URL ?? "${apiBaseUrls.development}",
  apiKey: process.env.JYKSTORE_API_KEY ?? "",
});

try {
  const result = await client.queryContext({ packId: "${samplePackId}", query: "callback" });
  console.log(result);
} catch (error) {
  if (error instanceof JYKStoreApiError) {
    console.error("API error", error.status, error.code, error.message);
  } else {
    throw error;
  }
}`;

export const retrievalMetadataFilterKeys = [
  "category",
  "feature",
  "apiName",
  "documentType",
  "securityLevel",
  "environment",
  "framework",
  "programmingLanguage (alias: language)",
  "productName",
  "productVersion (alias: version)",
  "sourceOrganization",
  "licenseType",
  "verificationStatus",
  "releaseVersion",
  "referenceType",
] as const;

export const retrievalApiErrorCodes = [
  { status: 401, code: "UNAUTHORIZED", description: "API Key가 없거나 유효하지 않습니다." },
  { status: 403, code: "FORBIDDEN", description: "API Key scope가 부족합니다." },
  { status: 400, code: "INVALID_RETRIEVAL_REQUEST", description: "요청 body/filter/topK가 올바르지 않습니다." },
  { status: 404, code: "PACK_NOT_FOUND", description: "공개된 지식팩을 찾을 수 없습니다." },
  { status: 500, code: "INTERNAL_SERVER_ERROR", description: "서버 처리 중 오류가 발생했습니다." },
] as const;

export const retrievalRequestBody = `{
  "knowledgePackId": "${samplePackId}",
  "query": "Callback 예제를 생성",
  "filters": {
    "documentType": "SAMPLE_CODE",
    "programmingLanguage": "Java",
    "framework": "Spring Boot",
    "securityLevel": "PUBLIC"
  },
  "topK": 8,
  "includeMetadata": true,
  "retrievalMode": "hybrid"
}`;

export const retrievalCurlExample = `curl -X POST "${apiBaseUrls.development}/api/v1/retrieval/query" \\
  -H "Authorization: Bearer ${sampleApiKey}" \\
  -H "Content-Type: application/json" \\
  --data '{
    "knowledgePackId": "${samplePackId}",
    "query": "Callback 예제를 생성",
    "filters": {
      "documentType": "SAMPLE_CODE",
      "programmingLanguage": "Java",
      "framework": "Spring Boot"
    },
    "topK": 8,
    "includeMetadata": true
  }'`;

export const retrievalFetchExample = `const res = await fetch(
  "${apiBaseUrls.development}/api/v1/retrieval/query",
  {
    method: "POST",
    headers: {
      Authorization: \`Bearer \${process.env.JYKSTORE_API_KEY}\`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      knowledgePackId: "${samplePackId}",
      query: "Callback 예제를 생성",
      filters: {
        documentType: "SAMPLE_CODE",
        programmingLanguage: "Java",
        framework: "Spring Boot",
      },
      topK: 8,
      includeMetadata: true,
    }),
  },
);

if (!res.ok) {
  throw new Error(\`Retrieval API error: \${res.status}\`);
}

const data = await res.json();
console.log(data);`;

export const retrievalResponseExample = `{
  "contexts": [
    {
      "chunkId": "ck_xxx",
      "knowledgePackId": "${samplePackId}",
      "title": "Callback 예제",
      "content": "...",
      "score": 122,
      "matchReasons": ["query:callback", "metadata:framework", "vector:similarity"],
      "metadata": {
        "category": "Callback",
        "framework": "Spring Boot",
        "programmingLanguage": "Java",
        "documentType": "SAMPLE_CODE",
        "securityLevel": "PUBLIC"
      },
      "scoreDetail": {
        "keywordScore": 40,
        "metadataScore": 30,
        "vectorScore": 52,
        "vectorSimilarity": 0.52
      },
      "references": [
        {
          "type": "SOURCE_DOCUMENT",
          "title": "간편인증 연동 매뉴얼",
          "sourceDocumentId": "doc_xxx"
        }
      ]
    }
  ],
  "usage": {
    "requestId": "req_xxx",
    "contextCount": 1,
    "topK": 8,
    "usedFilters": {
      "framework": "Spring Boot"
    },
    "retrievalMode": "hybrid",
    "embeddingProvider": "local-hash",
    "embeddingModel": "local-hash-v1",
    "scannedCandidateCount": 620,
    "filteredCandidateCount": 12,
    "candidateCollectionMode": "query-scan"
  }
}`;

export const retrievalErrorResponseExample = `{
  "error": {
    "code": "INVALID_RETRIEVAL_REQUEST",
    "message": "Invalid retrieval request.",
    "details": [
      "Unknown filter key: foo"
    ]
  },
  "usage": {
    "requestId": "req_xxx"
  }
}`;
