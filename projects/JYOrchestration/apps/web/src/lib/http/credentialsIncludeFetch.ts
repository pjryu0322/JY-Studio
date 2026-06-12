/**
 * 쿠키 기반 인증이 필요한 앱 내부 API 호출용 `fetch` 래퍼.
 * 호출부에서 `credentials: "include"` 누락을 막습니다.
 */
export function credentialsIncludeFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  return fetch(input, { ...init, credentials: "include" });
}

/** Route Handler JSON 응답 파싱 (404 HTML 등 비-JSON 응답 시 명확한 오류). */
export async function readJsonApiResponse<T>(res: Response): Promise<T> {
  const text = await res.text();
  const trimmed = text.trim();
  if (!trimmed) {
    return {} as T;
  }
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    try {
      return JSON.parse(trimmed) as T;
    } catch {
      throw new Error(`서버 응답을 JSON으로 해석할 수 없습니다. (HTTP ${res.status})`);
    }
  }
  if (trimmed.startsWith("<!DOCTYPE") || trimmed.startsWith("<html")) {
    if (res.status === 404) {
      throw new Error(
        "API 경로를 찾을 수 없습니다(404). dev 서버를 중지한 뒤 apps/web/.next 폴더를 삭제하고 pnpm dev로 다시 시작해 주세요.",
      );
    }
    throw new Error(`서버가 HTML 오류 페이지를 반환했습니다. (HTTP ${res.status}) dev 서버 로그를 확인해 주세요.`);
  }
  throw new Error(`예상하지 못한 서버 응답입니다. (HTTP ${res.status})`);
}
