import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  archiveTasksNotMatchingSpecVersion,
  reconcileArchivedStateForActiveSpecVersion,
} from "@/lib/project-spec/archiveTasksForSpecVersionTransition";
import { projectUpdateDataFromSpecVersionRow } from "@/lib/project-spec/projectSpecVersionSync";

export async function appendProjectSpecVersionAndSetCurrent(params: {
  projectId: string;
  markdown: string;
  sourceType: string;
  sourceData?: Prisma.InputJsonValue | null;
  createdByUserId: string | null;
}): Promise<{ id: string; version: number }> {
  const { projectId, markdown, sourceType, sourceData, createdByUserId } = params;
  return prisma.$transaction(async (tx) => {
    const agg = await tx.projectSpecVersion.aggregate({
      where: { projectId },
      _max: { version: true },
    });
    const nextVersion = (agg._max.version ?? 0) + 1;
    const row = await tx.projectSpecVersion.create({
      data: {
        projectId,
        version: nextVersion,
        markdown,
        sourceType,
        sourceData: sourceData === undefined || sourceData === null ? undefined : sourceData,
        createdByUserId: createdByUserId ?? undefined,
      },
    });
    await archiveTasksNotMatchingSpecVersion(tx, projectId, row.id);
    const patch = projectUpdateDataFromSpecVersionRow(row);
    await tx.project.update({
      where: { id: projectId },
      data: {
        currentSpecVersionId: row.id,
        confirmedSpecMarkdown: patch.confirmedSpecMarkdown,
        confirmedSpecResponseId: patch.confirmedSpecResponseId,
        confirmedSpecAt: patch.confirmedSpecAt,
        confirmedSpecSourceType: patch.confirmedSpecSourceType,
        confirmedSpecSourceData:
          patch.confirmedSpecSourceData === null
            ? Prisma.DbNull
            : (patch.confirmedSpecSourceData as Prisma.InputJsonValue),
      },
    });
    return { id: row.id, version: row.version };
  });
}

export async function rollbackProjectSpecToVersion(params: {
  projectId: string;
  versionId: string;
}): Promise<{ id: string; version: number }> {
  const { projectId, versionId } = params;
  return prisma.$transaction(async (tx) => {
    const row = await tx.projectSpecVersion.findFirst({
      where: { id: versionId, projectId },
    });
    if (!row) {
      throw new Error("SPEC_VERSION_NOT_FOUND");
    }
    await reconcileArchivedStateForActiveSpecVersion(tx, projectId, row.id);
    const patch = projectUpdateDataFromSpecVersionRow(row);
    await tx.project.update({
      where: { id: projectId },
      data: {
        currentSpecVersionId: row.id,
        confirmedSpecMarkdown: patch.confirmedSpecMarkdown,
        confirmedSpecResponseId: patch.confirmedSpecResponseId,
        confirmedSpecAt: patch.confirmedSpecAt,
        confirmedSpecSourceType: patch.confirmedSpecSourceType,
        confirmedSpecSourceData:
          patch.confirmedSpecSourceData === null
            ? Prisma.DbNull
            : (patch.confirmedSpecSourceData as Prisma.InputJsonValue),
      },
    });
    return { id: row.id, version: row.version };
  });
}
