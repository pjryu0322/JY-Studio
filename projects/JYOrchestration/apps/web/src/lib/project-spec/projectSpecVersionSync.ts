import type { Prisma } from "@prisma/client";

export type SpecVersionRowLike = {
  markdown: string;
  sourceType: string;
  sourceData: Prisma.JsonValue | null;
  createdAt: Date;
};

/**
 * project_spec_versions 행을 projects.confirmedSpec* 비정규화 필드로 반영한다.
 */
export function projectUpdateDataFromSpecVersionRow(v: SpecVersionRowLike): {
  confirmedSpecMarkdown: string;
  confirmedSpecResponseId: string | null;
  confirmedSpecAt: Date;
  confirmedSpecSourceType: string;
  confirmedSpecSourceData: Prisma.JsonValue | null;
} {
  const sd = v.sourceData;
  let responseId: string | null = null;
  if (v.sourceType === "RESPONSE" && sd && typeof sd === "object" && !Array.isArray(sd)) {
    const rid = (sd as Record<string, unknown>).responseId;
    if (typeof rid === "string" && rid.trim()) {
      responseId = rid.trim();
    }
  }
  return {
    confirmedSpecMarkdown: v.markdown,
    confirmedSpecResponseId: responseId,
    confirmedSpecAt: v.createdAt,
    confirmedSpecSourceType: v.sourceType,
    confirmedSpecSourceData: sd,
  };
}
