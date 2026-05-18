import { formatReferences, isStaticKnowledgePackId } from "@/lib/knowledge-packs/knowledgePackDbAdapter";
import { createKnowledgePack, type CreateKnowledgePackInput } from "@/lib/knowledge-packs/knowledgePackDbService";
import { getKnowledgePackById } from "@/lib/knowledge-packs/developerKnowledgePacks";
import type { KnowledgePack } from "@/lib/knowledge-packs/types";
import { prisma } from "@/lib/prisma";

export function buildCreateKnowledgePackInputFromStaticSeed(
  pack: KnowledgePack,
  staticSeedId: string
): CreateKnowledgePackInput {
  const prefix = `[Cloned from static seed: ${staticSeedId}]\n\n`;
  const desc = pack.description?.trim() ? `${prefix}${pack.description}` : prefix.trim();

  return {
    scope: "USER",
    category: pack.category,
    name: `${pack.name} - 내 복제본`,
    summary: pack.summary,
    description: desc,
    vendor: pack.vendor ?? "",
    licenseType: pack.license.type,
    status: "DRAFT",
    licenseNotes: [...pack.license.notes],
    agents: [...pack.agents],
    sections: {
      recommendedUseCases: pack.recommendedUseCases.join("\n"),
      notRecommendedUseCases: pack.notRecommendedUseCases.join("\n"),
      capabilities: pack.capabilities.join("\n"),
      constraints: pack.constraints.join("\n"),
      implementationGuidelines: pack.implementationGuidelines.join("\n"),
      cursorPromptRules: pack.cursorPromptRules.join("\n"),
      forbiddenPatterns: pack.forbiddenPatterns.join("\n"),
      reviewChecklist: pack.reviewChecklist.join("\n"),
      securityChecklist: (pack.securityChecklist ?? []).join("\n"),
      alternatives: pack.alternatives.join("\n"),
      references: formatReferences(pack.references),
      previewSpec: pack.previewSpec ?? "",
    },
  };
}

export async function cloneStaticSeedKnowledgePackForUser(
  ownerUserId: string,
  requestedId: string
): Promise<{ ok: true; packId: string; message: string } | { ok: false; message: string; httpStatus: number }> {
  const id = requestedId.trim();
  if (id.startsWith("kp_")) {
    return { ok: false, message: "DB 지식팩은 이 API로 복제할 수 없습니다.", httpStatus: 400 };
  }
  if (!isStaticKnowledgePackId(id)) {
    return { ok: false, message: "정적 시드 지식팩만 복제할 수 있습니다.", httpStatus: 400 };
  }

  const pack = getKnowledgePackById(id);
  if (!pack) {
    return { ok: false, message: "지식팩을 찾을 수 없습니다.", httpStatus: 404 };
  }

  const input = buildCreateKnowledgePackInputFromStaticSeed(pack, id);
  const created = await createKnowledgePack(ownerUserId, input);
  const row = await prisma.kpKnowledgePack.findUnique({
    where: { id: created.id },
    select: { currentVersionId: true },
  });
  await prisma.kpKnowledgePackHistory.create({
    data: {
      knowledgePackId: created.id,
      versionId: row?.currentVersionId ?? null,
      action: "CLONED_FROM_STATIC_SEED",
      actorId: ownerUserId,
      actorType: "USER",
      summary: `정적 시드에서 복제: ${id}`,
    },
  });

  return {
    ok: true,
    packId: created.id,
    message: "사용자 지식팩으로 복제되었습니다.",
  };
}
