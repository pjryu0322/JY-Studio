export const JYKSTORE_API_BASE_URL = "http://localhost:3004";
export const MOCK_API_KEY = "jyk_live_mock_xxxxxxxxxxxxx";

export function getContextEndpoint() {
  return `${JYKSTORE_API_BASE_URL}/api/v1/context`;
}

export function createCurlExample(packId: string) {
  return `curl -X POST "${getContextEndpoint()}" \\
  -H "Authorization: Bearer ${MOCK_API_KEY}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "packIds": ["${packId}"],
    "query": "이 지식팩을 기준으로 연동 방법을 알려줘",
    "target": "llm",
    "maxChunks": 5
  }'`;
}

export function createJavaScriptExample(packId: string) {
  return `const response = await fetch("${getContextEndpoint()}", {
  method: "POST",
  headers: {
    "Authorization": "Bearer ${MOCK_API_KEY}",
    "Content-Type": "application/json"
  },
  body: JSON.stringify({
    packIds: ["${packId}"],
    query: "이 지식팩을 기준으로 연동 방법을 알려줘",
    target: "llm",
    maxChunks: 5
  })
});

const context = await response.json();
console.log(context.promptBlock);`;
}

export function createJavaSpringExample(packId: string) {
  return `WebClient client = WebClient.builder()
    .baseUrl("${JYKSTORE_API_BASE_URL}")
    .defaultHeader("Authorization", "Bearer ${MOCK_API_KEY}")
    .build();

Map<String, Object> body = Map.of(
    "packIds", List.of("${packId}"),
    "query", "이 지식팩을 기준으로 연동 방법을 알려줘",
    "target", "llm",
    "maxChunks", 5
);

String response = client.post()
    .uri("/api/v1/context")
    .contentType(MediaType.APPLICATION_JSON)
    .bodyValue(body)
    .retrieve()
    .bodyToMono(String.class)
    .block();`;
}

export function createPythonExample(packId: string) {
  return `import requests

response = requests.post(
    "${getContextEndpoint()}",
    headers={
        "Authorization": "Bearer ${MOCK_API_KEY}",
        "Content-Type": "application/json",
    },
    json={
        "packIds": ["${packId}"],
        "query": "이 지식팩을 기준으로 연동 방법을 알려줘",
        "target": "llm",
        "maxChunks": 5,
    },
)

context = response.json()
print(context["promptBlock"])`;
}

export function createCursorPromptExample(packId: string, packName: string) {
  return `JYKStore의 ${packName}(${packId}) 지식팩을 기준으로 작업해줘.

작업 전 다음 Context API를 호출해 관련 지식을 확인해:
- Endpoint: ${getContextEndpoint()}
- packIds: ["${packId}"]
- target: "cursor"

반환된 promptBlock과 citations를 근거로 구현하고,
지식팩에 없는 내용은 임의로 추정하지 말아줘.`;
}

export function createGenericLlmPromptExample(packId: string, packName: string) {
  return `다음 작업은 JYKStore 지식팩을 근거로 수행해야 합니다.

지식팩:
- 이름: ${packName}
- Pack ID: ${packId}

Context API에서 반환된 promptBlock을 우선 근거로 답변하고,
출처가 없는 내용은 추정이라고 명시하세요.`;
}
