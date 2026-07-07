export const JYKSTORE_API_BASE_URL = "http://localhost:3004";
export const API_KEY_PLACEHOLDER = "<YOUR_JYKSTORE_API_KEY>";

/** @deprecated 예시 호환용. packId를 지정하면 실제 Context API URL을 반환합니다. */
export const MOCK_API_KEY = API_KEY_PLACEHOLDER;

export function getPackContextEndpoint(
  packId: string,
  options?: { limit?: number; q?: string; includeMetadata?: boolean },
) {
  const url = new URL(`${JYKSTORE_API_BASE_URL}/api/v1/packs/${encodeURIComponent(packId)}/context`);
  if (options?.limit !== undefined) {
    url.searchParams.set("limit", String(options.limit));
  }
  if (options?.q?.trim()) {
    url.searchParams.set("q", options.q.trim());
  }
  if (options?.includeMetadata === false) {
    url.searchParams.set("includeMetadata", "false");
  }
  return url.toString();
}

export function getContextEndpoint(packId?: string) {
  if (packId) {
    return getPackContextEndpoint(packId, { limit: 10 });
  }
  return `${JYKSTORE_API_BASE_URL}/api/v1/packs/{packId}/context`;
}

export function createCurlExample(packId: string) {
  const url = getPackContextEndpoint(packId, { limit: 10 });
  return `curl -X GET "${url}" \\
  -H "Authorization: Bearer ${API_KEY_PLACEHOLDER}"`;
}

export function createJavaScriptExample(packId: string) {
  const url = getPackContextEndpoint(packId, { limit: 10 });
  return `const response = await fetch("${url}", {
  headers: {
    Authorization: \`Bearer \${process.env.JYKSTORE_API_KEY}\`,
  },
});

const context = await response.json();`;
}

export function createJavaSpringExample(packId: string) {
  const url = getPackContextEndpoint(packId, { limit: 10 });
  return `String response = WebClient.create()
    .get()
    .uri("${url}")
    .header("Authorization", "Bearer " + System.getenv("JYKSTORE_API_KEY"))
    .retrieve()
    .bodyToMono(String.class)
    .block();`;
}

export function createPythonExample(packId: string) {
  const url = getPackContextEndpoint(packId, { limit: 10 });
  return `import os
import requests

response = requests.get(
    "${url}",
    headers={
        "Authorization": f"Bearer {os.environ['JYKSTORE_API_KEY']}",
    },
)

context = response.json()`;
}

export function createCursorPromptExample(packId: string, packName: string) {
  const endpoint = getPackContextEndpoint(packId, { limit: 10 });
  return `JYKStore의 ${packName}(${packId}) 지식팩을 기준으로 작업해줘.

작업 전 다음 Context API를 호출해 관련 지식을 확인해:
- GET ${endpoint}
- Authorization: Bearer <YOUR_JYKSTORE_API_KEY>

반환된 context.chunks와 pack metadata를 근거로 구현하고,
지식팩에 없는 내용은 임의로 추정하지 말아줘.`;
}

export function createGenericLlmPromptExample(packId: string, packName: string) {
  return `다음 작업은 JYKStore 지식팩을 근거로 수행해야 합니다.

지식팩:
- 이름: ${packName}
- Pack ID: ${packId}

Context API에서 반환된 context.summary와 chunks를 우선 근거로 답변하고,
출처가 없는 내용은 추정이라고 명시하세요.`;
}
