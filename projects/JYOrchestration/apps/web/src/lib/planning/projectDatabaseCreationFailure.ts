import type { PlanningDatabaseSettingsV1 } from "@/lib/planning/planningDatabaseSettingsV1";
import { isDatabaseUsageEnabledMode, resolveDatabaseUsageMode } from "@/lib/planning/planningDatabaseUsageMode";
import {
  readProjectDatabaseLifecycleStatus,
  type ProjectDatabaseLifecycleStatus,
} from "@/lib/planning/projectDatabaseLifecycle";

export type ProjectDatabaseCreationFailureReason =
  | "POSTGRES_ADMIN_CONFIG_MISSING"
  | "POSTGRES_CONNECTION_FAILED"
  | "CREATE_DATABASE_PERMISSION_DENIED"
  | "DATABASE_ALREADY_EXISTS_BUT_INACCESSIBLE"
  | "INVALID_DATABASE_NAME"
  | "UNKNOWN";

const FAILURE_REASONS: readonly ProjectDatabaseCreationFailureReason[] = [
  "POSTGRES_ADMIN_CONFIG_MISSING",
  "POSTGRES_CONNECTION_FAILED",
  "CREATE_DATABASE_PERMISSION_DENIED",
  "DATABASE_ALREADY_EXISTS_BUT_INACCESSIBLE",
  "INVALID_DATABASE_NAME",
  "UNKNOWN",
];

export function readProjectDatabaseCreationFailureReason(
  raw: unknown,
): ProjectDatabaseCreationFailureReason | null {
  const s = String(raw ?? "").trim();
  if (FAILURE_REASONS.includes(s as ProjectDatabaseCreationFailureReason)) {
    return s as ProjectDatabaseCreationFailureReason;
  }
  return null;
}

export function classifyProjectDatabaseCreationFailure(input: Readonly<{
  readonly adminConfigMissing?: boolean;
  readonly invalidDatabaseName?: boolean;
  readonly databaseExists?: boolean;
  readonly verifyFailedAfterCreate?: boolean;
  readonly rawError?: string | null;
}>): ProjectDatabaseCreationFailureReason {
  if (input.adminConfigMissing) return "POSTGRES_ADMIN_CONFIG_MISSING";
  if (input.invalidDatabaseName) return "INVALID_DATABASE_NAME";
  if (input.databaseExists && input.verifyFailedAfterCreate) {
    return "DATABASE_ALREADY_EXISTS_BUT_INACCESSIBLE";
  }
  const msg = String(input.rawError ?? "").toLowerCase();
  if (!msg) return "UNKNOWN";
  if (
    msg.includes("permission denied for schema") ||
    msg.includes("permission denied to create schema") ||
    msg.includes("create schema")
  ) {
    return "CREATE_DATABASE_PERMISSION_DENIED";
  }
  if (
    msg.includes("permission denied to create database") ||
    msg.includes("must be superuser") ||
    msg.includes("createdb privilege") ||
    msg.includes("createdb") && msg.includes("permission")
  ) {
    return "CREATE_DATABASE_PERMISSION_DENIED";
  }
  if (
    msg.includes("econnrefused") ||
    msg.includes("etimedout") ||
    msg.includes("timeout") ||
    msg.includes("connection terminated") ||
    msg.includes("could not connect") ||
    msg.includes("connect ")
  ) {
    return "POSTGRES_CONNECTION_FAILED";
  }
  if (input.verifyFailedAfterCreate) return "DATABASE_ALREADY_EXISTS_BUT_INACCESSIBLE";
  return "UNKNOWN";
}

export function projectDatabaseFailureUserMessage(
  reason: ProjectDatabaseCreationFailureReason,
): string {
  switch (reason) {
    case "POSTGRES_ADMIN_CONFIG_MISSING":
      return "플랫폼 PostgreSQL 관리자 설정이 필요합니다. 관리자 설정에서 PostgreSQL 접속 정보를 먼저 등록해 주세요.";
    case "POSTGRES_CONNECTION_FAILED":
      return "플랫폼이 PostgreSQL 서버에 접속하지 못했습니다. 관리자 설정의 PostgreSQL 연결 상태를 확인해 주세요.";
    case "CREATE_DATABASE_PERMISSION_DENIED":
      return "프로젝트 저장소를 준비할 수 없습니다. 플랫폼 관리자 설정 또는 schema 생성 권한 확인이 필요합니다.";
    case "DATABASE_ALREADY_EXISTS_BUT_INACCESSIBLE":
      return "프로젝트 데이터 저장소 연결 확인이 필요합니다. 플랫폼 관리자 설정을 확인해 주세요.";
    case "INVALID_DATABASE_NAME":
      return "데이터베이스명을 사용할 수 없습니다. 영문 소문자, 숫자, underscore 조합으로 입력해 주세요.";
    case "UNKNOWN":
    default:
      return "프로젝트 저장소를 준비할 수 없습니다. 플랫폼 관리자 설정 또는 schema 생성 권한 확인이 필요합니다.";
  }
}

export function projectDatabaseActionGuide(input: Readonly<{
  readonly failureReason: ProjectDatabaseCreationFailureReason | null | undefined;
  readonly platformDbUsername?: string | null;
}>): Readonly<{
  readonly summary: string;
  readonly adminGuide: string;
  readonly sqlExample: string | null;
  readonly securityNote: string;
  readonly retryable: boolean;
}> {
  const reason = input.failureReason ?? "UNKNOWN";
  const user = String(input.platformDbUsername ?? "").trim() || "<platform_db_user>";
  const baseSecurity =
    "운영 환경에서는 권한 부여 전에 보안 정책을 확인하세요. 관리자 권한이 없는 사용자는 이 작업을 수행할 수 없습니다.";

  switch (reason) {
    case "POSTGRES_ADMIN_CONFIG_MISSING":
      return {
        summary: "플랫폼 PostgreSQL 관리자 설정이 필요합니다.",
        adminGuide: [
          "관리자 조치 방법",
          "",
          "1. 플랫폼 PostgreSQL 관리자 설정이 등록되어 있는지 확인합니다.",
          "2. Host, Port, 관리자 Database, Username, Password를 등록합니다.",
          "3. 등록 후 다시 시도를 실행합니다.",
        ].join("\n"),
        sqlExample: null,
        securityNote: baseSecurity,
        retryable: true,
      };
    case "POSTGRES_CONNECTION_FAILED":
      return {
        summary: "플랫폼 PostgreSQL 서버 접속을 확인해 주세요.",
        adminGuide: [
          "관리자 조치 방법",
          "",
          "1. PostgreSQL 서버가 실행 중인지 확인합니다.",
          "2. 플랫폼 관리자 설정의 Host/Port/SSL 설정을 확인합니다.",
          "3. 방화벽 및 네트워크 경로를 확인합니다.",
          "4. 연결 확인 후 다시 시도를 실행합니다.",
        ].join("\n"),
        sqlExample: null,
        securityNote: baseSecurity,
        retryable: true,
      };
    case "CREATE_DATABASE_PERMISSION_DENIED":
      return {
        summary: "프로젝트 저장소 권한 확인 필요",
        adminGuide: [
          "관리자 조치 방법",
          "",
          "1. 프로젝트 데이터 저장소 접속 설정을 확인합니다.",
          "2. 플랫폼 계정에 CREATE SCHEMA 권한이 있는지 확인합니다.",
          "3. 권한이 없으면 PostgreSQL 관리자 계정으로 schema 생성 권한을 부여합니다.",
          "4. Quick Design 확정을 다시 실행합니다.",
        ].join("\n"),
        sqlExample: `GRANT CREATE ON DATABASE <project_data_database> TO ${user};`,
        securityNote: baseSecurity,
        retryable: true,
      };
    case "DATABASE_ALREADY_EXISTS_BUT_INACCESSIBLE":
      return {
        summary: "데이터베이스 접속 권한을 확인해 주세요.",
        adminGuide: [
          "관리자 조치 방법",
          "",
          "1. 동일 이름의 PostgreSQL database가 이미 존재하는지 확인합니다.",
          "2. 플랫폼 계정에 해당 database 접속 권한이 있는지 확인합니다.",
          "3. 필요 시 database 소유자 또는 GRANT CONNECT 권한을 조정합니다.",
          "4. 조치 후 다시 시도를 실행합니다.",
        ].join("\n"),
        sqlExample: null,
        securityNote: baseSecurity,
        retryable: true,
      };
    case "INVALID_DATABASE_NAME":
      return {
        summary: "데이터베이스명을 수정해 주세요.",
        adminGuide: [
          "조치 방법",
          "",
          "1. 데이터베이스명을 영문 소문자, 숫자, underscore 조합으로 입력합니다.",
          "2. 저장을 실행한 뒤 프로젝트 DB 생성을 다시 시도합니다.",
        ].join("\n"),
        sqlExample: null,
        securityNote: "",
        retryable: true,
      };
    case "UNKNOWN":
    default:
      return {
        summary: "프로젝트 데이터 저장소를 준비하지 못했습니다.",
        adminGuide: [
          "관리자 조치 방법",
          "",
          "1. 플랫폼 PostgreSQL 관리자 설정을 확인합니다.",
          "2. 관리자 로그에서 상세 오류 원인을 확인합니다.",
          "3. 조치 후 다시 시도를 실행합니다.",
        ].join("\n"),
        sqlExample: null,
        securityNote: baseSecurity,
        retryable: true,
      };
  }
}

export type ProjectDatabaseStatusNotice = Readonly<{
  readonly headline: string;
  readonly summary: string;
  readonly detail: string | null;
  readonly showActionGuide: boolean;
  readonly retryable: boolean;
  readonly failureReason: ProjectDatabaseCreationFailureReason | null;
}>;

export function buildProjectDatabaseStatusNotice(
  settings: PlanningDatabaseSettingsV1 | null | undefined,
): ProjectDatabaseStatusNotice | null {
  const usage = resolveDatabaseUsageMode(settings);
  if (usage === "DISABLED_JSON_SAMPLE") {
    return {
      headline: "데이터베이스 미사용",
      summary:
        "데이터베이스를 사용하지 않습니다. 구현단계에서는 JSON 샘플데이터로 화면과 기능 흐름을 확인합니다.",
      detail: null,
      showActionGuide: false,
      retryable: false,
      failureReason: null,
    };
  }
  if (!isDatabaseUsageEnabledMode(usage)) return null;
  const status = readProjectDatabaseLifecycleStatus(settings?.projectDbStatus);
  if (status === "CREATED") {
    return {
      headline: "프로젝트 저장소 준비 완료",
      summary:
        "프로젝트 저장소 schema가 준비되었습니다. Quick Design 확정 후 필요한 테이블과 샘플데이터가 생성됩니다.",
      detail: null,
      showActionGuide: false,
      retryable: false,
      failureReason: null,
    };
  }
  if (status === "PLANNED" || status === "CREATING") {
    return null;
  }
  if (status === "FAILED") {
    const failureReason = readProjectDatabaseCreationFailureReason(settings?.projectDbFailureReason) ?? "UNKNOWN";
    const guide = projectDatabaseActionGuide({ failureReason });
    return {
      headline: "플랫폼 확인 필요",
      summary: guide.summary,
      detail: projectDatabaseFailureUserMessage(failureReason),
      showActionGuide: true,
      retryable: guide.retryable,
      failureReason,
    };
  }
  return null;
}

export function buildSaveResultNotice(input: Readonly<{
  readonly saved: boolean;
  readonly projectDbStatus?: ProjectDatabaseLifecycleStatus | null;
  readonly usageMode?: ReturnType<typeof resolveDatabaseUsageMode>;
}>): string | null {
  if (!input.saved) {
    return "설정을 저장하지 못했습니다. 다시 시도해 주세요.";
  }
  const usage = input.usageMode ?? "UNSELECTED";
  const status = readProjectDatabaseLifecycleStatus(input.projectDbStatus);
  if (usage === "DISABLED_JSON_SAMPLE") {
    return "데이터베이스 미사용으로 저장되었습니다. 구현단계에서는 JSON 샘플데이터로 화면과 기능 흐름을 확인합니다.";
  }
  if (isDatabaseUsageEnabledMode(usage)) {
    if (status === "CREATED") {
      return "설정이 저장되었습니다. 프로젝트 저장소 schema가 준비되었습니다.";
    }
    if (status === "FAILED") {
      return "설정이 저장되었습니다. 프로젝트 저장소 준비는 관리자 확인이 필요합니다.";
    }
    return "설정이 저장되었습니다. 프로젝트 저장소 예정값이 준비되었습니다.";
  }
  return "설정이 저장되었습니다.";
}

export function shouldHideSaveMessageWhenStatusFailed(
  statusNotice: ProjectDatabaseStatusNotice | null,
  saveMessage: string | null,
): boolean {
  if (!saveMessage || !statusNotice) return false;
  if (statusNotice.failureReason == null) return false;
  const failureText = projectDatabaseFailureUserMessage(statusNotice.failureReason);
  return saveMessage.includes(failureText) || failureText.includes(saveMessage);
}
