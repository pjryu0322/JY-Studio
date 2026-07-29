import { jsonWithClientIdCookie } from "@/lib/client-identity";
import { CorrectionServiceError } from "@/lib/correction/correction-types";
import { KnowledgeScopeInventoryError } from "@/lib/knowledge-scope/inventory-types";
import { logSafeRouteError } from "@/lib/safe-logging";

export function mapCorrectionRouteError(
  error: unknown,
  clientId: string,
  scope: string,
  method: string,
  path: string,
) {
  if (error instanceof CorrectionServiceError) {
    return jsonWithClientIdCookie(
      { error: { code: error.code, message: error.message } },
      clientId,
      { status: error.httpStatus },
    );
  }
  if (error instanceof KnowledgeScopeInventoryError) {
    return jsonWithClientIdCookie(
      { error: { code: error.code, message: error.message } },
      clientId,
      { status: error.httpStatus },
    );
  }
  logSafeRouteError({ scope, method, path, error });
  return jsonWithClientIdCookie(
    { error: { code: "INTERNAL_ERROR", message: "서버 오류가 발생했습니다." } },
    clientId,
    { status: 500 },
  );
}
