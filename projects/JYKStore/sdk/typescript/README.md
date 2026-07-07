# JYKStore TypeScript SDK 샘플

JYKStore Context API를 호출하기 위한 fetch 기반 TypeScript client 샘플입니다.

> 이 SDK는 npm package가 아니라 프로젝트에 **복사해 사용**할 수 있는 샘플 코드입니다.
> `jykstore-client.ts`를 서비스 코드로 복사한 뒤 사용하세요. 외부 의존성은 없습니다.

## 1. 개요

- `jykstore-client.ts` — `JYKStoreClient`, `JYKStoreApiError`
- `example.ts` — 사용 예제

지원 메서드:

- `getContext()` — `GET /api/v1/packs/{packId}/context`
- `queryContext()` — `POST /api/v1/packs/{packId}/context/query`

## 2. 설치 (복사 방식)

`sdk/typescript/jykstore-client.ts` 파일을 서비스 프로젝트로 복사합니다. npm 설치가 필요하지 않습니다.

## 3. 환경변수 설정

API Key는 코드에 하드코딩하지 않고 서버 환경변수로 주입합니다.

```dotenv
JYKSTORE_BASE_URL=http://localhost:3004
JYKSTORE_API_KEY=jyk_live_xxx
```

## 4. queryContext 예제

```ts
import { JYKStoreClient } from "./jykstore-client";

const client = new JYKStoreClient({
  baseUrl: process.env.JYKSTORE_BASE_URL ?? "http://localhost:3004",
  apiKey: process.env.JYKSTORE_API_KEY ?? "",
});

const result = await client.queryContext({
  packId: "easy-auth",
  query: "callback 오류",
  limit: 5,
  includeMetadata: true,
});

console.log(JSON.stringify(result, null, 2));
```

## 5. getContext 예제

```ts
const context = await client.getContext({
  packId: "easy-auth",
  q: "callback",
  limit: 5,
  includeMetadata: true,
});
```

## 6. 에러 처리

`response.ok`가 아니면 `JYKStoreApiError`가 throw 됩니다.

```ts
import { JYKStoreClient, JYKStoreApiError } from "./jykstore-client";

try {
  const result = await client.queryContext({ packId: "easy-auth", query: "callback" });
  console.log(result);
} catch (error) {
  if (error instanceof JYKStoreApiError) {
    console.error("API error", error.status, error.code, error.message);
  } else {
    throw error;
  }
}
```

## 7. 보안 주의

- API Key는 서버 환경변수에 저장하고 클라이언트 번들에 포함하지 않습니다.
- localStorage/sessionStorage에 저장하지 않습니다.
- URL query로 전달하지 않습니다.
- 로그에 API Key 원문을 남기지 않습니다.
- 유출 시 즉시 revoke 합니다.
