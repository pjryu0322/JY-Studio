import type { ProjectStructureCandidate } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  buildStructureCandidateExplainability,
  mergeExplainabilityOntoCandidateRow,
} from "@/lib/project-structure/projectStructureExplainability";

function readPayloadString(payload: unknown, key: string): string {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return "";
  return String((payload as Record<string, unknown>)[key] ?? "").trim();
}

export async function enrichStructureCandidatesWithExplainability(
  projectId: string,
  candidates: readonly ProjectStructureCandidate[],
) {
  const pid = String(projectId).trim();
  const eventIds = [
    ...new Set(candidates.map((c) => String(c.sourceEventId ?? "").trim()).filter(Boolean)),
  ];

  const events =
    eventIds.length === 0
      ? []
      : await prisma.projectEvent.findMany({
          where: { projectId: pid, id: { in: eventIds } },
          include: { projectMessage: { select: { content: true, sourceMessageId: true } } },
        });

  const eventById = new Map(events.map((e) => [e.id, e]));

  return candidates.map((c) => {
    const event = c.sourceEventId ? eventById.get(c.sourceEventId) : null;
    const messageContent = event?.projectMessage?.content ?? null;
    const sourceMessageId =
      event?.sourceMessageId ??
      event?.projectMessage?.sourceMessageId ??
      readPayloadString(event?.payload, "sourceMessageId") ||
      null;

    const explainability = buildStructureCandidateExplainability({
      projectId: pid,
      nodeType: c.nodeType,
      title: c.title,
      summary: c.summary,
      metadata: c.metadata,
      sourceEventId: c.sourceEventId,
      eventType: event?.eventType ?? null,
      messageContent,
      sourceMessageId,
    });

    return mergeExplainabilityOntoCandidateRow(c, explainability);
  });
}
