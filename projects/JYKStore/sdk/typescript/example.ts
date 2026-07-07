import { JYKStoreApiError, JYKStoreClient } from "./jykstore-client";

const client = new JYKStoreClient({
  baseUrl: process.env.JYKSTORE_BASE_URL ?? "http://localhost:3004",
  apiKey: process.env.JYKSTORE_API_KEY ?? "",
});

async function main() {
  try {
    const result = await client.queryContext({
      packId: "easy-auth",
      query: "callback 오류",
      limit: 5,
      includeMetadata: true,
    });

    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    if (error instanceof JYKStoreApiError) {
      console.error("Context API error", error.status, error.code, error.message);
      return;
    }
    throw error;
  }
}

void main();
