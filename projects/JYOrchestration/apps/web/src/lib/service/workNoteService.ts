import { randomUUID } from "crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

const TITLE_MAX = 200;

export type WorkNoteDto = {
  id: string;
  projectId: string | null;
  userId: string;
  title: string;
  content: string;
  visibility: string;
  createdAt: string;
  updatedAt: string;
};

type WorkNoteRow = {
  id: string;
  projectId: string | null;
  userId: string;
  title: string;
  content: string;
  visibility: string;
  createdAt: Date;
  updatedAt: Date;
};

function normalizeTitleDb(raw: string): string {
  const t = raw.trim();
  if (!t) return "제목 없음";
  return t.length > TITLE_MAX ? t.slice(0, TITLE_MAX) : t;
}

function toDto(row: WorkNoteRow): WorkNoteDto {
  return {
    id: row.id,
    projectId: row.projectId,
    userId: row.userId,
    title: row.title,
    content: row.content,
    visibility: row.visibility,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/**
 * Prisma `generate`가 아직 반영되지 않은 환경에서도 `work_notes`에 접근하도록 `$queryRaw`만 사용합니다.
 */
export async function listWorkNotesForUser(params: { userId: string; projectId: string | null }): Promise<WorkNoteDto[]> {
  const uid = params.userId;
  const rows =
    params.projectId === null || !String(params.projectId).trim()
      ? await prisma.$queryRaw<WorkNoteRow[]>(
          Prisma.sql`
      SELECT * FROM "work_notes"
      WHERE "userId" = ${uid}
        AND "projectId" IS NULL
      ORDER BY "updatedAt" DESC
    `
        )
      : await prisma.$queryRaw<WorkNoteRow[]>(
          Prisma.sql`
      SELECT * FROM "work_notes"
      WHERE "projectId" = ${String(params.projectId).trim()}
        AND "userId" = ${uid}
      ORDER BY "updatedAt" DESC
    `
        );
  return rows.map(toDto);
}

export async function createWorkNoteForUser(params: {
  projectId: string | null;
  userId: string;
  title: string;
  content: string;
}): Promise<WorkNoteDto> {
  const id = randomUUID();
  const title = normalizeTitleDb(params.title);
  const content = params.content ?? "";
  const pid = params.projectId === null || !String(params.projectId).trim() ? null : String(params.projectId).trim();
  const rows = pid
    ? await prisma.$queryRaw<WorkNoteRow[]>(
        Prisma.sql`
      INSERT INTO "work_notes" ("id", "projectId", "userId", "title", "content", "visibility", "createdAt", "updatedAt")
      VALUES (${id}, ${pid}, ${params.userId}, ${title}, ${content}, CAST('PRIVATE' AS "WorkNoteVisibility"), NOW(), NOW())
      RETURNING *
    `
      )
    : await prisma.$queryRaw<WorkNoteRow[]>(
        Prisma.sql`
      INSERT INTO "work_notes" ("id", "projectId", "userId", "title", "content", "visibility", "createdAt", "updatedAt")
      VALUES (${id}, NULL, ${params.userId}, ${title}, ${content}, CAST('PRIVATE' AS "WorkNoteVisibility"), NOW(), NOW())
      RETURNING *
    `
      );
  const row = rows[0];
  if (!row) throw new Error("메모를 만들지 못했습니다.");
  return toDto(row);
}

export async function patchWorkNoteForOwner(params: {
  id: string;
  userId: string;
  title: string;
  content: string;
}): Promise<WorkNoteDto | null> {
  const owned = await prisma.$queryRaw<Pick<WorkNoteRow, "id">[]>(
    Prisma.sql`SELECT "id" FROM "work_notes" WHERE "id" = ${params.id} AND "userId" = ${params.userId} LIMIT 1`
  );
  if (!owned.length) return null;

  const title = normalizeTitleDb(params.title);
  const rows = await prisma.$queryRaw<WorkNoteRow[]>(
    Prisma.sql`
      UPDATE "work_notes"
      SET "title" = ${title}, "content" = ${params.content}, "updatedAt" = NOW()
      WHERE "id" = ${params.id} AND "userId" = ${params.userId}
      RETURNING *
    `
  );
  const row = rows[0];
  return row ? toDto(row) : null;
}

export async function deleteWorkNoteForOwner(params: { id: string; userId: string }): Promise<boolean> {
  const rows = await prisma.$queryRaw<Array<{ id: string }>>(
    Prisma.sql`
      DELETE FROM "work_notes"
      WHERE "id" = ${params.id} AND "userId" = ${params.userId}
      RETURNING "id"
    `
  );
  return rows.length > 0;
}

/** 메모 소유 확인 — `projectId`가 null이면 개인(비프로젝트) 메모 */
export async function getWorkNoteProjectIdForUser(
  noteId: string,
  userId: string
): Promise<{ projectId: string | null } | null> {
  const rows = await prisma.$queryRaw<Array<{ projectId: string | null }>>(
    Prisma.sql`SELECT "projectId" FROM "work_notes" WHERE "id" = ${noteId} AND "userId" = ${userId} LIMIT 1`
  );
  return rows[0] ?? null;
}
