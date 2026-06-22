import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  extractRequirementsMessagesForEventStore,
} from "@/lib/project-process/projectEventMessageExtract";
import {
  PROJECT_EVENT_TYPES,
  PROJECT_MESSAGE_SOURCES,
  PROJECT_PROCESS_STAGES,
} from "@/lib/project-process/projectEventTypes";

export type ProjectEventStoreClient = Prisma.TransactionClient | typeof prisma;

function assertNonEmpty(value: string, field: string): string {
  const s = String(value ?? "").trim();
  if (!s) throw new Error(`${field} is required`);
  return s;
}

function asJsonObject(value: unknown): Prisma.InputJsonObject {
  if (value === null || value === undefined) return {};
  if (typeof value === "object" && !Array.isArray(value)) {
    return value as Prisma.InputJsonObject;
  }
  if (Array.isArray(value)) {
    return { items: value } as Prisma.InputJsonObject;
  }
  return { value: String(value) } as Prisma.InputJsonObject;
}

function parseMessageCreatedAt(iso: string | undefined): Date | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return null;
  return new Date(t);
}

export function buildConversationMessageCreatedEventIdempotencyKey(
  projectId: string,
  sourceMessageId: string,
): string {
  return `conversation-message-created:${projectId}:${sourceMessageId}`;
}

/** @deprecated Use buildConversationMessageCreatedEventIdempotencyKey */
export function buildConversationMessageIdempotencyKey(input: Readonly<{
  readonly projectId: string;
  readonly stage: string;
  readonly source: string;
  readonly sourceMessageId: string;
}>): string {
  return buildConversationMessageCreatedEventIdempotencyKey(input.projectId, input.sourceMessageId);
}

export function resolveRequirementsMessageActor(input: Readonly<{
  readonly speakerType: string;
  readonly speakerId?: string | null;
  readonly loginUserId?: string | null;
}>): Readonly<{ readonly actorType: string; readonly actorId: string | null }> {
  const actorType =
    input.speakerType === "AI"
      ? "AI"
      : input.speakerType === "SYSTEM"
        ? "SYSTEM"
        : "USER";
  const speakerId = String(input.speakerId ?? "").trim() || null;
  const loginUserId = String(input.loginUserId ?? "").trim() || null;
  const actorId = actorType === "USER" ? loginUserId ?? speakerId : speakerId;
  return { actorType, actorId };
}

function isRootPrismaClient(db: ProjectEventStoreClient): db is typeof prisma {
  return typeof (db as typeof prisma).$transaction === "function";
}

async function withEventStoreTransaction<T>(
  db: ProjectEventStoreClient,
  fn: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  if (isRootPrismaClient(db)) {
    return db.$transaction((tx) => fn(tx));
  }
  return fn(db);
}

export async function appendProjectEvent(
  db: ProjectEventStoreClient,
  input: Readonly<{
    readonly projectId: string;
    readonly eventType: string;
    readonly actorType?: string;
    readonly actorId?: string | null;
    readonly stage?: string | null;
    readonly sourceMessageId?: string | null;
    readonly projectMessageId?: string | null;
    readonly correlationId?: string | null;
    readonly causationId?: string | null;
    readonly sessionId?: string | null;
    readonly idempotencyKey?: string | null;
    readonly payload?: unknown;
    readonly metadata?: unknown;
  }>,
) {
  const projectId = assertNonEmpty(input.projectId, "projectId");
  const eventType = assertNonEmpty(input.eventType, "eventType");
  const actorType = String(input.actorType ?? "SYSTEM").trim() || "SYSTEM";
  const idempotencyKey = String(input.idempotencyKey ?? "").trim() || null;

  if (idempotencyKey) {
    const existing = await db.projectEvent.findFirst({
      where: { projectId, idempotencyKey },
    });
    if (existing) return existing;
  }

  try {
    return await db.projectEvent.create({
      data: {
        projectId,
        eventType,
        actorType,
        actorId: input.actorId ?? null,
        stage: input.stage ?? null,
        sourceMessageId: input.sourceMessageId ?? null,
        projectMessageId: input.projectMessageId ?? null,
        correlationId: input.correlationId ?? null,
        causationId: input.causationId ?? null,
        sessionId: input.sessionId ?? null,
        idempotencyKey,
        payload: asJsonObject(input.payload),
        metadata: input.metadata == null ? undefined : (asJsonObject(input.metadata) as Prisma.InputJsonValue),
      },
    });
  } catch (error) {
    if (idempotencyKey && isPrismaUniqueViolation(error)) {
      const existing = await db.projectEvent.findFirst({
        where: { projectId, idempotencyKey },
      });
      if (existing) return existing;
    }
    throw error;
  }
}

function isPrismaUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "P2002"
  );
}

export async function appendProjectMessageWithEvent(
  db: ProjectEventStoreClient,
  input: Readonly<{
    readonly projectId: string;
    readonly stage: string;
    readonly source?: string;
    readonly sourceMessageId: string;
    readonly senderType: string;
    readonly senderId?: string | null;
    readonly senderName?: string | null;
    readonly messageType?: string | null;
    readonly content: string;
    readonly metadata?: unknown;
    readonly raw?: unknown;
    readonly messageCreatedAt?: Date | null;
    readonly actorType?: string;
    readonly actorId?: string | null;
  }>,
) {
  const projectId = assertNonEmpty(input.projectId, "projectId");
  const stage = assertNonEmpty(input.stage, "stage");
  const source = String(input.source ?? PROJECT_MESSAGE_SOURCES.REQUIREMENTS_CONVERSATION).trim();
  const sourceMessageId = assertNonEmpty(input.sourceMessageId, "sourceMessageId");

  let projectMessage = await db.projectMessage.findFirst({
    where: { projectId, stage, source, sourceMessageId },
  });

  if (!projectMessage) {
    try {
      projectMessage = await db.projectMessage.create({
        data: {
          projectId,
          stage,
          source,
          sourceMessageId,
          senderType: String(input.senderType ?? "SYSTEM").trim() || "SYSTEM",
          senderId: input.senderId ?? null,
          senderName: input.senderName ?? null,
          messageType: input.messageType ?? null,
          content: String(input.content ?? ""),
          metadata: input.metadata == null ? undefined : (asJsonObject(input.metadata) as Prisma.InputJsonValue),
          raw: input.raw == null ? undefined : (input.raw as Prisma.InputJsonValue),
          messageCreatedAt: input.messageCreatedAt ?? null,
        },
      });
    } catch (error) {
      if (isPrismaUniqueViolation(error)) {
        projectMessage = await db.projectMessage.findFirst({
          where: { projectId, stage, source, sourceMessageId },
        });
      }
      if (!projectMessage) throw error;
    }
  }

  const idempotencyKey = buildConversationMessageCreatedEventIdempotencyKey(projectId, sourceMessageId);

  const actorType = String(input.actorType ?? "USER").trim() || "USER";
  const actorId =
    actorType === "USER"
      ? (input.actorId ?? input.senderId ?? null)
      : (input.actorId ?? null);

  const event = await appendProjectEvent(db, {
    projectId,
    eventType: PROJECT_EVENT_TYPES.CONVERSATION_MESSAGE_CREATED,
    actorType,
    actorId,
    stage,
    sourceMessageId,
    projectMessageId: projectMessage.id,
    idempotencyKey,
    payload: {
      sourceMessageId,
      projectMessageId: projectMessage.id,
      stage,
      source,
      messageType: input.messageType ?? null,
      senderType: input.senderType,
    },
  });

  return { projectMessage, event };
}

export async function appendProjectCreatedEvents(
  db: ProjectEventStoreClient,
  input: Readonly<{
    readonly projectId: string;
    readonly actorId: string;
    readonly name: string;
    readonly description?: string | null;
    readonly projectType: string;
    readonly repoUrl?: string | null;
    readonly defaultBranch?: string | null;
  }>,
) {
  const projectId = assertNonEmpty(input.projectId, "projectId");
  const created = await appendProjectEvent(db, {
    projectId,
    eventType: PROJECT_EVENT_TYPES.PROJECT_CREATED,
    actorType: "USER",
    actorId: input.actorId,
    stage: PROJECT_PROCESS_STAGES.PROJECT_CREATE,
    idempotencyKey: `project-created:${projectId}`,
    payload: {
      name: input.name,
      projectType: input.projectType,
      repoUrl: input.repoUrl ?? null,
      defaultBranch: input.defaultBranch ?? null,
    },
  });

  const description = String(input.description ?? "").trim();
  let ideaEvent = null;
  if (description) {
    ideaEvent = await appendProjectEvent(db, {
      projectId,
      eventType: PROJECT_EVENT_TYPES.IDEA_CREATED,
      actorType: "USER",
      actorId: input.actorId,
      stage: PROJECT_PROCESS_STAGES.PROJECT_CREATE,
      idempotencyKey: `idea-created:${projectId}`,
      payload: {
        name: input.name,
        description,
      },
    });
  }

  return { created, ideaEvent };
}

export async function syncRequirementsConversationMessagesToEventStore(
  db: ProjectEventStoreClient,
  input: Readonly<{
    readonly projectId: string;
    readonly actorId?: string | null;
    readonly previousConversationJson?: unknown | null;
    readonly nextConversationJson: unknown;
    readonly fallbackStage?: string;
  }>,
) {
  const extracted = extractRequirementsMessagesForEventStore({
    previousConversationJson: input.previousConversationJson,
    nextConversationJson: input.nextConversationJson,
    fallbackStage: input.fallbackStage,
  });

  return withEventStoreTransaction(db, async (tx) => {
    const results: Awaited<ReturnType<typeof appendProjectMessageWithEvent>>[] = [];
    for (const item of extracted) {
      const msg = item.message;
      const { actorType, actorId } = resolveRequirementsMessageActor({
        speakerType: msg.speakerType,
        speakerId: msg.speakerId,
        loginUserId: input.actorId,
      });
      const result = await appendProjectMessageWithEvent(tx, {
        projectId: input.projectId,
        stage: item.stage,
        source: PROJECT_MESSAGE_SOURCES.REQUIREMENTS_CONVERSATION,
        sourceMessageId: msg.id,
        senderType: msg.speakerType,
        senderId: msg.speakerId,
        senderName: msg.speakerName,
        messageType: msg.messageType,
        content: msg.content,
        messageCreatedAt: parseMessageCreatedAt(msg.createdAt),
        raw: msg,
        actorType,
        actorId,
      });
      results.push(result);
    }

    return { syncedCount: results.length, results };
  });
}
