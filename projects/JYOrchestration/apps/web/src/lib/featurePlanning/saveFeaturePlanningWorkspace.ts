import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { mergeRequirementsStateJson, parseRequirementsStateJson, type RequirementsStateJson } from "@/lib/requirements/requirementsStateJson";

export async function patchProjectRequirementsStateJson(
  projectId: string,
  patch: Partial<RequirementsStateJson>
): Promise<{ ok: true; merged: RequirementsStateJson } | { ok: false; code: "NOT_FOUND" }> {
  const row = await prisma.project.findUnique({
    where: { id: projectId },
    select: { requirementsStateJson: true },
  });
  if (!row) return { ok: false, code: "NOT_FOUND" };
  const base = parseRequirementsStateJson(row.requirementsStateJson);
  const merged = mergeRequirementsStateJson(base, patch);
  await prisma.project.update({
    where: { id: projectId },
    data: { requirementsStateJson: merged as Prisma.InputJsonValue },
  });
  return { ok: true, merged };
}
