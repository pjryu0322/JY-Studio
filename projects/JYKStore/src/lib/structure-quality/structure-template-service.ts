import { prisma } from "@/lib/prisma";
import {
  getStructureTemplateDefinition,
  STRUCTURE_TEMPLATE_DEFINITIONS,
} from "@/lib/structure-quality/structure-template-definitions";

export async function ensureStructureTemplatesSeeded(): Promise<void> {
  for (const def of STRUCTURE_TEMPLATE_DEFINITIONS) {
    const template = await prisma.knowledgeStructureTemplate.upsert({
      where: { templateKey: def.templateKey },
      create: {
        templateKey: def.templateKey,
        name: def.name,
        description: def.description,
        isActive: true,
      },
      update: {
        name: def.name,
        description: def.description,
        isActive: true,
      },
    });

    for (const section of def.sections) {
      await prisma.knowledgeStructureSection.upsert({
        where: {
          templateId_sectionKey: {
            templateId: template.id,
            sectionKey: section.sectionKey,
          },
        },
        create: {
          templateId: template.id,
          sectionKey: section.sectionKey,
          title: section.title,
          description: section.description,
          required: section.required,
          weight: section.weight,
          sourceTypes: section.sourceTypes,
          keywords: section.keywords,
          sortOrder: section.sortOrder,
        },
        update: {
          title: section.title,
          description: section.description,
          required: section.required,
          weight: section.weight,
          sourceTypes: section.sourceTypes,
          keywords: section.keywords,
          sortOrder: section.sortOrder,
        },
      });
    }
  }
}

export async function getStructureTemplateWithSections(templateKey: string) {
  await ensureStructureTemplatesSeeded();
  const template = await prisma.knowledgeStructureTemplate.findUnique({
    where: { templateKey },
    include: {
      sections: { orderBy: { sortOrder: "asc" } },
    },
  });

  if (template) {
    return template;
  }

  const fallback = getStructureTemplateDefinition(templateKey);
  if (!fallback) {
    return null;
  }

  return {
    templateKey: fallback.templateKey,
    name: fallback.name,
    description: fallback.description,
    sections: fallback.sections.map((s) => ({
      sectionKey: s.sectionKey,
      title: s.title,
      description: s.description,
      required: s.required,
      weight: s.weight,
      sourceTypes: s.sourceTypes,
      keywords: s.keywords,
      sortOrder: s.sortOrder,
    })),
  };
}
