import type { OpenApiDocument } from "@/lib/openapi-dto";
import { buildOpenApiSchema } from "@/lib/openapi-schema-service";
import { loadPublicKnowledgePack } from "./export-shared";

// public openapi export: PUBLISHED/VERIFIED pack만 허용한다. 비공개 pack이면 null(404).
export async function buildPackOpenApiExport(packId: string): Promise<OpenApiDocument | null> {
  const pack = await loadPublicKnowledgePack(packId, {
    packId: true,
    name: true,
    shortDescription: true,
  });
  if (!pack) return null;

  return buildOpenApiSchema({
    packId: pack.packId,
    packName: pack.name,
    packDescription: pack.shortDescription,
  });
}
