export type ProjectSchemaStoreFailureReason =
  | "JYPROJECTS_CONFIG_MISSING"
  | "JYPROJECTS_CONNECTION_FAILED"
  | "CREATE_SCHEMA_PERMISSION_DENIED"
  | "CREATE_TABLE_FAILED"
  | "SEED_INSERT_FAILED"
  | "INVALID_SCHEMA_NAME"
  | "UNKNOWN";

export function projectSchemaStoreFailureUserMessage(
  reason: ProjectSchemaStoreFailureReason,
): string {
  switch (reason) {
    case "JYPROJECTS_CONFIG_MISSING":
      return "프로젝트 데이터 저장소 설정이 필요합니다. 관리자 설정에서 jyprojects 연결 정보를 확인해 주세요.";
    case "JYPROJECTS_CONNECTION_FAILED":
      return "프로젝트 데이터 저장소에 연결하지 못했습니다. 관리자 설정에서 jyprojects 연결 상태를 확인해 주세요.";
    case "CREATE_SCHEMA_PERMISSION_DENIED":
      return "프로젝트 저장소를 생성할 권한이 없습니다. 관리자 설정에서 jyprojects schema 생성 권한을 확인해 주세요.";
    case "CREATE_TABLE_FAILED":
      return "프로젝트 데이터 테이블을 생성하지 못했습니다. 관리자 로그를 확인해 주세요.";
    case "SEED_INSERT_FAILED":
      return "프로젝트 샘플데이터를 생성하지 못했습니다. 관리자 로그를 확인해 주세요.";
    case "INVALID_SCHEMA_NAME":
      return "프로젝트 저장소 이름을 사용할 수 없습니다.";
    case "UNKNOWN":
    default:
      return "프로젝트 저장소 준비가 필요합니다. 관리자 설정에서 jyprojects 연결 및 schema 생성 권한을 확인해 주세요.";
  }
}

export function classifyProjectSchemaStoreFailure(rawError: string): ProjectSchemaStoreFailureReason {
  const msg = String(rawError ?? "").toLowerCase();
  if (!msg) return "UNKNOWN";
  if (
    msg.includes("jyo_platform_pg") ||
    msg.includes("환경 변수") ||
    msg.includes("platform postgres") ||
    msg.includes("접속 정보가 부족") ||
    msg.includes("admin config")
  ) {
    return "JYPROJECTS_CONFIG_MISSING";
  }
  if (
    msg.includes("permission denied for schema") ||
    msg.includes("permission denied to create schema") ||
    msg.includes("create schema") && msg.includes("permission")
  ) {
    return "CREATE_SCHEMA_PERMISSION_DENIED";
  }
  if (msg.includes("create table") || msg.includes("relation") && msg.includes("already exists")) {
    return "CREATE_TABLE_FAILED";
  }
  if (msg.includes("insert into") || msg.includes("seed")) {
    return "SEED_INSERT_FAILED";
  }
  if (
    msg.includes("econnrefused") ||
    msg.includes("etimedout") ||
    msg.includes("could not connect") ||
    msg.includes("connection terminated")
  ) {
    return "JYPROJECTS_CONNECTION_FAILED";
  }
  return "UNKNOWN";
}

/** Short copy for toast when Quick Design confirm succeeded but store prep failed. */
export const QUICK_DESIGN_STORE_PREP_USER_SHORT_MESSAGE =
  "프로젝트 저장소 준비가 필요합니다.";

export const QUICK_DESIGN_CONFIRM_WITH_STORE_PREP_FAILURE_SUMMARY =
  "Quick Design이 확정되었습니다. 프로젝트 저장소 준비는 관리자 확인이 필요합니다.";
