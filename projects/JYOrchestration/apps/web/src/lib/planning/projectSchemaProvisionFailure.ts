import type { PlanningDatabaseSettingsV1 } from "@/lib/planning/planningDatabaseSettingsV1";
import { isDatabaseUsageEnabledMode, resolveDatabaseUsageMode } from "@/lib/planning/planningDatabaseUsageMode";
import type { SchemaLifecycleStatus } from "@/lib/planning/projectDataStoreTypes";
import {
  readEffectiveDataStoreFailureReason,
  readEffectiveImplementationSchemaStatus,
} from "@/lib/planning/planningDataStoreSettingsAdapter";
import {
  classifyProjectSchemaStoreFailure,
  projectSchemaStoreFailureUserMessage,
  type ProjectSchemaStoreFailureReason,
} from "@/lib/planning/projectSchemaStoreFailure";

export type ProjectSchemaProvisionFailureReason = ProjectSchemaStoreFailureReason;

export function readProjectSchemaProvisionFailureReason(
  raw: unknown,
): ProjectSchemaProvisionFailureReason | null {
  const s = String(raw ?? "").trim();
  const reasons: readonly ProjectSchemaProvisionFailureReason[] = [
    "JYPROJECTS_CONFIG_MISSING",
    "JYPROJECTS_CONNECTION_FAILED",
    "CREATE_SCHEMA_PERMISSION_DENIED",
    "CREATE_TABLE_FAILED",
    "SEED_INSERT_FAILED",
    "INVALID_SCHEMA_NAME",
    "UNKNOWN",
  ];
  if (reasons.includes(s as ProjectSchemaProvisionFailureReason)) {
    return s as ProjectSchemaProvisionFailureReason;
  }
  return null;
}

export function projectSchemaProvisionFailureUserMessage(
  reason: ProjectSchemaProvisionFailureReason,
): string {
  return projectSchemaStoreFailureUserMessage(reason);
}

export function classifyProjectSchemaProvisionFailure(input: Readonly<{
  readonly adminConfigMissing?: boolean;
  readonly invalidSchemaName?: boolean;
  readonly invalidDatabaseName?: boolean;
  readonly rawError?: string | null;
}>): ProjectSchemaProvisionFailureReason {
  if (input.adminConfigMissing) return "JYPROJECTS_CONFIG_MISSING";
  if (input.invalidSchemaName || input.invalidDatabaseName) return "INVALID_SCHEMA_NAME";
  return classifyProjectSchemaStoreFailure(String(input.rawError ?? ""));
}

export function projectDataStoreActionGuide(input: Readonly<{
  readonly failureReason: ProjectSchemaProvisionFailureReason | null | undefined;
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
    case "JYPROJECTS_CONFIG_MISSING":
      return {
        summary: "플랫폼 jyprojects 연결 설정이 필요합니다.",
        adminGuide: [
          "관리자 조치 방법",
          "",
          "1. JYO_PLATFORM_PG_* 환경 변수가 설정되어 있는지 확인합니다.",
          "2. jyprojects 데이터베이스 접속 정보를 확인합니다.",
          "3. 설정 후 저장소 준비 재시도를 실행합니다.",
        ].join("\n"),
        sqlExample: null,
        securityNote: baseSecurity,
        retryable: true,
      };
    case "JYPROJECTS_CONNECTION_FAILED":
      return {
        summary: "jyprojects 접속을 확인해 주세요.",
        adminGuide: [
          "관리자 조치 방법",
          "",
          "1. PostgreSQL 서버가 실행 중인지 확인합니다.",
          "2. jyprojects 데이터베이스 접속 설정을 확인합니다.",
          "3. 네트워크 및 방화벽을 확인한 뒤 재시도합니다.",
        ].join("\n"),
        sqlExample: null,
        securityNote: baseSecurity,
        retryable: true,
      };
    case "CREATE_SCHEMA_PERMISSION_DENIED":
      return {
        summary: "프로젝트 저장소 권한 확인 필요",
        adminGuide: [
          "관리자 조치 방법",
          "",
          "1. jyprojects 데이터베이스 접속 설정을 확인합니다.",
          "2. 플랫폼 계정에 CREATE SCHEMA 권한이 있는지 확인합니다.",
          "3. 권한 부여 후 Quick Design 확정 또는 저장소 준비 재시도를 실행합니다.",
        ].join("\n"),
        sqlExample: `GRANT CREATE ON DATABASE jyprojects TO ${user};`,
        securityNote: baseSecurity,
        retryable: true,
      };
    case "INVALID_SCHEMA_NAME":
      return {
        summary: "프로젝트 저장소 이름을 확인해 주세요.",
        adminGuide: [
          "조치 방법",
          "",
          "1. Repository 저장소명을 영문 소문자, 숫자, underscore 조합으로 확인합니다.",
          "2. 환경설정 저장 후 Quick Design 확정 또는 저장소 준비 재시도를 실행합니다.",
        ].join("\n"),
        sqlExample: null,
        securityNote: "",
        retryable: true,
      };
    case "UNKNOWN":
    default:
      return {
        summary: "프로젝트 저장소를 준비하지 못했습니다.",
        adminGuide: [
          "관리자 조치 방법",
          "",
          "1. jyprojects 연결 및 schema 생성 권한을 확인합니다.",
          "2. 관리자 로그에서 상세 오류 원인을 확인합니다.",
          "3. 조치 후 저장소 준비 재시도를 실행합니다.",
        ].join("\n"),
        sqlExample: null,
        securityNote: baseSecurity,
        retryable: true,
      };
  }
}

export type ProjectDataStoreStatusNotice = Readonly<{
  readonly headline: string;
  readonly summary: string;
  readonly detail: string | null;
  readonly showActionGuide: boolean;
  readonly retryable: boolean;
  readonly failureReason: ProjectSchemaProvisionFailureReason | null;
}>;

export function buildProjectDataStoreStatusNotice(
  settings: PlanningDatabaseSettingsV1 | null | undefined,
): ProjectDataStoreStatusNotice | null {
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
  const status = readEffectiveImplementationSchemaStatus(settings);
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
    const failureReason =
      readEffectiveDataStoreFailureReason(settings) ??
      readProjectSchemaProvisionFailureReason(settings?.dataStoreFailureReason) ??
      "UNKNOWN";
    const canonical =
      readProjectSchemaProvisionFailureReason(failureReason) ?? ("UNKNOWN" as const);
    const guide = projectDataStoreActionGuide({ failureReason: canonical });
    return {
      headline: "플랫폼 확인 필요",
      summary: guide.summary,
      detail: projectSchemaProvisionFailureUserMessage(canonical),
      showActionGuide: true,
      retryable: guide.retryable,
      failureReason: canonical,
    };
  }
  return null;
}

/** @deprecated Use buildProjectDataStoreStatusNotice */
export const buildProjectDatabaseStatusNotice = buildProjectDataStoreStatusNotice;

/** @deprecated Use ProjectDataStoreStatusNotice */
export type ProjectDatabaseStatusNotice = ProjectDataStoreStatusNotice;

/** @deprecated Use projectDataStoreActionGuide */
export const projectDatabaseActionGuide = projectDataStoreActionGuide;

/** @deprecated Use projectSchemaProvisionFailureUserMessage */
export function projectDatabaseFailureUserMessage(
  reason: ProjectSchemaProvisionFailureReason,
): string {
  return projectSchemaProvisionFailureUserMessage(reason);
}

export function buildSaveResultNotice(input: Readonly<{
  readonly saved: boolean;
  readonly dataStoreStatus?: SchemaLifecycleStatus | null;
  readonly usageMode?: ReturnType<typeof resolveDatabaseUsageMode>;
}>): string | null {
  if (!input.saved) {
    return "설정을 저장하지 못했습니다. 다시 시도해 주세요.";
  }
  const usage = input.usageMode ?? "UNSELECTED";
  const status = input.dataStoreStatus;
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
  statusNotice: ProjectDataStoreStatusNotice | null,
  saveMessage: string | null,
): boolean {
  if (!saveMessage || !statusNotice) return false;
  if (statusNotice.failureReason == null) return false;
  const failureText = projectSchemaProvisionFailureUserMessage(statusNotice.failureReason);
  return saveMessage.includes(failureText) || failureText.includes(saveMessage);
}
