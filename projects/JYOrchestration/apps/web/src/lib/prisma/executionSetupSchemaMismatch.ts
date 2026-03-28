import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";

/**
 * P2022: missing DB column. Used only from execution-setup routes (they only touch ExecutionSetup).
 * Korean PostgreSQL can make Prisma meta unreliable (e.g. column shown as "칼럼", modelName omitted).
 */
export function isExecutionSetupSchemaDriftError(error: unknown): boolean {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError)) return false;
  if (error.code !== "P2022") return false;
  const model = (error.meta as { modelName?: string } | undefined)?.modelName;
  return model === "ExecutionSetup" || model === undefined || model === "";
}

export function executionSetupSchemaDriftResponse(): NextResponse {
  return NextResponse.json(
    {
      success: false,
      code: "EXECUTION_SETUP_DB_COLUMNS_MISSING",
      message:
        "execution_setups 테이블이 Prisma 스키마보다 이전입니다. Next dev와 동일한 env(루트 .env + apps/web/.env.local)로 `pnpm db:fix:execution-setup-columns` 를 실행하세요(내부적으로 web 패키지에서 실행됩니다). 루트 .env만 쓰는 DB라면 `pnpm db:fix:execution-setup-columns:root-only` 를 쓰세요. 로그의 '칼럼'은 PostgreSQL 한국어 메시지를 Prisma가 잘못 읽은 것입니다.",
    },
    { status: 503 }
  );
}
