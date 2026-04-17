import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/** 클라이언트·요구사항 화면용 스칼라만 (관계 제외) */
const PROJECT_SCALAR_SELECT_BASE: Prisma.ProjectSelect = {
  id: true,
  name: true,
  description: true,
  ownerUserId: true,
  projectType: true,
  repoUrl: true,
  defaultBranch: true,
  status: true,
  workflowStatus: true,
  deletedAt: true,
  deletedByUserId: true,
  gitApprovalMode: true,
  gitPushMode: true,
  autoCreateGitRequest: true,
  createdAt: true,
  updatedAt: true,
  specCoreGoals: true,
  specScopeIn: true,
  specScopeOut: true,
  specTargetUsers: true,
  specSuccessCriteria: true,
  executionPlanMarkdown: true,
  selectedPlanCandidateId: true,
  confirmedSpecMarkdown: true,
  confirmedSpecResponseId: true,
  confirmedSpecAt: true,
  confirmedSpecSourceType: true,
  confirmedSpecSourceData: true,
  currentSpecVersionId: true,
  taskPrompt: true,
  taskGenerationPrompt: true,
};

const PROJECT_SCALAR_SELECT_WITH_ROOM: Prisma.ProjectSelect = {
  ...PROJECT_SCALAR_SELECT_BASE,
  requirementsRoomState: true,
};

const PROJECT_SCALAR_SELECT_WITHOUT_ROOM: Prisma.ProjectSelect = {
  ...PROJECT_SCALAR_SELECT_BASE,
};

type ProjectScalarRow = Prisma.ProjectGetPayload<{ select: typeof PROJECT_SCALAR_SELECT_WITH_ROOM }>;

/**
 * DB 스키마가 Prisma보다 오래된 환경에서 findUnique(select)가 매번 P2022를 발생시키며
 * prisma:error 로그를 반복 출력합니다. 한 번이라도 P2022가 확인되면 이후 호출은
 * 바로 raw SELECT 폴백을 사용해 로그 노이즈를 줄입니다.
 */
// NOTE: Prisma findUnique(select)는 DB에 없는 컬럼이 하나라도 있으면 P2022를 던지며,
// Prisma 내부 로깅으로 인해 catch하더라도 prisma:error 로그가 먼저 찍힙니다.
// dev/로컬에서 스키마-DB 불일치가 흔한 환경을 고려해 기본값을 true로 두고 raw SELECT로 시작합니다.
let skipPrismaSelectDueToP2022 = true;

/**
 * $queryRaw 결과 키가 드라이버/설정에 따라 달라질 수 있어 camelCase로 맞춥니다.
 */
function normalizeProjectRawRow(row: Record<string, unknown>): Record<string, unknown> {
  const map: Record<string, string> = {
    id: "id",
    name: "name",
    description: "description",
    owneruserid: "ownerUserId",
    ownerUserId: "ownerUserId",
    projecttype: "projectType",
    projectType: "projectType",
    repourl: "repoUrl",
    repoUrl: "repoUrl",
    defaultbranch: "defaultBranch",
    defaultBranch: "defaultBranch",
    status: "status",
    workflowstatus: "workflowStatus",
    workflowStatus: "workflowStatus",
    deletedat: "deletedAt",
    deletedAt: "deletedAt",
    deletedbyuserid: "deletedByUserId",
    deletedByUserId: "deletedByUserId",
    gitapprovalmode: "gitApprovalMode",
    gitApprovalMode: "gitApprovalMode",
    gitpushmode: "gitPushMode",
    gitPushMode: "gitPushMode",
    autocreategitrequest: "autoCreateGitRequest",
    autoCreateGitRequest: "autoCreateGitRequest",
    createdat: "createdAt",
    createdAt: "createdAt",
    updatedat: "updatedAt",
    updatedAt: "updatedAt",
    speccoregoals: "specCoreGoals",
    specCoreGoals: "specCoreGoals",
    specscopein: "specScopeIn",
    specScopeIn: "specScopeIn",
    specscopeout: "specScopeOut",
    specScopeOut: "specScopeOut",
    spectargetusers: "specTargetUsers",
    specTargetUsers: "specTargetUsers",
    specsuccesscriteria: "specSuccessCriteria",
    specSuccessCriteria: "specSuccessCriteria",
    executionplanmarkdown: "executionPlanMarkdown",
    executionPlanMarkdown: "executionPlanMarkdown",
    selectedplancandidateid: "selectedPlanCandidateId",
    selectedPlanCandidateId: "selectedPlanCandidateId",
    confirmedspecmarkdown: "confirmedSpecMarkdown",
    confirmedSpecMarkdown: "confirmedSpecMarkdown",
    confirmedspecresponseid: "confirmedSpecResponseId",
    confirmedSpecResponseId: "confirmedSpecResponseId",
    confirmedspecat: "confirmedSpecAt",
    confirmedSpecAt: "confirmedSpecAt",
    confirmedspecsourcetype: "confirmedSpecSourceType",
    confirmedSpecSourceType: "confirmedSpecSourceType",
    confirmedspecsourcedata: "confirmedSpecSourceData",
    confirmedSpecSourceData: "confirmedSpecSourceData",
    currentspecversionid: "currentSpecVersionId",
    currentSpecVersionId: "currentSpecVersionId",
    taskprompt: "taskPrompt",
    taskPrompt: "taskPrompt",
    taskgenerationprompt: "taskGenerationPrompt",
    taskGenerationPrompt: "taskGenerationPrompt",
    requirementsroomstate: "requirementsRoomState",
    requirementsRoomState: "requirementsRoomState",
  };
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) {
    const canon = map[k] ?? map[k.toLowerCase()] ?? k;
    if (out[canon] === undefined) out[canon] = v;
  }
  return out;
}

async function findProjectScalarsViaRawSelect(id: string): Promise<ProjectScalarRow | null> {
  try {
    const rows = await prisma.$queryRaw<Array<Record<string, unknown>>>`
      SELECT * FROM "projects" WHERE "id" = ${id} LIMIT 1
    `;
    const row = rows[0];
    if (!row) return null;
    return mergeToFullProjectScalarRow(normalizeProjectRawRow(row));
  } catch (e) {
    console.error("findProjectScalarsByIdSafe: raw SELECT fallback failed", e);
    return null;
  }
}

function mergeToFullProjectScalarRow(row: Record<string, unknown>): ProjectScalarRow {
  const now = new Date();
  return {
    id: String(row.id ?? ""),
    name: String(row.name ?? ""),
    description: row.description != null ? (row.description as string | null) : null,
    ownerUserId: String(row.ownerUserId ?? ""),
    projectType: String(row.projectType ?? ""),
    repoUrl: row.repoUrl != null ? (row.repoUrl as string | null) : null,
    defaultBranch: row.defaultBranch != null ? (row.defaultBranch as string | null) : null,
    status: String(row.status ?? ""),
    workflowStatus: (row.workflowStatus as string | null | undefined) ?? null,
    deletedAt: (row.deletedAt as Date | null | undefined) ?? null,
    deletedByUserId: (row.deletedByUserId as string | null | undefined) ?? null,
    gitApprovalMode: String(row.gitApprovalMode ?? "NO_APPROVAL"),
    gitPushMode: String(row.gitPushMode ?? "AUTO_PUSH"),
    autoCreateGitRequest: typeof row.autoCreateGitRequest === "boolean" ? row.autoCreateGitRequest : true,
    createdAt: (row.createdAt as Date | undefined) ?? now,
    updatedAt: (row.updatedAt as Date | undefined) ?? now,
    specCoreGoals: (row.specCoreGoals as string | null | undefined) ?? null,
    specScopeIn: (row.specScopeIn as string | null | undefined) ?? null,
    specScopeOut: (row.specScopeOut as string | null | undefined) ?? null,
    specTargetUsers: (row.specTargetUsers as string | null | undefined) ?? null,
    specSuccessCriteria: (row.specSuccessCriteria as string | null | undefined) ?? null,
    executionPlanMarkdown: (row.executionPlanMarkdown as string | null | undefined) ?? null,
    selectedPlanCandidateId: (row.selectedPlanCandidateId as string | null | undefined) ?? null,
    confirmedSpecMarkdown: (row.confirmedSpecMarkdown as string | null | undefined) ?? null,
    confirmedSpecResponseId: (row.confirmedSpecResponseId as string | null | undefined) ?? null,
    confirmedSpecAt: (row.confirmedSpecAt as Date | null | undefined) ?? null,
    confirmedSpecSourceType: (row.confirmedSpecSourceType as string | null | undefined) ?? null,
    confirmedSpecSourceData: (row.confirmedSpecSourceData as Prisma.JsonValue | null | undefined) ?? null,
    currentSpecVersionId: (row.currentSpecVersionId as string | null | undefined) ?? null,
    taskPrompt: (row.taskPrompt as string | null | undefined) ?? null,
    taskGenerationPrompt: (row.taskGenerationPrompt as string | null | undefined) ?? null,
    requirementsRoomState: (row.requirementsRoomState as Prisma.JsonValue | null | undefined) ?? null,
  } as ProjectScalarRow;
}

/**
 * Prisma `findUnique({ select })`는 DB에 없는 스키마 컬럼이 하나라도 있으면 P2022가 납니다.
 * 한국어 PostgreSQL 메시지에서는 meta.column이 "칼럼"으로만 보일 수 있습니다.
 * `SELECT *` raw는 **실제 테이블에 존재하는 컬럼만** 반환하므로, Prisma select와 DB 불일치 시 최종 폴백으로 사용합니다.
 */
export async function findProjectScalarsByIdSafe(id: string): Promise<ProjectScalarRow | null> {
  /** Prisma select 2단계만 시도하고, 둘 다 P2022면 raw로 넘겨 콘솔 오류 반복을 줄입니다. */
  const prismaSelectTiers: readonly Prisma.ProjectSelect[] = [
    PROJECT_SCALAR_SELECT_WITH_ROOM,
    PROJECT_SCALAR_SELECT_WITHOUT_ROOM,
  ];

  if (skipPrismaSelectDueToP2022) {
    return findProjectScalarsViaRawSelect(id);
  }

  for (const select of prismaSelectTiers) {
    try {
      const row = await prisma.project.findUnique({ where: { id }, select });
      if (!row) return null;
      return mergeToFullProjectScalarRow(row as unknown as Record<string, unknown>);
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2022") {
        skipPrismaSelectDueToP2022 = true;
        continue;
      }
      throw e;
    }
  }

  return findProjectScalarsViaRawSelect(id);
}
