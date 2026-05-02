/**
 * 쿠키 기반 인증이 필요한 앱 내부 API 호출용 `fetch` 래퍼.
 * 호출부에서 `credentials: "include"` 누락을 막습니다.
 */
export function credentialsIncludeFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  return fetch(input, { ...init, credentials: "include" });
}
