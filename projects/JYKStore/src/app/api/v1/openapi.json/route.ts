import { NextResponse } from "next/server";
import { buildOpenApiSchema } from "@/lib/openapi-schema-service";

// Schema discovery endpoint. 인증 없이 접근 가능하며, schema 내 operations에는 Bearer 보안 스키마를 명시한다.
export async function GET() {
  const schema = buildOpenApiSchema();
  return new NextResponse(JSON.stringify(schema, null, 2), {
    status: 200,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}
