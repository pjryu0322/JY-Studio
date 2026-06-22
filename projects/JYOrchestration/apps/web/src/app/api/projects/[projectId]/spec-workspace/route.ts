import { NextRequest, NextResponse } from "next/server";
import { requireSessionUserId } from "@/lib/auth/requireSession";
import {
  composeWorkspaceSpecUserMessage,
  DEFAULT_SPEC_GENERATION_USER_TEMPLATE,
} from "@/lib/project-spec/buildWorkspacePromptText";
import { computeSpecCandidatePayload } from "@/lib/project-spec/specCandidatePayload";
import {
  normalizeSpecPromptPreset,
  type SpecPromptPresetId,
} from "@/lib/project-spec/specPromptPresets";
import {
  completeWorkspaceSpecMarkdown,
  refineWorkspaceSpecMarkdown,
} from "@/lib/project-spec/generateSpecContextWithOpenAI";
import {
  appendProjectSpecVersionAndSetCurrent,
  rollbackProjectSpecToVersion,
} from "@/lib/project-spec/appendProjectSpecVersion";
import { trySyncTaskDraftsAfterSpecChange } from "@/lib/project-spec/trySyncTaskDraftsAfterSpecChange";
import { isAllowedSpecWorkspaceModel } from "@/lib/project-spec/specWorkspaceModels";
import { rbacErrorResponse } from "@/lib/rbac/handleApiRbac";
import { PROJECT_PROCESS_STAGES } from "@/lib/project-process/projectEventTypes";
import { syncRequirementsConversationMessagesToEventStore } from "@/lib/project-process/projectEventStore";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireProjectPermissionById } from "@/lib/service/taskOwnershipGuard";
import { findProjectScalarsByIdSafe } from "@/lib/service/projectFindForApi";
import type { Project } from "@/components/project-spec/types";

type ProjectColumnName = string;

/**
 * JSONB PATCH 값 정규화.
 *
 * Next.js `request.json()`은 JSON을 JS 값으로 파싱하므로, 클라이언트가 JSON 문자열을내면
 * 여기서는 `string`으로 들어올 수 있습니다. 이 상태를 `JSON.stringify`로 한 번 더 감싸면
 * PG `::jsonb` 캐스팅이 깨질 수 있어(22P02), 가능하면 `JSON.parse`로 "진짜 JSON 값"으로 복원합니다.
 */
function normalizeJsonbPatchValue(v: unknown): Prisma.InputJsonValue | null {
  if (v === null || v === undefined) return null;
  if (typeof v === "string") {
    const s = v.trim();
    if (!s) return null;
    // 객체/배열 JSON 문자열이면 parse (이중 stringify 방지)
    if (s.startsWith("{") || s.startsWith("[")) {
      try {
        return JSON.parse(s) as Prisma.InputJsonValue;
      } catch {
        throw new Error("INVALID_JSON_STRING");
      }
    }
    // JSON literal (boolean/null/number/quoted string)
    try {
      return JSON.parse(s) as Prisma.InputJsonValue;
    } catch {
      // 일반 텍스트는 JSON 문자열로 저장
      return s;
    }
  }
  return v as Prisma.InputJsonValue;
}

/**
 * Prisma/PostgreSQL는 camelCase 컬럼을 따옴표로 생성합니다.
 * information_schema.columns.column_name 은 소문자만 주는 경우가 있어 UPDATE 식별자와 불일치할 수 있으므로
 * pg_attribute.attname 으로 실제 이름을 가져옵니다.
 */
let cachedProjectColumnMap: Map<string, ProjectColumnName> | null = null;

async function getProjectColumnMap(): Promise<Map<string, ProjectColumnName>> {
  if (cachedProjectColumnMap) return cachedProjectColumnMap;
  const rows = await prisma.$queryRaw<Array<{ name: string }>>`
    SELECT a.attname AS name
    FROM pg_attribute a
    JOIN pg_class c ON a.attrelid = c.oid
    JOIN pg_namespace n ON c.relnamespace = n.oid
    WHERE n.nspname = 'public'
      AND c.relname = 'projects'
      AND a.attnum > 0
      AND NOT a.attisdropped
  `;
  const m = new Map<string, ProjectColumnName>();
  for (const r of rows) {
    const actual = String(r.name ?? "").trim();
    if (!actual) continue;
    m.set(actual.toLowerCase(), actual);
  }
  cachedProjectColumnMap = m;
  return cachedProjectColumnMap;
}

/** pg 식별자 (컬럼명은 pg_attribute 에서 온 값만 사용) */
function pgQuoteIdent(name: string): string {
  return `"${String(name).replace(/"/g, '""')}"`;
}

/** Prisma.sql 에 넣을 스칼라만 허용 (객체가 들어가면 PG 구문 오류가 날 수 있음) */
function scalarForRawUpdate(v: unknown): string | number | boolean | Date | null {
  if (v === null || v === undefined) return null;
  if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") return v;
  if (v instanceof Date) return v;
  return String(v);
}

/** jsonb 컬럼은 반드시 텍스트로 직렬화해 바인딩 (객체를 Prisma.sql에 넣으면 42601 구문 오류가 남) */
function jsonbTextOrNull(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  try {
    return JSON.stringify(v);
  } catch {
    return "{}";
  }
}

function pgQuoteStringLiteral(s: string): string {
  return `'${s.replace(/\\/g, "\\\\").replace(/'/g, "''")}'`;
}

/**
 * JSON 텍스트를 UPDATE에 넣을 때 SQL 단일인용부(`'`) 이스케이프로는 깨질 수 있어
 * PostgreSQL dollar-quoted string을 사용한다(본문 내 `'`·`\` 그대로 허용).
 */
function pgDollarQuotedForJsonBody(body: string): string {
  let tag = "JwReqJson";
  for (let i = 0; i < 64; i++) {
    const open = `$${tag}$`;
    if (!body.includes(open)) {
      return `${open}${body}${open}`;
    }
    tag = `JwReqJson_${i}_${Math.random().toString(36).slice(2, 11)}`;
  }
  throw new Error("JSON dollar-quote delimiter collision");
}

function scalarSqlRhs(value: ReturnType<typeof scalarForRawUpdate>): string {
  if (value === null) return "NULL";
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return "NULL";
    return String(value);
  }
  if (typeof value === "boolean") return value ? "TRUE" : "FALSE";
  if (value instanceof Date) return `${pgQuoteStringLiteral(value.toISOString())}::timestamptz`;
  return pgQuoteStringLiteral(String(value));
}

async function rawUpdateProjectByIdSafe(
  projectId: string,
  patch: Record<string, unknown>
): Promise<{ ok: true; applied: boolean; degraded?: { code: string; message: string } } | { ok: false; message: string }> {
  // Guard: do not build multi-megabyte SQL strings (can crash with "Invalid string length")
  // We degrade by skipping oversized JSONB patches rather than failing the entire save.
  const MAX_JSONB_TEXT_CHARS = 1_500_000;
  const MAX_SCALAR_TEXT_CHARS = 300_000;

  const colMap = await getProjectColumnMap();
  const entries: Array<
    | { col: string; kind: "jsonb"; jsonText: string | null }
    | { col: string; kind: "scalar"; value: ReturnType<typeof scalarForRawUpdate> }
  > = [];
  let degraded: { code: string; message: string } | null = null;

  for (const [k, v] of Object.entries(patch)) {
    const actualCol = colMap.get(k.toLowerCase());
    if (!actualCol) continue;
    const lower = actualCol.toLowerCase();
    if (
      lower === "requirementsroomstate" ||
      lower === "requirementsconversationjson" ||
      lower === "requirementsdraftjson" ||
      lower === "requirementsstatejson"
    ) {
      const jsonText = jsonbTextOrNull(v);
      if (jsonText && jsonText.length > MAX_JSONB_TEXT_CHARS) {
        degraded = {
          code: "PAYLOAD_TOO_LARGE",
          message: "저장할 데이터가 너무 커 일부 내용은 저장되지 않았습니다. 대화가 길다면 새 프로젝트로 분리해 주세요.",
        };
        continue;
      }
      if (jsonText) {
        try {
          JSON.parse(jsonText);
        } catch {
          return {
            ok: false,
            message: "요구사항 JSON 직렬화가 올바르지 않습니다. 새로고침 후 다시 시도해 주세요.",
          };
        }
      }
      entries.push({ col: actualCol, kind: "jsonb", jsonText });
      continue;
    }
    const scalar = scalarForRawUpdate(v);
    if (typeof scalar === "string" && scalar.length > MAX_SCALAR_TEXT_CHARS) {
      degraded = degraded ?? {
        code: "PAYLOAD_TOO_LARGE",
        message: "저장할 데이터가 너무 커 일부 내용은 저장되지 않았습니다. 대화가 길다면 새 프로젝트로 분리해 주세요.",
      };
      entries.push({ col: actualCol, kind: "scalar", value: scalar.slice(0, MAX_SCALAR_TEXT_CHARS) });
    } else {
      entries.push({ col: actualCol, kind: "scalar", value: scalar });
    }
  }

  if (entries.length === 0) {
    cachedProjectColumnMap = null;
    return {
      ok: true,
      applied: false,
      degraded: {
        code: "DB_SCHEMA_OUT_OF_DATE",
        message: "DB 스키마가 최신이 아니어서 저장할 컬럼을 찾지 못했습니다. 마이그레이션 적용 후 다시 시도하세요.",
      },
    };
  }

  const setParts: string[] = [];
  for (const e of entries) {
    const colQ = pgQuoteIdent(e.col);
    if (e.kind === "jsonb") {
      if (e.jsonText === null) setParts.push(`${colQ} = NULL`);
      else setParts.push(`${colQ} = ${pgDollarQuotedForJsonBody(e.jsonText)}::jsonb`);
    } else {
      setParts.push(`${colQ} = ${scalarSqlRhs(e.value)}`);
    }
  }

  const sql = `UPDATE "projects" SET ${setParts.join(", ")} WHERE "id" = ${pgQuoteStringLiteral(projectId)}`;

  try {
    await prisma.$executeRawUnsafe(sql);
    return { ok: true, applied: true, ...(degraded ? { degraded } : {}) };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, message: msg };
  }
}

async function getOrCreateSpecPromptConfig(projectId: string) {
  const existing = await prisma.specPromptConfig.findUnique({ where: { projectId } });
  if (existing) {
    return existing;
  }
  return prisma.specPromptConfig.create({
    data: {
      projectId,
      templatePrompt: DEFAULT_SPEC_GENERATION_USER_TEMPLATE,
      preset: "default",
    },
  });
}

function mapSpecPromptConfigRow(r: {
  id: string;
  projectId: string;
  templatePrompt: string;
  preset: string;
  updatedAt: Date;
}) {
  return {
    id: r.id,
    projectId: r.projectId,
    templatePrompt: r.templatePrompt,
    preset: normalizeSpecPromptPreset(r.preset) as SpecPromptPresetId,
    lastEditedAt: r.updatedAt.toISOString(),
  };
}

function isStoredCandidateScore(v: unknown): v is Record<string, unknown> {
  return (
    v !== null &&
    typeof v === "object" &&
    typeof (v as { total?: unknown }).total === "number" &&
    typeof (v as { completeness?: unknown }).completeness === "number"
  );
}

function isStoredCandidateMeta(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === "object" && Array.isArray((v as { sections?: unknown }).sections);
}

function mapResponseRow(r: {
  id: string;
  projectId: string;
  promptId: string;
  provider: string;
  model: string;
  responseMarkdown: string;
  status: string;
  promptTokens: number | null;
  completionTokens: number | null;
  totalTokens: number | null;
  createdAt: Date;
  specCandidateScore: unknown;
  specCandidateMeta: unknown;
}) {
  let score: Record<string, unknown>;
  let meta: Record<string, unknown>;
  if (isStoredCandidateScore(r.specCandidateScore) && isStoredCandidateMeta(r.specCandidateMeta)) {
    score = r.specCandidateScore;
    meta = r.specCandidateMeta;
  } else {
    const p = computeSpecCandidatePayload(r.responseMarkdown);
    score = p.score as unknown as Record<string, unknown>;
    meta = p.meta as unknown as Record<string, unknown>;
  }
  return {
    id: r.id,
    projectId: r.projectId,
    promptId: r.promptId,
    provider: r.provider,
    model: r.model,
    responseMarkdown: r.responseMarkdown,
    status: r.status,
    promptTokens: r.promptTokens ?? null,
    completionTokens: r.completionTokens ?? null,
    totalTokens: r.totalTokens ?? null,
    createdAt: r.createdAt.toISOString(),
    specCandidateScore: score,
    specCandidateMeta: meta,
  };
}

function mapProject(row: {
  id: string;
  name: string;
  description: string | null;
  projectType: string;
  specCoreGoals: string | null;
  specScopeIn: string | null;
  specScopeOut: string | null;
  specTargetUsers: string | null;
  specSuccessCriteria: string | null;
  executionPlanMarkdown: string | null;
  selectedPlanCandidateId: string | null;
  confirmedSpecMarkdown: string | null;
  confirmedSpecResponseId: string | null;
  confirmedSpecAt: Date | null;
  currentSpecVersionId: string | null;
  requirementsRoomState: unknown | null;
  requirementsConversationJson?: unknown | null;
  requirementsDraftJson?: unknown | null;
  requirementsStateJson?: unknown | null;
}): Pick<
  Project,
  | "id"
  | "name"
  | "description"
  | "projectType"
  | "specCoreGoals"
  | "specScopeIn"
  | "specScopeOut"
  | "specTargetUsers"
  | "specSuccessCriteria"
  | "executionPlanMarkdown"
  | "selectedPlanCandidateId"
  | "confirmedSpecMarkdown"
  | "confirmedSpecResponseId"
  | "confirmedSpecAt"
  | "currentSpecVersionId"
  | "requirementsRoomState"
  | "requirementsConversationJson"
  | "requirementsDraftJson"
  | "requirementsStateJson"
> {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    projectType: row.projectType,
    specCoreGoals: row.specCoreGoals,
    specScopeIn: row.specScopeIn,
    specScopeOut: row.specScopeOut,
    specTargetUsers: row.specTargetUsers,
    specSuccessCriteria: row.specSuccessCriteria,
    executionPlanMarkdown: row.executionPlanMarkdown,
    selectedPlanCandidateId: row.selectedPlanCandidateId,
    confirmedSpecMarkdown: row.confirmedSpecMarkdown,
    confirmedSpecResponseId: row.confirmedSpecResponseId,
    confirmedSpecAt: row.confirmedSpecAt?.toISOString() ?? null,
    currentSpecVersionId: row.currentSpecVersionId,
    requirementsRoomState: row.requirementsRoomState ?? null,
    requirementsConversationJson: row.requirementsConversationJson ?? null,
    requirementsDraftJson: row.requirementsDraftJson ?? null,
    requirementsStateJson: row.requirementsStateJson ?? null,
  };
}

type ProjectSafeRow = NonNullable<Awaited<ReturnType<typeof findProjectScalarsByIdSafe>>>;

/** findProjectScalarsByIdSafe 결과 → mapProject 입력(DB에 없는 컬럼은 null로 채워짐). */
function toProjectMapRow(row: ProjectSafeRow) {
  return mapProject({
    id: row.id,
    name: row.name,
    description: row.description,
    projectType: row.projectType,
    specCoreGoals: row.specCoreGoals,
    specScopeIn: row.specScopeIn,
    specScopeOut: row.specScopeOut,
    specTargetUsers: row.specTargetUsers,
    specSuccessCriteria: row.specSuccessCriteria,
    executionPlanMarkdown: row.executionPlanMarkdown,
    selectedPlanCandidateId: row.selectedPlanCandidateId,
    confirmedSpecMarkdown: row.confirmedSpecMarkdown,
    confirmedSpecResponseId: row.confirmedSpecResponseId,
    confirmedSpecAt: row.confirmedSpecAt,
    currentSpecVersionId: row.currentSpecVersionId,
    requirementsRoomState: row.requirementsRoomState,
    requirementsConversationJson: row.requirementsConversationJson ?? null,
    requirementsDraftJson: row.requirementsDraftJson ?? null,
    requirementsStateJson: row.requirementsStateJson ?? null,
  });
}

export async function GET(
  request: NextRequest,
  segmentData: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await segmentData.params;
    const id = String(projectId ?? "").trim();
    if (!id) {
      return NextResponse.json({ success: false, message: "projectId가 필요합니다." }, { status: 400 });
    }

    const userId = await requireSessionUserId(request);
    if (userId instanceof NextResponse) {
      return userId;
    }

    try {
      await requireProjectPermissionById(id, userId, "canViewProject", "GET /api/projects/[projectId]/spec-workspace");
    } catch (error) {
      const denied = rbacErrorResponse(error);
      if (denied) {
        return denied;
      }
      throw error;
    }

    const projectRow = await findProjectScalarsByIdSafe(id);
    if (!projectRow) {
      return NextResponse.json({ success: false, message: "프로젝트를 찾을 수 없습니다." }, { status: 404 });
    }

    const prompts = await prisma.projectSpecWorkspacePrompt.findMany({
      where: { projectId: id },
      orderBy: { version: "desc" },
      take: 50,
    });

    const responses = await prisma.projectSpecWorkspaceResponse.findMany({
      where: { projectId: id },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    const specPromptConfigRow = await getOrCreateSpecPromptConfig(id);

    const specVersions = await prisma.projectSpecVersion.findMany({
      where: { projectId: id },
      orderBy: { version: "desc" },
      take: 80,
      select: {
        id: true,
        projectId: true,
        version: true,
        markdown: true,
        sourceType: true,
        createdAt: true,
      },
    });

    return NextResponse.json({
      success: true,
      message: "실행 계획 워크스페이스를 불러왔습니다.",
      data: {
        project: toProjectMapRow(projectRow),
        specVersions: specVersions.map((v) => ({
          id: v.id,
          projectId: v.projectId,
          version: v.version,
          markdown: v.markdown,
          sourceType: v.sourceType,
          createdAt: v.createdAt.toISOString(),
        })),
        prompts: prompts.map((p) => ({
          id: p.id,
          projectId: p.projectId,
          version: p.version,
          promptText: p.promptText,
          createdAt: p.createdAt.toISOString(),
        })),
        responses: responses.map((r) => mapResponseRow(r)),
        specPromptConfig: mapSpecPromptConfigRow(specPromptConfigRow),
      },
    });
  } catch (error) {
    console.error("GET /api/projects/[projectId]/spec-workspace error:", error);
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2022") {
      return NextResponse.json(
        {
          success: false,
          code: "DB_SCHEMA_OUT_OF_DATE",
          message:
            "DB에 최신 컬럼이 없어 워크스페이스를 불러올 수 없습니다. 프로젝트 루트에서 `npx prisma migrate deploy`(스키마: packages/db/schema.prisma)로 마이그레이션을 적용하세요. (실행계획 저장 자체는 성공했을 수 있습니다.)",
          meta: error.meta,
        },
        { status: 500 }
      );
    }
    return NextResponse.json(
      { success: false, message: "실행 계획 워크스페이스 조회 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}

type PatchBody = {
  name?: string;
  description?: string | null;
  projectType?: string;
  specCoreGoals?: string | null;
  specScopeIn?: string | null;
  specScopeOut?: string | null;
  specTargetUsers?: string | null;
  specSuccessCriteria?: string | null;
  confirmedSpecMarkdown?: string | null;
  executionPlanMarkdown?: string | null;
  selectedPlanCandidateId?: string | null;
  workflowStatus?: string | null;
  specPromptTemplate?: string | null;
  specPromptPreset?: string | null;
  requirementsRoomState?: unknown | null;
  requirementsConversationJson?: unknown | null;
  requirementsDraftJson?: unknown | null;
  requirementsStateJson?: unknown | null;
};

export async function PATCH(
  request: NextRequest,
  segmentData: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await segmentData.params;
    const id = String(projectId ?? "").trim();
    if (!id) {
      return NextResponse.json({ success: false, message: "projectId가 필요합니다." }, { status: 400 });
    }

    const userId = await requireSessionUserId(request);
    if (userId instanceof NextResponse) {
      return userId;
    }

    try {
      await requireProjectPermissionById(
        id,
        userId,
        "canGenerateTask",
        "PATCH /api/projects/[projectId]/spec-workspace"
      );
    } catch (error) {
      const denied = rbacErrorResponse(error);
      if (denied) {
        return denied;
      }
      throw error;
    }

    let body: PatchBody;
    try {
      body = (await request.json()) as PatchBody;
    } catch {
      return NextResponse.json({ success: false, message: "요청 본문이 올바른 JSON이 아닙니다." }, { status: 400 });
    }

    const data: Record<string, unknown> = {};
    if (body.name !== undefined) {
      const name = String(body.name ?? "").trim();
      if (!name) {
        return NextResponse.json({ success: false, message: "프로젝트명은 비울 수 없습니다." }, { status: 400 });
      }
      data.name = name;
    }
    if (body.description !== undefined) {
      data.description = body.description === null ? null : String(body.description);
    }
    if (body.projectType !== undefined) {
      const pt = String(body.projectType ?? "").trim();
      if (!pt) {
        return NextResponse.json({ success: false, message: "projectType이 비어 있습니다." }, { status: 400 });
      }
      data.projectType = pt;
    }
    if (body.specCoreGoals !== undefined) {
      data.specCoreGoals = body.specCoreGoals === null ? null : String(body.specCoreGoals);
    }
    if (body.specScopeIn !== undefined) {
      data.specScopeIn = body.specScopeIn === null ? null : String(body.specScopeIn);
    }
    if (body.specScopeOut !== undefined) {
      data.specScopeOut = body.specScopeOut === null ? null : String(body.specScopeOut);
    }
    if (body.specTargetUsers !== undefined) {
      data.specTargetUsers = body.specTargetUsers === null ? null : String(body.specTargetUsers);
    }
    if (body.specSuccessCriteria !== undefined) {
      data.specSuccessCriteria = body.specSuccessCriteria === null ? null : String(body.specSuccessCriteria);
    }
    if (body.confirmedSpecMarkdown !== undefined) {
      data.confirmedSpecMarkdown = body.confirmedSpecMarkdown === null ? null : String(body.confirmedSpecMarkdown);
    }
    if (body.executionPlanMarkdown !== undefined) {
      data.executionPlanMarkdown = body.executionPlanMarkdown === null ? null : String(body.executionPlanMarkdown);
    }
    if (body.workflowStatus !== undefined) {
      data.workflowStatus = body.workflowStatus === null ? null : String(body.workflowStatus);
    }
    if (body.selectedPlanCandidateId !== undefined) {
      data.selectedPlanCandidateId =
        body.selectedPlanCandidateId === null || body.selectedPlanCandidateId === ""
          ? null
          : String(body.selectedPlanCandidateId);
    }
    try {
      if (body.requirementsRoomState !== undefined) {
        data.requirementsRoomState =
          body.requirementsRoomState === null ? null : normalizeJsonbPatchValue(body.requirementsRoomState);
      }
      if (body.requirementsConversationJson !== undefined) {
        data.requirementsConversationJson =
          body.requirementsConversationJson === null ? null : normalizeJsonbPatchValue(body.requirementsConversationJson);
      }
      if (body.requirementsDraftJson !== undefined) {
        data.requirementsDraftJson =
          body.requirementsDraftJson === null ? null : normalizeJsonbPatchValue(body.requirementsDraftJson);
      }
      if (body.requirementsStateJson !== undefined) {
        data.requirementsStateJson =
          body.requirementsStateJson === null ? null : normalizeJsonbPatchValue(body.requirementsStateJson);
      }
    } catch (e) {
      const code = e instanceof Error ? e.message : "";
      if (code === "INVALID_JSON_STRING") {
        return NextResponse.json(
          { success: false, message: "JSON 필드(requirements*) 값이 올바른 JSON 문자열이 아닙니다." },
          { status: 400 }
        );
      }
      throw e;
    }

    const hasPromptPatch = body.specPromptTemplate !== undefined || body.specPromptPreset !== undefined;

    if (Object.keys(data).length === 0 && !hasPromptPatch) {
      return NextResponse.json({ success: false, message: "수정할 필드가 없습니다." }, { status: 400 });
    }

    let updated = await findProjectScalarsByIdSafe(id);
    if (!updated) {
      return NextResponse.json({ success: false, message: "프로젝트를 찾을 수 없습니다." }, { status: 404 });
    }

    const previousConversationJson = updated.requirementsConversationJson ?? null;

    let patchApplied = false;
    let patchDegraded: { code: string; message: string } | null = null;

    if (Object.keys(data).length > 0) {
      // Prisma update는 스키마 불일치 시 P2022 + prisma:error 로그를 유발하므로,
      // 여기서는 테이블 실제 컬럼을 조회한 뒤 raw UPDATE로 안전하게 저장합니다.
      const raw = await rawUpdateProjectByIdSafe(id, data);
      if (!raw.ok) {
        patchApplied = false;
        patchDegraded = { code: "DB_UPDATE_FAILED", message: "저장에 실패했습니다. 잠시 후 다시 시도해 주세요." };
      } else {
        patchApplied = raw.applied;
        patchDegraded = raw.degraded ?? null;
      }

      const refetched = await findProjectScalarsByIdSafe(id);
      if (!refetched) {
        return NextResponse.json({ success: false, message: "프로젝트를 찾을 수 없습니다." }, { status: 404 });
      }
      updated = refetched;
    }

    let specPromptConfigOut: ReturnType<typeof mapSpecPromptConfigRow> | null = null;
    if (hasPromptPatch) {
      const cfg = await getOrCreateSpecPromptConfig(id);
      const nextTemplate =
        body.specPromptTemplate !== undefined ? String(body.specPromptTemplate ?? "") : cfg.templatePrompt;
      const nextPreset =
        body.specPromptPreset !== undefined
          ? normalizeSpecPromptPreset(body.specPromptPreset)
          : normalizeSpecPromptPreset(cfg.preset);
      if (!nextTemplate.trim()) {
        return NextResponse.json({ success: false, message: "AI 생성용 프롬프트 템플릿이 비어 있습니다." }, { status: 400 });
      }
      const saved = await prisma.specPromptConfig.update({
        where: { projectId: id },
        data: { templatePrompt: nextTemplate, preset: nextPreset },
      });
      specPromptConfigOut = mapSpecPromptConfigRow(saved);
    }

    let eventStoreWarning: string | null = null;
    if (body.requirementsConversationJson !== undefined && body.requirementsConversationJson !== null) {
      try {
        const nextConversationJson =
          updated.requirementsConversationJson ?? body.requirementsConversationJson;
        await syncRequirementsConversationMessagesToEventStore(prisma, {
          projectId: id,
          actorId: userId,
          previousConversationJson,
          nextConversationJson,
          fallbackStage: PROJECT_PROCESS_STAGES.REQUIREMENTS_IDEATION,
        });
      } catch (eventError) {
        console.error("Project Event Store sync failed:", eventError);
        eventStoreWarning = "EVENT_STORE_SYNC_FAILED";
      }
    }

    return NextResponse.json({
      success: true,
      message: patchDegraded?.message ?? "실행 계획 입력이 저장되었습니다.",
      data: {
        project: toProjectMapRow(updated),
        patchApplied,
        ...(patchDegraded ? { code: patchDegraded.code } : {}),
        ...(eventStoreWarning ? { eventStoreWarning } : {}),
        ...(specPromptConfigOut ? { specPromptConfig: specPromptConfigOut } : {}),
      },
    });
  } catch (error) {
    const denied = rbacErrorResponse(error);
    if (denied) {
      return denied;
    }
    console.error("PATCH /api/projects/[projectId]/spec-workspace error:", error);
    return NextResponse.json(
      { success: false, message: "저장 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}

type PostBody =
  | { action: "aiRequest"; model?: string; preset?: string; templatePrompt?: string }
  | { action: "confirm"; responseId: string }
  | {
      action: "confirmMerged";
      responseAId: string;
      responseBId: string;
      mergedMarkdown: string;
      selectedSections: Record<string, "A" | "B">;
    }
  | { action: "appendManualSpec"; markdown: string }
  | { action: "refineSpec"; model?: string }
  | { action: "rollbackSpec"; versionId: string };

export async function POST(
  request: NextRequest,
  segmentData: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await segmentData.params;
    const id = String(projectId ?? "").trim();
    if (!id) {
      return NextResponse.json({ success: false, message: "projectId가 필요합니다." }, { status: 400 });
    }

    const userId = await requireSessionUserId(request);
    if (userId instanceof NextResponse) {
      return userId;
    }

    try {
      await requireProjectPermissionById(
        id,
        userId,
        "canGenerateTask",
        "POST /api/projects/[projectId]/spec-workspace"
      );
    } catch (error) {
      const denied = rbacErrorResponse(error);
      if (denied) {
        return denied;
      }
      throw error;
    }

    let body: PostBody;
    try {
      body = (await request.json()) as PostBody;
    } catch {
      return NextResponse.json({ success: false, message: "요청 본문이 올바른 JSON이 아닙니다." }, { status: 400 });
    }

    if (body.action === "aiRequest") {
      let workspaceOpenAiModel: string | null = null;
      const rawModel = typeof body.model === "string" ? body.model.trim() : "";
      if (rawModel) {
        if (!isAllowedSpecWorkspaceModel(rawModel)) {
          return NextResponse.json(
            { success: false, message: "지원하지 않는 모델입니다. gpt-4o, gpt-4.1, gpt-4o-mini 중에서 선택하세요." },
            { status: 400 }
          );
        }
        workspaceOpenAiModel = rawModel;
      }

      const projectFull = await findProjectScalarsByIdSafe(id);
      if (!projectFull) {
        return NextResponse.json({ success: false, message: "프로젝트를 찾을 수 없습니다." }, { status: 404 });
      }

      const projectForPrompt: Project = {
        id: projectFull.id,
        name: projectFull.name,
        description: projectFull.description,
        projectType: projectFull.projectType,
        status: projectFull.status,
        specCoreGoals: projectFull.specCoreGoals,
        specScopeIn: projectFull.specScopeIn,
        specScopeOut: projectFull.specScopeOut,
        specTargetUsers: projectFull.specTargetUsers,
        specSuccessCriteria: projectFull.specSuccessCriteria,
        executionPlanMarkdown: projectFull.executionPlanMarkdown,
        selectedPlanCandidateId: projectFull.selectedPlanCandidateId,
        confirmedSpecMarkdown: projectFull.confirmedSpecMarkdown,
        confirmedSpecResponseId: projectFull.confirmedSpecResponseId,
        confirmedSpecAt: projectFull.confirmedSpecAt?.toISOString() ?? null,
      };

      const promptCfg = await getOrCreateSpecPromptConfig(id);
      let templatePrompt = promptCfg.templatePrompt.trim();
      let preset = normalizeSpecPromptPreset(promptCfg.preset);
      if (typeof body.templatePrompt === "string") {
        templatePrompt = body.templatePrompt.trim();
      }
      if (typeof body.preset === "string") {
        preset = normalizeSpecPromptPreset(body.preset);
      }
      if (!templatePrompt) {
        return NextResponse.json(
          {
            success: false,
            message: "프롬프트 템플릿이 비어 있으면 AI 실행 계획 문서를 생성할 수 없습니다.",
          },
          { status: 400 }
        );
      }
      if (typeof body.templatePrompt === "string" || typeof body.preset === "string") {
        await prisma.specPromptConfig.update({
          where: { projectId: id },
          data: { templatePrompt, preset },
        });
      }

      let promptText: string;
      try {
        promptText = composeWorkspaceSpecUserMessage(projectForPrompt, workspaceOpenAiModel, {
          templatePrompt,
          preset,
        });
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        if (msg === "EXECUTION_PLAN_REQUIRED") {
          return NextResponse.json(
            {
              success: false,
              message: "저장된 실행 계획이 없습니다. 「실행계획 저장」으로 먼저 저장하세요.",
            },
            { status: 400 }
          );
        }
        throw e;
      }
      const agg = await prisma.projectSpecWorkspacePrompt.aggregate({
        where: { projectId: id },
        _max: { version: true },
      });
      const nextVersion = (agg._max.version ?? 0) + 1;
      const promptRow = await prisma.projectSpecWorkspacePrompt.create({
        data: {
          projectId: id,
          version: nextVersion,
          promptText,
          createdByUserId: userId,
        },
      });

      let markdown: string;
      let modelUsed: string;
      let usage: { promptTokens: number; completionTokens: number; totalTokens: number } | null = null;
      try {
        const out = await completeWorkspaceSpecMarkdown(promptRow.promptText, workspaceOpenAiModel);
        markdown = out.markdown;
        modelUsed = out.model;
        usage = out.usage;
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        if (msg === "OPENAI_API_KEY_NOT_CONFIGURED") {
          return NextResponse.json(
            {
              success: false,
              message: "OpenAI API 키가 설정되지 않았습니다. OPENAI_API_KEY를 구성하세요.",
              code: "OPENAI_NOT_CONFIGURED",
            },
            { status: 503 }
          );
        }
        console.error("completeWorkspaceSpecMarkdown failed:", e);
        return NextResponse.json(
          {
            success: false,
            message: "AI 실행 계획 문서 생성에 실패했습니다. 잠시 후 다시 시도하세요.",
            code: "OPENAI_GENERATE_FAILED",
          },
          { status: 502 }
        );
      }

      const candidatePayload = computeSpecCandidatePayload(markdown);
      const responseRow = await prisma.projectSpecWorkspaceResponse.create({
        data: {
          projectId: id,
          promptId: promptRow.id,
          provider: "openai",
          model: modelUsed,
          responseMarkdown: markdown,
          status: "COMPLETED",
          promptTokens: usage?.promptTokens ?? null,
          completionTokens: usage?.completionTokens ?? null,
          totalTokens: usage?.totalTokens ?? null,
          specCandidateScore: candidatePayload.score,
          specCandidateMeta: candidatePayload.meta,
        },
      });

      const responsePayload: {
        response: ReturnType<typeof mapResponseRow>;
        project?: ReturnType<typeof mapProject>;
      } = {
        response: mapResponseRow(responseRow),
      };

      const mapped = await findProjectScalarsByIdSafe(id);
      if (mapped) {
        responsePayload.project = toProjectMapRow(mapped);
      }

      return NextResponse.json({
        success: true,
        message: "AI 응답이 생성되었습니다.",
        data: responsePayload,
      });
    }

    if (body.action === "confirm") {
      const responseId = String(body.responseId ?? "").trim();
      if (!responseId) {
        return NextResponse.json({ success: false, message: "responseId가 필요합니다." }, { status: 400 });
      }
      const resp = await prisma.projectSpecWorkspaceResponse.findFirst({
        where: { id: responseId, projectId: id },
      });
      if (!resp) {
        return NextResponse.json({ success: false, message: "응답을 찾을 수 없습니다." }, { status: 404 });
      }

      const { id: newSpecVersionId } = await appendProjectSpecVersionAndSetCurrent({
        projectId: id,
        markdown: resp.responseMarkdown,
        sourceType: "RESPONSE",
        sourceData: { responseId: resp.id },
        createdByUserId: userId,
      });

      const updatedProject = await findProjectScalarsByIdSafe(id);
      if (!updatedProject) {
        return NextResponse.json({ success: false, message: "프로젝트를 찾을 수 없습니다." }, { status: 404 });
      }

      const taskDraftSync = await trySyncTaskDraftsAfterSpecChange({
        projectId: id,
        specVersionId: newSpecVersionId,
        userId,
      });

      return NextResponse.json({
        success: true,
        message: "이 응답을 공식 실행 계획으로 확정했습니다.",
        data: { project: toProjectMapRow(updatedProject), taskDraftSync },
      });
    }

    if (body.action === "confirmMerged") {
      const responseAId = String(body.responseAId ?? "").trim();
      const responseBId = String(body.responseBId ?? "").trim();
      const mergedMarkdown = String(body.mergedMarkdown ?? "");
      const selectedSections = body.selectedSections ?? {};

      if (!responseAId || !responseBId) {
        return NextResponse.json({ success: false, message: "responseAId/responseBId가 필요합니다." }, { status: 400 });
      }
      if (!mergedMarkdown.trim()) {
        return NextResponse.json({ success: false, message: "mergedMarkdown이 비어 있습니다." }, { status: 400 });
      }

      const [respA, respB] = await Promise.all([
        prisma.projectSpecWorkspaceResponse.findFirst({ where: { id: responseAId, projectId: id } }),
        prisma.projectSpecWorkspaceResponse.findFirst({ where: { id: responseBId, projectId: id } }),
      ]);

      if (!respA || !respB) {
        return NextResponse.json({ success: false, message: "비교 응답을 찾을 수 없습니다." }, { status: 404 });
      }

      const { id: newSpecVersionId } = await appendProjectSpecVersionAndSetCurrent({
        projectId: id,
        markdown: mergedMarkdown,
        sourceType: "MERGED_SECTIONS",
        sourceData: {
          responseAId: respA.id,
          responseBId: respB.id,
          selectedSections,
        },
        createdByUserId: userId,
      });

      const updatedProject = await findProjectScalarsByIdSafe(id);
      if (!updatedProject) {
        return NextResponse.json({ success: false, message: "프로젝트를 찾을 수 없습니다." }, { status: 404 });
      }

      const taskDraftSync = await trySyncTaskDraftsAfterSpecChange({
        projectId: id,
        specVersionId: newSpecVersionId,
        userId,
      });

      return NextResponse.json({
        success: true,
        message: "섹션 병합 결과를 공식 실행 계획으로 확정했습니다.",
        data: { project: toProjectMapRow(updatedProject), taskDraftSync },
      });
    }

    if (body.action === "appendManualSpec") {
      const md = String(body.markdown ?? "").trim();
      if (!md) {
        return NextResponse.json({ success: false, message: "markdown이 비어 있습니다." }, { status: 400 });
      }
      const { id: newSpecVersionId } = await appendProjectSpecVersionAndSetCurrent({
        projectId: id,
        markdown: md,
        sourceType: "MANUAL_EDIT",
        sourceData: null,
        createdByUserId: userId,
      });
      const updatedProject = await findProjectScalarsByIdSafe(id);
      if (!updatedProject) {
        return NextResponse.json({ success: false, message: "프로젝트를 찾을 수 없습니다." }, { status: 404 });
      }
      const taskDraftSync = await trySyncTaskDraftsAfterSpecChange({
        projectId: id,
        specVersionId: newSpecVersionId,
        userId,
      });
      return NextResponse.json({
        success: true,
        message: "수정 내용을 새 버전으로 저장했습니다.",
        data: { project: toProjectMapRow(updatedProject), taskDraftSync },
      });
    }

    if (body.action === "refineSpec") {
      let refineModel: string | null = null;
      const rawRefine = typeof body.model === "string" ? body.model.trim() : "";
      if (rawRefine) {
        if (!isAllowedSpecWorkspaceModel(rawRefine)) {
          return NextResponse.json(
            { success: false, message: "지원하지 않는 모델입니다. gpt-4o, gpt-4.1, gpt-4o-mini 중에서 선택하세요." },
            { status: 400 }
          );
        }
        refineModel = rawRefine;
      }

      const projBase = await findProjectScalarsByIdSafe(id);
      if (!projBase) {
        return NextResponse.json({ success: false, message: "프로젝트를 찾을 수 없습니다." }, { status: 404 });
      }
      const currentVerRow = projBase.currentSpecVersionId
        ? await prisma.projectSpecVersion.findFirst({
            where: { id: projBase.currentSpecVersionId, projectId: id },
            select: { markdown: true },
          })
        : null;
      const currentMd =
        currentVerRow?.markdown?.trim() || String(projBase.confirmedSpecMarkdown ?? "").trim() || "";
      if (!currentMd) {
        return NextResponse.json(
          { success: false, message: "확정된 실행 계획이 없어 AI 개선을 실행할 수 없습니다." },
          { status: 400 }
        );
      }

      let refined: string;
      let modelUsed: string;
      try {
        const out = await refineWorkspaceSpecMarkdown(currentMd, refineModel);
        refined = out.markdown;
        modelUsed = out.model;
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        if (msg === "OPENAI_API_KEY_NOT_CONFIGURED") {
          return NextResponse.json(
            {
              success: false,
              message: "OpenAI API 키가 설정되지 않았습니다. OPENAI_API_KEY를 구성하세요.",
              code: "OPENAI_NOT_CONFIGURED",
            },
            { status: 503 }
          );
        }
        console.error("refineWorkspaceSpecMarkdown failed:", e);
        return NextResponse.json(
          {
            success: false,
            message: "AI 개선 요청에 실패했습니다. 잠시 후 다시 시도하세요.",
            code: "OPENAI_REFINE_FAILED",
          },
          { status: 502 }
        );
      }

      const { id: newSpecVersionId } = await appendProjectSpecVersionAndSetCurrent({
        projectId: id,
        markdown: refined,
        sourceType: "AI_REFINE",
        sourceData: {
          model: modelUsed,
          basedOnVersionId: projBase.currentSpecVersionId,
        },
        createdByUserId: userId,
      });

      const updatedProject = await findProjectScalarsByIdSafe(id);
      if (!updatedProject) {
        return NextResponse.json({ success: false, message: "프로젝트를 찾을 수 없습니다." }, { status: 404 });
      }

      const taskDraftSync = await trySyncTaskDraftsAfterSpecChange({
        projectId: id,
        specVersionId: newSpecVersionId,
        userId,
        model: modelUsed,
      });

      return NextResponse.json({
        success: true,
        message: "현재 확정된 실행 계획을 바탕으로 AI 개선본을 새 버전으로 저장했습니다.",
        data: { project: toProjectMapRow(updatedProject), taskDraftSync },
      });
    }

    if (body.action === "rollbackSpec") {
      const versionId = String(body.versionId ?? "").trim();
      if (!versionId) {
        return NextResponse.json({ success: false, message: "versionId가 필요합니다." }, { status: 400 });
      }
      let rolled: { id: string; version: number };
      try {
        rolled = await rollbackProjectSpecToVersion({ projectId: id, versionId });
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        if (msg === "SPEC_VERSION_NOT_FOUND") {
          return NextResponse.json({ success: false, message: "해당 버전을 찾을 수 없습니다." }, { status: 404 });
        }
        throw e;
      }
      const updatedProject = await findProjectScalarsByIdSafe(id);
      if (!updatedProject) {
        return NextResponse.json({ success: false, message: "프로젝트를 찾을 수 없습니다." }, { status: 404 });
      }
      const taskDraftSync = await trySyncTaskDraftsAfterSpecChange({
        projectId: id,
        specVersionId: rolled.id,
        userId,
      });
      return NextResponse.json({
        success: true,
        message: "선택한 버전을 현재 활성 실행 계획으로 되돌렸습니다.",
        data: { project: toProjectMapRow(updatedProject), taskDraftSync },
      });
    }

    return NextResponse.json({ success: false, message: "지원하지 않는 action입니다." }, { status: 400 });
  } catch (error) {
    const denied = rbacErrorResponse(error);
    if (denied) {
      return denied;
    }
    console.error("POST /api/projects/[projectId]/spec-workspace error:", error);
    return NextResponse.json(
      { success: false, message: "처리 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
